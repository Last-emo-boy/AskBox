package xyz.askbox.app.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import xyz.askbox.app.MainActivity
import xyz.askbox.app.R
import xyz.askbox.app.data.repository.AuthRepository
import javax.inject.Inject

/**
 * Firebase Cloud Messaging service for handling push notifications.
 */
@AndroidEntryPoint
class AskBoxFirebaseMessagingService : FirebaseMessagingService() {
    
    @Inject
    lateinit var authRepository: AuthRepository
    
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    
    companion object {
        private const val CHANNEL_ID = "askbox_notifications"
        private const val CHANNEL_NAME = "AskBox 通知"
        private const val CHANNEL_DESCRIPTION = "接收新问题的通知"
        
        private const val TAG = "FCMService"
    }
    
    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }
    
    /**
     * Called when a new FCM token is generated.
     * We need to send this to our server.
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        android.util.Log.d(TAG, "New FCM token: $token")
        
        serviceScope.launch {
            try {
                // Try to register the token with our server
                // This requires the user to be logged in
                authRepository.registerFcmToken(token)
                android.util.Log.d(TAG, "FCM token registered successfully")
            } catch (e: Exception) {
                android.util.Log.e(TAG, "Failed to register FCM token", e)
                // Token will be registered on next app launch
            }
        }
    }
    
    /**
     * Called when a message is received.
     */
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        
        android.util.Log.d(TAG, "Message received from: ${remoteMessage.from}")
        
        // Check if message contains a notification payload
        remoteMessage.notification?.let { notification ->
            showNotification(
                title = notification.title ?: "AskBox",
                body = notification.body ?: "您有新消息",
                data = remoteMessage.data
            )
        }
        
        // Check if message contains a data payload
        if (remoteMessage.data.isNotEmpty()) {
            val title = remoteMessage.data["title"] ?: "AskBox"
            val body = remoteMessage.data["body"] ?: "您有新消息"
            
            // Only show if there's no notification payload
            if (remoteMessage.notification == null) {
                showNotification(title, body, remoteMessage.data)
            }
        }
    }
    
    /**
     * Create the notification channel for Android O and above.
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, importance).apply {
                description = CHANNEL_DESCRIPTION
                enableLights(true)
                enableVibration(true)
            }
            
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    /**
     * Show a notification to the user.
     */
    private fun showNotification(
        title: String,
        body: String,
        data: Map<String, String>
    ) {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            
            // Pass data to the activity
            data.forEach { (key, value) ->
                putExtra(key, value)
            }
        }
        
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
        
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        
        // Use a unique ID based on timestamp
        val notificationId = System.currentTimeMillis().toInt()
        notificationManager.notify(notificationId, notification)
    }
}
