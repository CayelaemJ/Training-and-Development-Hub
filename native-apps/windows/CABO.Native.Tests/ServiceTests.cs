using Xunit;
using System;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace CABO.Native.Tests;

public class AuthenticationAndTransportTests
{
    [Fact]
    public async Task SendsBearerAndClientHeadersButNoCookies()
    {
        var handler = new StubHandler(_ => StubHandler.Json("""{"role":"learner","organizationIds":[3]}"""));
        using var service = Fixtures.Service(handler);
        await service.PortalAsync(CancellationToken.None);
        var request = Assert.Single(handler.Requests);
        Assert.Equal("Bearer " + Fixtures.Token, request.Authorization);
        Assert.Equal("windows", request.Headers["X-CABO-Client"]);
        Assert.False(request.Headers.ContainsKey("Cookie"));
        Assert.Equal("https://cabo.test/api/portal/me", request.Uri.ToString());
    }

    [Fact]
    public async Task UnauthorizedClearsTheStoredSessionAndRaisesSessionEnded()
    {
        var store = new MemorySessionStore();
        var handler = new StubHandler(_ => StubHandler.Status(HttpStatusCode.Unauthorized));
        using var service = Fixtures.Service(handler, store);
        var ended = 0;
        service.SessionEnded += (_, _) => ended++;

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.PortalAsync(CancellationToken.None));
        Assert.False(service.HasSession);
        Assert.Null(store.Load());
        Assert.Equal(1, ended);
    }

    [Fact]
    public async Task ForbiddenKeepsSessionAndIsNotShownAsData()
    {
        var handler = new StubHandler(_ => StubHandler.Status(HttpStatusCode.Forbidden));
        using var service = Fixtures.Service(handler);
        await Assert.ThrowsAsync<NativeForbiddenException>(() => service.PlatformRegistryAsync(CancellationToken.None));
        Assert.True(service.HasSession);
    }

    [Fact]
    public async Task ExpiredSessionNeverReachesTheNetwork()
    {
        var store = new MemorySessionStore();
        store.Save(new NativeSession(Fixtures.Token, Fixtures.Now.AddMinutes(-1)));
        var handler = new StubHandler(_ => StubHandler.Json("{}"));
        using var service = new NativeLearningService(handler, store, Fixtures.Origin, () => Fixtures.Now, _ => { }, false);
        Assert.False(service.HasSession);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.PortalAsync(CancellationToken.None));
        Assert.Empty(handler.Requests);
        Assert.Null(store.Load());
    }

    [Fact]
    public async Task SignedOutRequestThrowsWithoutCallingCabo()
    {
        var handler = new StubHandler(_ => StubHandler.Json("{}"));
        using var service = Fixtures.Service(handler, signedIn: false);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.MaterialsAsync(CancellationToken.None));
        Assert.Empty(handler.Requests);
    }

    [Fact]
    public async Task GetIsRetriedOnceOnGatewayFailure()
    {
        var calls = 0;
        var handler = new StubHandler(_ => ++calls == 1
            ? StubHandler.Status(HttpStatusCode.ServiceUnavailable)
            : StubHandler.Json("[]"));
        using var service = Fixtures.Service(handler);
        var materials = await service.MaterialsAsync(CancellationToken.None);
        Assert.Empty(materials);
        Assert.Equal(2, calls);
    }

    [Fact]
    public async Task PostIsNeverRetriedAutomatically()
    {
        var handler = new StubHandler(_ => StubHandler.Status(HttpStatusCode.ServiceUnavailable));
        using var service = Fixtures.Service(handler);
        var error = await Assert.ThrowsAsync<NativeApiException>(() =>
            service.SubmitQuizAsync(4, new[] { 0, 1 }, "key_0123456789abcdef", CancellationToken.None));
        Assert.Equal(HttpStatusCode.ServiceUnavailable, error.Status);
        Assert.Single(handler.Requests);
    }

    [Fact]
    public async Task NetworkFailureBecomesOfflineError()
    {
        var handler = new StubHandler(_ => throw new HttpRequestException("no route"));
        using var service = Fixtures.Service(handler);
        await Assert.ThrowsAsync<NativeOfflineException>(() => service.PortalAsync(CancellationToken.None));
        Assert.Equal(2, handler.Requests.Count);
        Assert.True(service.HasSession);
    }

    [Fact]
    public async Task RateLimitCarriesRetryAfterForTheUser()
    {
        var handler = new StubHandler(_ =>
        {
            var response = StubHandler.Status(HttpStatusCode.TooManyRequests);
            response.Headers.RetryAfter = new System.Net.Http.Headers.RetryConditionHeaderValue(TimeSpan.FromSeconds(30));
            return response;
        });
        using var service = Fixtures.Service(handler);
        var error = await Assert.ThrowsAsync<NativeApiException>(() => service.PortalAsync(CancellationToken.None));
        Assert.Equal(TimeSpan.FromSeconds(30), error.RetryAfter);
        Assert.Contains("30 seconds", NativeErrorText.ForUser(error));
    }

    [Fact]
    public async Task MalformedJsonIsReportedNotThrownRaw()
    {
        var handler = new StubHandler(_ => StubHandler.Json("{not json"));
        using var service = Fixtures.Service(handler);
        var error = await Assert.ThrowsAsync<NativeApiException>(() => service.PortalAsync(CancellationToken.None));
        Assert.Equal(HttpStatusCode.BadGateway, error.Status);
    }

    [Theory]
    [InlineData("/api/portal/me")]
    [InlineData("https://evil.test/api")]
    [InlineData("api/../../secret")]
    public async Task RejectsPathsThatCouldLeaveTheCaboOrigin(string path)
    {
        var handler = new StubHandler(_ => StubHandler.Json("{}"));
        using var service = Fixtures.Service(handler);
        await Assert.ThrowsAsync<ArgumentException>(() => service.SendAsync(HttpMethod.Get, path, null, CancellationToken.None));
        Assert.Empty(handler.Requests);
    }

    [Theory]
    [InlineData("""{"access_token":"tok_0123456789abcdefghijklmnopqrstuvwxyzABCD","token_type":"Bearer","expires_in":7200}""")]
    [InlineData("""{"access_token":"tok_0123456789abcdefghijklmnopqrstuvwxyzABCD","token_type":"MAC","expires_in":3600}""")]
    [InlineData("""{"access_token":"short","token_type":"Bearer","expires_in":3600}""")]
    [InlineData("""{"token_type":"Bearer","expires_in":3600}""")]
    public void RejectsUnexpectedSessionResponses(string json)
    {
        var store = new MemorySessionStore();
        using var service = Fixtures.Service(new StubHandler(_ => StubHandler.Json("{}")), store, signedIn: false);
        using var doc = JsonDocument.Parse(json);
        Assert.Throws<InvalidOperationException>(() => service.AcceptSession(doc.RootElement));
        Assert.False(service.HasSession);
        Assert.Null(store.Load());
    }

    [Fact]
    public void AcceptsSessionWithBoundedExpiry()
    {
        var store = new MemorySessionStore();
        using var service = Fixtures.Service(new StubHandler(_ => StubHandler.Json("{}")), store, signedIn: false);
        using var doc = JsonDocument.Parse($$"""{"access_token":"{{Fixtures.Token}}","token_type":"Bearer","expires_in":3600}""");
        service.AcceptSession(doc.RootElement);
        Assert.True(service.HasSession);
        Assert.Equal(Fixtures.Now.AddHours(1), store.Load()!.ExpiresAt);
    }

    [Fact]
    public async Task SignOutClearsLocalSessionEvenWhenOffline()
    {
        var store = new MemorySessionStore();
        var handler = new StubHandler(_ => throw new HttpRequestException("offline"));
        using var service = Fixtures.Service(handler, store);
        await service.SignOutAsync(CancellationToken.None);
        Assert.False(service.HasSession);
        Assert.Null(store.Load());
    }

    [Fact]
    public async Task TestLoginIsUnavailableInStandardBuilds()
    {
        var handler = new StubHandler(_ => StubHandler.Json("{}"));
        using var service = Fixtures.Service(handler, signedIn: false, testLogin: false);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            service.SignInTestAsync("cabo_test", "a-long-test-password", CancellationToken.None));
        Assert.Empty(handler.Requests);
    }

