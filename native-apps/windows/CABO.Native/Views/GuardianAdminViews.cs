using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Controls;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace CABO.Native;

// Parent/guardian and administrator sections.
public sealed partial class MainWindow
{
    // -------------------------------------------------------------- family

    private async Task<IReadOnlyList<UIElement>> RenderFamilyAsync(CancellationToken token)
    {
        var overview = await service.GuardianOverviewAsync(token);
        var items = new List<UIElement>();
        if (overview.Guidance.Length > 0) items.Add(Ui.Body(overview.Guidance, secondary: true));
        items.Add(Ui.Notice("How linking works",
            "A school must verify you as a parent or guardian before you can see a learner's name or progress. " +
            "Ask the school office if a link is still pending.", InfoBarSeverity.Informational));
        if (overview.Links.Count == 0) items.Add(Ui.Empty("No learner is linked to your account yet."));

        foreach (var link in overview.Links)
        {
            var heading = link.VerifiedForRead && link.LearnerName is not null ? link.LearnerName : "Learner (awaiting school verification)";
            var state = Ui.Body($"Status: {Ui.Humanize(link.Status)}" + (link.VerifiedForRead ? " · verified by school" : ""), secondary: true);
            var children = new List<UIElement> { Ui.Heading(heading, 3), state };
            if (link.Status == "pending" && link.InvitationId > 0)
            {
                var accept = Ui.Button("Accept invitation", (_, _) => { }, accent: true);
                var decline = Ui.Button("Decline", (_, _) => { });
                async Task Respond(bool yes)
                {
                    if (!await ConfirmAsync(yes ? "Accept this guardian invitation?" : "Decline this invitation?",
                            yes
                                ? "You confirm you are this learner's parent or legal guardian. The school will still verify your relationship before any records are shared."
                                : "The school will be told you declined. You can ask the school to invite you again.",
                            yes ? "Accept" : "Decline")) return;
                    if (!await RunActionAsync(ct => service.RespondToGuardianInviteAsync(link.InvitationId, yes, ct), "Response not saved")) return;
                    accept.IsEnabled = decline.IsEnabled = false;
                    state.Text = "Status: " + (yes ? "Accepted — awaiting school verification" : "Declined");
                }
                accept.Click += async (_, _) => await Respond(true);
                decline.Click += async (_, _) => await Respond(false);
                children.Add(Ui.Row(accept, decline));
            }
            items.Add(Ui.Card(children.ToArray()));
        }
        return items;
    }

    private async Task<IReadOnlyList<UIElement>> RenderFamilyReportsAsync(CancellationToken token)
    {
        var data = await service.GuardianReportsAsync(token);
        var items = new List<UIElement>();
        if (data.Guidance.Length > 0) items.Add(Ui.Body(data.Guidance, secondary: true));

        var progress = await service.GuardianChildProgressAsync(token);
        if (progress.Count > 0)
        {
            items.Add(Ui.Heading("How your child is doing", 2));
            items.Add(Ui.Body("Shown only for children a school has verified you for. Published results only; the outlook is not a forecast.", secondary: true));
            foreach (var lines in progress)
                items.Add(Ui.Card(lines.Select(line => (UIElement)Ui.Body(line)).ToArray()));
        }
        if (data.Reports.Count == 0)
        {
            items.Add(Ui.Empty("No verified progress is available yet. Reports appear once the school has verified your link and published marks."));
            return items;
        }
        foreach (var r in data.Reports)
        {
            var name = r.LearnerName.Length > 0 ? r.LearnerName : "Your learner";
            var card = Ui.Card(Ui.Heading($"{name} · {(r.Grade.Length > 0 ? r.Grade : "Grade not set")} · {r.Year}", 2),
                Ui.Body(r.Official ? "Official school report" : "Progress preview — not an officially issued report card", secondary: true),
                Ui.Meter("Overall average", r.Average));
            var panel = (StackPanel)card.Child;
            if (r.AttendanceRate is { } rate)
                panel.Children.Add(Ui.Meter("Attendance", rate, r.RecordedDays > 0 ? $" ({r.PresentDays} of {r.RecordedDays} days)" : null));
            foreach (var s in r.Subjects) panel.Children.Add(Ui.Meter(s.Name, s.Percentage));
            items.Add(card);
        }
        return items;
    }

