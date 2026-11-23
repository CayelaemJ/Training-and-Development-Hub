# Windows internal test build

The GitHub Actions workflow `.github/workflows/native-windows-verify.yml` compiles the WinUI 3 client when Windows source or the workflow changes.

## Download

1. Open the pull request's **Checks** tab and select **CABO native Windows build verification**.
2. Confirm the run is green and its commit matches the source you are testing.
3. Download artifact `CABO-Windows-DEBUG-no-test-login` and extract the debug build directory.

The workflow retains this artifact for two days. Rerun the workflow from GitHub Actions when a fresh build is needed.

## Test limits

This is an unsigned debug build directory, not an MSIX installer or production-signed executable. CI compilation does not verify Windows installation, upgrades, uninstall, OIDC sign-in, role authorization or behavior on a school device. Do not distribute it as a production school app.

Use authorised test accounts and synthetic learner records. Record Windows version, test result and reproduction steps without capturing real learner data. CABO signing, packaging and installation testing remain required release work.

## Windows installer (`.exe`)

Workflow **CABO native Windows installer** (`.github/workflows/native-windows-release.yml`) builds the **Release x64** client with the isolated test sign-in compiled out, and verifies that in the built assembly before packaging. It then produces an Inno Setup installer from `native-apps/windows/installer/CABO.Native.iss`.

- **Install type:** per-user into `%LOCALAPPDATA%\Programs\CABO Learning Hub`; no administrator rights; Windows 10 1809 or later, x64. It registers a standard uninstaller with a fixed AppId, so upgrades replace the previous version.
- **Uninstall:** removes program files and the local sign-in token (`%LOCALAPPDATA%\CABO\LearningHub\native-session.bin`), so a shared computer is not left signed in.
- **CI test on a hosted Windows runner:** silent install, a check that the executable and uninstall registration are present, an informational 15-second startup check, silent uninstall, and a check that the files, registration and token are gone.
- **Signing:** set both repository secrets `CABO_WINDOWS_CERT_BASE64` (base64 `.pfx`) and `CABO_WINDOWS_CERT_PASSWORD` to sign the app and installer with SHA-256 and an RFC 3161 timestamp. Without them the file is named `…-UNSIGNED-do-not-distribute.exe`, and Windows SmartScreen will warn on it.
- **When it runs:** automatically on pull requests that change Windows files (version `0.0.0-pr<number>`, artifact kept 2 days), or manually with a version for a release candidate (artifact kept 7 days).

A hosted-runner install is not a school-device test. Sign-in, role access, offline behaviour and accessibility still need testing on real Windows 10/11 devices before distribution.
