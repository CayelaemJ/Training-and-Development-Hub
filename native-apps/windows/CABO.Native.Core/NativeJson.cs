using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

namespace CABO.Native;

/// <summary>
/// Tolerant, bounded JSON readers. A missing or wrongly-typed field becomes an
/// empty/null value instead of an exception, and every string and array is
/// length-capped so a malformed or hostile response cannot exhaust memory or
/// flood the UI.
/// </summary>
internal static class NativeJson
{
    public static bool Has(JsonElement obj, string name, out JsonElement value)
    {
        if (obj.ValueKind == JsonValueKind.Object && obj.TryGetProperty(name, out value))
            return true;
        value = default;
        return false;
    }

    public static string Str(JsonElement obj, string name, int max = 500)
    {
        if (!Has(obj, name, out var v)) return "";
        var text = v.ValueKind switch
        {
            JsonValueKind.String => v.GetString() ?? "",
            JsonValueKind.Number => v.GetRawText(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            _ => ""
        };
        text = text.Trim();
        return text.Length > max ? text[..max] : text;
    }

    public static string? OptStr(JsonElement obj, string name, int max = 500)
    {
        var text = Str(obj, name, max);
        return text.Length == 0 || text == "null" ? null : text;
    }

    public static int Int(JsonElement obj, string name, int fallback = 0)
    {
        if (Has(obj, name, out var v) && v.ValueKind == JsonValueKind.Number)
        {
            if (v.TryGetInt32(out var i)) return i;
            if (v.TryGetDouble(out var d) && double.IsFinite(d) &&
                d >= int.MinValue && d <= int.MaxValue) return (int)d;
        }
        return fallback;
    }

    public static long Long(JsonElement obj, string name)
    {
        if (Has(obj, name, out var v) && v.ValueKind == JsonValueKind.Number)
        {
            if (v.TryGetInt64(out var l)) return l;
            if (v.TryGetDouble(out var d) && double.IsFinite(d)) return (long)d;
        }
        return 0;
    }

    public static int? OptInt(JsonElement obj, string name)
    {
        if (Has(obj, name, out var v) && v.ValueKind == JsonValueKind.Number)
        {
            if (v.TryGetInt32(out var i)) return i;
            if (v.TryGetDouble(out var d) && double.IsFinite(d) &&
                d >= int.MinValue && d <= int.MaxValue) return (int)Math.Round(d);
        }
        return null;
    }

    public static double? OptDouble(JsonElement obj, string name)
    {
        if (Has(obj, name, out var v) && v.ValueKind == JsonValueKind.Number &&
            v.TryGetDouble(out var d) && double.IsFinite(d)) return d;
        return null;
    }

    /// <summary>Percentage-like value restricted to 0..100; anything else is unknown.</summary>
    public static double? Percent(JsonElement obj, string name)
    {
        var d = OptDouble(obj, name);
        return d is >= 0 and <= 100 ? d : null;
    }

    public static bool Bool(JsonElement obj, string name) =>
        Has(obj, name, out var v) && v.ValueKind == JsonValueKind.True;

    public static IEnumerable<JsonElement> Arr(JsonElement obj, string name, int max)
    {
        if (!Has(obj, name, out var v) || v.ValueKind != JsonValueKind.Array)
            return Array.Empty<JsonElement>();
        return v.EnumerateArray().Take(max);
    }

    public static IEnumerable<JsonElement> Root(JsonElement root, int max) =>
        root.ValueKind == JsonValueKind.Array ? root.EnumerateArray().Take(max) : Array.Empty<JsonElement>();

    public static IReadOnlyList<string> Strings(JsonElement obj, string name, int maxItems, int maxLength)
    {
        return Arr(obj, name, maxItems)
            .Where(v => v.ValueKind == JsonValueKind.String)
            .Select(v => (v.GetString() ?? "").Trim())
            .Where(v => v.Length > 0)
            .Select(v => v.Length > maxLength ? v[..maxLength] : v)
            .ToArray();
    }

    public static IReadOnlyList<NativeStat> Stats(JsonElement obj, string name, int max = 40)
    {
        if (!Has(obj, name, out var v) || v.ValueKind != JsonValueKind.Object)
            return Array.Empty<NativeStat>();
        return v.EnumerateObject().Take(max)
            .Where(p => p.Value.ValueKind == JsonValueKind.Number)
            .Select(p => new NativeStat(p.Name.Length > 80 ? p.Name[..80] : p.Name,
                p.Value.TryGetInt64(out var n) ? n : 0))
            .ToArray();
    }

    public static IReadOnlyDictionary<string, int> Counts(JsonElement obj, string name, int max = 20)
    {
        var result = new Dictionary<string, int>(StringComparer.Ordinal);
        if (!Has(obj, name, out var v) || v.ValueKind != JsonValueKind.Object) return result;
        foreach (var p in v.EnumerateObject().Take(max))
        {
            if (p.Value.ValueKind != JsonValueKind.Number || !p.Value.TryGetInt32(out var n)) continue;
            result[p.Name.Length > 40 ? p.Name[..40] : p.Name] = Math.Max(0, n);
        }
        return result;
    }
}
