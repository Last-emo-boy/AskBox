package xyz.askbox.app.ui.debug

import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import xyz.askbox.app.debug.DebugLogger
import xyz.askbox.app.debug.LogEntry
import javax.inject.Inject

@HiltViewModel
class DebugViewModel @Inject constructor(
    private val debugLogger: DebugLogger
) : ViewModel() {
    
    private val _logs = MutableStateFlow<List<LogEntry>>(emptyList())
    val logs: StateFlow<List<LogEntry>> = _logs
    
    private val _isEnabled = MutableStateFlow(debugLogger.isEnabled)
    val isEnabled: StateFlow<Boolean> = _isEnabled
    
    init {
        refresh()
    }
    
    fun refresh() {
        _logs.value = debugLogger.logs
    }
    
    fun clearLogs() {
        debugLogger.clear()
        _logs.value = emptyList()
    }
    
    fun toggleLogging() {
        debugLogger.isEnabled = !debugLogger.isEnabled
        _isEnabled.value = debugLogger.isEnabled
    }
}
