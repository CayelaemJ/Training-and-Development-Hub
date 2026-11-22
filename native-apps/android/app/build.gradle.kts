plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}
android {
    namespace = "za.co.cabosolutions.learninghub"
    compileSdk = 35
    defaultConfig {
        applicationId = "za.co.cabosolutions.learninghub"
        minSdk = 23
        targetSdk = 35
        // CI or a release engineer can raise these without editing source; defaults keep local builds working.
        versionCode = providers.gradleProperty("caboVersionCode").orNull?.toIntOrNull() ?: 1
        versionName = providers.gradleProperty("caboVersionName").orNull ?: "0.1.0"
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
    // Release signing is read only from the environment of the build machine (for example GitHub Actions
    // secrets). Nothing secret is stored in this repository. Without all four values the release APK/AAB
    // stay unsigned and must be signed before distribution.
    val releaseKeystore = System.getenv("CABO_ANDROID_KEYSTORE_PATH")?.takeIf { it.isNotBlank() }
    val releaseStorePassword = System.getenv("CABO_ANDROID_KEYSTORE_PASSWORD")?.takeIf { it.isNotBlank() }
    val releaseKeyAlias = System.getenv("CABO_ANDROID_KEY_ALIAS")?.takeIf { it.isNotBlank() }
    val releaseKeyPassword = System.getenv("CABO_ANDROID_KEY_PASSWORD")?.takeIf { it.isNotBlank() }
    val canSignRelease = releaseKeystore != null && file(releaseKeystore).isFile &&
        releaseStorePassword != null && releaseKeyAlias != null && releaseKeyPassword != null
    signingConfigs {
        if (canSignRelease) {
            create("caboRelease") {
                storeFile = file(releaseKeystore!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }
    buildTypes {
        getByName("release") {
            isMinifyEnabled = true
            isShrinkResources = true
            isDebuggable = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (canSignRelease) signingConfig = signingConfigs.getByName("caboRelease")
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
