using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;

namespace CABO.Native;

// Display-only projection of GET /api/guardian/progress/:learnerId. The CABO
// backend decides who may see it (verified guardian, this school's latest
// decision, active enrolment) and returns published results only.
public static class NativeChildProgress
{
    private static readonly HashSet<string> Outlooks = new() { "on_track", "watch", "needs_support", "not_enough_data" };
    private static readonly HashSet<string> Trends = new() { "improving", "steady", "declining", "not_enough_data" };

    private static string Text(JsonElement e, string name, int max)
    {
        if (e.ValueKind != JsonValueKind.Object || !e.TryGetProperty(name, out var v) || v.ValueKind != JsonValueKind.String) return "";
        var s = (v.GetString() ?? "").Trim();
        return s.Length > max ? s[..max] : s;
    }

    private static double? Number(JsonElement e, string name)
    {
        if (e.ValueKind != JsonValueKind.Object || !e.TryGetProperty(name, out var v) || v.ValueKind != JsonValueKind.Number) return null;
        var d = v.GetDouble();
        return double.IsFinite(d) ? d : null;
    }

    private static JsonElement Child(JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) ? v : default;

    private static IEnumerable<JsonElement> Items(JsonElement e, string name, int limit)
    {
        var v = Child(e, name);
        return v.ValueKind == JsonValueKind.Array ? v.EnumerateArray().Take(limit).ToArray() : Array.Empty<JsonElement>();
    }

    public static string Pct(double? value)
    {
        if (value is null) return "—";
        var v = Math.Clamp(value.Value, -100, 100);
        return v.ToString(v == Math.Round(v) ? "0" : "0.0", CultureInfo.InvariantCulture) + "%";
    }

    public static string OutlookLabel(string status) => status switch
    {
        "on_track" => "On track",
        "watch" => "Worth watching",
        "needs_support" => "Needs support",
        _ => "Not enough results yet",
    };

    public static string TrendLabel(string trend, double? change) => trend switch
    {
        "improving" => "Improving" + (change is null ? "" : $" (+{Pct(change).TrimEnd('%')} pts)"),
        "declining" => "Declining" + (change is null ? "" : $" ({Pct(change).TrimEnd('%')} pts)"),
        "steady" => "Steady",
        _ => "Not enough data",
    };

    public static string BandLabel(string band) => band switch
    {
        "top_quarter" => "top quarter of the class",
        "upper_middle" => "above the class middle",
        "lower_middle" => "below the class middle",
        "bottom_quarter" => "bottom quarter of the class",
        _ => "",
    };

    private static string Known(string value, HashSet<string> allowed) => allowed.Contains(value) ? value : "not_enough_data";

    /// Formats one progress response as readable lines; returns an empty list
    /// when the response is not addressed to a verified guardian.
    public static IReadOnlyList<string> Format(JsonElement root)
    {
        var lines = new List<string>();
        if (root.ValueKind != JsonValueKind.Object || Text(root, "visibility", 40) != "verified_guardian") return lines;
        var learnerId = Text(root, "learnerId", 160);
        var orgId = Number(root, "organizationId") ?? 0;
        var year = Number(root, "year") ?? 0;
        if (learnerId.Length == 0 || orgId <= 0 || year < 2020 || year > 2200) return lines;

        var name = Text(root, "learnerName", 160);
        var header = string.Join(" · ", new[] { name.Length > 0 ? name : "Your child", Text(root, "organization", 160), Text(root, "grade", 40), ((int)year).ToString(CultureInfo.InvariantCulture) }.Where(s => s.Length > 0));
        lines.Add(header);

        var outlook = Child(root, "outlook");
        lines.Add("Outlook: " + OutlookLabel(Known(Text(outlook, "status", 30), Outlooks)));
        foreach (var reason in Items(outlook, "reasons", 8))
            if (reason.ValueKind == JsonValueKind.String) lines.Add("  • " + reason.GetString());

        var overall = Child(root, "overall");
        lines.Add($"Overall: {Pct(Number(overall, "current"))} · {TrendLabel(Known(Text(overall, "trend", 30), Trends), Number(overall, "change"))}");
        var terms = Items(overall, "terms", 12).Where(t => Number(t, "percentage") is not null)
            .Select(t => $"{Text(t, "period", 60)} {Pct(Number(t, "percentage"))}").ToArray();
        if (terms.Length > 0) lines.Add("Term by term: " + string.Join(", ", terms));

        var attendance = Child(root, "attendance");
        var days = (int)(Number(attendance, "recordedDays") ?? 0);
        lines.Add(days > 0
            ? $"Attendance: {Pct(Number(attendance, "rate"))} over {days} days · {TrendLabel(Known(Text(attendance, "trend", 30), Trends), null)}"
            : "Attendance: no days recorded");

        foreach (var s in Items(root, "subjects", 40))
        {
            var subject = Text(s, "subject", 120);
            if (subject.Length == 0) continue;
            var so = Child(s, "outlook");
            var standing = Child(s, "standing");
            var available = standing.ValueKind == JsonValueKind.Object && standing.TryGetProperty("available", out var a) && a.ValueKind == JsonValueKind.True;
            var comparison = available
                ? $"class average {Pct(Number(standing, "classAverage"))}, {BandLabel(Text(standing, "band", 30))}"
                : Text(standing, "reason", 240);
            lines.Add($"{subject}: {Pct(Number(s, "current"))} · {TrendLabel(Known(Text(s, "trend", 30), Trends), Number(s, "change"))} · {OutlookLabel(Known(Text(so, "status", 30), Outlooks))}" +
                (comparison.Length > 0 ? " · " + comparison : ""));
        }

        var highlights = Child(root, "highlights");
        var focus = Items(highlights, "focusAreas", 10).Select(f => Text(f, "subject", 120)).Where(x => x.Length > 0).ToArray();
        if (focus.Length > 0) lines.Add("Where to focus: " + string.Join(", ", focus));

        foreach (var r in Items(root, "recentResults", 5))
        {
            var subject = Text(r, "subject", 120);
            var pct = Number(r, "percentage");
            if (subject.Length == 0 || pct is null) continue;
            lines.Add($"Latest: {subject} {Text(r, "assessment", 160)} {Pct(Math.Clamp(pct.Value, 0, 100))}".Replace("  ", " "));
        }
        var method = Text(Child(root, "method"), "notAPrediction", 300);
        lines.Add(method.Length > 0 ? method : "The outlook describes published results so far. It is not a forecast or an official assessment.");
        return lines;
    }
}
