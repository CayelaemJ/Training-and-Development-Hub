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
