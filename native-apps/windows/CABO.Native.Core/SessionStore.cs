using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace CABO.Native;

/// <summary>An expiring CABO native bearer session. Never a password or refresh token.</summary>
public sealed record NativeSession(string AccessToken, DateTimeOffset? ExpiresAt);

public interface ISessionStore
{
    NativeSession? Load();
    void Save(NativeSession session);
    void Clear();
}

/// <summary>
/// Stores the one-hour bearer session encrypted with Windows DPAPI for the
/// current Windows user only. Learner records and passwords are never written.
/// </summary>
public sealed class DpapiSessionStore : ISessionStore
{
    // App-specific entropy so another program running as the same user cannot
    // decrypt the blob with a plain DPAPI call that does not know this value.
    private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("CABO.LearningHub.NativeSession.v2");
    private readonly string path;

    public DpapiSessionStore(string? path = null)
    {
        this.path = path ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "CABO", "LearningHub", "native-session.bin");
    }

    public string FilePath => path;

    public NativeSession? Load()
    {
        if (!OperatingSystem.IsWindows()) return null;
        try
        {
            if (!File.Exists(path)) return null;
            var blob = File.ReadAllBytes(path);
            if (blob.Length == 0 || blob.Length > 64 * 1024) { Clear(); return null; }
            byte[] plain;
            try
            {
                plain = ProtectedData.Unprotect(blob, Entropy, DataProtectionScope.CurrentUser);
            }
            catch (CryptographicException)
            {
                // Sessions written by v1.0 used no entropy; read once, then re-save as v2.
                plain = ProtectedData.Unprotect(blob, null, DataProtectionScope.CurrentUser);
                var legacy = Decode(plain);
                if (legacy is not null) Save(legacy);
                return legacy;
            }
            return Decode(plain);
        }
        catch (Exception)
        {
            // A corrupt, foreign or undecryptable file is discarded rather than trusted.
            Clear();
            return null;
        }
    }

    internal static NativeSession? Decode(byte[] plain)
    {
        var text = Encoding.UTF8.GetString(plain);
        if (text.StartsWith("{", StringComparison.Ordinal))
        {
            using var doc = JsonDocument.Parse(text);
            var root = doc.RootElement;
            var token = NativeJson.Str(root, "token", 512);
            if (token.Length < 32) return null;
            var expires = NativeJson.Long(root, "expiresAt");
            return new NativeSession(token,
                expires > 0 ? DateTimeOffset.FromUnixTimeSeconds(expires) : null);
        }
        // v1.0 stored the bare token; its expiry is unknown and the server enforces it.
        return text.Length is >= 32 and <= 512 ? new NativeSession(text, null) : null;
    }

    internal static byte[] Encode(NativeSession session)
    {
        var json = JsonSerializer.Serialize(new
        {
            v = 2,
            token = session.AccessToken,
            expiresAt = session.ExpiresAt?.ToUnixTimeSeconds() ?? 0
        });
        return Encoding.UTF8.GetBytes(json);
    }

    public void Save(NativeSession session)
    {
        if (!OperatingSystem.IsWindows())
            throw new PlatformNotSupportedException("DPAPI session storage requires Windows.");
        var encrypted = ProtectedData.Protect(Encode(session), Entropy, DataProtectionScope.CurrentUser);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var temp = path + ".tmp";
        File.WriteAllBytes(temp, encrypted);
        File.Move(temp, path, overwrite: true);
    }

    public void Clear()
    {
        try { if (File.Exists(path)) File.Delete(path); }
        catch (IOException) { /* The server session still expires within an hour. */ }
        catch (UnauthorizedAccessException) { }
        try { if (File.Exists(path + ".tmp")) File.Delete(path + ".tmp"); }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }
}

/// <summary>Volatile store used by tests and as a fallback when DPAPI is unavailable.</summary>
public sealed class MemorySessionStore : ISessionStore
{
    private NativeSession? session;
    public NativeSession? Load() => session;
    public void Save(NativeSession value) => session = value;
    public void Clear() => session = null;
}
