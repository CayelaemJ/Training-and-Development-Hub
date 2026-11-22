using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Controls;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Windows.Storage.Pickers;

namespace CABO.Native;

// Learner sections, plus the educator material upload that shares the
// Materials page. Every list is drawn from the signed-in account's own CABO
// data; nothing is cached on disk.
public sealed partial class MainWindow
{
    private async Task<IReadOnlyList<UIElement>> RenderOverviewAsync(CancellationToken token)
    {
        var p = portal!;
        var items = new List<UIElement>
        {
            Ui.Body($"Signed in as: {RoleAccess.FriendlyRole(p.Role)}"),
        };
        if (p.CountryScopedRecordsRequired)
            items.Add(Ui.Notice("School approval required",
                "Personal records appear after your school confirms the country pilot agreement.",
                InfoBarSeverity.Informational));

        if (p.Summary.Count > 0)
        {
            var summary = Ui.Card(Ui.Heading("At a glance", 2));
            var panel = (StackPanel)summary.Child;
            foreach (var stat in p.Summary) panel.Children.Add(Ui.Body($"{Ui.Humanize(Split(stat.Name))}: {stat.Value:N0}"));
            items.Add(summary);
        }

        if (memberships.Count > 0)
        {
            var schools = Ui.Card(Ui.Heading("My schools", 2));
            var panel = (StackPanel)schools.Child;
            foreach (var m in memberships) panel.Children.Add(Ui.Body($"{m.Name} · {Ui.Humanize(m.Role)}"));
            items.Add(schools);
        }

        var sections = RoleAccess.SectionsFor(p.Role, memberships).Where(s => s != NativeSection.Overview).ToArray();
        if (sections.Length > 0)
        {
            var quick = Ui.Card(Ui.Heading("Go to", 2));
            var panel = (StackPanel)quick.Child;
            var wrap = new VariableSizedWrapGrid { Orientation = Orientation.Horizontal, ItemWidth = 220, ItemHeight = 44 };
            foreach (var section in sections)
            {
                var target = section;
                wrap.Children.Add(Ui.Button(RoleAccess.Title(section), (_, _) => SelectSection(target)));
            }
            panel.Children.Add(wrap);
            items.Add(quick);
        }
        await Task.CompletedTask;
        return items;
    }

    private static string Split(string camel)
    {
        var chars = new List<char>();
        foreach (var c in camel)
        {
            if (char.IsUpper(c) && chars.Count > 0) chars.Add(' ');
            chars.Add(char.ToLowerInvariant(c));
        }
        return new string(chars.ToArray());
    }

    private void SelectSection(NativeSection section)
    {
        var item = Nav.MenuItems.OfType<NavigationViewItem>().FirstOrDefault(i => i.Tag is NativeSection s && s == section);
        if (item is not null) Nav.SelectedItem = item;
    }

    // ------------------------------------------------------------ reports

    private async Task<IReadOnlyList<UIElement>> RenderReportsAsync(CancellationToken token)
    {
        var result = await service.LearnerReportsAsync(OrganizationIds, token);
        var items = new List<UIElement>
        {
            Ui.Body("Draft progress based on marks your school has published. This is not an officially issued report card.", secondary: true)
        };
        if (result.IsPartial) items.Add(PartialNotice(result.FailedOrganizations));
        if (result.Items.Count == 0)
        {
            items.Add(Ui.Empty("No published marks yet for this year."));
            return items;
        }
        foreach (var report in result.Items)
        {
            var school = memberships.FirstOrDefault(m => m.Id == report.OrganizationId)?.Name ?? $"School {report.OrganizationId}";
            var card = Ui.Card(Ui.Heading($"{school} · {(report.Grade.Length > 0 ? report.Grade : "Grade not set")} · {report.Year}", 2));
            var panel = (StackPanel)card.Child;
            panel.Children.Add(Ui.Meter("Overall average", report.Average));
            if (report.AttendanceRate is { } rate) panel.Children.Add(Ui.Meter("Attendance", rate));
            foreach (var subject in report.Subjects)
                panel.Children.Add(Ui.Meter(subject.Name, subject.Percentage,
                    subject.AssessmentCount > 0 ? $" ({subject.AssessmentCount} assessment{(subject.AssessmentCount == 1 ? "" : "s")})" : null));
            var weakest = report.Subjects.Where(s => s.Percentage is not null).OrderBy(s => s.Percentage).FirstOrDefault();
            if (weakest is not null && weakest.Percentage < 50)
                panel.Children.Add(Ui.Notice("Suggested next step",
                    $"Your {weakest.Name} mark is below 50%. Try the practice tests and use Ask for help to get support from your teacher.",
                    InfoBarSeverity.Informational));
            items.Add(card);
        }
        return items;
    }

