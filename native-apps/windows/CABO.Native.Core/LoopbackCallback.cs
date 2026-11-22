using System;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace CABO.Native;

public enum CallbackOutcome
{
    /// <summary>The request is not the sign-in callback (e.g. a favicon probe); keep listening.</summary>
    Ignore,
    /// <summary>
    /// Malformed request or a state that does not match this attempt. Another
    /// local program may be probing the port: reject it, never use its code,
    /// and keep waiting for the genuine browser redirect.
    /// </summary>
    Foreign,
    Success,
    /// <summary>The identity provider or user cancelled the sign-in.</summary>
    Denied,
    /// <summary>The state matched but the code is malformed: fail closed.</summary>
    Invalid
}

public sealed record CallbackResult(CallbackOutcome Outcome, string? Code);

/// <summary>
/// Pure RFC 8252 loopback-callback validation, kept separate from sockets so it
/// can be unit tested. Codes and state are never logged or shown in the UI.
/// </summary>
public static partial class LoopbackCallback
{
    public const int MaxLineLength = 4096;

    [GeneratedRegex("^[A-Za-z0-9_-]{43}$")]
    private static partial Regex CodePattern();

    public static CallbackResult Evaluate(string? requestLine, string expectedState)
    {
        if (string.IsNullOrEmpty(requestLine) || requestLine.Length > MaxLineLength)
            return new CallbackResult(CallbackOutcome.Foreign, null);
        var parts = requestLine.Split(' ');
        if (parts.Length != 3 || !parts[2].StartsWith("HTTP/1.", StringComparison.Ordinal))
            return new CallbackResult(CallbackOutcome.Foreign, null);
        if (parts[0] != "GET") return new CallbackResult(CallbackOutcome.Ignore, null);
        var target = parts[1];
        if (target != "/auth" && !target.StartsWith("/auth?", StringComparison.Ordinal))
            return new CallbackResult(CallbackOutcome.Ignore, null);

        var query = target.Length > 5 ? target[6..] : "";
        var state = QueryParam(query, "state");
        if (state is null || !FixedEquals(state, expectedState))
            return new CallbackResult(CallbackOutcome.Foreign, null);
        if (QueryParam(query, "error") is not null)
            return new CallbackResult(CallbackOutcome.Denied, null);
        var code = QueryParam(query, "code");
        if (code is null || !CodePattern().IsMatch(code))
            return new CallbackResult(CallbackOutcome.Invalid, null);
        return new CallbackResult(CallbackOutcome.Success, code);
    }

    internal static string? QueryParam(string query, string key)
    {
        string? found = null;
        foreach (var segment in query.Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var pair = segment.Split('=', 2);
            string name;
            try { name = Uri.UnescapeDataString(pair[0]); }
            catch (UriFormatException) { return null; }
            if (name != key) continue;
            // A repeated parameter is ambiguous; treat it as an attack and fail closed.
            if (found is not null) return null;
            try { found = pair.Length > 1 ? Uri.UnescapeDataString(pair[1].Replace("+", " ")) : ""; }
            catch (UriFormatException) { return null; }
        }
        return found;
    }

    private static bool FixedEquals(string a, string b)
    {
        var x = Encoding.UTF8.GetBytes(a);
        var y = Encoding.UTF8.GetBytes(b);
        return x.Length == y.Length && CryptographicOperations.FixedTimeEquals(x, y);
    }

    public static byte[] HttpResponse(int status, string body)
    {
        var reason = status switch { 200 => "OK", 400 => "Bad Request", 404 => "Not Found", _ => "Error" };
        var data = Encoding.UTF8.GetBytes(body);
        var head = Encoding.ASCII.GetBytes(
            $"HTTP/1.1 {status} {reason}\r\nContent-Type: text/plain; charset=utf-8\r\n" +
            $"Cache-Control: no-store\r\nReferrer-Policy: no-referrer\r\n" +
            $"Content-Length: {data.Length}\r\nConnection: close\r\n\r\n");
        var all = new byte[head.Length + data.Length];
        Buffer.BlockCopy(head, 0, all, 0, head.Length);
        Buffer.BlockCopy(data, 0, all, head.Length, data.Length);
        return all;
    }
}
