using Microsoft.UI.Dispatching;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using Windows.Graphics;

namespace CABO.Native;

public sealed partial class MainWindow : Window
{
    private const int MinWidthDip = 720;
    private const int MinHeightDip = 560;

    private readonly NativeLearningService service = new();
    private readonly DispatcherQueueTimer sessionTimer;
    private NativePortal? portal;
    private IReadOnlyList<OrganizationMembership> memberships = Array.Empty<OrganizationMembership>();
    private NativeSection currentSection = NativeSection.Overview;
    private CancellationTokenSource? sectionLoad;
    private int busyCount;
    private bool closed;

    public MainWindow()
    {
        InitializeComponent();
        Title = "CABO Learning Hub";
        ConfigureWindow();

        TestLoginPanel.Visibility = service.TestLoginEnabled ? Visibility.Visible : Visibility.Collapsed;
        PrivacyText.Text =
            "CABO stores only a one-hour sign-in session on this PC, encrypted for your Windows account. " +
            "Learner records, marks and study materials are shown online and are not saved on this device. " +
            "Signing out removes the session immediately. CABO processes learner information under the " +
            "school's agreement and applicable law, including South Africa's POPIA and Botswana's Data Protection Act; " +
            "contact your school to access, correct or object to the processing of your information.";

        service.SessionEnded += (_, _) => DispatcherQueue.TryEnqueue(() =>
        {
            if (closed) return;
            ShowSignedOut();
            ShowStatus("Your session has ended", "Please sign in again to continue.", InfoBarSeverity.Warning);
        });

        NetworkChange.NetworkAvailabilityChanged += OnNetworkAvailabilityChanged;
        OfflineBar.IsOpen = !NetworkInterface.GetIsNetworkAvailable();

        // Desktop sessions last an hour; check once a minute so an expired
        // session never leaves stale learner data on screen.
        sessionTimer = DispatcherQueue.CreateTimer();
        sessionTimer.Interval = TimeSpan.FromMinutes(1);
        sessionTimer.Tick += (_, _) => CheckSessionExpiry();
        sessionTimer.Start();

        Closed += OnClosed;

        if (service.HasSession) _ = EnterSignedInAsync();
        else ShowSignedOut();
    }

    // ------------------------------------------------------------- window

    [DllImport("user32.dll")]
    private static extern uint GetDpiForWindow(IntPtr hwnd);

    private double Scale()
    {
        try
        {
            var hwnd = WinRT.Interop.WindowNative.GetWindowHandle(this);
            var dpi = GetDpiForWindow(hwnd);
            return dpi == 0 ? 1.0 : dpi / 96.0;
        }
        catch (Exception) { return 1.0; }
    }

    private void ConfigureWindow()
    {
        try
        {
            var icon = Path.Combine(AppContext.BaseDirectory, "Assets", "cabo.ico");
            if (File.Exists(icon)) AppWindow.SetIcon(icon);
            var scale = Scale();
            AppWindow.Resize(new SizeInt32((int)(1180 * scale), (int)(820 * scale)));
            AppWindow.Changed += (sender, args) =>
            {
                if (!args.DidSizeChange) return;
                var s = Scale();
                var minW = (int)(MinWidthDip * s);
                var minH = (int)(MinHeightDip * s);
                var size = sender.Size;
                if (sender.Presenter is OverlappedPresenter { State: OverlappedPresenterState.Restored } &&
                    (size.Width < minW || size.Height < minH))
                    sender.Resize(new SizeInt32(Math.Max(size.Width, minW), Math.Max(size.Height, minH)));
            };
        }
        catch (Exception error)
        {
            // Cosmetic only; never block startup.
            CrashLog.Write("window", error);
        }
    }

    private void OnClosed(object sender, WindowEventArgs args)
    {
        closed = true;
        sessionTimer.Stop();
        NetworkChange.NetworkAvailabilityChanged -= OnNetworkAvailabilityChanged;
        sectionLoad?.Cancel();
        sectionLoad?.Dispose();
        service.Dispose();
    }

