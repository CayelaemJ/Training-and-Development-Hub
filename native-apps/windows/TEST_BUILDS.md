# Windows builds

The WinUI 3 client lives in `native-apps/windows`:

| Project | Purpose |
|---|---|
| `CABO.Native` | WinUI 3 desktop app (unpackaged, self-contained Windows App SDK) |
| `CABO.Native.Core` | UI-free API client, PKCE sign-in, DPAPI session store and role policy |
| `CABO.Native.Tests` | xUnit tests: auth/PKCE loopback, token lifecycle, API contracts, permissions, upload safety, parsing limits |
| `installer/CABOLearningHub.iss` | Inno Setup per-user installer (no admin rights) |

## CI

`.github/workflows/native-windows-verify.yml` runs on Windows pull requests and `main`:

1. Unit tests (`dotnet test`), results uploaded as `CABO-Windows-test-results`.
2. NuGet vulnerability scan — fails on any known vulnerable package or if the scan cannot run.
3. Debug builds of the isolated test-login variant (never archived) and the standard client.
4. Release publish (`scripts/build-windows-release.ps1`), check that the isolated test switch is absent from shipped binaries, optional Authenticode signing, installer + portable zip + SHA-256 sums.
5. Installer smoke test (`scripts/windows-installer-smoke.ps1`): silent install, version and uninstall-registration checks, 15-second launch without a crash log, reinstall over the top, silent uninstall that removes files, registration and local session data.

Artifacts: `CABO-Windows-installer-<version>` (14 days), `CABO-Windows-DEBUG-no-test-login` (2 days).

## Releases

`.github/workflows/windows-release.yml` (manual dispatch with a version, or a `windows-vX.Y.Z` tag) reuses the pipeline above and, only when asked or on a tag, creates a **draft, pre-release** GitHub release. A maintainer must publish it manually.

Signing is used only when both repository secrets `CABO_WINDOWS_CERT_BASE64` (base64 `.pfx`) and `CABO_WINDOWS_CERT_PASSWORD` are configured; the app and installer are then signed with SHA-256 and an RFC 3161 timestamp. Otherwise every build is marked **UNSIGNED** in `SIGNING_STATUS.txt` and must not be distributed to schools.

This is the only Windows installer. It replaces the interim `native-windows-release.yml` / `installer/CABO.Native.iss` pipeline from #198, which used a different AppId; neither was distributed.

## Local build (Windows)

```powershell
dotnet test native-apps/windows/CABO.Native.Tests
./scripts/build-windows-release.ps1 -Version 1.1.0      # needs VS Build Tools + Inno Setup 6.3+
./scripts/windows-installer-smoke.ps1 -Installer native-apps/windows/artifacts/release/CABO-LearningHub-Setup-1.1.0-x64.exe -Version 1.1.0
```

## Test limits

CI does not verify live browser sign-in against the pilot, role behaviour with real accounts, screen-reader use, or school-device behaviour. Use authorised test accounts and synthetic learner records only; record Windows version, result and reproduction steps without capturing real learner data. A hosted-runner install is not a school-device test: sign-in, role access, offline behaviour and accessibility still need testing on real Windows 10/11 devices before distribution.
