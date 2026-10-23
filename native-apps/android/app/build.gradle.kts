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
        versionCode = 1
        versionName = "0.1.0"
        // Test URL and login are compile-time settings, never downloaded from a web page.
        val publicOrigin = "https://cabo-learning-hub-pilot.onrender.com"
        val origin = providers.gradleProperty("caboApiOrigin").orNull ?: publicOrigin
        require(Regex("^https://[A-Za-z0-9.-]+(?::[0-9]{1,5})?$").matches(origin)) {
            "CABO Android API origin must be a trusted HTTPS host"
        }
        val pilot = providers.gradleProperty("caboEnableTestLogin").orNull == "true" &&
            origin != publicOrigin
        buildConfigField("String", "API_ORIGIN", "\"$origin\"")
        buildConfigField("boolean", "ENABLE_TEST_LOGIN", pilot.toString())
    }
    buildFeatures { compose = true; buildConfig = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation(platform("androidx.compose:compose-bom:2025.04.01"))
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
}
