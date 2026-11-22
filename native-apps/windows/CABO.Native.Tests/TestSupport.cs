using Xunit;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace CABO.Native.Tests;

internal sealed record RecordedRequest(HttpMethod Method, Uri Uri, string? Authorization,
    IReadOnlyDictionary<string, string> Headers, string? Body);

/// <summary>Deterministic in-memory API. No network or real CABO data is ever used.</summary>
internal sealed class StubHandler : HttpMessageHandler
{
    private readonly Func<RecordedRequest, HttpResponseMessage> respond;
    public ConcurrentQueue<RecordedRequest> Requests { get; } = new();

    public StubHandler(Func<RecordedRequest, HttpResponseMessage> respond) => this.respond = respond;

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var h in request.Headers) headers[h.Key] = string.Join(",", h.Value);
        var body = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
        var recorded = new RecordedRequest(request.Method, request.RequestUri!, request.Headers.Authorization?.ToString(),
            headers, body);
        Requests.Enqueue(recorded);
        return respond(recorded);
    }

    public static HttpResponseMessage Json(string json, HttpStatusCode status = HttpStatusCode.OK) =>
        new(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") };

    public static HttpResponseMessage Status(HttpStatusCode status) => new(status) { Content = new StringContent("") };
}

internal static class Fixtures
{
    public static readonly Uri Origin = new("https://cabo.test/");
    public const string Token = "tok_0123456789abcdefghijklmnopqrstuvwxyzABCD";
    public static readonly DateTimeOffset Now = new(2026, 11, 22, 9, 0, 0, TimeSpan.Zero);

    public static NativeLearningService Service(StubHandler handler, ISessionStore? store = null, bool signedIn = true,
        Func<DateTimeOffset>? clock = null, Action<Uri>? browser = null, bool testLogin = false)
    {
        store ??= new MemorySessionStore();
        if (signedIn) store.Save(new NativeSession(Token, Now.AddMinutes(50)));
        return new NativeLearningService(handler, store, Origin, clock ?? (() => Now), browser ?? (_ => { }), testLogin);
    }
}
