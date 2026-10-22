# CABO Android APK and Google Play AAB

PR #40 already provides an HTTPS installable PWA. Package the **same hosted CABO site** as a Trusted Web Activity (TWA) using Google's Bubblewrap / PWABuilder; this preserves same-origin session cookies, learner uploads and the existing API. Do not build a separate offline data store.

## Prerequisites

- Stable CABO-owned HTTPS production origin and a production-quality privacy policy.
- A working manifest at `https://YOUR-CABO-DOMAIN/manifest.webmanifest`, app icons and service worker.
- JDK, Android SDK, Bubblewrap CLI, an Android test device/emulator and sufficient disk space.
- CABO-controlled Android application ID (proposed: `za.co.cabosolutions.learninghub`).
- Unique Android app signing key/keystore held securely **outside Git**.

## Generate packages (local developer machine)

```bash
npm install --global @bubblewrap/cli
bubblewrap init --manifest https://YOUR-CABO-DOMAIN/manifest.webmanifest
# Review packageId, app name, icons, start URL, scope and signing settings.
bubblewrap build
```

Bubblewrap will generate an Android project and signed test APK when a signing key is configured. Depending on the version/configuration it also produces an AAB for Play; inspect actual outputs before sharing. Keep keystores and fingerprints in CABO's secure release vault. Never commit generated keys.

## Verified fullscreen mode requires Digital Asset Links

Create `https://YOUR-CABO-DOMAIN/.well-known/assetlinks.json` on the **same origin** used by the manifest:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "za.co.cabosolutions.learninghub",
    "sha256_cert_fingerprints": ["REPLACE_WITH_REAL_APP_SIGNING_SHA256"]
  }
}]
```

**Do not deploy the placeholder.** Use the SHA-256 signing certificate fingerprint for the actual distribution key (including Google's Play App Signing key when applicable). Check the asset-link relationship on an actual device. A TWA without a valid association can appear with browser chrome.

Before external distribution, test actual login/logout, downloads, uploads, file picking, AI test generation, multi-account isolation, session expiration, network loss, back button, camera/photo selection, and accessibility. Do not use the pilot Render origin for a public release.

Useful official references:
- https://developer.android.com/develop/ui/views/layout/webapps/guide-trusted-web-activities-version2
- https://github.com/pwa-builder/PWABuilder/blob/main/docs/builder/android.md
