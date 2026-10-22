using Microsoft.UI.Xaml;
using System;
using System.Diagnostics;
using System.Net.Http;
using System.Threading.Tasks;

namespace CABO.Native;
public sealed partial class MainWindow : Window
{
    private static readonly Uri Origin = new("https://cabo-learning-hub-pilot.onrender.com/");
    public MainWindow()
    {
        InitializeComponent();
        Title = "CABO Learning Hub";
        _ = CheckServiceAsync();
    }
    private async Task CheckServiceAsync()
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(8) };
            using var response = await client.GetAsync(new Uri(Origin, "api/auth/user"));
            ServiceStatus.Text = response.IsSuccessStatusCode
                ? "CABO service reachable · Sign in required"
                : $"CABO service returned HTTP {(int)response.StatusCode}";
        }
        catch (Exception)
        {
            ServiceStatus.Text = "Cannot reach CABO. Check your internet connection.";
        }
    }
    private void OpenSignIn(object sender, RoutedEventArgs args)
    {
        Process.Start(new ProcessStartInfo(new Uri(Origin, "api/login").ToString()) { UseShellExecute = true });
    }
}
