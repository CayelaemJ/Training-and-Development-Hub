using Xunit;
using System;
using System.Linq;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace CABO.Native.Tests;

public class ParsingTests
{
    private static JsonElement Parse(string json) => JsonDocument.Parse(json).RootElement.Clone();

    [Fact]
    public void PortalKeepsOnlyValidDistinctBoundedOrganizations()
    {
        var ids = string.Join(",", Enumerable.Range(1, 30));
        var portal = NativeLearningService.ParsePortal(Parse(
            $$"""{"role":"teacher","organizationIds":[-4,0,"7",{{ids}},3],"summary":{"learningStages":2,"bad":"x"},"cards":[{"label":"Teaching"}]}"""));
        Assert.Equal("teacher", portal.Role);
        Assert.Equal(12, portal.OrganizationIds.Count);
        Assert.All(portal.OrganizationIds, id => Assert.True(id > 0));
        Assert.Equal(portal.OrganizationIds.Distinct().Count(), portal.OrganizationIds.Count);
        Assert.Single(portal.Summary);
        Assert.Equal("Teaching", Assert.Single(portal.Cards));
    }

    [Fact]
    public void MissingRoleDefaultsToLeastPrivilegedLearner()
    {
        Assert.Equal("learner", NativeLearningService.ParsePortal(Parse("{}")).Role);
    }

    [Fact]
    public void EducationCommandSuppressesSmallCohortsEvenIfServerLeaksThem()
    {
        var data = NativeLearningService.ParseEducationCommand(Parse(
            """{"year":2026,"minimumCohort":10,"schools":[{"id":1,"name":"A","learnerCount":4,"attendanceRate":90},{"id":2,"name":"B","learnerCount":40,"attendanceRate":101},{"id":3,"name":"C","learnerCount":55,"attendanceRate":88}]}"""), 2026);
        var a = data.Schools.Single(s => s.Id == 1);
        Assert.True(a.PrivacySuppressed);
        Assert.Null(a.LearnerCount);
        Assert.Null(a.AttendanceRate);
        var b = data.Schools.Single(s => s.Id == 2);
        Assert.False(b.PrivacySuppressed);
        Assert.Null(b.AttendanceRate); // 101% is not a valid rate
        Assert.Equal(88, data.Schools.Single(s => s.Id == 3).AttendanceRate);
        Assert.False(data.OfficialData);
    }

    [Fact]
    public void MinimumCohortCannotBeLoweredBelowTen()
    {
        var data = NativeLearningService.ParseEducationCommand(Parse(
            """{"minimumCohort":2,"schools":[{"id":1,"name":"A","learnerCount":5}]}"""), 2026);
        Assert.Equal(10, data.MinimumCohort);
        Assert.True(data.Schools.Single().PrivacySuppressed);
    }

    [Fact]
    public async Task GuardianNamesAreHiddenUnlessVerifiedForRead()
    {
        var handler = new StubHandler(_ => StubHandler.Json(
            """{"relationships":[{"invitationId":1,"status":"pending","learnerName":"Thandi","verifiedForRead":false},{"invitationId":2,"status":"verified","learnerName":"Kagiso","verifiedForRead":true}],"guidance":"School verification is required."}"""));
        using var service = Fixtures.Service(handler);
        var overview = await service.GuardianOverviewAsync(CancellationToken.None);
        Assert.Null(overview.Links.Single(l => l.InvitationId == 1).LearnerName);
        Assert.Equal("Kagiso", overview.Links.Single(l => l.InvitationId == 2).LearnerName);
    }

    [Fact]
    public void LearnerReportRejectsImpossibleValues()
    {
        var report = NativeLearningService.ParseLearnerReport(Parse(
            """{"year":2026,"grade":"Grade 9","average":140,"attendance":{"rate":-3},"subjects":[{"name":"","percentage":50},{"name":"Science","percentage":"60"}]}"""), 3)!;
        Assert.Null(report.Average);
        Assert.Null(report.AttendanceRate);
        var subject = Assert.Single(report.Subjects);
        Assert.Equal("Science", subject.Name);
        Assert.Null(subject.Percentage); // a string is not trusted as a mark
        Assert.Null(NativeLearningService.ParseLearnerReport(Parse("""{"year":1800}"""), 3));
    }

    [Fact]
    public void StringsAreLengthCapped()
    {
        var huge = new string('x', 10_000);
        var journey = NativeLearningService.ParseJourney(Parse(
            $$"""{"identity":{"displayName":"{{huge}}"},"milestones":[{"id":1,"title":"{{huge}}","description":"Won","kind":"sport","year":2026}]}"""));
        Assert.Equal(160, journey.DisplayName.Length);
        Assert.Equal(160, journey.Milestones.Single().Title.Length);
    }

    [Fact]
    public void IntelligenceThresholdsAreClamped()
    {
        var data = NativeLearningService.ParseIntelligence(5, 2026,
            Parse("""{"records":-5,"counts":{"present":8,"absent":-2}}"""),
            Parse("""{"studentsReviewed":3,"attentionNeeded":1,"thresholds":{"subjectBelow":400,"attendanceBelow":-1},"learners":[{"learnerId":"L1","average":45,"subjectsAtRisk":["Maths"]},{"learnerId":""}]}"""));
        Assert.Equal(0, data.AttendanceRecords);
        Assert.Equal(0, data.AttendanceCounts["absent"]);
        Assert.Equal(100, data.SubjectBelow);
        Assert.Equal(0, data.AttendanceBelow);
        Assert.Single(data.Learners);
    }
}

