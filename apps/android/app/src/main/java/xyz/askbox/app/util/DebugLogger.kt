package xyz.askbox.app.util

import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Singleton debug logger that captures logs for display in a debug UI.
 * Enable debug mode by tapping the app title 7 times.
 */
object DebugLogger {
    private const val TAG = "AskBoxDebug"
    private const val MAX_LOGS = 500
    
    private val _logs = MutableStateFlow<List<LogEntry>>(emptyList())
    val logs: StateFlow<List<LogEntry>> = _logs.asStateFlow()
    
    private val _isDebugEnabled = MutableStateFlow(false)
    val isDebugEnabled: StateFlow<Boolean> = _isDebugEnabled.asStateFlow()
    
    private val dateFormat = SimpleDateFormat("HH:mm:ss.SSS", Locale.getDefault())
    
    data class LogEntry(
        val timestamp: String,
        val level: LogLevel,
        val tag: String,
        val message: String
    )
    
    enum class LogLevel {
        DEBUG, INFO, WARN, ERROR
    }
    
    fun enableDebug() {
        _isDebugEnabled.value = true
        i("DebugLogger", "Debug mode enabled")
    }
    
    fun disableDebug() {
        _isDebugEnabled.value = false
    }
    
    fun toggleDebug() {
        if (_isDebugEnabled.value) {
            disableDebug()
        } else {
            enableDebug()
        }
    }
    
    fun clearLogs() {
        _logs.value = emptyList()
    }
    
    fun d(tag: String, message: String) {
        log(LogLevel.DEBUG, tag, message)
        Log.d(TAG, "[$tag] $message")
    }
    
    fun i(tag: String, message: String) {
        log(LogLevel.INFO, tag, message)
        Log.i(TAG, "[$tag] $message")
    }
    
    fun w(tag: String, message: String) {
        log(LogLevel.WARN, tag, message)
        Log.w(TAG, "[$tag] $message")
    }
    
    fun e(tag: String, message: String, throwable: Throwable? = null) {
        val fullMessage = if (throwable != null) {
            "$message\n${throwable.stackTraceToString()}"
        } else {
            message
        }
        log(LogLevel.ERROR, tag, fullMessage)
        Log.e(TAG, "[$tag] $message", throwable)
    }
    
    private fun log(level: LogLevel, tag: String, message: String) {
        val entry = LogEntry(
            timestamp = dateFormat.format(Date()),
            level = level,
            tag = tag,
            message = message
        )
        
        _logs.value = (_logs.value + entry).takeLast(MAX_LOGS)
    }
    
    // Convenience methods for crypto debugging
    fun logCrypto(operation: String, details: Map<String, Any?>) {
        val message = buildString {
            append(operation)
            append(": ")
            details.entries.joinTo(this, ", ") { (k, v) ->
                when (v) {
                    is ByteArray -> "$k=${v.size}bytes"
                    is String -> if (v.length > 50) "$k=${v.take(20)}...(${v.length}chars)" else "$k=$v"
                    else -> "$k=$v"
                }
            }
        }
        d("Crypto", message)
    }
    
    fun logApi(method: String, endpoint: String, status: String, details: String? = null) {
        val message = buildString {
            append("$method $endpoint -> $status")
            if (details != null) {
                append(" | $details")
            }
        }
        if (status.startsWith("2")) {
            i("API", message)
        } else {
            w("API", message)
        }
    }
}
