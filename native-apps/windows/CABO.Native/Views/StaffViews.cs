using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Controls;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace CABO.Native;

// Teacher, assessor and school-leader sections. Learner identifiers come from
// the server's authorised views; the client never widens a query by passing
// another person's ID, and decisions are confirmed before they are sent.
public sealed partial class MainWindow
{
    // ----------------------------------------------------- school operations

    private async Task<IReadOnlyList<UIElement>> RenderSchoolAsync(CancellationToken token)
    {
        var schools = await service.SchoolOperationsAsync(memberships, token);
        if (schools.Count == 0)
            return new UIElement[] { Ui.Empty("No school information is available to your account.") };
        var items = new List<UIElement>();
        foreach (var school in schools)
        {
            items.Add(Ui.Heading($"{school.Name} · {Ui.Humanize(school.Role)}", 2));
            if (school.Warning is not null) items.Add(Ui.Notice("Partly loaded", school.Warning, InfoBarSeverity.Warning));

            if (school.Notices.Count == 0) items.Add(Ui.Empty("No notices."));
            foreach (var n in school.Notices.OrderByDescending(n => n.CreatedAt).Take(30))
                items.Add(Ui.Card(Ui.Heading(n.Subject, 3), Ui.Body(Ui.Date(n.CreatedAt), secondary: true),
                    Ui.Body(n.Message, selectable: true)));

            if (school.Attendance.Count > 0)
            {
                var present = school.Attendance.Count(a => a.Status is "present" or "late");
                var rate = 100.0 * present / school.Attendance.Count;
                var recent = school.Attendance.OrderByDescending(a => a.Day).Take(10)
                    .Select(a => $"{a.Day}: {Ui.Humanize(a.Status)}");
                items.Add(Ui.Card(Ui.Heading("My attendance", 3), Ui.Meter("Present or late", rate),
                    Ui.Body(string.Join(Environment.NewLine, recent), secondary: true)));
            }

            if (school.Summary is { } summary)
                items.Add(Ui.Card(Ui.Heading($"Attendance records {summary.Year}", 3),
                    Ui.Body($"{summary.Records:N0} records"),
                    Ui.Body(Ui.Join(summary.Counts.Select(c => $"{Ui.Humanize(c.Key)} {c.Value:N0}")), secondary: true)));

            if (school.Timetable.Count > 0)
            {
                var lines = school.Timetable.OrderBy(t => t.Day).ThenBy(t => t.StartsAt).Take(60).Select(t =>
                    $"{Ui.Day(t.Day)} {t.StartsAt}–{t.EndsAt} · {t.Subject}" +
                    (t.Grade.Length > 0 ? $" · {t.Grade}{(t.Group.Length > 0 ? " " + t.Group : "")}" : "") +
                    (t.Room.Length > 0 ? $" · {t.Room}" : "") +
                    (t.Status is "" or "scheduled" ? "" : $" · {Ui.Humanize(t.Status)}"));
                items.Add(Ui.Card(Ui.Heading("Timetable", 3), Ui.Body(string.Join(Environment.NewLine, lines))));
            }
        }
        return items;
    }

    // --------------------------------------------------------- support queue

    private async Task<IReadOnlyList<UIElement>> RenderSupportQueueAsync(CancellationToken token)
    {
        var result = await service.StaffWorkspacesAsync(OrganizationIds, token);
        var items = new List<UIElement>
        {
            Ui.Body("Help requests from learners in your classes. Drafted guidance is for you to review — nothing is sent to a learner until you reply.",
                secondary: true)
        };
        if (result.IsPartial) items.Add(PartialNotice(result.FailedOrganizations));
        if (result.Items.Count == 0) items.Add(Ui.Empty("No schools with learner support are linked to your account."));

        foreach (var ws in result.Items)
        {
            var name = memberships.FirstOrDefault(m => m.Id == ws.OrganizationId)?.Name ?? $"School {ws.OrganizationId}";
            items.Add(Ui.Heading(name, 2));
            if (ws.Warning is not null) items.Add(Ui.Notice("Learner support", ws.Warning, InfoBarSeverity.Warning));
            if (ws.Courses.Count > 0) items.Add(Ui.Body("My subjects: " + Ui.Join(ws.Courses), secondary: true));
            if (ws.Accountability.Count > 0)
                items.Add(Ui.Body(Ui.Join(ws.Accountability.Select(s => $"{Ui.Humanize(Split(s.Name))}: {s.Value:N0}"))));
            if (ws.Tickets.Count == 0 && ws.Warning is null) items.Add(Ui.Empty("No open help requests."));
            foreach (var ticket in ws.Tickets) items.Add(BuildTicketCard(ticket));
        }
        return items;
    }