#if !CABO_ISOLATED_TEST
    [Fact]
    public void ReleaseBuildAlwaysUsesPilotOriginAndDisablesTestLogin()
    {
        Assert.Equal("https://" + NativeLearningService.PilotHost + "/", NativeLearningService.ResolveOrigin().ToString());
    }
#endif

    [Fact]
    public void RefusesPlainHttpOrigin()
    {
        Assert.Throws<ArgumentException>(() => new NativeLearningService(new StubHandler(_ => StubHandler.Json("{}")),
            new MemorySessionStore(), new Uri("http://cabo.test/"), null, null, false));
    }
}

public class SubmissionTests
{
    [Fact]
    public async Task QuizSubmissionCarriesIdempotencyKey()
    {
        var handler = new StubHandler(_ => StubHandler.Json(
            """{"id":9,"quizId":4,"correctCount":1,"totalQuestions":2,"percentage":50,"feedback":[{"questionIndex":0,"isCorrect":true,"explanation":"ok"}]}"""));
        using var service = Fixtures.Service(handler);
        var attempt = await service.SubmitQuizAsync(4, new[] { 2, 0 }, "key_0123456789abcdef", CancellationToken.None);
        var request = Assert.Single(handler.Requests);
        Assert.Equal("key_0123456789abcdef", request.Headers["Idempotency-Key"]);
        Assert.Equal("""{"answers":[2,0]}""", request.Body);
        Assert.Equal(50, attempt.Percentage);
    }

