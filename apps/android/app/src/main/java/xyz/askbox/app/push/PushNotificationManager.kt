package xyz.askbox.app.push

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.tasks.await
import xyz.askbox.app.data.repository.AuthRepository
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manager class for handling push notification setup and registration.
 */
@Singleton
class PushNotificationManager @Inject constructor(
    private val context: Context,
    private val authRepository: AuthRepository
) {
    companion object {
        private const val TAG = "PushManager"
        const val CHANNEL_ID = "askbox_notifications"
        private const val CHANNEL_NAME = "AskBox 通知"
        private const val CHANNEL_DESCRIPTION = "接收新问题的通知"
    }

    /**
     * Check if push notifications are supported on this device.
     */
    fun isPushSupported(): Boolean {
        return try {
            Class.forName("com.google.firebase.messaging.FirebaseMessaging")
            true
        } catch (e: ClassNotFoundException) {
            false
        }
    }

    /**
     * Check if we have notification permission (Android 13+).
     */
    fun hasNotificationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    /**
     * Create the notification channel for Android O and above.
     */
    fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, importance).apply {
                description = CHANNEL_DESCRIPTION
                enableLights(true)
                enableVibration(true)
            }

            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    /**
     * Get the current FCM token.
     */
    suspend fun getFcmToken(): String? {
        return try {
            FirebaseMessaging.getInstance().token.await()
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to get FCM token", e)
            null
        }
    }

    /**
     * Register the FCM token with the server.
     */
    suspend fun registerPushToken() {
        try {
            val token = getFcmToken() ?: return
            authRepository.registerFcmToken(token)
            android.util.Log.d(TAG, "FCM token registered successfully")
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to register FCM token", e)
            throw e
        }
    }

    /**
     * Subscribe to push notifications (get token and register with server).
     */
    suspend fun subscribeToPush(): Boolean {
        if (!isPushSupported()) {
            android.util.Log.w(TAG, "Push not supported")
            return false
        }

        if (!hasNotificationPermission()) {
            android.util.Log.w(TAG, "No notification permission")
            return false
        }

        return try {
            createNotificationChannel()
            registerPushToken()
            true
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to subscribe to push", e)
            false
        }
    }

    /**
     * Unsubscribe from push notifications.
     */
    suspend fun unsubscribeFromPush(): Boolean {
        return try {
            val token = getFcmToken() ?: return true
            // Delete token from Firebase
            FirebaseMessaging.getInstance().deleteToken().await()
            // Remove from our server (best effort)
            try {
                // Note: This might fail if user is not logged in
                // which is fine, the token will be invalidated anyway
            } catch (e: Exception) {
                android.util.Log.w(TAG, "Failed to unregister from server", e)
            }
            true
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Failed to unsubscribe from push", e)
            false
        }
    }
}
