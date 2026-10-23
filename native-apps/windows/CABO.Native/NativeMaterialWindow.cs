using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace CABO.Native;

// Displays only owned learning text delivered by CABO; no local file cache,
// web content renderer or direct storage-object URLs.
public sealed partial class MainWindow
{
    private void ClearMaterial()
    {
        activeMaterial = null;
        materialNextOffset = null;
        materialContent = "";
        MaterialTitle.Text = "";
        MaterialText.Text = "";
        MaterialStatus.Text = "";
        MaterialPanel.Visibility = Visibility.Collapsed;
    }

    private async void MaterialSelected(object sender, SelectionChangedEventArgs args)
    {
        var index = MaterialItems.SelectedIndex;
        if (busy || !service.HasSession || index < 0 || index >= materialEntries.Count)
            return;
        ClearMaterial();
        activeMaterial = materialEntries[index];
        materialNextOffset = 0;
        MaterialTitle.Text = activeMaterial.Title;
        MaterialPanel.Visibility = Visibility.Visible;
        await LoadNextMaterialAsync();
    }

    private async Task LoadNextMaterialAsync()
    {
        if (busy || activeMaterial is null || materialNextOffset is null)
            return;
        var id = activeMaterial.Id;
        var offset = materialNextOffset.Value;
        busy = true;
        UpdateButtons();
        MaterialStatus.Text = "Loading material from CABO…";
        try
        {
            using var cancel = new CancellationTokenSource(TimeSpan.FromSeconds(20));
            var page = await service.ReadMaterialAsync(id, offset, cancel.Token);
            if (activeMaterial?.Id != id || materialNextOffset != offset)
                return; // A sign-out or changed item must not restore private text.
            materialContent += page.Text;
            materialNextOffset = page.NextOffset;
            MaterialText.Text = materialContent;
            MaterialStatus.Text = page.NextOffset is null
                ? "End of available learning material." : "More material is available.";
        }
        catch (UnauthorizedAccessException)
        {
            ClearRecords();
            ServiceStatus.Text = "Session expired. Sign in again to read your material.";
        }
        catch (Exception)
        {
            MaterialStatus.Text = "This material could not be opened. Retry this section or check your connection.";
        }
        finally
        {
            busy = false;
            UpdateButtons();
        }
    }

    private async void ReadNextMaterial(object sender, RoutedEventArgs args)
    {
        await LoadNextMaterialAsync();
    }

    private void CloseMaterial(object sender, RoutedEventArgs args)
    {
        if (busy) return;
        MaterialItems.SelectedIndex = -1;
        ClearMaterial();
        UpdateButtons();
    }
}
