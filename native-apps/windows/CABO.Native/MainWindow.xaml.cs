using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Collections.Generic;
using System.Linq;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace CABO.Native;

public sealed partial class MainWindow : Window
{
    private readonly NativeLearningService service = new();
    private bool busy;
    private NativeQuizDetail? activeQuiz;
    private readonly List<ComboBox> answerOptions = new();
    private List<NativeQuizSummary> quizEntries = new();
    private string? submissionKey;
    private bool submitted;
    private bool uncertain;
    private List<NativeMaterialSummary> materialEntries = new();
    private NativeMaterialSummary? activeMaterial;
    private int? materialNextOffset;
    private string materialContent = "";

    public MainWindow()
    {
        InitializeComponent();
        Title = "CABO Learning Hub";
        TestLoginPanel.Visibility = service.TestLoginEnabled ? Visibility.Visible : Visibility.Collapsed;
        UpdateButtons();
        if (service.HasSession) _ = RefreshAsync();
    }

    private void UpdateButtons()
    {
        SignInButton.IsEnabled = !busy && !service.HasSession;
        RefreshButton.IsEnabled = !busy && service.HasSession;
        SignOutButton.IsEnabled = !busy && service.HasSession;
        TestSignInButton.IsEnabled = !busy && !service.HasSession && service.TestLoginEnabled;
        TestUsername.IsEnabled = !busy && !service.HasSession;
        TestPassword.IsEnabled = !busy && !service.HasSession;
        BusyIndicator.IsActive = busy;
        QuizSubmitButton.IsEnabled = !busy && !submitted && activeQuiz is not null &&
            answerOptions.Count == activeQuiz.Questions.Count &&
            answerOptions.All(c => c.SelectedIndex >= 0);
        QuizCheckButton.IsEnabled = !busy && uncertain && activeQuiz is not null;
        QuizCloseButton.IsEnabled = !busy;
        MaterialNextButton.IsEnabled = !busy && activeMaterial is not null && materialNextOffset.HasValue;
        MaterialCloseButton.IsEnabled = !busy;
    }

    private async void OpenSignIn(object sender, RoutedEventArgs args)
    {
        if (busy) return;
        busy = true;
        UpdateButtons();
        ServiceStatus.Text = "Opening secure system-browser sign-in…";
        try {
            using var cts = new CancellationTokenSource(TimeSpan.FromMinutes(4));
            await service.SignInAsync(cts.Token);
            ServiceStatus.Text = "Signed in to CABO.";
        }
        catch (Exception) {
            ServiceStatus.Text = "Secure sign-in was not completed. Check the pilot server and try again.";
        }
        finally { busy = false; UpdateButtons(); }
        if (service.HasSession) await RefreshAsync();
    }

    private async void SignInTest(object sender, RoutedEventArgs args)
    {
        if (busy || !service.TestLoginEnabled) return;
        var username = TestUsername.Text;
        var password = TestPassword.Password;
        TestPassword.Password = ""; // Never retain the plaintext in the control.
        busy = true;
        UpdateButtons();
        ServiceStatus.Text = "Connecting to isolated CABO demonstration…";
        try {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(20));
            await service.SignInTestAsync(username, password, cts.Token);
            ServiceStatus.Text = "Test account signed in.";
        } catch (Exception) {
            ServiceStatus.Text = "Test sign-in failed. Confirm the isolated server and credentials.";
        } finally {
            password = "";
            busy = false;
            UpdateButtons();
        }
        if (service.HasSession) await RefreshAsync();
    }

    private async void RefreshDashboard(object sender, RoutedEventArgs args)
    {
        await RefreshAsync();
    }

    private async Task RefreshAsync()
    {
        if (busy || !service.HasSession) return;
        busy = true;
        UpdateButtons();
        try {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(35));
            var data = await service.DashboardAsync(cts.Token);
            RoleLabel.Text = "My CABO role: " + data.Role;
            OverviewItems.ItemsSource = data.Summary;
            materialEntries = data.MaterialEntries.ToList();
            MaterialItems.ItemsSource = materialEntries.Select(x => x.Title).ToList();
            quizEntries = data.QuizEntries.ToList();
            QuizItems.ItemsSource = quizEntries.Select(q => q.Title +
                " (" + q.QuestionCount + " questions)").ToList();
            OrganizationItems.ItemsSource = data.Organizations;
            ServiceStatus.Text = "Connected securely to CABO.";
        }
        catch (UnauthorizedAccessException) {
            ClearRecords();
            ServiceStatus.Text = "Your session expired. Please sign in again.";
        }
        catch (Exception) {
            ClearRecords();
            ServiceStatus.Text = "Your records could not be loaded. Check the connection and try again.";
        }
        finally { busy = false; UpdateButtons(); }
    }

    private void ClearRecords()
    {
        RoleLabel.Text = "Not signed in";
        OverviewItems.ItemsSource = null;
        MaterialItems.ItemsSource = null;
        materialEntries.Clear();
        ClearMaterial();
        QuizItems.ItemsSource = null;
        quizEntries.Clear();
        ClearQuiz();
        OrganizationItems.ItemsSource = null;
    }

    private async void SignOut(object sender, RoutedEventArgs args)
    {
        if (busy) return;
        busy = true;
        UpdateButtons();
        try {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(8));
            await service.SignOutAsync(cts.Token);
        }
        finally {
            ClearRecords();
            busy = false;
            ServiceStatus.Text = "Signed out on this Windows device.";
            UpdateButtons();
        }
    }
}