    // ---------------------------------------------------------- materials

    private async Task<IReadOnlyList<UIElement>> RenderMaterialsAsync(CancellationToken token)
    {
        var materials = await service.MaterialsAsync(token);
        var items = new List<UIElement>();
        var isEducator = portal is not null && (RoleAccess.IsStaff(portal.Role) ||
                         memberships.Any(m => m.Role is "owner" or "admin" or "teacher"));
        if (isEducator) items.Add(BuildUploadCard());

        items.Add(Ui.Body("Materials are read online in pages. No copy is saved on this PC.", secondary: true));
        if (materials.Count == 0)
        {
            items.Add(Ui.Empty("No study materials are available to your account yet."));
            return items;
        }
        var reader = new StackPanel { Spacing = 10 };
        var list = new ListView { SelectionMode = ListViewSelectionMode.Single, MaxHeight = 320 };
        AutomationProperties.SetName(list, "Study materials");
        foreach (var m in materials) list.Items.Add(new ListViewItem { Content = m.Title, Tag = m });
        list.SelectionChanged += async (_, _) =>
        {
            if (list.SelectedItem is ListViewItem { Tag: NativeMaterialSummary material })
                await OpenMaterialAsync(material, reader);
        };
        items.Add(list);
        items.Add(reader);
        return items;
    }

    private async Task OpenMaterialAsync(NativeMaterialSummary material, StackPanel reader)
    {
        reader.Children.Clear();
        var title = Ui.Heading(material.Title, 2);
        var text = Ui.Body("", selectable: true);
        var status = Ui.Body("", secondary: true);
        int? next = 0;
        var nextButton = Ui.Button("Read next section", (_, _) => { });
        async Task LoadNextAsync()
        {
            if (next is null) return;
            NativeMaterialPage? page = null;
            var ok = await RunActionAsync(async ct => page = await service.ReadMaterialAsync(material.Id, next.Value, ct),
                "Could not open the material");
            if (!ok || page is null) return;
            text.Text = (text.Text.Length > 0 ? text.Text + Environment.NewLine + Environment.NewLine : "") + page.Text;
            next = page.NextOffset;
            nextButton.Visibility = next is null ? Visibility.Collapsed : Visibility.Visible;
            status.Text = next is null ? "End of material." : "";
        }
        nextButton.Click += async (_, _) => await LoadNextAsync();
        var close = Ui.Button("Close material", (_, _) => reader.Children.Clear());
        reader.Children.Add(Ui.Card(title, text, Ui.Row(nextButton, close), status));
        await LoadNextAsync();
    }

