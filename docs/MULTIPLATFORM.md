# CABO cross-platform baseline — Testing only

The existing React SPA is packaged first as a Progressive Web App (PWA).
- Website: the existing Node/React service is hosted on Render; isolated native testing uses the dedicated Render preview.
- Desktop: Chrome/Edge install the PWA into a standalone app window.
- Android: Chrome → Install app / Add to Home screen.
- iOS: Safari → Share → Add to Home Screen.

The manifest, app icons and service worker are shipped with the same frontend build. Native Android (Kotlin/Compose), iOS (Swift/SwiftUI) and Windows (WinUI 3) clients now exist on the native feature branch. CI compiles these targets, but physical-device acceptance, signed release packages and store publication remain open.

Security: the worker intentionally does not cache HTML/navigation or /api requests. Learner data, login sessions, exams, grades and submissions remain online-only. Offline exam submission and authenticated offline storage require separate threat modelling, resumability and audit controls.

Verification: inspect /manifest.webmanifest, /sw.js and /icons/cabo-192.png; check browser Application > Manifest/Service Workers; test install on Android Chrome and desktop Edge/Chrome, iOS Safari Add to Home Screen; regression-test auth and role navigation on narrow screens. Native packaging and device testing remain outstanding.
