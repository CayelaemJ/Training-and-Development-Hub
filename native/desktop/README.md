# CABO Learning Hub desktop

A minimal, sandboxed Electron **pilot** wrapper for the already-deployed CABO Learning Hub. It loads the same HTTPS origin as web/mobile, preserving same-origin sessions and API. The app contains no server data or keys.

## Windows (on Windows)

```powershell
cd native/desktop
npm install
npm test
npm run build:win
```

An NSIS `CABO-Learning-Hub-Setup-*.exe` is expected under `native/desktop/dist` if the build succeeds. The app icon is recreated from the existing CABO favicon/brand script; it is not stock Electron branding. The build is **unsigned**, unless a CABO-owned trusted signing certificate is configured outside Git.

## Linux development preview

```bash
cd native/desktop
npm install
npm test
npm run build:linux
```

## Release gates

- `navigation.cjs` currently uses the isolated Render pilot. Replace `PORTAL_URL` with the approved stable HTTPS production host **before signing/releasing**, and confirm the OIDC allowlist matches the actual configured identity provider. Do not allow arbitrary URLs.
- Verify account login/logout and identity-provider redirects, imports/exports, downloads, quiz submissions, session expiry, connectivity loss and role access on an actual Windows machine.
- Remote web content is sandboxed, Node.js and popups are disabled, navigation is constrained and all browser permission requests are denied. Add permissions only in an explicitly reviewed follow-up.
- Do not promise offline saving or desktop background AI processing. Changes to the hosted web application arrive through the normal web release; new desktop permissions or native features require a new signed installer.
- No automated release or deploy is triggered by this directory; the manual Windows workflow is optional and consumes runner credits if invoked.