    private void OnNetworkAvailabilityChanged(object? sender, NetworkAvailabilityEventArgs e)
    {
        DispatcherQueue.TryEnqueue(() =>
        {
            if (closed) return;
            var wasOffline = OfflineBar.IsOpen;
            OfflineBar.IsOpen = !e.IsAvailable;
            if (e.IsAvailable && wasOffline && service.HasSession && portal is not null)
                _ = LoadSectionAsync(currentSection);
        });
    }

    private void CheckSessionExpiry()
    {
        if (closed || portal is null) return;
        if (!service.HasSession)
        {
            ShowSignedOut();
            ShowStatus("Your session has ended", "For your security, CABO sessions on Windows last one hour. Please sign in again.",
                InfoBarSeverity.Warning);
            return;
        }
        UpdateAccountText();
    }

    internal void ShowUnexpectedError() =>
        DispatcherQueue.TryEnqueue(() => ShowStatus("Something went wrong",
            "The app recovered from an unexpected error. If this keeps happening, restart CABO Learning Hub.",
            InfoBarSeverity.Error));

    // ------------------------------------------------------------- status

    private void ShowStatus(string title, string message, InfoBarSeverity severity = InfoBarSeverity.Informational)
    {
        StatusBar.Title = title;
        StatusBar.Message = message;
        StatusBar.Severity = severity;
        StatusBar.IsOpen = true;
    }

    private void ShowError(Exception error, string title = "Could not load")
    {
        if (error is UnauthorizedAccessException)
        {
            ShowSignedOut();
            ShowStatus("Your session has ended", NativeErrorText.ForUser(error), InfoBarSeverity.Warning);
            return;
        }
        ShowStatus(title, NativeErrorText.ForUser(error),
            error is NativeOfflineException ? InfoBarSeverity.Warning : InfoBarSeverity.Error);
    }

    private sealed class BusyScope : IDisposable
    {
        private MainWindow? owner;
        public BusyScope(MainWindow owner) { this.owner = owner; owner.SetBusy(+1); }
        public void Dispose() { owner?.SetBusy(-1); owner = null; }
    }

    private BusyScope Busy() => new(this);
    private bool IsBusy => busyCount > 0;

    private void SetBusy(int delta)
    {
        busyCount = Math.Max(0, busyCount + delta);
        BusyBar.Visibility = IsBusy ? Visibility.Visible : Visibility.Collapsed;
        SignInButton.IsEnabled = !IsBusy;
        TestSignInButton.IsEnabled = !IsBusy && service.TestLoginEnabled;
        RefreshButton.IsEnabled = !IsBusy;
        SignOutButton.IsEnabled = !IsBusy;
    }

    // --------------------------------------------------------------- auth

    private void ShowSignedOut()
    {
        sectionLoad?.Cancel();
        portal = null;
        memberships = Array.Empty<OrganizationMembership>();
        Nav.MenuItems.Clear();
        ContentHost.Children.Clear();
        Nav.Visibility = Visibility.Collapsed;
        SignedOutPanel.Visibility = Visibility.Visible;
        SignInButton.Focus(FocusState.Programmatic);
    }