    private Border BuildUploadCard()
    {
        var titleBox = Ui.Input("Material title", 200);
        var fileText = Ui.Body("No file chosen.", secondary: true);
        string? path = null;
        var choose = Ui.Button("Choose file…", async (_, _) =>
        {
            var picker = new FileOpenPicker { SuggestedStartLocation = PickerLocationId.DocumentsLibrary };
            foreach (var ext in NativeLearningService.MaterialContentTypes.Keys) picker.FileTypeFilter.Add(ext);
            // Unpackaged WinUI apps must bind pickers to the window handle.
            WinRT.Interop.InitializeWithWindow.Initialize(picker, WinRT.Interop.WindowNative.GetWindowHandle(this));
            var file = await picker.PickSingleFileAsync();
            if (file is null) return;
            path = file.Path;
            fileText.Text = file.Name;
            if (titleBox.Text.Trim().Length == 0) titleBox.Text = Path.GetFileNameWithoutExtension(file.Name);
        });
        var upload = Ui.Button("Upload to CABO", async (_, _) =>
        {
            if (path is null) { ShowStatus("Choose a file", "Select a document to upload first.", InfoBarSeverity.Warning); return; }
            var chosen = path;
            var ok = await RunActionAsync(async ct =>
            {
                var info = new FileInfo(chosen);
                if (!info.Exists) throw new ArgumentException("The selected file is no longer available.");
                if (info.Length > NativeLearningService.MaxMaterialBytes) throw new ArgumentException("Files must be 30 MB or smaller.");
                var bytes = await File.ReadAllBytesAsync(chosen, ct);
                await service.UploadMaterialAsync(info.Name, bytes, titleBox.Text, ct);
            }, "Upload failed", TimeSpan.FromMinutes(3));
            if (!ok) return;
            ShowStatus("Uploaded", "The material was added to CABO. AI reading is off for this file by default.", InfoBarSeverity.Success);
            _ = LoadSectionAsync(NativeSection.Materials);
        }, accent: true);
        return Ui.Card(Ui.Heading("Add a study material", 2),
            Ui.Body("PDF, Word, PowerPoint, Excel, text, CSV or image files up to 30 MB. Only upload material you have the right to share."),
            titleBox, Ui.Row(choose, upload), fileText);
    }

    // ------------------------------------------------------ practice tests

    private async Task<IReadOnlyList<UIElement>> RenderPracticeAsync(CancellationToken token)
    {
        var quizzes = await service.QuizzesAsync(token);
        var items = new List<UIElement>
        {
            Ui.Body("Answers are marked by the CABO server. Practice results are feedback, not a qualification.", secondary: true)
        };
        if (quizzes.Count == 0)
        {
            items.Add(Ui.Empty("No practice tests are available yet."));
            return items;
        }
        var host = new StackPanel { Spacing = 10 };
        var list = new ListView { SelectionMode = ListViewSelectionMode.Single, MaxHeight = 300 };
        AutomationProperties.SetName(list, "Practice tests");
        foreach (var q in quizzes)
            list.Items.Add(new ListViewItem
            {
                Tag = q,
                Content = $"{q.Title} · {q.QuestionCount} questions" + (q.LatestScore is { } s ? $" · last score {s:0.#}%" : "")
            });
        list.SelectionChanged += async (_, _) =>
        {
            if (list.SelectedItem is ListViewItem { Tag: NativeQuizSummary quiz }) await OpenQuizAsync(quiz, host);
        };
        items.Add(list);
        items.Add(host);
        return items;
    }

