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
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace CABO.Native;

/// <summary>
/// Windows client for the existing CABO Learning Hub API.
///
/// Security model:
/// * Sign-in is the RFC 8252 loopback authorization-code flow with PKCE S256
///   in the system browser; the app never sees the user's password.
/// * The only thing persisted is the one-hour CABO bearer session, encrypted
///   with DPAPI for the current Windows user. No refresh token, learner record
///   or AI secret is stored on the device.
/// * Every request is authorised by the server from that bearer session. The
///   client never sends another person's user ID or a role claim.
/// * Cookies and redirects are disabled so the bearer cannot be replayed to
///   another host and no browser session leaks into the API client.
/// </summary>
public sealed partial class NativeLearningService : IDisposable
{
    public const string ClientId = "cabo-windows";
    public const string PilotHost = "cabo-learning-hub-pilot.onrender.com";
    public static readonly Uri Callback = new("http://127.0.0.1:47787/auth");
    private const int MaxParallelOrganizations = 4;
    private const int MaxOrganizations = 12;
    private const long MaxResponseBytes = 8 * 1024 * 1024;

    private readonly HttpClient http;
    private readonly ISessionStore store;
    private readonly Func<DateTimeOffset> clock;
    private readonly Action<Uri> openBrowser;
    private readonly bool testLoginEnabled;
    private readonly object sessionLock = new();
    private NativeSession? session;
    private IReadOnlyList<OrganizationMembership>? membershipCache;

    /// <summary>Raised (possibly off the UI thread) when the server rejects the session.</summary>
    public event EventHandler? SessionEnded;

    public Uri Origin { get; }

    public NativeLearningService()
        : this(CreateHandler(), new DpapiSessionStore(), ResolveOrigin(), null, null, null) { }

    internal NativeLearningService(HttpMessageHandler handler, ISessionStore store, Uri origin,
        Func<DateTimeOffset>? clock, Action<Uri>? openBrowser, bool? testLoginEnabled)
    {
        if (origin.Scheme != Uri.UriSchemeHttps && !origin.IsLoopback)
            throw new ArgumentException("CABO must be reached over HTTPS.", nameof(origin));
        Origin = origin;
        this.store = store;
        this.clock = clock ?? (() => DateTimeOffset.UtcNow);
        this.openBrowser = openBrowser ?? new Action<Uri>(OpenSystemBrowser);
        this.testLoginEnabled = testLoginEnabled ?? DefaultTestLoginEnabled(origin);
        http = new HttpClient(handler, disposeHandler: true)
        {
            BaseAddress = origin,
            Timeout = TimeSpan.FromSeconds(20),
            MaxResponseContentBufferSize = MaxResponseBytes
        };
        http.DefaultRequestHeaders.TryAddWithoutValidation("X-CABO-Client", "windows");
        http.DefaultRequestHeaders.TryAddWithoutValidation("X-CABO-Client-Version", AppVersion);
        try { session = store.Load(); }
        catch (Exception) { session = null; }
    }

    public static string AppVersion =>
        typeof(NativeLearningService).Assembly.GetName().Version?.ToString(3) ?? "1.0.0";

    private static SocketsHttpHandler CreateHandler() => new()
    {
        AllowAutoRedirect = false,
        UseCookies = false,
        AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate | DecompressionMethods.Brotli,
        PooledConnectionLifetime = TimeSpan.FromMinutes(5),
        // TLS versions are left to Windows (TLS 1.2+ on supported builds); pinning
        // TLS 1.3 breaks Windows 10 builds that do not support it.
        ConnectTimeout = TimeSpan.FromSeconds(10)
    };

    // The normal Windows app always uses the approved pilot origin and browser
    // sign-in. A password pilot needs a separate test compilation AND an
    // explicitly configured non-pilot HTTPS origin.
    internal static Uri ResolveOrigin()
    {
        var pilot = new Uri("https://" + PilotHost + "/");
#if CABO_ISOLATED_TEST
        var candidate = Environment.GetEnvironmentVariable("CABO_ISOLATED_TEST_ORIGIN");
        if (Uri.TryCreate(candidate, UriKind.Absolute, out var url) &&
            url.Scheme == Uri.UriSchemeHttps &&
            url.Host != pilot.Host && url.UserInfo.Length == 0 &&
            url.AbsolutePath == "/" && url.Query.Length == 0 &&
            url.Fragment.Length == 0) return url;
#endif
        return pilot;
    }

    private static bool DefaultTestLoginEnabled(Uri origin)
    {
#if CABO_ISOLATED_TEST
        return origin.Host != PilotHost;
#else
        _ = origin;
        return false;
#endif
    }

    public bool TestLoginEnabled => testLoginEnabled;

    public bool HasSession
    {
        get
        {
            var current = session;
            return current is not null &&
                   (current.ExpiresAt is null || current.ExpiresAt > clock().AddSeconds(30));
        }
    }

    public DateTimeOffset? SessionExpiresAt => session?.ExpiresAt;

    public void Dispose() => http.Dispose();

    // ------------------------------------------------------------------ auth

    private static string UrlSafe(byte[] value) =>
        Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static void OpenSystemBrowser(Uri url)
    {
        if (url.Scheme != Uri.UriSchemeHttps && !url.IsLoopback)
            throw new InvalidOperationException("Refusing to open a non-HTTPS sign-in page.");
        Process.Start(new ProcessStartInfo(url.AbsoluteUri) { UseShellExecute = true });
    }