    private async void OpenSignIn(object sender, RoutedEventArgs args)
    {
        if (IsBusy) return;
        StatusBar.IsOpen = false;
        using (Busy())
        {
            ShowStatus("Continue in your browser", "Finish signing in on the CABO page that just opened, then return here.");
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromMinutes(4));
                await service.SignInAsync(cts.Token);
                StatusBar.IsOpen = false;
            }
            catch (OperationCanceledException)
            {
                ShowStatus("Sign-in timed out", "The browser sign-in was not completed in time. Please try again.",
                    InfoBarSeverity.Warning);
                return;
            }
            catch (InvalidOperationException error) when (error.Message.Contains("port", StringComparison.OrdinalIgnoreCase))
            {
                ShowStatus("Sign-in could not start", error.Message, InfoBarSeverity.Error);
                return;
            }
            catch (Exception error)
            {
                ShowError(error, "Sign-in was not completed");
                return;
            }
        }
        await EnterSignedInAsync();
    }

    private async void SignInTest(object sender, RoutedEventArgs args)
    {
        if (IsBusy || !service.TestLoginEnabled) return;
        var username = TestUsername.Text;
        var password = TestPassword.Password;
        TestPassword.Password = ""; // Never retain the plaintext in the control.
        using (Busy())
        {
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(20));
                await service.SignInTestAsync(username, password, cts.Token);
            }
            catch (Exception error)
            {
                ShowError(error, "Test sign-in failed");
                return;
            }
            finally { password = ""; }
        }
        await EnterSignedInAsync();
    }

    private async void SignOut(object sender, RoutedEventArgs args)
    {
        if (IsBusy) return;
        using (Busy())
        {
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(8));
                await service.SignOutAsync(cts.Token);
            }
            catch (Exception) { /* local session is cleared regardless */ }
        }
        ShowSignedOut();
        ShowStatus("Signed out", "Your session was removed from this PC.", InfoBarSeverity.Success);
    }

    private async Task EnterSignedInAsync()
    {
        using (Busy())
        {
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));
                portal = await service.PortalAsync(cts.Token);
                try { memberships = await service.MembershipsAsync(cts.Token, refresh: true); }
                catch (Exception error) when (error is not UnauthorizedAccessException)
                {
                    memberships = Array.Empty<OrganizationMembership>();
                }
            }
            catch (Exception error)
            {
                ShowSignedOut();
                ShowError(error, "Your account could not be loaded");
                return;
            }
        }

        SignedOutPanel.Visibility = Visibility.Collapsed;
        Nav.Visibility = Visibility.Visible;
        BuildNavigation();
        UpdateAccountText();
    }

    private void UpdateAccountText()
    {
        if (portal is null) { AccountText.Text = ""; return; }
        var expires = service.SessionExpiresAt;
        AccountText.Text = RoleAccess.FriendlyRole(portal.Role) +
            (expires is { } e ? $"{Environment.NewLine}Session ends {e.ToLocalTime():HH:mm}" : "");
    }

    // --------------------------------------------------------- navigation

    private void BuildNavigation()
    {
        if (portal is null) return;
        Nav.MenuItems.Clear();
        var sections = RoleAccess.SectionsFor(portal.Role, memberships);
        NavigationViewItem? first = null;
        foreach (var section in sections)
        {
            var item = new NavigationViewItem
            {
                Content = RoleAccess.Title(section),
                Tag = section,
                Icon = new SymbolIcon(IconFor(section))
            };
            Microsoft.UI.Xaml.Automation.AutomationProperties.SetName(item, RoleAccess.Title(section));
            Nav.MenuItems.Add(item);
            first ??= item;
        }
        Nav.SelectedItem = first;
    }

    private static Symbol IconFor(NativeSection section) => section switch
    {
        NativeSection.Overview => Symbol.Home,
        NativeSection.Reports or NativeSection.FamilyReports => Symbol.ReportHacked,
        NativeSection.Materials => Symbol.Library,
        NativeSection.Practice => Symbol.Edit,
        NativeSection.Assignments => Symbol.Calendar,
        NativeSection.Journey => Symbol.Favorite,
        NativeSection.HelpRequests or NativeSection.SupportQueue => Symbol.Help,
        NativeSection.School => Symbol.Message,
        NativeSection.GuardianReviews or NativeSection.Family => Symbol.People,
        NativeSection.ReportIssuance => Symbol.Document,
        NativeSection.SchoolIntelligence or NativeSection.EducationCommand => Symbol.View,
        NativeSection.Notifications => Symbol.Setting,
        NativeSection.Registry => Symbol.World,
        _ => Symbol.Page
    };

    private void NavSelectionChanged(NavigationView sender, NavigationViewSelectionChangedEventArgs args)
    {
        if (args.SelectedItem is NavigationViewItem { Tag: NativeSection section })
            _ = LoadSectionAsync(section);
    }

    private void RefreshClicked(object sender, RoutedEventArgs args)
    {
        if (IsBusy || portal is null) return;
        service.InvalidateCaches();
        _ = LoadSectionAsync(currentSection);
    }

    /// <summary>
    /// Loads one section. Starting another cancels the previous load so a slow
    /// response can never draw over the section the user has moved to.
    /// </summary>
    private async Task LoadSectionAsync(NativeSection section)
    {
        if (portal is null) return;
        currentSection = section;
        sectionLoad?.Cancel();
        sectionLoad?.Dispose();
        var load = new CancellationTokenSource(TimeSpan.FromSeconds(45));
        sectionLoad = load;
        StatusBar.IsOpen = false;

        ContentHost.Children.Clear();
        ContentHost.Children.Add(Ui.Heading(RoleAccess.Title(section)));
        var placeholder = Ui.Body("Loading…", secondary: true);
        ContentHost.Children.Add(placeholder);
        ContentScroller.ChangeView(null, 0, null, disableAnimation: true);

        using (Busy())
        {
            try
            {
                var elements = await RenderSectionAsync(section, load.Token);
                if (load.IsCancellationRequested || !ReferenceEquals(sectionLoad, load)) return;
                ContentHost.Children.Remove(placeholder);
                foreach (var element in elements) ContentHost.Children.Add(element);
            }
            catch (OperationCanceledException) when (!ReferenceEquals(sectionLoad, load) || closed)
            {
                // Superseded by another navigation.
            }
            catch (Exception error)
            {
                if (!ReferenceEquals(sectionLoad, load)) return;
                ContentHost.Children.Remove(placeholder);
                ContentHost.Children.Add(Ui.Empty(NativeErrorText.ForUser(error)));
                if (error is not NativeForbiddenException) ShowError(error);
            }
        }
    }

    private Task<IReadOnlyList<UIElement>> RenderSectionAsync(NativeSection section, CancellationToken token) => section switch
    {
        NativeSection.Overview => RenderOverviewAsync(token),
        NativeSection.Reports => RenderReportsAsync(token),
        NativeSection.Materials => RenderMaterialsAsync(token),
        NativeSection.Practice => RenderPracticeAsync(token),
        NativeSection.Assignments => RenderAssignmentsAsync(token),
        NativeSection.Journey => RenderJourneyAsync(token),
        NativeSection.HelpRequests => RenderHelpRequestsAsync(token),
        NativeSection.School => RenderSchoolAsync(token),
        NativeSection.SupportQueue => RenderSupportQueueAsync(token),
        NativeSection.GuardianReviews => RenderGuardianReviewsAsync(token),
        NativeSection.ReportIssuance => RenderReportIssuanceAsync(token),
        NativeSection.SchoolIntelligence => RenderSchoolIntelligenceAsync(token),
        NativeSection.Family => RenderFamilyAsync(token),
        NativeSection.FamilyReports => RenderFamilyReportsAsync(token),
        NativeSection.Notifications => RenderNotificationsAsync(token),
        NativeSection.Registry => RenderRegistryAsync(token),
        NativeSection.EducationCommand => RenderEducationCommandAsync(token),
        _ => Task.FromResult<IReadOnlyList<UIElement>>(new UIElement[] { Ui.Empty("This section is not available.") })
    };

    private IReadOnlyList<int> OrganizationIds => portal?.OrganizationIds ?? Array.Empty<int>();

    private static UIElement PartialNotice(int failed) =>
        Ui.Notice("Some schools could not load",
            $"{failed} school{(failed == 1 ? "" : "s")} did not respond or did not authorise this view. Refresh to try again.",
            InfoBarSeverity.Warning);

    /// <summary>Runs an action from inside a section (submit, reply…), keeping the section on screen.</summary>
    private async Task<bool> RunActionAsync(Func<CancellationToken, Task> action, string failureTitle, TimeSpan? timeout = null)
    {
        if (IsBusy) return false;
        using (Busy())
        {
            try
            {
                using var cts = new CancellationTokenSource(timeout ?? TimeSpan.FromSeconds(25));
                await action(cts.Token);
                return true;
            }
            catch (Exception error)
            {
                ShowError(error, failureTitle);
                return false;
            }
        }
    }

    private async Task<bool> ConfirmAsync(string title, string message, string primary)
    {
        var dialog = new ContentDialog
        {
            Title = title,
            Content = new TextBlock { Text = message, TextWrapping = TextWrapping.Wrap },
            PrimaryButtonText = primary,
            CloseButtonText = "Cancel",
            DefaultButton = ContentDialogButton.Close,
            XamlRoot = RootGrid.XamlRoot
        };
        return await dialog.ShowAsync() == ContentDialogResult.Primary;
    }
}
