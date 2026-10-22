# CABO installable app release

CABO uses one responsive web application, API and account system across phones, tablets and computers. The browser-installable edition is the first distribution channel: no duplicated backend, separate learner database or native wrapper dependency.

## Included

- Public `/install` page, available before sign-in, with Android, iPhone/iPad and PC/Mac instructions.
- Browser install event handling, acceptance/cancellation/failure feedback and installed-window recognition. Where a browser does not expose a prompt, manual steps remain available.
- Standalone manifest, persistent app identity, CABO branding, maskable icons, an Apple touch icon and app shortcuts. Icons match the existing favicon geometry.
- Safe-area layout support and a connectivity indicator.
- Real service-worker offline navigation fallback with a reconnect action. Only explicitly allowed public static assets are cached; API responses, uploads and authenticated HTML are excluded. Old CABO static caches are removed on activation.
- Online server authority for learner data, saved work and submissions. No new offline write/replay mechanism is added.
- CI browser checks for installation states, device instructions, responsive widths, selected accessibility rules, real service-worker fallback/reconnect and cache privacy.

## Distribution

Open the deployed `/install` page. Android users install through Chrome; iPhone/iPad users add CABO to their Home Screen from Safari; desktop users install with Chrome/Edge or add to Dock with supported Safari. Browser/device wording varies. Installed users continue using the same online CABO service and receive web updates.

This release is not an APK, AAB, IPA, EXE or app-store listing. No store publication or signed native build has occurred. Store distribution is a subsequent channel that requires CABO-owned developer accounts, signing credentials, an agreed permanent production domain, store metadata/privacy declarations, real-device acceptance and store review. Apple requires meaningful app functionality beyond a repackaged website. Do not advertise store availability before approval.

The existing Render deployment is an isolated pilot with the data continuity and operational limitations documented in LEARNER_SUCCESS_RELEASE.md. Installing the pilot does not complete the Railway production cutover. Before distributing permanently, choose the stable production origin; changing origin creates a separate app/storage identity.

## Verification and limits

The PR records local/hosted browser results and live deployment checks. Automated prompts are synthetic browser events; they do not prove operating-system installation. Mobile viewport/user-agent checks do not replace physical iPhone/Android testing. Installation UI and uninstall are controlled by the browser/OS. A network connection remains necessary for learning workflows; the offline screen does not claim an interrupted submission failed or succeeded.

Sources checked 22 October 2026:
- https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios
- https://support.apple.com/guide/safari/add-to-dock-ibrw9e991864/mac
- https://support.google.com/chrome/answer/9658361
- https://developer.apple.com/app-store/review/guidelines/