public class RoleAccessTests
{
    private static readonly OrganizationMembership LearnerAt3 = new(3, "Hope High", "learner");
    private static readonly OrganizationMembership TeacherAt3 = new(3, "Hope High", "teacher");
    private static readonly OrganizationMembership AdminAt3 = new(3, "Hope High", "admin");

    [Fact]
    public void LearnerSeesOnlyLearnerSections()
    {
        var sections = RoleAccess.SectionsFor("learner", new[] { LearnerAt3 });
        Assert.Contains(NativeSection.Practice, sections);
        Assert.Contains(NativeSection.HelpRequests, sections);
        Assert.Contains(NativeSection.School, sections);
        Assert.DoesNotContain(NativeSection.SupportQueue, sections);
        Assert.DoesNotContain(NativeSection.GuardianReviews, sections);
        Assert.DoesNotContain(NativeSection.SchoolIntelligence, sections);
        Assert.DoesNotContain(NativeSection.Registry, sections);
        Assert.DoesNotContain(NativeSection.EducationCommand, sections);
    }

    [Fact]
    public void GuardianSeesFamilySectionsAndNoSchoolRecords()
    {
        var sections = RoleAccess.SectionsFor("parent", Array.Empty<OrganizationMembership>());
        Assert.Equal(new[] { NativeSection.Overview, NativeSection.Family, NativeSection.FamilyReports, NativeSection.Notifications },
            sections);
    }

    [Fact]
    public void TeacherSeesTeachingTools()
    {
        var sections = RoleAccess.SectionsFor("teacher", new[] { TeacherAt3 });
        Assert.Contains(NativeSection.SupportQueue, sections);
        Assert.Contains(NativeSection.Materials, sections);
        Assert.Contains(NativeSection.GuardianReviews, sections);
        Assert.Contains(NativeSection.SchoolIntelligence, sections);
        Assert.DoesNotContain(NativeSection.Registry, sections);
        Assert.DoesNotContain(NativeSection.Practice, sections);
    }

    [Fact]
    public void OnlyPlatformAdminSeesRegistry()
    {
        Assert.Contains(NativeSection.Registry, RoleAccess.SectionsFor("superadmin", Array.Empty<OrganizationMembership>()));
        Assert.DoesNotContain(NativeSection.Registry, RoleAccess.SectionsFor("district_director", Array.Empty<OrganizationMembership>()));
        Assert.Contains(NativeSection.EducationCommand, RoleAccess.SectionsFor("district_director", Array.Empty<OrganizationMembership>()));
    }

    [Fact]
    public void SchoolManagerGetsOversightView()
    {
        var sections = RoleAccess.SectionsFor("administrator", new[] { AdminAt3 });
        Assert.Contains(NativeSection.EducationCommand, sections);
        Assert.Contains(NativeSection.SchoolIntelligence, sections);
    }

    [Fact]
    public void UnknownRoleGetsOverviewOnly()
    {
        Assert.Equal(new[] { NativeSection.Overview }, RoleAccess.SectionsFor("something_new", Array.Empty<OrganizationMembership>()));
    }

    [Theory]
    [InlineData("deputy_headmaster", "Deputy Headmaster")]
    [InlineData("parent", "Parent or guardian")]
    public void FriendlyRoleNames(string role, string expected) => Assert.Equal(expected, RoleAccess.FriendlyRole(role));
}

public class SessionStoreTests
{
    [Fact]
    public void EncodesExpiryAndReadsLegacyBareToken()
    {
        var session = new NativeSession(Fixtures.Token, DateTimeOffset.FromUnixTimeSeconds(1_800_000_000));
        var decoded = DpapiSessionStore.Decode(DpapiSessionStore.Encode(session));
        Assert.Equal(session, decoded);

        var legacy = DpapiSessionStore.Decode(Encoding.UTF8.GetBytes(Fixtures.Token));
        Assert.Equal(Fixtures.Token, legacy!.AccessToken);
        Assert.Null(legacy.ExpiresAt);
        Assert.Null(DpapiSessionStore.Decode(Encoding.UTF8.GetBytes("short")));
    }

    [Fact]
    public void DpapiFileIsEncryptedAndRemovedOnClear()
    {
        if (!OperatingSystem.IsWindows()) return; // DPAPI exists only on Windows runners.
        var path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "cabo-test-" + Guid.NewGuid().ToString("N"), "s.bin");
        var store = new DpapiSessionStore(path);
        store.Save(new NativeSession(Fixtures.Token, Fixtures.Now));
        var raw = System.IO.File.ReadAllBytes(path);
        Assert.DoesNotContain(Fixtures.Token, Encoding.UTF8.GetString(raw));
        Assert.Equal(Fixtures.Token, store.Load()!.AccessToken);
        store.Clear();
        Assert.False(System.IO.File.Exists(path));
        Assert.Null(store.Load());
    }

    [Fact]
    public void CorruptFileIsDiscarded()
    {
        if (!OperatingSystem.IsWindows()) return;
        var dir = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "cabo-test-" + Guid.NewGuid().ToString("N"));
        System.IO.Directory.CreateDirectory(dir);
        var path = System.IO.Path.Combine(dir, "s.bin");
        System.IO.File.WriteAllBytes(path, new byte[] { 1, 2, 3, 4 });
        Assert.Null(new DpapiSessionStore(path).Load());
        Assert.False(System.IO.File.Exists(path));
    }
}

public class ErrorTextTests
{
    [Fact]
    public void MessagesNeverExposeServerDetail()
    {
        var error = new NativeApiException(HttpStatusCode.InternalServerError, "SQL error at users.id=abc");
        var text = NativeErrorText.ForUser(error);
        Assert.DoesNotContain("SQL", text);
        Assert.Equal("Your account is not authorised for this information.", NativeErrorText.ForUser(new NativeForbiddenException()));
    }
}
