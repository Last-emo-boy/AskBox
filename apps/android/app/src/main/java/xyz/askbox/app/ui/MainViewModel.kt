package xyz.askbox.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import xyz.askbox.app.data.repository.AskBoxRepository
import javax.inject.Inject

@HiltViewModel
class MainViewModel @Inject constructor(
    private val repository: AskBoxRepository
) : ViewModel() {

    private val _hasAccount = MutableStateFlow<Boolean?>(null)
    val hasAccount: StateFlow<Boolean?> = _hasAccount

    private val _isUnlocked = MutableStateFlow(false)
    val isUnlocked: StateFlow<Boolean> = _isUnlocked

    init {
        checkAccount()
    }

    private fun checkAccount() {
        viewModelScope.launch {
            _hasAccount.value = repository.hasAccount()
            _isUnlocked.value = repository.isUnlocked()
        }
    }

    fun refreshState() {
        checkAccount()
    }
}
