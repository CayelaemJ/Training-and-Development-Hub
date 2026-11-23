# CABO Learning Hub release shrinking rules.
# The app uses org.json (platform) and Compose; neither needs reflection keeps beyond the
# consumer rules shipped with AndroidX and kotlinx.coroutines.

# Keep readable stack traces for crash triage without shipping original source file names.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Strip verbose, debug and info logging from release builds so learner data can never
# reach logcat through a forgotten diagnostic call. Warnings and errors are kept.
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
}