    internal static (string Verifier, string Challenge, string State) NewPkce()
    {
        var verifier = UrlSafe(RandomNumberGenerator.GetBytes(32));
        var challenge = UrlSafe(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)));
        var state = UrlSafe(RandomNumberGenerator.GetBytes(32));
        return (verifier, challenge, state);
    }

    /// <summary>Opens the system browser and completes PKCE sign-in via the loopback callback.</summary>
    public async Task SignInAsync(CancellationToken cancellation)
    {
        var (verifier, challenge, state) = NewPkce();
        var authorize = new Uri(Origin,
            "api/native/authorize?client_id=" + ClientId +
            "&code_challenge=" + Uri.EscapeDataString(challenge) +
            "&code_challenge_method=S256&state=" + Uri.EscapeDataString(state));

        // Bind the exact loopback IP before opening the browser. Exclusive use
        // stops another local process from sharing the port to steal the code.
        using var listener = new TcpListener(IPAddress.Loopback, Callback.Port);
        if (OperatingSystem.IsWindows()) listener.ExclusiveAddressUse = true;
        try { listener.Start(4); }
        catch (SocketException error)
        {
            throw new InvalidOperationException(
                "The local sign-in port is in use. Close other CABO windows and try again.", error);
        }

        try
        {
            openBrowser(authorize);
            string? code = null;
            // Browsers may probe /favicon.ico or retry; a bounded number of
            // unrelated connections is tolerated, never their contents.
            for (var attempt = 0; attempt < 12 && code is null; attempt++)
            {
                using var client = await listener.AcceptTcpClientAsync(cancellation).ConfigureAwait(false);
                code = await HandleCallbackAsync(client, state, cancellation).ConfigureAwait(false);
            }
            if (code is null) throw new InvalidOperationException("No valid sign-in callback was received.");
            await ExchangeCodeAsync(code, verifier, cancellation).ConfigureAwait(false);
        }
        finally
        {
            listener.Stop();
        }
    }

    private static async Task<string?> HandleCallbackAsync(TcpClient client, string state, CancellationToken cancellation)
    {
        using var perConnection = CancellationTokenSource.CreateLinkedTokenSource(cancellation);
        perConnection.CancelAfter(TimeSpan.FromSeconds(10));
        var token = perConnection.Token;
        await using var stream = client.GetStream();
        using var reader = new StreamReader(stream, Encoding.ASCII, false, 1024, leaveOpen: true);

        string? line;
        try
        {
            line = await ReadBoundedLineAsync(reader, token).ConfigureAwait(false);
            for (var i = 0; i < 48; i++)
            {
                var header = await ReadBoundedLineAsync(reader, token).ConfigureAwait(false);
                if (string.IsNullOrEmpty(header)) break;
            }
        }
        catch (Exception) when (!cancellation.IsCancellationRequested)
        {
            // A slow, silent or oversized local connection is dropped; keep waiting.
            return null;
        }

        var result = LoopbackCallback.Evaluate(line, state);
        switch (result.Outcome)
        {
            case CallbackOutcome.Success:
                await stream.WriteAsync(LoopbackCallback.HttpResponse(200,
                    "Signed in. Return to the CABO Learning Hub app. You can close this tab."), token).ConfigureAwait(false);
                return result.Code;
            case CallbackOutcome.Denied:
                await stream.WriteAsync(LoopbackCallback.HttpResponse(200,
                    "Sign-in was cancelled. Return to the CABO Learning Hub app."), token).ConfigureAwait(false);
                throw new NativeSignInCancelledException();
            case CallbackOutcome.Invalid:
                await stream.WriteAsync(LoopbackCallback.HttpResponse(400,
                    "Sign-in could not be verified. Return to the app and try again."), token).ConfigureAwait(false);
                throw new InvalidOperationException("Sign-in code verification failed.");
            case CallbackOutcome.Foreign:
                await stream.WriteAsync(LoopbackCallback.HttpResponse(400, "Unexpected request."), token).ConfigureAwait(false);
                return null;
            default:
                await stream.WriteAsync(LoopbackCallback.HttpResponse(404, "Not found."), token).ConfigureAwait(false);
                return null;
        }
    }

    internal static async Task<string?> ReadBoundedLineAsync(StreamReader reader, CancellationToken cancellation)
    {
        var builder = new StringBuilder();
        var buffer = new char[1];
        while (true)
        {
            var read = await reader.ReadAsync(buffer.AsMemory(), cancellation).ConfigureAwait(false);
            if (read == 0) return builder.Length == 0 ? null : builder.ToString();
            if (buffer[0] == '\n')
            {
                if (builder.Length > 0 && builder[^1] == '\r') builder.Length--;
                return builder.ToString();
            }
            builder.Append(buffer[0]);
            if (builder.Length > LoopbackCallback.MaxLineLength)
                throw new InvalidDataException("Oversized callback line.");
        }
    }

    private async Task ExchangeCodeAsync(string code, string verifier, CancellationToken cancellation)
    {
        using var json = await SendAsync(HttpMethod.Post, "api/native/token",
            new { client_id = ClientId, code, code_verifier = verifier },
            cancellation, auth: false).ConfigureAwait(false);
        AcceptSession(json.RootElement);
    }

    internal void AcceptSession(JsonElement root)
    {
        var type = NativeJson.Str(root, "token_type", 20);
        var expiresIn = NativeJson.Int(root, "expires_in");
        var token = NativeJson.Str(root, "access_token", 600);
        if (type != "Bearer" || expiresIn is < 1 or > 3600 || token.Length is < 32 or > 512)
            throw new InvalidOperationException("Unexpected native session response.");
        var next = new NativeSession(token, clock().AddSeconds(expiresIn));
        lock (sessionLock)
        {
            membershipCache = null;
            session = next;
        }
        try { store.Save(next); }
        catch (Exception)
        {
            // Without secure storage the session lives only in memory for this run.
        }
    }

    public async Task SignInTestAsync(string username, string password, CancellationToken cancellation)
    {
        if (!TestLoginEnabled || username != "cabo_test" || password.Length is < 12 or > 200)
            throw new UnauthorizedAccessException("Test mode is not available.");
        // The password goes once to the isolated HTTPS server and is never
        // written anywhere. Only the expiring bearer session is saved.
        using var json = await SendAsync(HttpMethod.Post, "api/native/test-login",
            new { username, password }, cancellation, auth: false).ConfigureAwait(false);
        AcceptSession(json.RootElement);
    }

    public async Task SignOutAsync(CancellationToken cancellation)
    {
        var current = session;
        if (current is not null)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, "api/native/logout");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", current.AccessToken);
                using var _ = await http.SendAsync(request, cancellation).ConfigureAwait(false);
            }
            catch (Exception)
            {
                // Offline sign-out still removes the local DPAPI session.
            }
        }
        ClearLocalSession();
    }

    private void ClearLocalSession()
    {
        lock (sessionLock)
        {
            session = null;
            membershipCache = null;
        }
        try { store.Clear(); } catch (Exception) { }
    }

    private void EndSession()
    {
        var hadSession = session is not null;
        ClearLocalSession();
        if (hadSession) SessionEnded?.Invoke(this, EventArgs.Empty);
    }

    private string RequireToken()
    {
        var current = session;
        if (current is null) throw new UnauthorizedAccessException("Sign-in required.");
        if (current.ExpiresAt is { } expires && expires <= clock())
        {
            EndSession();
            throw new UnauthorizedAccessException("Session expired.");
        }
        return current.AccessToken;
    }

    // -------------------------------------------------------------- transport

    /// <summary>
    /// Sends one request. GETs are retried once for transient network or
    /// gateway failures; POST/PATCH are never retried automatically so a lost
    /// response cannot create a duplicate submission.
    /// </summary>
    internal async Task<JsonDocument> SendAsync(HttpMethod method, string path, object? body,
        CancellationToken cancellation, string? idempotencyKey = null, bool auth = true)
    {
        if (path.StartsWith("/", StringComparison.Ordinal) || path.Contains("://", StringComparison.Ordinal) ||
            path.Contains("..", StringComparison.Ordinal))
            throw new ArgumentException("API paths must be relative to the CABO origin.", nameof(path));

        var maxAttempts = method == HttpMethod.Get ? 2 : 1;
        for (var attempt = 1; ; attempt++)
        {
            using var request = new HttpRequestMessage(method, path);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            if (auth) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", RequireToken());
            if (idempotencyKey is not null) request.Headers.TryAddWithoutValidation("Idempotency-Key", idempotencyKey);
            if (body is not null) request.Content = JsonContent.Create(body, body.GetType());

            HttpResponseMessage response;
            try
            {
                response = await http.SendAsync(request, HttpCompletionOption.ResponseContentRead, cancellation)
                    .ConfigureAwait(false);
            }
            catch (HttpRequestException error)
            {
                if (attempt < maxAttempts) { await Backoff(attempt, cancellation).ConfigureAwait(false); continue; }
                throw new NativeOfflineException("CABO could not be reached.", error);
            }
            catch (TaskCanceledException error) when (!cancellation.IsCancellationRequested)
            {
                if (attempt < maxAttempts) { await Backoff(attempt, cancellation).ConfigureAwait(false); continue; }
                throw new NativeOfflineException("The CABO request timed out.", error);
            }

            using (response)
            {
                var status = response.StatusCode;
                if (status == HttpStatusCode.Unauthorized && auth)
                {
                    EndSession();
                    throw new UnauthorizedAccessException("Session expired.");
                }
                if (status == HttpStatusCode.Forbidden) throw new NativeForbiddenException();
                if ((int)status is 502 or 503 or 504 && attempt < maxAttempts)
                {
                    await Backoff(attempt, cancellation).ConfigureAwait(false);
                    continue;
                }
                if (!response.IsSuccessStatusCode)
                    throw new NativeApiException(status, "CABO returned HTTP " + (int)status + ".",
                        response.Headers.RetryAfter?.Delta);

                var bytes = await response.Content.ReadAsByteArrayAsync(cancellation).ConfigureAwait(false);
                if (bytes.Length == 0) return JsonDocument.Parse("{}");
                try
                {
                    return JsonDocument.Parse(bytes, new JsonDocumentOptions { MaxDepth = 32 });
                }
                catch (JsonException)
                {
                    throw new NativeApiException(HttpStatusCode.BadGateway, "Unexpected response from CABO.");
                }
            }
        }
    }

    private static Task Backoff(int attempt, CancellationToken cancellation) =>
        Task.Delay(TimeSpan.FromMilliseconds(400 * attempt + Random.Shared.Next(0, 200)), cancellation);

    private Task<JsonDocument> GetAsync(string path, CancellationToken cancellation) =>
        SendAsync(HttpMethod.Get, path, null, cancellation);

    /// <summary>
    /// Loads per-school data with bounded parallelism. A school that fails is
    /// counted (so the UI can say the view is partial) instead of being shown
    /// as zero. An expired session always propagates.
    /// </summary>
    internal static async Task<PartialResult<T>> ForEachOrganizationAsync<T>(
        IEnumerable<int> organizationIds, Func<int, CancellationToken, Task<IEnumerable<T>>> load,
        CancellationToken cancellation)
    {
        var ids = organizationIds.Where(id => id > 0).Distinct().Take(MaxOrganizations).ToArray();
        if (ids.Length == 0) return PartialResult<T>.Empty;
        using var gate = new SemaphoreSlim(MaxParallelOrganizations);
        var failed = 0;
        var tasks = ids.Select(async id =>
        {
            await gate.WaitAsync(cancellation).ConfigureAwait(false);
            try
            {
                return (await load(id, cancellation).ConfigureAwait(false)).ToArray();
            }
            catch (UnauthorizedAccessException) { throw; }
            catch (OperationCanceledException) when (cancellation.IsCancellationRequested) { throw; }
            catch (Exception)
            {
                Interlocked.Increment(ref failed);
                return Array.Empty<T>();
            }
            finally { gate.Release(); }
        }).ToArray();
        var results = await Task.WhenAll(tasks).ConfigureAwait(false);
        return new PartialResult<T>(results.SelectMany(r => r).ToArray(), failed);
    }

    private int CurrentYear => clock().ToLocalTime().Year;

    [GeneratedRegex("^[A-Za-z0-9_-]{16,64}$")]
    private static partial Regex RequestKeyPattern();

    // ---------------------------------------------------------------- portal

    public async Task<NativePortal> PortalAsync(CancellationToken cancellation)
    {
        using var json = await GetAsync("api/portal/me", cancellation).ConfigureAwait(false);
        return ParsePortal(json.RootElement);
    }

    internal static NativePortal ParsePortal(JsonElement root)
    {
        var role = NativeJson.Str(root, "role", 40);
        if (role.Length == 0) role = "learner";
        var ids = NativeJson.Arr(root, "organizationIds", 50)
            .Where(v => v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var id) && id > 0)
            .Select(v => v.GetInt32()).Distinct().Take(MaxOrganizations).ToArray();
        var cards = NativeJson.Arr(root, "cards", 20)
            .Select(c => NativeJson.Str(c, "label", 80)).Where(l => l.Length > 0).ToArray();
        return new NativePortal(role, ids, NativeJson.Stats(root, "summary"), cards,
            NativeJson.Bool(root, "countryScopedRecordsRequired"));
    }

    /// <summary>The caller's own school memberships, fetched once per session.</summary>
    public async Task<IReadOnlyList<OrganizationMembership>> MembershipsAsync(CancellationToken cancellation, bool refresh = false)
    {
        var cached = membershipCache;
        if (cached is not null && !refresh) return cached;
        using var json = await GetAsync("api/organizations", cancellation).ConfigureAwait(false);
        var rows = NativeJson.Root(json.RootElement, 100)
            .Select(r => new OrganizationMembership(NativeJson.Int(r, "id"), NativeJson.Str(r, "name", 200),
                NativeJson.Str(r, "role", 40)))
            .Where(m => m.Id > 0 && m.Name.Length > 0 && m.Role.Length > 0)
            .Take(MaxOrganizations).ToArray();
        membershipCache = rows;
        return rows;
    }

    public void InvalidateCaches() => membershipCache = null;

    // --------------------------------------------------------------- learner

    public Task<PartialResult<LearnerReport>> LearnerReportsAsync(IReadOnlyList<int> organizationIds, CancellationToken cancellation)
    {
        var year = CurrentYear;
        // The learner is always identified by the bearer session, never by an ID from the device.
        return ForEachOrganizationAsync<LearnerReport>(organizationIds.Take(5), async (id, ct) =>
        {
            try
            {
                using var json = await GetAsync($"api/reports/me?organizationId={id}&year={year}", ct).ConfigureAwait(false);
                var report = ParseLearnerReport(json.RootElement, id);
                return report is null ? Array.Empty<LearnerReport>() : new[] { report };
            }
            catch (NativeApiException error) when (error.Status == HttpStatusCode.NotFound)
            {
                // No enrolment or no published grades is not fabricated as a 0%.
                return Array.Empty<LearnerReport>();
            }
        }, cancellation);
    }

    internal static LearnerReport? ParseLearnerReport(JsonElement root, int organizationId)
    {
        var year = NativeJson.Int(root, "year");
        var grade = NativeJson.Str(root, "grade", 32);
        if (year is < 2000 or > 2200) return null;
        int? attendance = null;
        if (NativeJson.Has(root, "attendance", out var att))
        {
            var rate = NativeJson.OptInt(att, "rate");
            attendance = rate is >= 0 and <= 100 ? rate : null;
        }
        return new LearnerReport(organizationId, year, grade, NativeJson.Percent(root, "average"), attendance,
            ParseSubjects(root));
    }

    private static IReadOnlyList<SubjectScore> ParseSubjects(JsonElement root) =>
        NativeJson.Arr(root, "subjects", 100)
            .Select(s => new SubjectScore(NativeJson.Str(s, "name", 160), NativeJson.Percent(s, "percentage"),
                Math.Max(0, NativeJson.Int(s, "assessmentCount"))))
            .Where(s => s.Name.Length > 0).ToArray();

    public async Task<IReadOnlyList<NativeMaterialSummary>> MaterialsAsync(CancellationToken cancellation)
    {
        using var json = await GetAsync("api/materials", cancellation).ConfigureAwait(false);
        return NativeJson.Root(json.RootElement, 60)
            .Select(r => new NativeMaterialSummary(NativeJson.Int(r, "id"), NativeJson.Str(r, "title", 200)))
            .Where(m => m.Id > 0)
            .Select(m => m.Title.Length == 0 ? m with { Title = "Study material" } : m)
            .ToArray();
    }

    public async Task<NativeMaterialPage> ReadMaterialAsync(int id, int offset, CancellationToken cancellation)
    {
        if (id <= 0 || offset < 0 || offset > 2_000_000)
            throw new ArgumentException("Invalid material reading position.");
        using var json = await GetAsync($"api/materials/{id}/preview?offset={offset}", cancellation).ConfigureAwait(false);
        var root = json.RootElement;
        if (NativeJson.Int(root, "id") != id || NativeJson.Int(root, "offset", -1) != offset)
            throw new InvalidOperationException("Mismatched material position.");
        if (!NativeJson.Has(root, "text", out var textValue) || textValue.ValueKind != JsonValueKind.String)
            throw new InvalidOperationException("Invalid material page.");
        var body = textValue.GetString() ?? "";
        int? next = NativeJson.Has(root, "nextOffset", out var marker) && marker.ValueKind == JsonValueKind.Number
            ? marker.GetInt32() : null;
        if (body.Length > 16_000 || (next is not null && next <= offset))
            throw new InvalidOperationException("Invalid material page.");
        var title = NativeJson.Str(root, "title", 200);
        return new NativeMaterialPage(id, title.Length == 0 ? "Study material" : title, body, offset, next);
    }

    public async Task<IReadOnlyList<NativeQuizSummary>> QuizzesAsync(CancellationToken cancellation)
    {
        using var json = await GetAsync("api/quizzes", cancellation).ConfigureAwait(false);
        return NativeJson.Root(json.RootElement, 60)
            .Select(r => new NativeQuizSummary(NativeJson.Int(r, "id"),
                NativeJson.Str(r, "title", 200) is { Length: > 0 } t ? t : "Practice test",
                Math.Max(0, NativeJson.Int(r, "questionCount")), NativeJson.Percent(r, "latestScore")))
            .Where(q => q.Id > 0).ToArray();
    }

    public async Task<NativeQuizDetail> OpenQuizAsync(int quizId, CancellationToken cancellation)
    {
        if (quizId <= 0) throw new ArgumentOutOfRangeException(nameof(quizId));
        using var json = await GetAsync($"api/quizzes/{quizId}", cancellation).ConfigureAwait(false);
        var root = json.RootElement;
        if (NativeJson.Int(root, "id") != quizId) throw new InvalidOperationException("Unexpected quiz.");
        var questions = NativeJson.Arr(root, "questions", 100).Select(q => new NativeQuizQuestion(
            NativeJson.Str(q, "prompt", 4000),
            NativeJson.Arr(q, "options", 12).Select(o => o.ValueKind == JsonValueKind.String ? o.GetString() ?? "" : "")
                .ToArray())).ToArray();
        if (questions.Length == 0 || questions.Any(q => q.Options.Count == 0))
            throw new InvalidOperationException("Incomplete assessment.");
        var title = NativeJson.Str(root, "title", 200);
        return new NativeQuizDetail(quizId, title.Length == 0 ? "Practice test" : title, questions);
    }

    internal static NativeQuizAttempt ParseAttempt(JsonElement root, int quizId)
    {
        if (NativeJson.Int(root, "quizId") != quizId) throw new InvalidOperationException("Unexpected assessment result.");
        var feedback = NativeJson.Arr(root, "feedback", 100).Select(f => new NativeQuizFeedback(
            NativeJson.Int(f, "questionIndex"), NativeJson.Bool(f, "isCorrect"),
            NativeJson.Str(f, "explanation", 2000))).ToArray();
        return new NativeQuizAttempt(NativeJson.Int(root, "id"), quizId, NativeJson.Int(root, "correctCount"),
            NativeJson.Int(root, "totalQuestions"), NativeJson.OptDouble(root, "percentage") ?? 0, feedback);
    }

    public async Task<NativeQuizAttempt> SubmitQuizAsync(int quizId, IReadOnlyList<int> answers, string requestKey,
        CancellationToken cancellation)
    {
        if (quizId <= 0 || answers.Count == 0 || answers.Count > 100 || answers.Any(v => v < 0) ||
            !RequestKeyPattern().IsMatch(requestKey))
            throw new ArgumentException("Invalid assessment submission.");
        using var json = await SendAsync(HttpMethod.Post, $"api/quizzes/{quizId}/attempts",
            new { answers = answers.ToArray() }, cancellation, idempotencyKey: requestKey).ConfigureAwait(false);
        return ParseAttempt(json.RootElement, quizId);
    }

    /// <summary>A lost submit response is never retried as a POST: read the persisted attempt instead.</summary>
    public async Task<NativeQuizAttempt> CheckQuizSubmissionAsync(int quizId, string requestKey, CancellationToken cancellation)
    {
        if (quizId <= 0 || !RequestKeyPattern().IsMatch(requestKey)) throw new ArgumentException("Invalid request.");
        using var json = await GetAsync($"api/quizzes/{quizId}/attempts/by-key/{Uri.EscapeDataString(requestKey)}",
            cancellation).ConfigureAwait(false);
        return ParseAttempt(json.RootElement, quizId);
    }

    public async Task<IReadOnlyList<WrittenAssignment>> AssignmentsAsync(CancellationToken cancellation)
    {
        using var json = await GetAsync("api/my-assignments", cancellation).ConfigureAwait(false);
        return NativeJson.Root(json.RootElement, 60).Select(r => new WrittenAssignment(
                NativeJson.Int(r, "id"), NativeJson.Int(r, "examId"), NativeJson.Str(r, "title", 200),
                NativeJson.Int(r, "organizationId"), NativeJson.Str(r, "organization", 200),
                NativeJson.OptStr(r, "dueAt", 40)))
            .Where(a => a.Id > 0 && a.ExamId > 0 && a.OrganizationId > 0 && a.Title.Length > 0 && a.Organization.Length > 0)
            .ToArray();
    }

    public async Task<LearnerJourney> JourneyAsync(CancellationToken cancellation)
    {
        using var json = await GetAsync("api/learner-journey/me", cancellation).ConfigureAwait(false);
        return ParseJourney(json.RootElement);
    }

    internal static LearnerJourney ParseJourney(JsonElement root)
    {
        var name = NativeJson.Has(root, "identity", out var identity) ? NativeJson.Str(identity, "displayName", 160) : "";
        var entries = NativeJson.Arr(root, "journeys", 100).Select(r => new JourneyEntry(
                NativeJson.Int(r, "id"), NativeJson.Str(r, "institutionName", 160), NativeJson.Str(r, "stage", 32),
                NativeJson.Int(r, "academicYear"), NativeJson.Str(r, "note", 2000)))
            .Where(e => e.Id > 0 && e.InstitutionName.Length > 0).ToArray();
        var milestones = NativeJson.Arr(root, "milestones", 100).Select(r => new JourneyMilestone(
                NativeJson.Int(r, "id"), NativeJson.Str(r, "title", 160), NativeJson.Str(r, "description", 4000),
                NativeJson.Str(r, "kind", 32), NativeJson.Int(r, "year")))
            .Where(m => m.Id > 0 && m.Title.Length > 0 && m.Description.Length > 0).ToArray();
        return new LearnerJourney(name, entries, milestones);
    }

    public Task<PartialResult<SupportCourse>> SupportCoursesAsync(IReadOnlyList<int> organizationIds, CancellationToken cancellation) =>
        ForEachOrganizationAsync<SupportCourse>(organizationIds, async (orgId, ct) =>
        {
            using var json = await GetAsync($"api/organizations/{orgId}/support/options", ct).ConfigureAwait(false);
            return NativeJson.Arr(json.RootElement, "courses", 100)
                .Select(c => new SupportCourse(orgId, NativeJson.Int(c, "id"), NativeJson.Str(c, "name", 120)))
                .Where(c => c.CourseId > 0 && c.Name.Length > 0).ToArray();
        }, cancellation);

    public Task<PartialResult<SupportTicket>> SupportTicketsAsync(IReadOnlyList<int> organizationIds, CancellationToken cancellation) =>
        ForEachOrganizationAsync<SupportTicket>(organizationIds, async (orgId, ct) =>
        {
            using var json = await GetAsync($"api/organizations/{orgId}/support", ct).ConfigureAwait(false);
            return ParseTickets(json.RootElement, orgId, 30);
        }, cancellation);

    internal static IReadOnlyList<SupportTicket> ParseTickets(JsonElement root, int orgId, int max) =>
        NativeJson.Arr(root, "items", max).Select(r => new SupportTicket(orgId, NativeJson.Int(r, "id"),
                NativeJson.Str(r, "concept", 160), NativeJson.Str(r, "status", 32) is { Length: > 0 } s ? s : "open",
                Math.Max(1, NativeJson.Int(r, "version", 1)), NativeJson.Str(r, "updatedAt", 40),
                NativeJson.OptStr(r, "reviewAt", 40), NativeJson.OptStr(r, "feedback", 40)))
            .Where(t => t.Id > 0 && t.Concept.Length > 0).ToArray();

    /// <summary>Learner asks their school for help with a concept (routed to their teacher, optionally AI-assisted).</summary>
    public async Task<int> SubmitHelpRequestAsync(SupportCourse course, string concept, string question, string attempted,
        Guid requestKey, CancellationToken cancellation)
    {
        concept = concept.Trim(); question = question.Trim(); attempted = attempted.Trim();
        if (course.OrganizationId <= 0 || course.CourseId <= 0 || concept.Length is < 2 or > 160 ||
            question.Length is < 10 or > 4000 || attempted.Length is < 3 or > 2000 || requestKey == Guid.Empty)
            throw new ArgumentException("Choose a subject, concept, question and what you already tried.");
        using var json = await SendAsync(HttpMethod.Post, $"api/organizations/{course.OrganizationId}/support",
            new { courseId = course.CourseId, concept, question, attempted, requestKey = requestKey.ToString("D") },
            cancellation).ConfigureAwait(false);
        var id = NativeJson.Int(json.RootElement, "id");
        if (id <= 0) throw new InvalidOperationException("CABO returned an invalid support request.");
        return id;
    }

    public const long MaxMaterialBytes = 30L * 1024 * 1024;

    public static readonly IReadOnlyDictionary<string, string> MaterialContentTypes =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            [".txt"] = "text/plain", [".md"] = "text/markdown", [".csv"] = "text/csv",
            [".pdf"] = "application/pdf",
            [".docx"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            [".pptx"] = "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            [".xlsx"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            [".png"] = "image/png", [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg", [".webp"] = "image/webp"
        };

    [GeneratedRegex("^/api/storage/uploads/railway/[a-f0-9-]{36}$")]
    private static partial Regex TestUploadPath();

    /// <summary>
    /// Educator upload of a study material, using the same two-step contract as
    /// Android: request a signed destination, PUT the bytes, then register the
    /// material. The CABO bearer is never sent to an external storage host.
    /// AI reading is off by default for uploaded files.
    /// </summary>
    public async Task<NativeMaterialSummary> UploadMaterialAsync(string fileName, byte[] content, string title,
        CancellationToken cancellation)
    {
        title = title.Trim();
        var name = Path.GetFileName(fileName ?? "").Trim();
        if (title.Length is < 1 or > 200) throw new ArgumentException("Enter a title of 1 to 200 characters.");
        if (name.Length is < 1 or > 200) throw new ArgumentException("Choose a file with a shorter name.");
        if (!MaterialContentTypes.TryGetValue(Path.GetExtension(name), out var contentType))
            throw new ArgumentException("Choose a supported PDF, Office, text, CSV, PNG, JPEG or WebP file.");
        if (content.LongLength == 0) throw new ArgumentException("The selected file is empty.");
        if (content.LongLength > MaxMaterialBytes) throw new ArgumentException("Files must be 30 MB or smaller.");

        string uploadUrl, objectPath;
        using (var intent = await SendAsync(HttpMethod.Post, "api/storage/uploads/request-url",
                   new { name, size = content.LongLength, contentType, allowAiReading = false }, cancellation)
                   .ConfigureAwait(false))
        {
            uploadUrl = NativeJson.Str(intent.RootElement, "uploadURL", 4000);
            objectPath = NativeJson.Str(intent.RootElement, "objectPath", 1000);
        }
        var target = ValidateUploadTarget(uploadUrl, Origin, out var sendBearer);
        if (objectPath.Length == 0) throw new InvalidOperationException("CABO returned an invalid upload record.");

        using (var put = new HttpRequestMessage(HttpMethod.Put, target))
        {
            put.Content = new ByteArrayContent(content);
            put.Content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
            if (sendBearer) put.Headers.Authorization = new AuthenticationHeaderValue("Bearer", RequireToken());
            HttpResponseMessage response;
            try
            {
                response = await http.SendAsync(put, cancellation).ConfigureAwait(false);
            }
            catch (HttpRequestException error) { throw new NativeOfflineException("Upload failed.", error); }
            catch (TaskCanceledException error) when (!cancellation.IsCancellationRequested)
            {
                throw new NativeOfflineException("Upload timed out.", error);
            }
            using (response)
            {
                if (!response.IsSuccessStatusCode)
                    throw new NativeApiException(response.StatusCode, "The file upload was not accepted.");
            }
        }

        using var saved = await SendAsync(HttpMethod.Post, "api/materials", new { title, objectPath }, cancellation)
            .ConfigureAwait(false);
        var id = NativeJson.Int(saved.RootElement, "id");
        var savedTitle = NativeJson.Str(saved.RootElement, "title", 200);
        if (id <= 0 || savedTitle.Length == 0) throw new InvalidOperationException("CABO returned an invalid material record.");
        return new NativeMaterialSummary(id, savedTitle);
    }

    internal static Uri ValidateUploadTarget(string url, Uri origin, out bool sendBearer)
    {
        sendBearer = false;
        if (!Uri.TryCreate(url, UriKind.Absolute, out var target) || target.Scheme != Uri.UriSchemeHttps ||
            target.UserInfo.Length > 0)
            throw new InvalidOperationException("CABO returned an invalid secure upload destination.");
        var sameHost = string.Equals(target.Host, origin.Host, StringComparison.OrdinalIgnoreCase);
        if (!sameHost) return target;
        // Only the isolated test storage route on the CABO API itself may receive the bearer.
        if (target.Port != origin.Port || !TestUploadPath().IsMatch(target.AbsolutePath) || target.Query.Length > 0)
            throw new InvalidOperationException("CABO returned an unexpected upload destination.");
        sendBearer = true;
        return target;
    }

    // ------------------------------------------------------ school operations

    public async Task<IReadOnlyList<SchoolOperations>> SchoolOperationsAsync(IReadOnlyList<OrganizationMembership> memberships,
        CancellationToken cancellation)
    {
        var year = CurrentYear;
        var byId = memberships.Where(m => m.Id > 0).GroupBy(m => m.Id).ToDictionary(g => g.Key, g => g.First());
        var result = await ForEachOrganizationAsync<SchoolOperations>(byId.Keys, async (orgId, ct) =>
        {
            var member = byId[orgId];
            var partial = false;
            async Task<T> Try<T>(Func<Task<T>> load, T fallback)
            {
                try { return await load().ConfigureAwait(false); }
                catch (UnauthorizedAccessException) { throw; }
                catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
                catch (Exception) { partial = true; return fallback; }
            }

            var noticesTask = Try<IReadOnlyList<SchoolNotice>>(async () =>
            {
                using var json = await GetAsync($"api/organizations/{orgId}/notices", ct).ConfigureAwait(false);
                return (IReadOnlyList<SchoolNotice>)NativeJson.Root(json.RootElement, 100).Select(r => new SchoolNotice(
                        NativeJson.Int(r, "id"), NativeJson.Str(r, "subject", 180), NativeJson.Str(r, "message", 5000),
                        NativeJson.Str(r, "audience", 16), NativeJson.Str(r, "createdAt", 40)))
                    .Where(n => n.Id > 0 && n.Subject.Length > 0).ToArray();
            }, Array.Empty<SchoolNotice>());

            var attendanceTask = member.Role == "learner"
                ? Try<IReadOnlyList<AttendanceRecord>>(async () =>
                {
                    using var json = await GetAsync($"api/organizations/{orgId}/attendance/me", ct).ConfigureAwait(false);
                    return (IReadOnlyList<AttendanceRecord>)NativeJson.Arr(json.RootElement, "attendance", 180)
                        .Select(r => new AttendanceRecord(NativeJson.Str(r, "day", 10), NativeJson.Str(r, "status", 16)))
                        .Where(a => a.Day.Length == 10 && a.Status is "present" or "absent" or "late" or "excused")
                        .ToArray();
                }, Array.Empty<AttendanceRecord>())
                : Task.FromResult<IReadOnlyList<AttendanceRecord>>(Array.Empty<AttendanceRecord>());

            var timetableTask = Try<IReadOnlyList<TimetableSlot>>(async () =>
            {
                using var json = await GetAsync($"api/organizations/{orgId}/timetable?year={year}", ct).ConfigureAwait(false);
                return (IReadOnlyList<TimetableSlot>)NativeJson.Root(json.RootElement, 200).Select(r => new TimetableSlot(
                        NativeJson.Int(r, "id"), NativeJson.Int(r, "day"), NativeJson.Str(r, "startsAt", 5),
                        NativeJson.Str(r, "endsAt", 5), NativeJson.Str(r, "grade", 32), NativeJson.Str(r, "group", 40),
                        NativeJson.Str(r, "subject", 100), NativeJson.Str(r, "room", 80), NativeJson.Str(r, "status", 16)))
                    .Where(t => t.Id > 0 && t.Subject.Length > 0).ToArray();
            }, Array.Empty<TimetableSlot>());

            var summaryTask = RoleAccess.ManagerMembershipRoles.Contains(member.Role)
                ? Try<AttendanceSummary?>(async () =>
                {
                    using var json = await GetAsync($"api/organizations/{orgId}/attendance/summary?year={year}", ct)
                        .ConfigureAwait(false);
                    var root = json.RootElement;
                    return new AttendanceSummary(NativeJson.Int(root, "year", year),
                        Math.Max(0, NativeJson.Int(root, "records")), NativeJson.Counts(root, "counts"));
                }, null)
                : Task.FromResult<AttendanceSummary?>(null);

            await Task.WhenAll(noticesTask, attendanceTask, timetableTask, summaryTask).ConfigureAwait(false);
            return new[]
            {
                new SchoolOperations(orgId, member.Name, member.Role, noticesTask.Result, attendanceTask.Result,
                    timetableTask.Result, summaryTask.Result,
                    partial ? "Some school information could not load. Refresh to try again." : null)
            };
        }, cancellation).ConfigureAwait(false);
        return result.Items;
    }

    // ------------------------------------------------------------------ staff

    public Task<PartialResult<StaffWorkspace>> StaffWorkspacesAsync(IReadOnlyList<int> organizationIds, CancellationToken cancellation) =>
        ForEachOrganizationAsync<StaffWorkspace>(organizationIds, async (orgId, ct) =>
        {
            try
            {
                using var options = await GetAsync($"api/organizations/{orgId}/support/options", ct).ConfigureAwait(false);
                var courses = NativeJson.Arr(options.RootElement, "courses", 100)
                    .Select(c => NativeJson.Str(c, "name", 120)).Where(n => n.Length > 0).ToArray();
                IReadOnlyList<NativeStat> stats = Array.Empty<NativeStat>();
                IReadOnlyList<SupportTicket> tickets = Array.Empty<SupportTicket>();
                var partial = false;
                try
                {
                    using var account = await GetAsync($"api/organizations/{orgId}/support/accountability", ct).ConfigureAwait(false);
                    stats = NativeJson.Stats(account.RootElement, "summary");
                }
                catch (Exception error) when (error is not UnauthorizedAccessException && !ct.IsCancellationRequested) { partial = true; }
                try
                {
                    using var queue = await GetAsync($"api/organizations/{orgId}/support", ct).ConfigureAwait(false);
                    tickets = ParseTickets(queue.RootElement, orgId, 40);
                }
                catch (Exception error) when (error is not UnauthorizedAccessException && !ct.IsCancellationRequested) { partial = true; }
                return new[] { new StaffWorkspace(orgId, courses, stats, tickets,
                    partial ? "Some support data could not load. Refresh to try again." : null) };
            }
            catch (NativeApiException)
            {
                return new[] { new StaffWorkspace(orgId, Array.Empty<string>(), Array.Empty<NativeStat>(),
                    Array.Empty<SupportTicket>(), "Learner support is not enabled for your account at this school.") };
            }
        }, cancellation);

    /// <summary>
    /// Requests a draft explanation for a ticket. The draft is for the educator
    /// to review and edit; it is never sent to the learner automatically.
    /// </summary>
    public async Task<SupportGuidance> RequestGuidanceAsync(SupportTicket ticket, CancellationToken cancellation)
    {
        if (ticket.OrganizationId <= 0 || ticket.Id <= 0) throw new ArgumentException("Invalid ticket.");
        using var json = await SendAsync(HttpMethod.Post,
            $"api/organizations/{ticket.OrganizationId}/support/{ticket.Id}/guidance-draft", new { },
            cancellation).ConfigureAwait(false);
        var root = json.RootElement;
        return new SupportGuidance(NativeJson.Str(root, "explanation", 2000), NativeJson.Strings(root, "questions", 4, 300),
            NativeJson.Strings(root, "practice", 4, 300), NativeJson.Str(root, "source", 32) is { Length: > 0 } s ? s : "non_ai_template");
    }

    public async Task<SupportTicket> ReplyToTicketAsync(SupportTicket ticket, string body, CancellationToken cancellation)
    {
        body = body.Trim();
        if (ticket.OrganizationId <= 0 || ticket.Id <= 0 || body.Length is < 2 or > 4000)
            throw new ArgumentException("Write a reply between 2 and 4000 characters.");
        using var json = await SendAsync(HttpMethod.Post,
            $"api/organizations/{ticket.OrganizationId}/support/{ticket.Id}/actions",
            new { version = ticket.Version, action = new { kind = "reply", body } }, cancellation).ConfigureAwait(false);
        var root = json.RootElement;
        if (NativeJson.Int(root, "id") != ticket.Id) throw new InvalidOperationException("Unexpected support response.");
        return ticket with
        {
            Status = NativeJson.Str(root, "status", 32) is { Length: > 0 } s ? s : ticket.Status,
            Version = Math.Max(1, NativeJson.Int(root, "version", ticket.Version + 1)),
            UpdatedAt = NativeJson.Str(root, "updatedAt", 40) is { Length: > 0 } u ? u : ticket.UpdatedAt
        };
    }

    public Task<PartialResult<GuardianReview>> GuardianReviewsAsync(IReadOnlyList<int> organizationIds, CancellationToken cancellation) =>
        ForEachOrganizationAsync<GuardianReview>(organizationIds, async (orgId, ct) =>
        {
            using var json = await GetAsync($"api/organizations/{orgId}/guardian-reviews", ct).ConfigureAwait(false);
            return NativeJson.Root(json.RootElement, 200).Select(r => new GuardianReview(orgId, NativeJson.Int(r, "id"),
                    NativeJson.Str(r, "learnerId", 200), NativeJson.Str(r, "guardianId", 200), NativeJson.Str(r, "status", 32)))
                .Where(g => g.Id > 0 && g.LearnerId.Length > 0 && g.GuardianId.Length > 0 && g.Status.Length > 0).ToArray();
        }, cancellation);

    /// <summary>Records a staff decision on a guardian link after the school has checked evidence.</summary>
    public async Task ReviewGuardianAsync(GuardianReview review, bool verify, CancellationToken cancellation)
    {
        if (review.OrganizationId <= 0 || review.Id <= 0) throw new ArgumentException("Invalid guardian review.");
        using var _ = await SendAsync(HttpMethod.Post,
            $"api/organizations/{review.OrganizationId}/guardian-reviews/{review.Id}",
            new { decision = verify ? "verified" : "revoked", evidenceReviewed = true }, cancellation).ConfigureAwait(false);
    }

    public Task<PartialResult<ReportIssuance>> ReportIssuanceAsync(IReadOnlyList<int> organizationIds, CancellationToken cancellation) =>
        ForEachOrganizationAsync<ReportIssuance>(organizationIds, async (orgId, ct) =>
        {
            using var json = await GetAsync($"api/organizations/{orgId}/report-issuance", ct).ConfigureAwait(false);
            return NativeJson.Root(json.RootElement, 100).Select(r => new ReportIssuance(orgId, NativeJson.Int(r, "id"),
                    NativeJson.Str(r, "learnerId", 200), NativeJson.Int(r, "academicYear"), NativeJson.Int(r, "version"),
                    NativeJson.Str(r, "status", 32), NativeJson.OptStr(r, "issuedAt", 40)))
                .Where(x => x.Id > 0 && x.LearnerId.Length > 0 && x.Status.Length > 0).ToArray();
        }, cancellation);

    public async Task<SchoolIntelligence> SchoolIntelligenceAsync(int organizationId, CancellationToken cancellation)
    {
        if (organizationId <= 0) throw new ArgumentOutOfRangeException(nameof(organizationId));
        var year = CurrentYear;
        var attendanceTask = GetAsync($"api/organizations/{organizationId}/attendance/summary?year={year}", cancellation);
        var academicTask = GetAsync($"api/organizations/{organizationId}/academic-intelligence?year={year}", cancellation);
        try
        {
            await Task.WhenAll(attendanceTask, academicTask).ConfigureAwait(false);
        }
        catch
        {
            // Dispose whichever request succeeded before surfacing the failure.
            if (attendanceTask.IsCompletedSuccessfully) attendanceTask.Result.Dispose();
            if (academicTask.IsCompletedSuccessfully) academicTask.Result.Dispose();
            throw;
        }
        using var attendance = attendanceTask.Result;
        using var academic = academicTask.Result;
        return ParseIntelligence(organizationId, year, attendance.RootElement, academic.RootElement);
    }

    internal static SchoolIntelligence ParseIntelligence(int organizationId, int year, JsonElement attendance, JsonElement academic)
    {
        var learners = NativeJson.Arr(academic, "learners", 400).Select(r => new SchoolIntelligenceLearner(
                NativeJson.Str(r, "learnerId", 160), NativeJson.Str(r, "grade", 40), NativeJson.Percent(r, "average"),
                NativeJson.Percent(r, "attendanceRate"), NativeJson.Strings(r, "subjectsAtRisk", 20, 120),
                Math.Max(0, NativeJson.Int(r, "supportPlans"))))
            .Where(l => l.LearnerId.Length > 0).ToArray();
        double subjectBelow = 50, attendanceBelow = 80;
        if (NativeJson.Has(academic, "thresholds", out var thresholds))
        {
            subjectBelow = Math.Clamp(NativeJson.OptDouble(thresholds, "subjectBelow") ?? 50, 0, 100);
            attendanceBelow = Math.Clamp(NativeJson.OptDouble(thresholds, "attendanceBelow") ?? 80, 0, 100);
        }
        return new SchoolIntelligence(organizationId, NativeJson.Int(academic, "year", year),
            Math.Max(0, NativeJson.Int(attendance, "records")), NativeJson.Counts(attendance, "counts"),
            Math.Max(0, NativeJson.Int(academic, "studentsReviewed")), Math.Max(0, NativeJson.Int(academic, "attentionNeeded")),
            learners, subjectBelow, attendanceBelow, NativeJson.Bool(attendance, "officialDistrictData"));
    }

    // --------------------------------------------------------- administrators

    public async Task<IReadOnlyList<string>> PlatformRegistryAsync(CancellationToken cancellation)
    {
        // Audited, privileged endpoint; the server enforces superadmin.
        using var json = await GetAsync("api/platform/overview", cancellation).ConfigureAwait(false);
        return NativeJson.Arr(json.RootElement, "organizations", 200)
            .Select(o => NativeJson.Str(o, "name", 200)).Where(n => n.Length > 0).ToArray();
    }

    public async Task<EducationCommand> EducationCommandAsync(CancellationToken cancellation)
    {
        var year = CurrentYear;
        using var json = await GetAsync($"api/education-command/overview?year={year}", cancellation).ConfigureAwait(false);
        return ParseEducationCommand(json.RootElement, year);
    }

    internal static EducationCommand ParseEducationCommand(JsonElement root, int year)
    {
        var minimumCohort = Math.Clamp(NativeJson.Int(root, "minimumCohort", 10), 10, 100);
        var schools = NativeJson.Arr(root, "schools", 100).Select(r =>
            {
                // Cohorts below the privacy threshold are suppressed even if a value leaks through.
                var learners = NativeJson.OptInt(r, "learnerCount");
                if (learners is not null && learners < minimumCohort) learners = null;
                var rate = NativeJson.OptInt(r, "attendanceRate");
                if (rate is < 0 or > 100) rate = null;
                var suppressed = NativeJson.Bool(r, "privacySuppressed") || learners is null;
                return new EducationCommandSchool(NativeJson.Int(r, "id"), NativeJson.Str(r, "name", 200),
                    suppressed ? null : learners, suppressed ? null : rate, suppressed);
            })
            .Where(s => s.Id > 0 && s.Name.Length > 0).ToArray();
        return new EducationCommand(NativeJson.Int(root, "year", year),
            Math.Clamp(NativeJson.Int(root, "institutions", schools.Length), 0, 100), schools, minimumCohort,
            NativeJson.Bool(root, "nationalVerified"), NativeJson.Bool(root, "officialDbEData"));
    }

    // -------------------------------------------------------------- guardians

    public async Task<GuardianOverview> GuardianOverviewAsync(CancellationToken cancellation)
    {
        using var json = await GetAsync("api/native/mobile/parent", cancellation).ConfigureAwait(false);
        var root = json.RootElement;
        var links = NativeJson.Arr(root, "relationships", 100).Select(r => new GuardianLink(
                NativeJson.Int(r, "invitationId"), NativeJson.Str(r, "status", 32),
                NativeJson.OptStr(r, "learnerName", 160), NativeJson.Bool(r, "verifiedForRead")))
            .Where(l => l.Status.Length > 0)
            // A learner name is only displayed for links the server marked verified-for-read.
            .Select(l => l.VerifiedForRead ? l : l with { LearnerName = null })
            .ToArray();
        return new GuardianOverview(links, NativeJson.Str(root, "guidance", 1000));
    }

    public async Task RespondToGuardianInviteAsync(int invitationId, bool accept, CancellationToken cancellation)
    {
        if (invitationId <= 0) throw new ArgumentOutOfRangeException(nameof(invitationId));
        using var _ = await SendAsync(HttpMethod.Post, $"api/guardian-relationships/{invitationId}/decision",
            new { decision = accept ? "accepted" : "declined" }, cancellation).ConfigureAwait(false);
    }

    /// <summary>
    /// Progress for each child the school has verified this guardian for.
    /// The server decides access (verified relationship, this school's latest
    /// decision, active enrolment) and returns published results only; the
    /// formatter also refuses any response not marked verified_guardian.
    /// Returns one list of display lines per child; a child without published
    /// results is skipped, never shown as 0%.
    /// </summary>
    public async Task<IReadOnlyList<IReadOnlyList<string>>> GuardianChildProgressAsync(CancellationToken cancellation)
    {
        var result = new List<IReadOnlyList<string>>();
        JsonDocument children;
        try { children = await GetAsync("api/guardian/children", cancellation).ConfigureAwait(false); }
        catch (UnauthorizedAccessException) { throw; }
        catch (Exception) when (!cancellation.IsCancellationRequested) { return result; } // optional section
        using (children)
        {
            if (children.RootElement.ValueKind != JsonValueKind.Array) return result;
            foreach (var child in children.RootElement.EnumerateArray().Take(6))
            {
                if (child.ValueKind != JsonValueKind.Object ||
                    !child.TryGetProperty("learnerId", out var lid) || lid.ValueKind != JsonValueKind.String ||
                    !child.TryGetProperty("organizationId", out var oid) || oid.ValueKind != JsonValueKind.Number ||
                    !child.TryGetProperty("academicYear", out var yr) || yr.ValueKind != JsonValueKind.Number) continue;
                var learnerId = lid.GetString() ?? "";
                if (!oid.TryGetInt32(out var organizationId) || !yr.TryGetInt32(out var academicYear)) continue;
                if (learnerId.Length == 0 || learnerId.Length > 160 || organizationId <= 0 ||
                    academicYear < 2020 || academicYear > 2200) continue;
                try
                {
                    using var progress = await GetAsync(
                        $"api/guardian/progress/{Uri.EscapeDataString(learnerId)}?organizationId={organizationId}&year={academicYear}",
                        cancellation).ConfigureAwait(false);
                    var lines = NativeChildProgress.Format(progress.RootElement);
                    if (lines.Count > 0) result.Add(lines);
                }
                catch (UnauthorizedAccessException) { throw; }
                catch (Exception) when (!cancellation.IsCancellationRequested) { /* skip this child */ }
            }
        }
        return result;
    }

    public async Task<GuardianReports> GuardianReportsAsync(CancellationToken cancellation)
    {
        using var json = await GetAsync("api/native/mobile/parent/reports", cancellation).ConfigureAwait(false);
        return ParseGuardianReports(json.RootElement);
    }

    internal static GuardianReports ParseGuardianReports(JsonElement root)
    {
        var reports = NativeJson.Arr(root, "reports", 20).Select(r =>
            {
                int? rate = null; int present = 0, recorded = 0;
                if (NativeJson.Has(r, "attendance", out var att))
                {
                    rate = NativeJson.OptInt(att, "rate");
                    if (rate is < 0 or > 100) rate = null;
                    present = Math.Max(0, NativeJson.Int(att, "presentDays"));
                    recorded = Math.Max(0, NativeJson.Int(att, "recordedDays"));
                }
                return new GuardianReport(NativeJson.Str(r, "learnerId", 200), NativeJson.Str(r, "learnerName", 160),
                    NativeJson.Int(r, "organizationId"), NativeJson.Int(r, "year"), NativeJson.Str(r, "grade", 32),
                    NativeJson.Percent(r, "average"), ParseSubjects(r), rate, present, recorded, NativeJson.Bool(r, "official"));
            })
            .Where(r => r.LearnerId.Length > 0 && r.OrganizationId > 0).ToArray();
        return new GuardianReports(reports, NativeJson.Str(root, "guidance", 1000));
    }

    public async Task<NotificationPreferences> NotificationPreferencesAsync(CancellationToken cancellation)
    {
        using var json = await GetAsync("api/notifications/preferences", cancellation).ConfigureAwait(false);
        var root = json.RootElement;
        var schools = NativeJson.Arr(root, "schools", 100).Select(s => new NotificationSchool(
                NativeJson.Int(s, "id"), NativeJson.Str(s, "name", 200),
                NativeJson.Arr(s, "choices", 10).Select(c => new NotificationChoice(NativeJson.Str(c, "kind", 40),
                        NativeJson.Bool(c, "enabled"), NativeJson.Bool(c, "canEnable")))
                    .Where(c => IsNotificationKind(c.Kind)).ToArray()))
            .Where(s => s.Id > 0 && s.Name.Length > 0).ToArray();
        return new NotificationPreferences(NativeJson.Bool(root, "enabled"), NativeJson.Bool(root, "optInAvailable"), schools);
    }

    public static bool IsNotificationKind(string kind) =>
        kind is "guardian_review_requested" or "learner_support_updated";

    /// <summary>
    /// Records a guardian's explicit consent choice. Enabling requires the
    /// caller to confirm the user acknowledged what will be sent.
    /// </summary>
    public async Task SetNotificationPreferenceAsync(int organizationId, string kind, bool enabled, bool acknowledged,
        CancellationToken cancellation)
    {
        if (organizationId <= 0 || !IsNotificationKind(kind)) throw new ArgumentException("Invalid notification choice.");
        if (enabled && !acknowledged) throw new ArgumentException("Consent must be acknowledged before enabling.");
        using var _ = await SendAsync(HttpMethod.Patch, $"api/notifications/preferences/{organizationId}/{kind}",
            new { enabled, acknowledged }, cancellation).ConfigureAwait(false);
    }
}
