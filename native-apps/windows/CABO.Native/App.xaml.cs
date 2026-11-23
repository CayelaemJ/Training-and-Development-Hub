using Microsoft.UI.Xaml;
using System;
using System.IO;
using System.Threading.Tasks;

namespace CABO.Native;

public partial class App : Application
{
    private MainWindow? window;

    public App()
    {
        InitializeComponent();
        // Keep the app alive on unexpected UI errors and record only the
        // exception type and stack (never request bodies, tokens or names).
        UnhandledException += (_, e) =>
        {
            CrashLog.Write("ui", e.Exception);
            e.Handled = true;
            window?.ShowUnexpectedError();
        };
        AppDomain.CurrentDomain.UnhandledException += (_, e) =>
            CrashLog.Write("domain", e.ExceptionObject as Exception);
        TaskScheduler.UnobservedTaskException += (_, e) =>
        {
            CrashLog.Write("task", e.Exception);
            e.SetObserved();
        };
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        window = new MainWindow();
        window.Activate();
    }
}

/// <summary>Bounded, local, PII-free diagnostic log for support.</summary>
internal static class CrashLog
{
    private const long MaxBytes = 256 * 1024;
    private static readonly object Gate = new();

    public static string LogDirectory => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "CABO", "LearningHub", "logs");

    public static void Write(string source, Exception? error)
    {
        if (error is null) return;
        try
        {
            lock (Gate)
            {
                Directory.CreateDirectory(LogDirectory);
                var path = Path.Combine(LogDirectory, "app.log");
                if (File.Exists(path) && new FileInfo(path).Length > MaxBytes)
                    File.Move(path, path + ".1", overwrite: true);
                // Type, HResult and stack only: exception messages can echo server text.
                File.AppendAllText(path,
                    $"{DateTimeOffset.UtcNow:O} [{source}] v{NativeLearningService.AppVersion} " +
                    $"{error.GetType().FullName} 0x{error.HResult:X8}{Environment.NewLine}" +
                    $"{error.StackTrace}{Environment.NewLine}");
            }
        }
        catch (Exception)
        {
            // Logging must never crash the app.
        }
    }
}
