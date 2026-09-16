plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

// Fase 15.0(4) — spike: modulo Wear OS vacio ("Hello World" con
// Compose-for-Wear), sideloaded directo al reloj por ADB (no se empaqueta
// dentro del APK del telefono, ver D8 y "Fuera de alcance" en el plan).
// Sin plugin de Flutter ni dependencia de :app.
//
// Fase 15.0(6) fix: el `applicationId` DEBE ser identico al de :app para
// que el Wearable Data Layer (MessageClient) funcione -- Play Services
// trata telefono/reloj como apps completamente ajenas si difiere (falla
// en silencio, sin excepcion). El namespace de Kotlin si puede diferir
// (no afecta el ruteo de Play Services), por eso `com...wear` se queda
// solo ahi.
android {
    namespace = "com.jose2929.micontrolfinanciero.mobile.wear"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.jose2929.micontrolfinanciero.mobile"
        minSdk = 30
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.wear.compose:compose-material:1.4.1")
    implementation("androidx.wear.compose:compose-foundation:1.4.1")
    // Fase 15.0(6): transporte reloj -> telefono (Wearable Data Layer).
    implementation("com.google.android.gms:play-services-wearable:19.0.0")
    // Fase 15.2: Tiles (VoiceExpenseTileService).
    implementation("androidx.wear.tiles:tiles:1.6.2")
    implementation("androidx.wear.protolayout:protolayout:1.4.2")
    implementation("androidx.wear.protolayout:protolayout-material:1.4.2")
    debugImplementation("androidx.wear.tiles:tiles-renderer:1.6.2")
}
