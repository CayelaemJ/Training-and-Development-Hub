plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}
// Release signing comes ONLY from CI/runtime secrets, never from files in this
// repository. All four variables must be set together; with none set, release
// outputs are produced UNSIGNED and must not be distributed.
val releaseSigningEnv = listOf(
    "CABO_ANDROID_KEYSTORE_PATH",
    "CABO_ANDROID_KEYSTORE_PASSWORD",
    "CABO_ANDROID_KEY_ALIAS",
    "CABO_ANDROID_KEY_PASSWORD",
).associateWith { providers.environmentVariable(it).orNull?.takeIf(String::isNotBlank) }
val releaseSigningReady = releaseSigningEnv.values.all { it != null }
require(releaseSigningReady || releaseSigningEnv.values.all { it == null }) {
    "Set all of ${releaseSigningEnv.keys} for a signed release, or none for an unsigned build"
}
// The default applies only when the property is absent; a supplied value that is
// not a valid Int (for example 3000000000) fails instead of silently becoming 1.
val caboVersionCodeInput = providers.gradleProperty("caboVersionCode").orNull
val caboVersionCode = if (caboVersionCodeInput == null) 1 else requireNotNull(caboVersionCodeInput.trim().toIntOrNull()) {
    "caboVersionCode must be a whole number between 1 and 2100000000"
}
require(caboVersionCode in 1..2_100_000_000) { "caboVersionCode must be a whole number between 1 and 2100000000" }
val caboVersionName = providers.gradleProperty("caboVersionName").orNull ?: "0.1.0"
require(Regex("^[0-9]+\\.[0-9]+\\.[0-9]+(-[A-Za-z0-9.]+)?$").matches(caboVersionName)) {
    "caboVersionName must look like 1.2.3 or 1.2.3-rc.1"
}
android {
    namespace = "za.co.cabosolutions.learninghub"
    compileSdk = 36
    defaultConfig {
        applicationId = "za.co.cabosolutions.learninghub"
        minSdk = 23
        targetSdk = 36
        versionCode = caboVersionCode
        versionName = caboVersionName
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        // Test URL and login are compile-time settings, never downloaded from a web page.
        val publicOrigin = "https://cabo-learning-hub-pilot.onrender.com"
        val origin = providers.gradleProperty("caboApiOrigin").orNull ?: publicOrigin
        require(Regex("^https://[A-Za-z0-9.-]+(?::[0-9]{1,5})?$").matches(origin)) {
            "CABO Android API origin must be a trusted HTTPS host"
        }
        val pilot = providers.gradleProperty("caboEnableTestLogin").orNull == "true" &&
            origin != publicOrigin
        val demo = providers.gradleProperty("caboEnableDemoMode").orNull == "true" &&
            origin != publicOrigin
        buildConfigField("String", "API_ORIGIN", "\"$origin\"")
        buildConfigField("boolean", "ENABLE_TEST_LOGIN", pilot.toString())
        buildConfigField("boolean", "ENABLE_DEMO_MODE", demo.toString())
    }
    signingConfigs {
        if (releaseSigningReady) {
            create("caboRelease") {
                storeFile = file(releaseSigningEnv.getValue("CABO_ANDROID_KEYSTORE_PATH")!!)
                storePassword = releaseSigningEnv.getValue("CABO_ANDROID_KEYSTORE_PASSWORD")
                keyAlias = releaseSigningEnv.getValue("CABO_ANDROID_KEY_ALIAS")
                keyPassword = releaseSigningEnv.getValue("CABO_ANDROID_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        create("demo") {
            initWith(getByName("debug"))
            applicationIdSuffix = ".demo"
            versionNameSuffix = "-demo"
            matchingFallbacks += listOf("debug")
            buildConfigField("boolean", "ENABLE_TEST_LOGIN", "false")
            buildConfigField("boolean", "ENABLE_DEMO_MODE", "true")
        }
        getByName("release") {
            isDebuggable = false
            // R8 shrinking stays off until it is tested on devices with keep rules.
            isMinifyEnabled = false
            // Release builds never contain the isolated test login or offline demo mode,
            // whatever Gradle properties are passed (build-type fields override defaultConfig).
            buildConfigField("boolean", "ENABLE_TEST_LOGIN", "false")
            buildConfigField("boolean", "ENABLE_DEMO_MODE", "false")
            if (releaseSigningReady) signingConfig = signingConfigs.getByName("caboRelease")
        }
    }
    lint {
        abortOnError = true
        checkReleaseBuilds = true
        warningsAsErrors = false
    }
    testOptions { unitTests.isReturnDefaultValues = true }
    buildFeatures { compose = true; buildConfig = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation(platform("androidx.compose:compose-bom:2025.04.01"))
    androidTestImplementation(platform("androidx.compose:compose-bom:2025.04.01"))
    debugImplementation(platform("androidx.compose:compose-bom:2025.04.01"))
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
