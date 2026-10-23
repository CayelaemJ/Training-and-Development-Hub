using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace CABO.Native;

public record NativeMaterialSummary(int Id, string Title);
public record NativeMaterialPage(int Id, string Title, string Text, int Offset, int? NextOffset);

public record NativeQuizSummary(int Id, string Title, int QuestionCount, double? LatestScore);
public record NativeQuizQuestion(string Prompt, IReadOnlyList<string> Options);
public record NativeQuizDetail(int Id, string Title, IReadOnlyList<NativeQuizQuestion> Questions);
public record NativeQuizFeedback(int QuestionIndex, bool IsCorrect, string Explanation);
public record NativeQuizAttempt(int Id, int QuizId, int CorrectCount, int TotalQuestions,
    double Percentage, IReadOnlyList<NativeQuizFeedback> Feedback);

public record NativeDashboard(
    string Role,
    IReadOnlyList<string> Summary,
    IReadOnlyList<string> Materials,
    IReadOnlyList<NativeMaterialSummary> MaterialEntries,
    IReadOnlyList<string> Quizzes,
    IReadOnlyList<string> Organizations,
    IReadOnlyList<NativeQuizSummary> QuizEntries,
    IReadOnlyList<string> LearnerReports
);

// Windows uses a loopback RFC8252 authorization-code handoff with PKCE.
// Never embed passwords, AI provider secrets or school records in this app.
public sealed class NativeLearningService
{
    // The normal Windows app always uses the approved browser sign-in.
    // An isolated password pilot requires a separate, explicit test compilation.
    private static readonly Uri Origin = ResolveOrigin();
    private static Uri ResolveOrigin()
    {
        var publicOrigin = new Uri("https://cabo-learning-hub-pilot.onrender.com/");
#if CABO_ISOLATED_TEST
        var candidate = Environment.GetEnvironmentVariable("CABO_ISOLATED_TEST_ORIGIN");
        if (Uri.TryCreate(candidate, UriKind.Absolute, out var url) &&
            url.Scheme == Uri.UriSchemeHttps &&
            url.Host != publicOrigin.Host && url.UserInfo.Length == 0 &&
            url.AbsolutePath == "/" && url.Query.Length == 0 &&
            url.Fragment.Length == 0) return url;
#endif
        return publicOrigin;
    }
    public bool TestLoginEnabled
    {
        get
        {
#if CABO_ISOLATED_TEST
            return Origin.Host != "cabo-learning-hub-pilot.onrender.com";
#else
            return false;
#endif
        }
    }
    private static readonly Uri Callback = new("http://127.0.0.1:47787/auth");
    private static readonly HttpClient Http = new() { BaseAddress = Origin, Timeout = TimeSpan.FromSeconds(15) };
    private readonly string tokenFile = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "CABO", "LearningHub", "native-session.bin");
    private string? token;

    public NativeLearningService() => token = RestoreToken();

    public bool HasSession => !string.IsNullOrEmpty(token);

    private static string UrlSafe(byte[] value) =>
        Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private string? RestoreToken()
    {
        try {
            if (!File.Exists(tokenFile)) return null;
            var data = ProtectedData.Unprotect(File.ReadAllBytes(tokenFile),
                optionalEntropy: null, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(data);
        } catch (Exception) { return null; }
    }

    private void SaveToken(string accessToken)
    {
        var encrypted = ProtectedData.Protect(Encoding.UTF8.GetBytes(accessToken),
            optionalEntropy: null, DataProtectionScope.CurrentUser);
        Directory.CreateDirectory(Path.GetDirectoryName(tokenFile)!);
        var temp = tokenFile + ".tmp";
        File.WriteAllBytes(temp, encrypted);
        File.Move(temp, tokenFile, overwrite: true);
        token = accessToken;
    }

    private void ClearToken()
    {
        token = null;
        try { if (File.Exists(tokenFile)) File.Delete(tokenFile); }
        catch (IOException) { /* Server session still expires within an hour. */ }
    }

    private static string? QueryParam(Uri uri, string key)
    {
        foreach (var segment in uri.Query.TrimStart('?').Split('&',
                     StringSplitOptions.RemoveEmptyEntries)) {
            var pair = segment.Split('=', 2);
            if (Uri.UnescapeDataString(pair[0]) == key)
                return pair.Length > 1 ? Uri.UnescapeDataString(pair[1].Replace("+", " ")) : "";
        }
        return null;
    }

    public async Task SignInAsync(CancellationToken cancellation)
    {
        var verifier = UrlSafe(RandomNumberGenerator.GetBytes(32));
        var state = UrlSafe(RandomNumberGenerator.GetBytes(32));
        var challenge = UrlSafe(SHA256.HashData(Encoding.UTF8.GetBytes(verifier)));
        var authorize = new Uri(Origin,
            "api/native/authorize?client_id=cabo-windows&code_challenge=" +
            Uri.EscapeDataString(challenge) + "&code_challenge_method=S256&state=" +
            Uri.EscapeDataString(state));

        // Bind to exact loopback IP first; a pre-existing port occupant fails closed.
        using var listener = new TcpListener(IPAddress.Loopback, Callback.Port);
        listener.Start(1);
        Process.Start(new ProcessStartInfo(authorize.ToString()) { UseShellExecute = true });

        using var incoming = await listener.AcceptTcpClientAsync(cancellation);
        await using var stream = incoming.GetStream();
        using var reader = new StreamReader(stream, Encoding.ASCII, false, 1024, leaveOpen: true);
        var line = await reader.ReadLineAsync(cancellation);
        if (line is null || !line.StartsWith("GET /auth?", StringComparison.Ordinal) ||
            line.Length > 4096) throw new InvalidOperationException("Unexpected sign-in callback.");

        // Drain small request headers, without echoing codes/state to logs or UI.
        for (var i = 0; i < 48; i++) {
            var header = await reader.ReadLineAsync(cancellation);
            if (header is null || header.Length == 0) break;
            if (header.Length > 4096) throw new InvalidOperationException("Oversized callback header.");
        }
        var responseBody = "Return to the CABO Learning Hub desktop app to finish signing in.";
        var data = Encoding.UTF8.GetBytes(responseBody);
        var headers = Encoding.ASCII.GetBytes(
            $"HTTP/1.1 200 OK\r\nContent-Type: text/plain; charset=utf-8\r\n" +
            $"Cache-Control: no-store\r\nContent-Length: {data.Length}\r\nConnection: close\r\n\r\n");
        await stream.WriteAsync(headers, cancellation);
        await stream.WriteAsync(data, cancellation);

        var path = line.Split(' ')[1];
        var redirected = new Uri(Callback.GetLeftPart(UriPartial.Authority) + path);
        var returnedState = QueryParam(redirected, "state");
        var code = QueryParam(redirected, "code");
        if (returnedState != state || string.IsNullOrEmpty(code) ||
            !System.Text.RegularExpressions.Regex.IsMatch(code, "^[A-Za-z0-9_-]{43}$"))
            throw new InvalidOperationException("Sign-in state or code verification failed.");

        using var result = await Http.PostAsJsonAsync("api/native/token", new {
            client_id = "cabo-windows", code, code_verifier = verifier
        }, cancellation);
        if (!result.IsSuccessStatusCode)
            throw new InvalidOperationException("CABO did not accept the sign-in.");
        using var json = await JsonDocument.ParseAsync(await result.Content.ReadAsStreamAsync(cancellation),
            cancellationToken: cancellation);
        var root = json.RootElement;
        if (root.GetProperty("token_type").GetString() != "Bearer" ||
            root.GetProperty("expires_in").GetInt32() is < 1 or > 3600)
            throw new InvalidOperationException("Unexpected native session response.");
        var nextToken = root.GetProperty("access_token").GetString();
        if (string.IsNullOrWhiteSpace(nextToken) || nextToken.Length < 32)
            throw new InvalidOperationException("Invalid native token.");
        SaveToken(nextToken);
    }

    public async Task SignInTestAsync(string username, string password,
        CancellationToken cancellation)
    {
        if (!TestLoginEnabled || username != "cabo_test" || password.Length < 12)
            throw new UnauthorizedAccessException("Test mode is not available.");
        // The password is sent once to the isolated HTTPS server and never
        // written to DPAPI storage. Only the expiring bearer token is saved.
        using var response = await Http.PostAsJsonAsync("api/native/test-login",
            new { username, password }, cancellation);
        if (!response.IsSuccessStatusCode)
            throw new UnauthorizedAccessException("CABO test login was not accepted.");
        using var json = await JsonDocument.ParseAsync(
            await response.Content.ReadAsStreamAsync(cancellation),
            cancellationToken: cancellation);
        var root = json.RootElement;
        if (root.GetProperty("token_type").GetString() != "Bearer" ||
            root.GetProperty("expires_in").GetInt32() is < 1 or > 3600)
            throw new UnauthorizedAccessException("Unexpected test session.");
        var nextToken = root.GetProperty("access_token").GetString();
        if (nextToken is null || nextToken.Length < 32)
            throw new UnauthorizedAccessException("Invalid token.");
        SaveToken(nextToken);
    }

    private async Task<JsonDocument> FetchAsync(string path, CancellationToken cancellation)
    {
        if (string.IsNullOrEmpty(token)) throw new UnauthorizedAccessException("Sign-in required.");
        using var message = new HttpRequestMessage(HttpMethod.Get, path);
        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var response = await Http.SendAsync(message, cancellation);
        if (response.StatusCode == HttpStatusCode.Unauthorized) {
            ClearToken();
            throw new UnauthorizedAccessException("Session expired. Sign in again.");
        }
        response.EnsureSuccessStatusCode();
        return await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellation),
            cancellationToken: cancellation);
    }

    private static NativeQuizAttempt ParseAttempt(JsonElement root, int quizId)
    {
        if (root.GetProperty("quizId").GetInt32() != quizId)
            throw new InvalidOperationException("Unexpected assessment result.");
        var feedback = root.GetProperty("feedback").EnumerateArray().Select(f =>
            new NativeQuizFeedback(f.GetProperty("questionIndex").GetInt32(),
                f.GetProperty("isCorrect").GetBoolean(),
                f.GetProperty("explanation").GetString() ?? "")).ToArray();
        return new NativeQuizAttempt(
            root.GetProperty("id").GetInt32(), quizId,
            root.GetProperty("correctCount").GetInt32(),
            root.GetProperty("totalQuestions").GetInt32(),
            root.GetProperty("percentage").GetDouble(), feedback);
    }

    public async Task<NativeMaterialPage> ReadMaterialAsync(int id, int offset,
        CancellationToken cancellation)
    {
        if (id <= 0 || offset < 0 || offset > 2_000_000)
            throw new ArgumentException("Invalid material reading position.");
        using var json = await FetchAsync($"api/materials/{id}/preview?offset={offset}",
            cancellation);
        var root = json.RootElement;
        var returnedId = root.GetProperty("id").GetInt32();
        var returnedOffset = root.GetProperty("offset").GetInt32();
        if (returnedId != id || returnedOffset != offset)
            throw new InvalidOperationException("Mismatched material position.");
        var body = root.GetProperty("text").GetString() ?? "";
        var marker = root.GetProperty("nextOffset");
        int? nextOffset = marker.ValueKind == JsonValueKind.Null
            ? null : marker.GetInt32();
        if (body.Length > 16_000 || (nextOffset is not null && nextOffset <= offset))
            throw new InvalidOperationException("Invalid material page.");
        return new NativeMaterialPage(id, root.GetProperty("title").GetString() ??
            "Study material", body, offset, nextOffset);
    }

    public async Task<NativeQuizDetail> OpenQuizAsync(int quizId, CancellationToken cancellation)
    {
        if (quizId <= 0) throw new ArgumentOutOfRangeException(nameof(quizId));
        using var result = await FetchAsync($"api/quizzes/{quizId}", cancellation);
        var root = result.RootElement;
        if (root.GetProperty("id").GetInt32() != quizId)
            throw new InvalidOperationException("Unexpected quiz.");
        var questions = root.GetProperty("questions").EnumerateArray().Select(q =>
            new NativeQuizQuestion(q.GetProperty("prompt").GetString() ?? "",
                q.GetProperty("options").EnumerateArray()
                    .Select(o => o.GetString() ?? "").ToArray())).ToArray();
        if (questions.Length == 0 || questions.Any(q => q.Options.Count == 0))
            throw new InvalidOperationException("Incomplete assessment.");
        return new NativeQuizDetail(quizId, root.GetProperty("title").GetString() ?? "Practice test", questions);
    }

    public async Task<NativeQuizAttempt> SubmitQuizAsync(
        int quizId, IReadOnlyList<int> answers, string requestKey, CancellationToken cancellation)
    {
        if (quizId <= 0 || answers.Count == 0 || answers.Any(v => v < 0) ||
            !System.Text.RegularExpressions.Regex.IsMatch(requestKey, "^[A-Za-z0-9_-]{16,64}$"))
            throw new ArgumentException("Invalid assessment submission.");
        if (string.IsNullOrEmpty(token)) throw new UnauthorizedAccessException("Sign-in required.");
        using var request = new HttpRequestMessage(HttpMethod.Post, $"api/quizzes/{quizId}/attempts");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Headers.Add("Idempotency-Key", requestKey);
        request.Content = JsonContent.Create(new { answers });
        using var response = await Http.SendAsync(request, cancellation);
        if (response.StatusCode == HttpStatusCode.Unauthorized) {
            ClearToken();
            throw new UnauthorizedAccessException("Session expired.");
        }
        response.EnsureSuccessStatusCode();
        using var result = await JsonDocument.ParseAsync(
            await response.Content.ReadAsStreamAsync(cancellation), cancellationToken: cancellation);
        return ParseAttempt(result.RootElement, quizId);
    }

    // A lost response is NOT retried as a POST: query the persisted attempt.
    public async Task<NativeQuizAttempt> CheckQuizSubmissionAsync(
        int quizId, string requestKey, CancellationToken cancellation)
    {
        if (quizId <= 0 || !System.Text.RegularExpressions.Regex.IsMatch(
            requestKey, "^[A-Za-z0-9_-]{16,64}$")) throw new ArgumentException("Invalid request.");
        using var result = await FetchAsync(
            $"api/quizzes/{quizId}/attempts/by-key/{Uri.EscapeDataString(requestKey)}", cancellation);
        return ParseAttempt(result.RootElement, quizId);
    }

    public async Task<NativeDashboard> DashboardAsync(CancellationToken cancellation)
    {
        using var portal = await FetchAsync("api/portal/me", cancellation);
        var root = portal.RootElement;
        var role = root.GetProperty("role").GetString() ?? "learner";
        var summary = new List<string>();
        if (root.TryGetProperty("summary", out var totals) &&
            totals.ValueKind == JsonValueKind.Object)
            foreach (var item in totals.EnumerateObject())
                summary.Add($"{item.Name}: {item.Value}");

        var materials = new List<string>();
        var materialEntries = new List<NativeMaterialSummary>();
        var quizzes = new List<string>();
        var organizations = new List<string>();
        var quizEntries = new List<NativeQuizSummary>();
        var learnerReports = new List<string>();
        if (role == "superadmin") {
            // Audited, privileged endpoint; never assume role solely from UI state.
            using var registry = await FetchAsync("api/platform/overview", cancellation);
            if (registry.RootElement.TryGetProperty("organizations", out var names) &&
                names.ValueKind == JsonValueKind.Array)
                organizations.AddRange(names.EnumerateArray().Take(100)
                    .Select(v => v.TryGetProperty("name", out var n) ? n.GetString() : null)
                    .Where(v => !string.IsNullOrWhiteSpace(v))!);
        } else if (role == "learner") {
            // Learner ID always comes from the bearer token: the device never
            // passes another person's ID to the self-report endpoint.
            if (root.TryGetProperty("organizationIds", out var ids) &&
                ids.ValueKind == JsonValueKind.Array) {
                foreach (var org in ids.EnumerateArray().Take(5)) {
                    if (org.ValueKind != JsonValueKind.Number) continue;
                    var id = org.GetInt32();
                    if (id <= 0) continue;
                    try {
                        using var report = await FetchAsync(
                            $"api/reports/me?organizationId={id}&year={DateTime.UtcNow.Year}",
                            cancellation);
                        var value = report.RootElement;
                        var year = value.GetProperty("year").GetInt32();
                        var grade = value.GetProperty("grade").GetString() ?? "";
                        learnerReports.Add($"Institution {id} · {grade} · {year} · Draft progress");
                        if (value.TryGetProperty("average", out var average) &&
                            average.ValueKind == JsonValueKind.Number)
                            learnerReports.Add($"Published average: {average.GetDouble():0.#}%");
                        if (value.TryGetProperty("attendance", out var attendance) &&
                            attendance.TryGetProperty("rate", out var rate) &&
                            rate.ValueKind == JsonValueKind.Number)
                            learnerReports.Add($"Attendance: {rate.GetInt32()}%");
                        if (value.TryGetProperty("subjects", out var subjects) &&
                            subjects.ValueKind == JsonValueKind.Array)
                            foreach (var subject in subjects.EnumerateArray().Take(20)) {
                                var name = subject.GetProperty("name").GetString() ?? "Subject";
                                var percentage = subject.GetProperty("percentage").GetDouble();
                                learnerReports.Add($"{name}: {percentage:0.#}%");
                            }
                        learnerReports.Add("Draft preview; not an officially issued report card.");
                    } catch (UnauthorizedAccessException) {
                        throw;
                    } catch (Exception) {
                        // No enrolment or published grades is not fabricated as a 0%.
                    }
                }
            }
            using var materialResult = await FetchAsync("api/materials", cancellation);
            if (materialResult.RootElement.ValueKind == JsonValueKind.Array) {
                foreach (var row in materialResult.RootElement.EnumerateArray().Take(30)) {
                    var id = row.GetProperty("id").GetInt32();
                    var title = row.GetProperty("title").GetString() ?? "Study material";
                    if (id > 0) {
                        materialEntries.Add(new NativeMaterialSummary(id, title));
                        materials.Add(title);
                    }
                }
            }
            using var quizResult = await FetchAsync("api/quizzes", cancellation);
            if (quizResult.RootElement.ValueKind == JsonValueKind.Array) {
                foreach (var v in quizResult.RootElement.EnumerateArray().Take(30)) {
                    var id = v.GetProperty("id").GetInt32();
                    var title = v.GetProperty("title").GetString() ?? "Practice test";
                    var count = v.GetProperty("questionCount").GetInt32();
                    double? lastScore = v.TryGetProperty("latestScore", out var score) &&
                        score.ValueKind == JsonValueKind.Number ? score.GetDouble() : null;
                    if (id > 0) {
                        quizEntries.Add(new NativeQuizSummary(id, title, count, lastScore));
                        quizzes.Add(title);
                    }
                }
            }
        }
        return new NativeDashboard(role, summary, materials, materialEntries, quizzes, organizations, quizEntries, learnerReports);
    }

    public async Task SignOutAsync(CancellationToken cancellation)
    {
        if (!string.IsNullOrEmpty(token)) {
            try {
                using var message = new HttpRequestMessage(HttpMethod.Post, "api/native/logout");
                message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
                using var _ = await Http.SendAsync(message, cancellation);
            } catch (Exception) { /* Offline sign-out clears local DPAPI credentials. */ }
        }
        ClearToken();
    }
}
