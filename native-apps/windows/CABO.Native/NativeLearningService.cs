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

public record NativeDashboard(
    string Role,
    IReadOnlyList<string> Summary,
    IReadOnlyList<string> Materials,
    IReadOnlyList<string> Quizzes,
    IReadOnlyList<string> Organizations
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
        var quizzes = new List<string>();
        var organizations = new List<string>();
        if (role == "superadmin") {
            // Audited, privileged endpoint; never assume role solely from UI state.
            using var registry = await FetchAsync("api/platform/overview", cancellation);
            if (registry.RootElement.TryGetProperty("organizations", out var names) &&
                names.ValueKind == JsonValueKind.Array)
                organizations.AddRange(names.EnumerateArray().Take(100)
                    .Select(v => v.TryGetProperty("name", out var n) ? n.GetString() : null)
                    .Where(v => !string.IsNullOrWhiteSpace(v))!);
        } else if (role == "learner") {
            using var materialResult = await FetchAsync("api/materials", cancellation);
            if (materialResult.RootElement.ValueKind == JsonValueKind.Array)
                materials.AddRange(materialResult.RootElement.EnumerateArray().Take(30)
                    .Select(v => v.GetProperty("title").GetString() ?? ""));
            using var quizResult = await FetchAsync("api/quizzes", cancellation);
            if (quizResult.RootElement.ValueKind == JsonValueKind.Array)
                quizzes.AddRange(quizResult.RootElement.EnumerateArray().Take(30)
                    .Select(v => v.GetProperty("title").GetString() ?? ""));
        }
        return new NativeDashboard(role, summary, materials, quizzes, organizations);
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
