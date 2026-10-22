# CABO iPhone and iPad (Xcode / TestFlight preparation)

This is an **iOS project scaffold**, not a released IPA or App Store app. It keeps the existing CABO React application, same HTTPS origin, cookies and database rather than creating a second mobile backend. A native toolbar provides reload, share, and Open in Safari.

On a **Mac** with Xcode 15+ and [XcodeGen](https://github.com/yonaskolb/XcodeGen):

```bash
bash native/ios/scripts/prepare-icon.sh
cd native/ios
xcodegen generate
open CABOLearningHub.xcodeproj
```

Select CABO's Apple Developer team, confirm the final Bundle ID, run on physical iPhone/iPad, and use Xcode Archive for a signing/test build. TestFlight/App Store require Apple signing and distribution privileges. Change the pilot URL in `Sources/CABOApp.swift` to CABO's **approved permanent production HTTPS origin** before release; re-review permitted identity-provider hosts when replacing Replit OIDC.

The web app's Replit OIDC login may navigate to identity providers or launch popups that this deliberately restricted WKWebView does not yet support. **Complete sign-in, logout, token expiration, file upload/download, handoff, and multi-user data-isolation tests on real devices before advertising compatibility.** An App Store submission also needs native quality and function sufficient for Apple's Guideline 4.2; this proof of concept is not a guarantee of approval. Design native notifications, downloadable learning materials (with privacy-safe storage and deletion), and useful iOS-only workflows before requesting approval.

Do not package schoolchild records offline by default. Treat analytics, tracking, guardian consent, App Privacy fields, and child safety as release gates.

https://developer.apple.com/app-store/review/guidelines/
