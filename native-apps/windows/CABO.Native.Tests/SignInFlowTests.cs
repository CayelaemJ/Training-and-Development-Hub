using Xunit;
using System;
using System.Linq;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace CABO.Native.Tests;

/// <summary>
/// Drives the real loopback listener on 127.0.0.1:47787 with a simulated
/// browser, against a stubbed token endpoint. These tests share the fixed
/// callback port, so they run in one non-parallel collection.
/// </summary>
[Collection("loopback")]
public class SignInFlowTests
{
    private const string Code = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ";

    private static string Query(Uri uri, string key) =>
        uri.Query.TrimStart('?').Split('&').Select(p => p.Split('=', 2))
            .Where(p => p[0] == key).Select(p => Uri.UnescapeDataString(p[1])).Single();

    private static async Task<string> BrowserHit(string pathAndQuery)
    {
        using var client = new TcpClient();
        await client.ConnectAsync("127.0.0.1", NativeLearningService.Callback.Port);
        using var stream = client.GetStream();
        var request = Encoding.ASCII.GetBytes($"GET {pathAndQuery} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n");
        await stream.WriteAsync(request);
        var buffer = new byte[2048];
        var read = await stream.ReadAsync(buffer);
        return Encoding.ASCII.GetString(buffer, 0, read);
    }

    [Fact]
    public async Task CompletesPkceSignInAndIgnoresForeignCallbacks()
    {
        string? tokenBody = null;
        var handler = new StubHandler(r =>
        {
            Assert.Equal("/api/native/token", r.Uri.AbsolutePath);
            Assert.Null(r.Authorization);
            tokenBody = r.Body;
            return StubHandler.Json($$"""{"access_token":"{{Fixtures.Token}}","token_type":"Bearer","expires_in":3600}""");
        });

        Uri? authorize = null;
        Task? browser = null;
        var store = new MemorySessionStore();
        using var service = Fixtures.Service(handler, store, signedIn: false, browser: url =>
        {
            authorize = url;
            var state = Query(url, "state");
            browser = Task.Run(async () =>
            {
                Assert.Contains("404", await BrowserHit("/favicon.ico"));
                Assert.Contains("400", await BrowserHit($"/auth?code={Code}&state=attacker-state-attacker-state-attacker"));
                Assert.Contains("200", await BrowserHit($"/auth?code={Code}&state={Uri.EscapeDataString(state)}"));
            });
        });

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));
        await service.SignInAsync(cts.Token);
        await browser!;

        Assert.True(service.HasSession);
        Assert.Equal(Fixtures.Token, store.Load()!.AccessToken);

        Assert.NotNull(authorize);
        Assert.Equal("cabo-windows", Query(authorize!, "client_id"));
        Assert.Equal("S256", Query(authorize!, "code_challenge_method"));
        using var body = JsonDocument.Parse(tokenBody!);
        Assert.Equal(Code, body.RootElement.GetProperty("code").GetString());
        var verifier = body.RootElement.GetProperty("code_verifier").GetString()!;
        var expected = Convert.ToBase64String(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        Assert.Equal(expected, Query(authorize!, "code_challenge"));
    }

    [Fact]
    public async Task CancelledSignInStoresNothing()
    {
        var handler = new StubHandler(_ => throw new InvalidOperationException("token endpoint must not be called"));
        var store = new MemorySessionStore();
        Task? browser = null;
        using var service = Fixtures.Service(handler, store, signedIn: false, browser: url =>
        {
            var state = Query(url, "state");
            browser = Task.Run(() => BrowserHit($"/auth?error=access_denied&state={Uri.EscapeDataString(state)}"));
        });
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));
        await Assert.ThrowsAsync<NativeSignInCancelledException>(() => service.SignInAsync(cts.Token));
        await browser!;
        Assert.False(service.HasSession);
        Assert.Null(store.Load());
        Assert.Empty(handler.Requests);
    }

    [Fact]
    public async Task PkceValuesMeetServerPolicy()
    {
        var (verifier, challenge, state) = NativeLearningService.NewPkce();
        Assert.Matches("^[A-Za-z0-9_-]{43}$", challenge);
        Assert.InRange(verifier.Length, 43, 128);
        Assert.InRange(state.Length, 32, 128);
        await Task.CompletedTask;
    }
}

[CollectionDefinition("loopback", DisableParallelization = true)]
public class LoopbackCollection { }