    [Fact]
    public async Task RejectsAttemptForADifferentQuiz()
    {
        var handler = new StubHandler(_ => StubHandler.Json("""{"id":9,"quizId":99,"correctCount":1,"totalQuestions":1,"percentage":100,"feedback":[]}"""));
        using var service = Fixtures.Service(handler);
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.SubmitQuizAsync(4, new[] { 0 }, "key_0123456789abcdef", CancellationToken.None));
    }

    [Theory]
    [InlineData("", "a question that is long enough", "tried this")]
    [InlineData("fractions", "short", "tried this")]
    [InlineData("fractions", "a question that is long enough", "")]
    public async Task HelpRequestValidatesBeforeSending(string concept, string question, string attempted)
    {
        var handler = new StubHandler(_ => StubHandler.Json("""{"id":1}"""));
        using var service = Fixtures.Service(handler);
        await Assert.ThrowsAsync<ArgumentException>(() => service.SubmitHelpRequestAsync(
            new SupportCourse(3, 7, "Maths"), concept, question, attempted, Guid.NewGuid(), CancellationToken.None));
        Assert.Empty(handler.Requests);
    }

    [Fact]
    public async Task HelpRequestUsesUuidRequestKeyAndOwnSchoolPath()
    {
        var handler = new StubHandler(_ => StubHandler.Json("""{"id":12}"""));
        using var service = Fixtures.Service(handler);
        var key = Guid.Parse("6f1c2b8e-1d0a-4c55-9a8e-111111111111");
        var id = await service.SubmitHelpRequestAsync(new SupportCourse(3, 7, "Maths"), " fractions ",
            "How do I add unlike fractions?", "Common denominators", key, CancellationToken.None);
        Assert.Equal(12, id);
        var request = Assert.Single(handler.Requests);
        Assert.Equal("/api/organizations/3/support", request.Uri.AbsolutePath);
        using var body = JsonDocument.Parse(request.Body!);
        Assert.Equal("6f1c2b8e-1d0a-4c55-9a8e-111111111111", body.RootElement.GetProperty("requestKey").GetString());
        Assert.Equal("fractions", body.RootElement.GetProperty("concept").GetString());
        Assert.False(body.RootElement.TryGetProperty("learnerId", out _));
    }

    [Fact]
    public async Task EnablingNotificationsRequiresAcknowledgedConsent()
    {
        var handler = new StubHandler(_ => StubHandler.Json("{}"));
        using var service = Fixtures.Service(handler);
        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.SetNotificationPreferenceAsync(3, "learner_support_updated", true, false, CancellationToken.None));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.SetNotificationPreferenceAsync(3, "marketing", false, false, CancellationToken.None));
        Assert.Empty(handler.Requests);

        await service.SetNotificationPreferenceAsync(3, "learner_support_updated", false, false, CancellationToken.None);
        var request = Assert.Single(handler.Requests);
        Assert.Equal(HttpMethod.Patch, request.Method);
    }

    [Fact]
    public async Task GuardianReviewSendsExplicitEvidenceDecision()
    {
        var handler = new StubHandler(_ => StubHandler.Json("{}"));
        using var service = Fixtures.Service(handler);
        await service.ReviewGuardianAsync(new GuardianReview(5, 8, "learner-x", "guardian-y", "pending"), verify: false,
            CancellationToken.None);
        var request = Assert.Single(handler.Requests);
        Assert.Equal("/api/organizations/5/guardian-reviews/8", request.Uri.AbsolutePath);
        Assert.Equal("""{"decision":"revoked","evidenceReviewed":true}""", request.Body);
    }
}

public class UploadTests
{
    private static readonly byte[] Pdf = { 0x25, 0x50, 0x44, 0x46 };

    [Fact]
    public void ExternalStorageNeverReceivesTheBearer()
    {
        var target = NativeLearningService.ValidateUploadTarget("https://storage.example/upload?sig=1", Fixtures.Origin, out var bearer);
        Assert.False(bearer);
        Assert.Equal("storage.example", target.Host);
    }

    [Theory]
    [InlineData("http://storage.example/upload")]
    [InlineData("https://user:pw@storage.example/upload")]
    [InlineData("https://cabo.test/api/materials")]
    [InlineData("not a url")]
    public void RejectsUnsafeUploadTargets(string url)
    {
        Assert.Throws<InvalidOperationException>(() => NativeLearningService.ValidateUploadTarget(url, Fixtures.Origin, out _));
    }

