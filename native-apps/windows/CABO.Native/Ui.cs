using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Automation.Peers;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media;
using System;
using System.Collections.Generic;
using System.Globalization;

namespace CABO.Native;

/// <summary>
/// Small, accessible building blocks so every section renders consistently:
/// real headings for screen readers, named buttons, wrapped text that reflows
/// at any window width or text scale, and theme brushes for light, dark and
/// high-contrast modes.
/// </summary>
internal static class Ui
{
    public static Style? Style(string key) =>
        Application.Current.Resources.TryGetValue(key, out var value) ? value as Style : null;

    public static Brush? Brush(string key) =>
        Application.Current.Resources.TryGetValue(key, out var value) ? value as Brush : null;

    public static TextBlock Heading(string text, int level = 1)
    {
        var block = new TextBlock
        {
            Text = text,
            TextWrapping = TextWrapping.Wrap,
            Style = Style(level == 1 ? "TitleTextBlockStyle" : level == 2 ? "SubtitleTextBlockStyle" : "BodyStrongTextBlockStyle"),
            Margin = level == 1 ? new Thickness(0, 0, 0, 4) : new Thickness(0, 8, 0, 0)
        };
        AutomationProperties.SetHeadingLevel(block, level switch
        {
            1 => AutomationHeadingLevel.Level1,
            2 => AutomationHeadingLevel.Level2,
            _ => AutomationHeadingLevel.Level3
        });
        return block;
    }

    public static TextBlock Body(string text, bool secondary = false, bool selectable = false)
    {
        var block = new TextBlock
        {
            Text = text,
            TextWrapping = TextWrapping.Wrap,
            IsTextSelectionEnabled = selectable
        };
        if (secondary)
        {
            var brush = Brush("TextFillColorSecondaryBrush");
            if (brush is not null) block.Foreground = brush;
        }
        return block;
    }

    public static Border Card(params UIElement[] children)
    {
        var panel = new StackPanel { Spacing = 6 };
        foreach (var child in children) panel.Children.Add(child);
        return new Border
        {
            Child = panel,
            Padding = new Thickness(16),
            CornerRadius = new CornerRadius(8),
            BorderThickness = new Thickness(1),
            Background = Brush("CardBackgroundFillColorDefaultBrush"),
            BorderBrush = Brush("CardStrokeColorDefaultBrush")
        };
    }

    public static Button Button(string text, RoutedEventHandler click, bool accent = false, string? automationName = null)
    {
        var button = new Button { Content = text };
        if (accent) button.Style = Style("AccentButtonStyle");
        AutomationProperties.SetName(button, automationName ?? text);
        button.Click += click;
        return button;
    }

    public static StackPanel Row(params UIElement[] children)
    {
        var row = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 10 };
        foreach (var child in children) row.Children.Add(child);
        return row;
    }

    public static InfoBar Notice(string title, string message, InfoBarSeverity severity = InfoBarSeverity.Informational) =>
        new() { Title = title, Message = message, Severity = severity, IsOpen = true, IsClosable = false };

    public static TextBlock Empty(string text) => Body(text, secondary: true);

    /// <summary>A labelled bar for a 0–100 value, readable by screen readers.</summary>
    public static StackPanel Meter(string label, double? percent, string? suffix = null)
    {
        var text = percent is null ? $"{label}: not yet published" : $"{label}: {percent:0.#}%{suffix}";
        var panel = new StackPanel { Spacing = 2 };
        panel.Children.Add(Body(text));
        if (percent is not null)
        {
            var bar = new ProgressBar { Minimum = 0, Maximum = 100, Value = Math.Clamp(percent.Value, 0, 100), MaxWidth = 520, HorizontalAlignment = HorizontalAlignment.Left, MinWidth = 240 };
            AutomationProperties.SetName(bar, text);
            panel.Children.Add(bar);
        }
        return panel;
    }

    public static TextBox Input(string header, int maxLength, bool multiline = false, string? placeholder = null)
    {
        var box = new TextBox
        {
            Header = header,
            MaxLength = maxLength,
            AcceptsReturn = multiline,
            TextWrapping = multiline ? TextWrapping.Wrap : TextWrapping.NoWrap,
            MinHeight = multiline ? 96 : 0,
            PlaceholderText = placeholder ?? "",
            MaxWidth = 720,
            HorizontalAlignment = HorizontalAlignment.Left,
            MinWidth = 320
        };
        AutomationProperties.SetName(box, header);
        return box;
    }

    public static string Humanize(string value) =>
        value.Length == 0 ? value : CultureInfo.CurrentCulture.TextInfo.ToTitleCase(value.Replace('_', ' '));

    public static string Date(string? iso)
    {
        if (string.IsNullOrWhiteSpace(iso)) return "";
        return DateTimeOffset.TryParse(iso, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var when)
            ? when.ToLocalTime().ToString("d MMM yyyy, HH:mm", CultureInfo.CurrentCulture)
            : iso;
    }

    public static string Day(int day) => day switch
    {
        1 => "Monday", 2 => "Tuesday", 3 => "Wednesday", 4 => "Thursday", 5 => "Friday", 6 => "Saturday", 7 => "Sunday",
        _ => "Day " + day
    };

    public static string Join(IEnumerable<string> parts) => string.Join(" · ", parts);
}