    private async Task<IReadOnlyList<UIElement>> RenderNotificationsAsync(CancellationToken token)
    {
        var prefs = await service.NotificationPreferencesAsync(token);
        var items = new List<UIElement>
        {
            Ui.Body("Choose which school updates CABO may send you. You can withdraw consent at any time; " +
                    "withdrawing does not affect information already shared.", secondary: true)
        };
        if (!prefs.Enabled || !prefs.OptInAvailable)
        {
            items.Add(Ui.Empty("Your schools have not enabled notifications yet."));
            if (prefs.Schools.Count == 0) return items;
        }
        foreach (var school in prefs.Schools)
        {
            var card = Ui.Card(Ui.Heading(school.Name, 3));
            var panel = (StackPanel)card.Child;
            foreach (var choice in school.Choices)
            {
                var label = choice.Kind == "guardian_review_requested"
                    ? "Tell me when the school asks me to confirm a guardian link"
                    : "Tell me when a learner's support request is updated";
                var toggle = new ToggleSwitch
                {
                    Header = label,
                    IsOn = choice.Enabled,
                    IsEnabled = choice.Enabled || (choice.CanEnable && prefs.OptInAvailable)
                };
                AutomationProperties.SetName(toggle, label);
                var applying = false;
                var target = choice;
                var schoolId = school.Id;
                toggle.Toggled += async (_, _) =>
                {
                    if (applying) return;
                    var wanted = toggle.IsOn;
                    var acknowledged = false;
                    if (wanted)
                    {
                        acknowledged = await ConfirmAsync("Allow these notifications?",
                            "CABO will send this school's updates about your linked learners to you. You can turn this off at any time.",
                            "Allow");
                        if (!acknowledged) { applying = true; toggle.IsOn = false; applying = false; return; }
                    }
                    var ok = await RunActionAsync(ct => service.SetNotificationPreferenceAsync(schoolId, target.Kind, wanted, acknowledged, ct),
                        "Preference not saved");
                    if (!ok) { applying = true; toggle.IsOn = !wanted; applying = false; return; }
                    ShowStatus("Saved", wanted ? "Notifications turned on." : "Notifications turned off. Consent withdrawn.", InfoBarSeverity.Success);
                };
                panel.Children.Add(toggle);
            }
            if (school.Choices.Count == 0) panel.Children.Add(Ui.Empty("No notification types are available for this school."));
            items.Add(card);
        }
        return items;
    }

    // ------------------------------------------------------- administrators

    private async Task<IReadOnlyList<UIElement>> RenderRegistryAsync(CancellationToken token)
    {
        var names = await service.PlatformRegistryAsync(token);
        var items = new List<UIElement>
        {
            Ui.Body("Every view of this registry is audited. It lists institutions only; no learner records are shown here.", secondary: true),
            Ui.Body($"{names.Count:N0} institution{(names.Count == 1 ? "" : "s")}")
        };
        var list = new ListView { SelectionMode = ListViewSelectionMode.None, MaxHeight = 520 };
        AutomationProperties.SetName(list, "Institutions");
        foreach (var n in names.OrderBy(n => n)) list.Items.Add(n);
        items.Add(list);
        return items;
    }

    private async Task<IReadOnlyList<UIElement>> RenderEducationCommandAsync(CancellationToken token)
    {
        var data = await service.EducationCommandAsync(token);
        var items = new List<UIElement>
        {
            Ui.Body($"Schools you are authorised to oversee for {data.Year}. Figures for groups smaller than {data.MinimumCohort} learners are hidden to protect privacy.",
                secondary: true)
        };
        if (!data.OfficialData || !data.NationalVerified)
            items.Add(Ui.Notice("Not official statistics",
                "These figures come from records captured in CABO and have not been verified against national education data.",
                InfoBarSeverity.Warning));
        items.Add(Ui.Body($"{data.Institutions:N0} institution{(data.Institutions == 1 ? "" : "s")}"));
        if (data.Schools.Count == 0) items.Add(Ui.Empty("No schools are within your oversight scope."));
        foreach (var s in data.Schools.OrderBy(s => s.Name))
        {
            if (s.PrivacySuppressed)
                items.Add(Ui.Card(Ui.Heading(s.Name, 3), Ui.Body("Hidden: cohort below the privacy threshold.", secondary: true)));
            else
                items.Add(Ui.Card(Ui.Heading(s.Name, 3),
                    Ui.Body($"{s.LearnerCount:N0} learners"),
                    Ui.Meter("Attendance", s.AttendanceRate)));
        }
        return items;
    }
}
