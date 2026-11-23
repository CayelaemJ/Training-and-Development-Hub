using System;
using System.Net;

namespace CABO.Native;

/// <summary>The device could not reach CABO (offline, DNS, TLS or timeout).</summary>
public sealed class NativeOfflineException : Exception
{
    public NativeOfflineException(string message, Exception? inner = null) : base(message, inner) { }
}

/// <summary>CABO answered with a non-success status. Message is safe to show.</summary>
public class NativeApiException : Exception
{
    public HttpStatusCode Status { get; }
    public TimeSpan? RetryAfter { get; }

    public NativeApiException(HttpStatusCode status, string message, TimeSpan? retryAfter = null)
        : base(message)
    {
        Status = status;
        RetryAfter = retryAfter;
    }
}

/// <summary>The signed-in account is not allowed to see this record (HTTP 403).</summary>
public sealed class NativeForbiddenException : NativeApiException
{
    public NativeForbiddenException() : base(HttpStatusCode.Forbidden,
        "Your CABO account is not authorised for this information.") { }
}

/// <summary>The user or identity provider cancelled the browser sign-in.</summary>
public sealed class NativeSignInCancelledException : Exception
{
    public NativeSignInCancelledException() : base("Sign-in was cancelled.") { }
}

public static class NativeErrorText
{
    /// <summary>Maps any failure to a short, non-technical message without leaking server detail.</summary>
    public static string ForUser(Exception error) => error switch
    {
        UnauthorizedAccessException => "Your session has ended. Please sign in again.",
        NativeForbiddenException => "Your account is not authorised for this information.",
        NativeOfflineException => "CABO could not be reached. Check your internet connection and try again.",
        NativeApiException { Status: HttpStatusCode.TooManyRequests } api =>
            api.RetryAfter is { } wait
                ? $"Too many requests. Please wait about {Math.Max(1, (int)Math.Ceiling(wait.TotalSeconds))} seconds and try again."
                : "Too many requests. Please wait a moment and try again.",
        NativeApiException { Status: HttpStatusCode.NotFound } => "This information is not available for your account.",
        NativeApiException { Status: HttpStatusCode.ServiceUnavailable } =>
            "CABO is temporarily unavailable. Please try again shortly.",
        NativeApiException { Status: HttpStatusCode.BadRequest } => "CABO could not accept that request. Check the details and try again.",
        NativeApiException { Status: HttpStatusCode.Conflict } => "This record changed on another device. Refresh and try again.",
        NativeSignInCancelledException => "Sign-in was cancelled.",
        OperationCanceledException => "The request took too long. Check your connection and try again.",
        ArgumentException => "Some details are missing or invalid.",
        _ => "Something went wrong. Please try again."
    };
}
