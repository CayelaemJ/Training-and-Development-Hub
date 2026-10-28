# CABO native accessibility and broad-device support

## Product commitment
A person's phone, tablet brand, purchase price, age of device or network quality must **never** determine access to learning content, guardian rights or educator permissions. Server-side institutional and guardian authorization determines data access. Screen size only changes the native layout. Both Android and iOS native apps avoid WebViews and reuse CABO's existing secured education backend.

## Proposed minimum supported operating systems (NOT yet hardware-verified)

| Platform | Planned native OS floor | Device examples / notes |
| --- | --- | --- |
| Android phones and tablets | **Android 6.0 / API 23+** | Includes many older and inexpensive devices; Android Keystore AES used for credentials requires API 23. Apps must run on actual OEM Android devices and those without Google Play Services where browser sign-in is available. |
| iPhone and iPad | **iOS / iPadOS 15+** | iPhone 6s/6s Plus, original iPhone SE, iPhone 7 and newer iPhones capable of iOS 15; compatible iPads. iOS project uses `NavigationView` instead of iOS 16-only `NavigationStack`. |
| Windows | As supported by selected WinUI 3 runtime | A separate Windows release matrix is needed when the desktop client is finished. |
| Older unsupported Android/iOS versions | No native support claim yet | Keep the existing browser-based CABO web edition available where the installed browser can securely access it; do not guarantee old browsers work without testing. |

**"Any iPhone" and "any Android" cannot literally mean every device ever manufactured.** Devices too old to run supported OS frameworks, with limited memory, unsupported CPU instructions, absent secure HTTPS support or no accessible browser cannot reliably run these builds. We will publish a tested compatibility matrix and avoid artificial premium-device requirements.

## Role and form-factor experience

- **Teacher with tablet**: large two-pane native classroom workspace at 600dp+ on Android or regular horizontal size class on iPad, with assigned course names and permitted support summary. On smaller devices the same authorized user uses a one-pane view. Editing lesson content, marking and interventions remain separate development work and must go through CABO's existing scoped APIs.
- **Learner with tablet or phone**: progress summary, study materials and practice-test listings, plus an authenticated picker for supported study documents. No force-installed parental control based on hardware or private cache of school records. Live storage/device acceptance and offline learning remain further work.
- **Parent with phone or tablet**: large, clearly labeled native Accept/Decline buttons, invitation status, verification guidance. An invitation alone does not authorize child reports. Name is returned **only** for an institution-verified guardian link with an active enrollment.
- **Any role**: no account is blocked or changed simply because a screen is small, wide, older, or inexpensive. User's server-resolved role is the source of truth, independent of device detection.

## Low-end and low-data requirements

1. Always readable on 320dp, 360dp, 390dp, 600dp, 800dp widths; both rotations where possible, system font scaling 100–200%, no clipping, no minimum screen diagonal.
2. Touch controls at least 48dp on Android and comfortably large on iOS; keyboard/switch/VoiceOver/TalkBack support and clear focus order.
3. No mandatory animations, 3D, heavy video, AI inference on-device or large image loads for critical content. User-facing essential data comes from compact JSON, not a giant embedded site.
4. No continuous auto-refresh on metered cellular connections. Load records on demand with obvious refresh, timeouts, retry messaging and no duplicate exam submissions.
5. No assumption that camera, biometrics, Google Mobile Services, NFC or powerful hardware exists. Document selection must support each platform's standard system picker.
6. User-friendly failures for slow connections, school Wi-Fi interruptions and devices with limited storage. Never display a failed submission as successful or silently re-send it.
7. Keep CABO clay, teal, ink and gold accessible with adequate contrast, actual text labels, dynamic type, readable marks and localization-ready content.
8. Clear any sensitive session credentials upon logout and never cache private student work by default. Once offline learning is implemented, use explicit downloads, encrypted at-rest storage, per-learner isolation, expiration and conflict-safe synchronization.

## Native implementation references

- Android Compose view and 600dp responsive switching: `native-apps/android/app/src/main/java/za/co/cabosolutions/learninghub/MainActivity.kt`
- Android minimum API: `native-apps/android/app/build.gradle.kts`
- iOS iPhone/iPad adaptive UI: `native-apps/ios/NativeHomeView.swift`
- iOS deployment target: `native-apps/ios/project.yml`
- Parent child-data privacy policy/tests: `artifacts/api-server/src/lib/parentMobilePolicy.ts` and `artifacts/api-server/src/tests/parentMobilePolicy.test.mjs`

## Acceptance test matrix for release engineers (future work)

- **Android API 23 emulator**, API 26 inexpensive hardware, API 30 mainstream phone, current Android physical phone, 7-inch tablet, 10-inch tablet.
- **iPhone on iOS 15** or highest available compatible simulator, small iPhone SE-class viewport, latest iPhone, iPad in portrait/landscape and multitasking/resized widths.
- Offline/2G-throttled/high-latency connections; low available RAM/storage; screen-reader font scaling; parent invitation permissions, teacher course scoping and learner quizzes.
- Hardware with no biometric sensor, no camera, no Google Play Services, and intermittent school Wi-Fi.
- Install, upgrade, sleep/resume, logout, screen rotation, keyboard appearance, secure browser OAuth redirect, app-link claiming and session expiry.

Native minimum versions are *targets* only until actual builds and hands-on acceptance pass. Never promise a signed APK, IPA or app-store compatibility based solely on source settings.

Official platform references:
- https://developer.android.com/develop/ui/compose/layouts/adaptive
- https://developer.apple.com/documentation/swiftui/migrating-to-new-navigation-types
- https://www.rfc-editor.org/rfc/rfc8252.html
