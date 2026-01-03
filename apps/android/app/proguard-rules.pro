# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.kts.

# Keep Kotlin serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}

-keep,includedescriptorclasses class xyz.askbox.app.**$$serializer { *; }
-keepclassmembers class xyz.askbox.app.** {
    *** Companion;
}
-keepclasseswithmembers class xyz.askbox.app.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# JNA
-dontwarn java.awt.*
-keep class com.sun.jna.** { *; }
-keep class * implements com.sun.jna.** { *; }

# Lazysodium
-keep class com.goterl.lazysodium.** { *; }
-keep class com.sun.jna.** { *; }