    private Border BuildTicketCard(SupportTicket initial)
    {
        var ticket = initial;
        var status = Ui.Body($"Status: {Ui.Humanize(ticket.Status)} · updated {Ui.Date(ticket.UpdatedAt)}", secondary: true);
        var guidance = new StackPanel { Spacing = 4 };
        var reply = Ui.Input("Reply to learner", 4000, multiline: true);

        var draft = Ui.Button("Draft guidance", async (_, _) =>
        {
            SupportGuidance? g = null;
            if (!await RunActionAsync(async ct => g = await service.RequestGuidanceAsync(ticket, ct), "Guidance unavailable",
                    TimeSpan.FromSeconds(60)) || g is null) return;
            guidance.Children.Clear();
            guidance.Children.Add(Ui.Notice(g.Source == "non_ai_template" ? "Template draft" : "AI-assisted draft",
                "Check accuracy and suitability before using any of this with the learner.", InfoBarSeverity.Informational));
            if (g.Explanation.Length > 0) guidance.Children.Add(Ui.Body(g.Explanation, selectable: true));
            if (g.Questions.Count > 0) guidance.Children.Add(Ui.Body("Check questions:" + Environment.NewLine + string.Join(Environment.NewLine, g.Questions.Select(q => "• " + q)), selectable: true));
            if (g.Practice.Count > 0) guidance.Children.Add(Ui.Body("Practice:" + Environment.NewLine + string.Join(Environment.NewLine, g.Practice.Select(q => "• " + q)), selectable: true));
            guidance.Children.Add(Ui.Button("Copy explanation into reply", (_, _) =>
            {
                if (reply.Text.Trim().Length == 0) reply.Text = g.Explanation;
            }));
        });

        var send = Ui.Button("Send reply", async (_, _) =>
        {
            var body = reply.Text;
            SupportTicket? updated = null;
            if (!await RunActionAsync(async ct => updated = await service.ReplyToTicketAsync(ticket, body, ct), "Reply not sent") ||
                updated is null) return;
            ticket = updated;
            reply.Text = "";
            status.Text = $"Status: {Ui.Humanize(ticket.Status)} · updated {Ui.Date(ticket.UpdatedAt)}";
            ShowStatus("Reply sent", "The learner will see your reply in CABO.", InfoBarSeverity.Success);
        }, accent: true);

        return Ui.Card(Ui.Heading(ticket.Concept, 3), status, Ui.Row(draft), guidance, reply, send);
    }

    // ------------------------------------------------- guardian verification

    private async Task<IReadOnlyList<UIElement>> RenderGuardianReviewsAsync(CancellationToken token)
    {
        var result = await service.GuardianReviewsAsync(OrganizationIds, token);
        var items = new List<UIElement>
        {
            Ui.Body("Verify a parent or guardian only after your school has checked their identity and relationship documents. " +
                    "Revoking access immediately stops their view of the learner's records.", secondary: true)
        };
        if (result.IsPartial) items.Add(PartialNotice(result.FailedOrganizations));
        if (result.Items.Count == 0) items.Add(Ui.Empty("No guardian links are awaiting review."));
        foreach (var review in result.Items.OrderBy(r => r.Status != "pending"))
        {
            var school = memberships.FirstOrDefault(m => m.Id == review.OrganizationId)?.Name ?? $"School {review.OrganizationId}";
            var state = Ui.Body($"Status: {Ui.Humanize(review.Status)}", secondary: true);
            var verify = Ui.Button("Verify guardian", (_, _) => { }, accent: true);
            var revoke = Ui.Button("Revoke access", (_, _) => { });
            async Task Decide(bool approve)
            {
                if (!await ConfirmAsync(approve ? "Verify this guardian?" : "Revoke this guardian's access?",
                        approve
                            ? "Confirm that your school has reviewed evidence of this person's identity and their legal relationship to the learner."
                            : "This guardian will no longer see the learner's progress or reports.",
                        approve ? "Verify" : "Revoke")) return;
                if (!await RunActionAsync(ct => service.ReviewGuardianAsync(review, approve, ct), "Decision not saved")) return;
                state.Text = "Status: " + (approve ? "Verified" : "Revoked");
                verify.IsEnabled = revoke.IsEnabled = false;
                ShowStatus("Saved", "The guardian decision was recorded and audited by CABO.", InfoBarSeverity.Success);
            }
            verify.Click += async (_, _) => await Decide(true);
            revoke.Click += async (_, _) => await Decide(false);
            items.Add(Ui.Card(Ui.Heading(school, 3),
                Ui.Body($"Learner reference: {review.LearnerId}"), Ui.Body($"Guardian reference: {review.GuardianId}"),
                state, Ui.Row(verify, revoke)));
        }
        return items;
    }

    // -------------------------------------------------------- report issuance

