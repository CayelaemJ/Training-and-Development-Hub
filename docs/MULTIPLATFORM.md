# CABO cross-platform baseline — Testing only

The existing React SPA is packaged first as a Progressive Web App (PWA).
- Website: deploy the existing Node/React service to Railway Testing.
- Desktop: Chrome/Edge install the PWA into a standalone app window.
- Android: Chrome → Install app / Add to Home screen.
- iOS: Safari → Share → Add to Home Screen.

The manifest, app icons and service worker are shipped with the same frontend build. A native Windows/macOS wrapper (Tauri) and iOS/Android package (Capacitor) are future milestones; **no installers or app-store binaries are included in this change**.

Security: the worker intentionally does not cache HTML/navigation or /api requests. Learner data, login sessions, exams, grades and submissions remain online-only. Offline exam submission and authenticated offline storage require separate threat modelling, resumability and audit controls.

Verification: inspect /manifest.webmanifest, /sw.js and /icons/cabo-192.png; check browser Application > Manifest/Service Workers; test install on Android Chrome and desktop Edge/Chrome, iOS Safari Add to Home Screen; regression-test auth and role navigation on narrow screens. Native packaging and device testing remain outstanding.