    private async Task OpenQuizAsync(NativeQuizSummary summary, StackPanel host)
    {
        host.Children.Clear();
        NativeQuizDetail? detail = null;
        if (!await RunActionAsync(async ct => detail = await service.OpenQuizAsync(summary.Id, ct), "Could not open the test") ||
            detail is null) return;

        var quiz = detail;
        var requestKey = Guid.NewGuid().ToString("N");
        var selectors = new List<ComboBox>();
        var questions = new StackPanel { Spacing = 14 };
        var results = Ui.Body("", selectable: true);
        var submitted = false;
        Button? submit = null;
        Button? check = null;

        void UpdateSubmit()
        {
            if (submit is not null)
                submit.IsEnabled = !submitted && selectors.All(s => s.SelectedIndex >= 0);
        }

        for (var i = 0; i < quiz.Questions.Count; i++)
        {
            var question = quiz.Questions[i];
            var selector = new ComboBox
            {
                Header = $"Question {i + 1} of {quiz.Questions.Count}: {question.Prompt}",
                PlaceholderText = "Choose an answer",
                MinWidth = 280,
                MaxWidth = 700,
                ItemsSource = question.Options
            };
            AutomationProperties.SetName(selector, $"Answer for question {i + 1}");
            selector.SelectionChanged += (_, _) => UpdateSubmit();
            selectors.Add(selector);
            questions.Children.Add(selector);
        }

        void Show(NativeQuizAttempt attempt)
        {
            if (attempt.QuizId != quiz.Id || attempt.TotalQuestions != quiz.Questions.Count)
                throw new InvalidOperationException("Unexpected assessment result.");
            var lines = new List<string>
            {
                $"Result: {attempt.CorrectCount}/{attempt.TotalQuestions} correct ({attempt.Percentage:0.#}%)"
            };
            lines.AddRange(attempt.Feedback.OrderBy(f => f.QuestionIndex).Select(f =>
                $"Question {f.QuestionIndex + 1}: {(f.IsCorrect ? "Correct." : "Review.")} {f.Explanation}"));
            results.Text = string.Join(Environment.NewLine, lines);
            if (check is not null) check.Visibility = Visibility.Collapsed;
        }

        submit = Ui.Button("Submit answers", async (_, _) =>
        {
            if (submitted || selectors.Any(s => s.SelectedIndex < 0)) return;
            submitted = true;
            UpdateSubmit();
            var answers = selectors.Select(s => s.SelectedIndex).ToArray();
            NativeQuizAttempt? attempt = null;
            var ok = await RunActionAsync(async ct => attempt = await service.SubmitQuizAsync(quiz.Id, answers, requestKey, ct),
                "Submission outcome unknown");
            if (ok && attempt is not null) { Show(attempt); return; }
            // Never resubmit blindly: the server may have saved the attempt.
            results.Text = "We could not confirm your submission. Use 'Check saved result' instead of submitting again.";
            if (check is not null) check.Visibility = Visibility.Visible;
        }, accent: true);
        submit.IsEnabled = false;

        check = Ui.Button("Check saved result", async (_, _) =>
        {
            NativeQuizAttempt? attempt = null;
            if (await RunActionAsync(async ct => attempt = await service.CheckQuizSubmissionAsync(quiz.Id, requestKey, ct),
                    "Result not confirmed") && attempt is not null)
                Show(attempt);
        });
        check.Visibility = Visibility.Collapsed;
        var close = Ui.Button("Close test", (_, _) => host.Children.Clear());

        host.Children.Add(Ui.Card(Ui.Heading(quiz.Title, 2), questions, Ui.Row(submit, check, close), results));
    }

    // -------------------------------------------------------- assignments

    private async Task<IReadOnlyList<UIElement>> RenderAssignmentsAsync(CancellationToken token)
    {
        var assignments = await service.AssignmentsAsync(token);
        if (assignments.Count == 0)
            return new UIElement[] { Ui.Empty("You have no assigned written assessments right now.") };
        var items = new List<UIElement>
        {
            Ui.Body("Written assessments are completed in the CABO web app where your school supervises them.", secondary: true)
        };
        foreach (var a in assignments.OrderBy(a => a.DueAt ?? "9999"))
            items.Add(Ui.Card(Ui.Heading(a.Title, 3), Ui.Body(a.Organization),
                Ui.Body(a.DueAt is null ? "No due date set" : "Due " + Ui.Date(a.DueAt), secondary: true)));
        return items;
    }

    // ------------------------------------------------------------ journey

