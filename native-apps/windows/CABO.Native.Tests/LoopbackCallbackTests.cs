using Xunit;
namespace CABO.Native.Tests;

public class LoopbackCallbackTests
{
    private const string State = "state_0123456789abcdefghijklmnopqrstuvwx";
    private const string Code = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ"; // 43 url-safe chars

    [Fact]
    public void AcceptsGenuineCallback()
    {
        var result = LoopbackCallback.Evaluate($"GET /auth?code={Code}&state={State} HTTP/1.1", State);
        Assert.Equal(CallbackOutcome.Success, result.Outcome);
        Assert.Equal(Code, result.Code);
    }

    [Fact]
    public void IgnoresUnrelatedBrowserProbe()
    {
        Assert.Equal(CallbackOutcome.Ignore, LoopbackCallback.Evaluate("GET /favicon.ico HTTP/1.1", State).Outcome);
        Assert.Equal(CallbackOutcome.Ignore, LoopbackCallback.Evaluate("POST /auth?code=x HTTP/1.1", State).Outcome);
    }

    [Theory]
    [InlineData("GET /auth?code=" + Code + "&state=wrong-state-value-wrong-state-value HTTP/1.1")]
    [InlineData("GET /auth?code=" + Code + " HTTP/1.1")]
    [InlineData("GET /auth?code=" + Code + "&state=" + State + "&state=" + State + " HTTP/1.1")]
    [InlineData("garbage")]
    [InlineData("")]
    public void RejectsForeignOrMalformedRequestsWithoutUsingTheirCode(string line)
    {
        var result = LoopbackCallback.Evaluate(line, State);
        Assert.Equal(CallbackOutcome.Foreign, result.Outcome);
        Assert.Null(result.Code);
    }

    [Fact]
    public void RejectsOversizedRequestLine()
    {
        var line = "GET /auth?pad=" + new string('a', 5000) + " HTTP/1.1";
        Assert.Equal(CallbackOutcome.Foreign, LoopbackCallback.Evaluate(line, State).Outcome);
    }

    [Theory]
    [InlineData("short")]
    [InlineData("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP%21")]
    [InlineData("")]
    public void FailsClosedOnMalformedCodeWithMatchingState(string code)
    {
        var result = LoopbackCallback.Evaluate($"GET /auth?code={code}&state={State} HTTP/1.1", State);
        Assert.Equal(CallbackOutcome.Invalid, result.Outcome);
        Assert.Null(result.Code);
    }

    [Fact]
    public void ReportsCancellation()
    {
        var result = LoopbackCallback.Evaluate($"GET /auth?error=access_denied&state={State} HTTP/1.1", State);
        Assert.Equal(CallbackOutcome.Denied, result.Outcome);
    }

    [Fact]
    public void ResponseNeverEchoesTheCode()
    {
        var bytes = LoopbackCallback.HttpResponse(200, "Signed in.");
        var text = System.Text.Encoding.UTF8.GetString(bytes);
        Assert.StartsWith("HTTP/1.1 200 OK", text);
        Assert.Contains("Cache-Control: no-store", text);
        Assert.DoesNotContain(Code, text);
    }
}