    private async Task<IReadOnlyList<UIElement>> RenderReportIssuanceAsync(CancellationToken token)
    {
        var result = await service.ReportIssuanceAsync(OrganizationIds, token);
        var items = new List<UIElement>
        {
            Ui.Body("Official reports move through submission, review and issue in the CABO web app. This view shows their status.",
                secondary: true)
        };
        if (result.IsPartial) items.Add(PartialNotice(result.FailedOrganizations));
        if (result.Items.Count == 0) items.Add(Ui.Empty("No reports in the issuance workflow."));
        foreach (var group in result.Items.GroupBy(r => r.Status).OrderBy(g => g.Key))
        {
            var card = Ui.Card(Ui.Heading($"{Ui.Humanize(group.Key)} ({group.Count()})", 3));
            var panel = (StackPanel)card.Child;
            foreach (var r in group.Take(50))
                panel.Children.Add(Ui.Body($"{r.LearnerId} · {r.AcademicYear} · version {r.Version}" +
                                           (r.IssuedAt is null ? "" : " · issued " + Ui.Date(r.IssuedAt))));
            items.Add(card);
        }
        return items;
    }

    // ------------------------------------------------- academic analytics

    private Task<IReadOnlyList<UIElement>> RenderSchoolIntelligenceAsync(CancellationToken token)
    {
        var candidates = memberships.Where(m => RoleAccess.IntelligenceMembershipRoles.Contains(m.Role)).ToList();
        if (candidates.Count == 0) candidates = memberships.ToList();
        if (candidates.Count == 0)
            return Task.FromResult<IReadOnlyList<UIElement>>(new UIElement[] { Ui.Empty("No school is linked to your account.") });

        var picker = new ComboBox { Header = "School", ItemsSource = candidates.Select(c => c.Name).ToList(), MinWidth = 320 };
        AutomationProperties.SetName(picker, "School");
        var output = new StackPanel { Spacing = 10 };
        picker.SelectionChanged += async (_, _) =>
        {
            if (picker.SelectedIndex < 0) return;
            var org = candidates[picker.SelectedIndex];
            output.Children.Clear();
            SchoolIntelligence? data = null;
            if (!await RunActionAsync(async ct => data = await service.SchoolIntelligenceAsync(org.Id, ct),
                    "Analytics unavailable", TimeSpan.FromSeconds(40)) || data is null)
            {
                output.Children.Add(Ui.Empty("Analytics could not be loaded for this school."));
                return;
            }
            foreach (var element in BuildIntelligence(data)) output.Children.Add(element);
        };
        IReadOnlyList<UIElement> items = new UIElement[]
        {
            Ui.Body("Aggregated from records your school has captured. Use it to plan interventions; it is not an official district statistic.",
                secondary: true),
            picker, output
        };
        // Select after the section has finished rendering so the load is not refused as "busy".
        if (candidates.Count == 1)
            DispatcherQueue.TryEnqueue(Microsoft.UI.Dispatching.DispatcherQueuePriority.Low, () => picker.SelectedIndex = 0);
        return Task.FromResult(items);
    }

    private static IEnumerable<UIElement> BuildIntelligence(SchoolIntelligence data)
    {
        var attendanceTotal = data.AttendanceCounts.Values.Sum();
        var present = data.AttendanceCounts.TryGetValue("present", out var p) ? p : 0;
        yield return Ui.Card(Ui.Heading($"{data.Year} overview", 3),
            Ui.Body($"Learners reviewed: {data.StudentsReviewed:N0}"),
            Ui.Body($"Need attention: {data.AttentionNeeded:N0} (subject below {data.SubjectBelow:0}% or attendance below {data.AttendanceBelow:0}%)"),
            attendanceTotal > 0 ? (UIElement)Ui.Meter("Recorded present", 100.0 * present / attendanceTotal) : Ui.Body("No attendance captured yet.", secondary: true),
            Ui.Body(data.OfficialDistrictData ? "Includes official district data." : "School-captured data only.", secondary: true));

        var flagged = data.Learners
            .Where(l => l.SubjectsAtRisk.Count > 0 || (l.Average ?? 100) < data.SubjectBelow || (l.AttendanceRate ?? 100) < data.AttendanceBelow)
            .OrderBy(l => l.Average ?? 100).Take(100).ToList();
        if (flagged.Count == 0)
        {
            yield return Ui.Empty("No learners currently meet the intervention thresholds.");
            yield break;
        }
        yield return Ui.Heading("Learners who may need support", 3);
        foreach (var l in flagged)
        {
            var parts = new List<string> { l.Grade.Length > 0 ? l.Grade : "Grade not set" };
            if (l.Average is { } avg) parts.Add($"average {avg:0.#}%");
            if (l.AttendanceRate is { } att) parts.Add($"attendance {att:0.#}%");
            if (l.SupportPlans > 0) parts.Add($"{l.SupportPlans} support plan{(l.SupportPlans == 1 ? "" : "s")}");
            var lines = new List<UIElement> { Ui.Body(l.LearnerId), Ui.Body(Ui.Join(parts), secondary: true) };
            if (l.SubjectsAtRisk.Count > 0) lines.Add(Ui.Body("Subjects at risk: " + Ui.Join(l.SubjectsAtRisk)));
            yield return Ui.Card(lines.ToArray());
        }
    }
}