    [Fact]
    public void IsolatedTestStorageRouteMayReceiveBearer()
    {
        NativeLearningService.ValidateUploadTarget(
            "https://cabo.test/api/storage/uploads/railway/0f8fad5b-d9cb-469f-a165-70867728950e", Fixtures.Origin, out var bearer);
        Assert.True(bearer);
    }

    [Fact]
    public async Task UploadFlowKeepsTokenOnCaboOnly()
    {
        var handler = new StubHandler(r => r.Uri.AbsolutePath switch
        {
            "/api/storage/uploads/request-url" => StubHandler.Json(
                """{"uploadURL":"https://storage.example/put?sig=abc","objectPath":"/objects/uploads/abc"}"""),
            "/put" => StubHandler.Status(HttpStatusCode.OK),
            "/api/materials" => StubHandler.Json("""{"id":44,"title":"Algebra notes"}"""),
            _ => StubHandler.Status(HttpStatusCode.NotFound)
        });
        using var service = Fixtures.Service(handler);
        var saved = await service.UploadMaterialAsync("notes.pdf", Pdf, "Algebra notes", CancellationToken.None);
        Assert.Equal(44, saved.Id);
        var requests = handler.Requests.ToArray();
        Assert.Equal(3, requests.Length);
        Assert.NotNull(requests[0].Authorization);
        Assert.Contains("\"allowAiReading\":false", requests[0].Body);
        Assert.Null(requests[1].Authorization);
        Assert.Equal("storage.example", requests[1].Uri.Host);
        Assert.NotNull(requests[2].Authorization);
    }

    [Theory]
    [InlineData("virus.exe")]
    [InlineData("script.js")]
    [InlineData("noextension")]
    public async Task RejectsUnsupportedFileTypes(string name)
    {
        var handler = new StubHandler(_ => StubHandler.Json("{}"));
        using var service = Fixtures.Service(handler);
        await Assert.ThrowsAsync<ArgumentException>(() => service.UploadMaterialAsync(name, Pdf, "Title", CancellationToken.None));
        Assert.Empty(handler.Requests);
    }

    [Fact]
    public async Task RejectsEmptyAndOversizedFiles()
    {
        var handler = new StubHandler(_ => StubHandler.Json("{}"));
        using var service = Fixtures.Service(handler);
        await Assert.ThrowsAsync<ArgumentException>(() => service.UploadMaterialAsync("a.pdf", Array.Empty<byte>(), "T", CancellationToken.None));
        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.UploadMaterialAsync("a.pdf", new byte[NativeLearningService.MaxMaterialBytes + 1], "T", CancellationToken.None));
        Assert.Empty(handler.Requests);
    }
}

public class OrganizationFanOutTests
{
    [Fact]
    public async Task CountsFailedSchoolsInsteadOfShowingZeros()
    {
        var result = await NativeLearningService.ForEachOrganizationAsync<int>(new[] { 1, 2, 3, 2, -1 }, (id, _) =>
            id == 2 ? throw new NativeForbiddenException() : Task.FromResult<System.Collections.Generic.IEnumerable<int>>(new[] { id }),
            CancellationToken.None);
        Assert.Equal(new[] { 1, 3 }, result.Items.OrderBy(i => i).ToArray());
        Assert.Equal(1, result.FailedOrganizations);
        Assert.True(result.IsPartial);
    }

    [Fact]
    public async Task ExpiredSessionPropagates()
    {
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            NativeLearningService.ForEachOrganizationAsync<int>(new[] { 1, 2 }, (_, _) =>
                throw new UnauthorizedAccessException(), CancellationToken.None));
    }

    [Fact]
    public async Task LearnerReportsNeverSendALearnerId()
    {
        var handler = new StubHandler(_ => StubHandler.Json("""{"year":2026,"grade":"Grade 10","average":72.5,"subjects":[{"name":"Maths","percentage":48}]}"""));
        using var service = Fixtures.Service(handler);
        var reports = await service.LearnerReportsAsync(new[] { 3 }, CancellationToken.None);
        var request = Assert.Single(handler.Requests);
        Assert.Equal("/api/reports/me", request.Uri.AbsolutePath);
        Assert.DoesNotContain("learner", request.Uri.Query, StringComparison.OrdinalIgnoreCase);
        var report = Assert.Single(reports.Items);
        Assert.Equal(72.5, report.Average);
    }

    [Fact]
    public async Task MissingReportIsNotFabricatedAsZero()
    {
        var handler = new StubHandler(_ => StubHandler.Status(HttpStatusCode.NotFound));
        using var service = Fixtures.Service(handler);
        var reports = await service.LearnerReportsAsync(new[] { 3 }, CancellationToken.None);
        Assert.Empty(reports.Items);
        Assert.False(reports.IsPartial);
    }
}