    private async Task<IReadOnlyList<UIElement>> RenderJourneyAsync(CancellationToken token)
    {
        var journey = await service.JourneyAsync(token);
        var items = new List<UIElement>();
        if (journey.DisplayName.Length > 0) items.Add(Ui.Body("Name on your journey: " + journey.DisplayName));

        items.Add(Ui.Heading("Achievements, sport and milestones", 2));
        if (journey.Milestones.Count == 0) items.Add(Ui.Empty("No milestones recorded yet. Add them in the CABO web app."));
        foreach (var m in journey.Milestones.OrderByDescending(m => m.Year))
            items.Add(Ui.Card(Ui.Heading(m.Title, 3),
                Ui.Body(Ui.Join(new[] { Ui.Humanize(m.Kind), m.Year > 0 ? m.Year.ToString() : "" }.Where(x => x.Length > 0)), secondary: true),
                Ui.Body(m.Description)));

        items.Add(Ui.Heading("Learning stages", 2));
        if (journey.Entries.Count == 0) items.Add(Ui.Empty("No learning stages recorded yet."));
        foreach (var e in journey.Entries.OrderByDescending(e => e.AcademicYear))
            items.Add(Ui.Card(Ui.Heading(e.InstitutionName, 3),
                Ui.Body(Ui.Join(new[] { Ui.Humanize(e.Stage), e.AcademicYear > 0 ? e.AcademicYear.ToString() : "" }.Where(x => x.Length > 0)), secondary: true),
                Ui.Body(e.Note)));
        return items;
    }

    // ------------------------------------------------------- help requests

    private async Task<IReadOnlyList<UIElement>> RenderHelpRequestsAsync(CancellationToken token)
    {
        var coursesTask = service.SupportCoursesAsync(OrganizationIds, token);
        var ticketsTask = service.SupportTicketsAsync(OrganizationIds.Take(3).ToArray(), token);
        await Task.WhenAll(coursesTask, ticketsTask);
        var courses = coursesTask.Result;
        var tickets = ticketsTask.Result;

        var items = new List<UIElement>
        {
            Ui.Body("Ask your teacher about something you are stuck on. Your teacher may use CABO's tutoring tools to prepare " +
                    "an explanation, and reviews it before it reaches you.", secondary: true)
        };
        if (courses.IsPartial || tickets.IsPartial)
            items.Add(PartialNotice(Math.Max(courses.FailedOrganizations, tickets.FailedOrganizations)));

        if (courses.Items.Count == 0)
        {
            items.Add(Ui.Empty("Help requests are not enabled for your subjects yet."));
        }
        else
        {
            var subject = new ComboBox { Header = "Subject", ItemsSource = courses.Items.Select(c => c.Name).ToList(), MinWidth = 320 };
            AutomationProperties.SetName(subject, "Subject");
            var concept = Ui.Input("What topic or concept?", 160);
            var question = Ui.Input("Your question (at least 10 characters)", 4000, multiline: true);
            var attempted = Ui.Input("What have you already tried?", 2000, multiline: true);
            var requestKey = Guid.NewGuid();
            var send = Ui.Button("Send to my teacher", async (_, _) =>
            {
                if (subject.SelectedIndex < 0) { ShowStatus("Choose a subject", "Select the subject this question is about.", InfoBarSeverity.Warning); return; }
                var course = courses.Items[subject.SelectedIndex];
                var key = requestKey;
                var ok = await RunActionAsync(ct => service.SubmitHelpRequestAsync(course, concept.Text, question.Text, attempted.Text, key, ct),
                    "Your request was not sent");
                if (!ok) return;
                requestKey = Guid.NewGuid();
                ShowStatus("Request sent", "Your teacher will see it in CABO.", InfoBarSeverity.Success);
                _ = LoadSectionAsync(NativeSection.HelpRequests);
            }, accent: true);
            items.Add(Ui.Card(Ui.Heading("New help request", 2), subject, concept, question, attempted, send));
        }

        items.Add(Ui.Heading("My requests", 2));
        if (tickets.Items.Count == 0) items.Add(Ui.Empty("You have not asked for help yet."));
        foreach (var t in tickets.Items.OrderByDescending(t => t.UpdatedAt))
        {
            var details = new List<UIElement>
            {
                Ui.Heading(t.Concept, 3),
                Ui.Body($"Status: {Ui.Humanize(t.Status)} · updated {Ui.Date(t.UpdatedAt)}", secondary: true)
            };
            if (t.ReviewAt is not null) details.Add(Ui.Body("Practice review: " + Ui.Date(t.ReviewAt)));
            items.Add(Ui.Card(details.ToArray()));
        }
        return items;
    }
}
