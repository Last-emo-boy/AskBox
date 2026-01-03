package xyz.askbox.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import xyz.askbox.app.R
import xyz.askbox.app.data.repository.AskBoxRepository
import javax.inject.Inject

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ImportAccountScreen(
    onBack: () -> Unit,
    onAccountImported: () -> Unit,
    viewModel: ImportAccountViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(uiState.isSuccess) {
        if (uiState.isSuccess) {
            onAccountImported()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.import_account_title)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Spacer(modifier = Modifier.height(8.dp))

            // Seed input
            OutlinedTextField(
                value = uiState.seed,
                onValueChange = { viewModel.setSeed(it) },
                label = { Text(stringResource(R.string.import_account_seed_label)) },
                placeholder = { Text(stringResource(R.string.import_account_seed_hint)) },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3,
                maxLines = 5
            )

            // Password field (optional)
            OutlinedTextField(
                value = uiState.password,
                onValueChange = { viewModel.setPassword(it) },
                label = { Text(stringResource(R.string.create_account_password_label) + "（可选）") },
                placeholder = { Text(stringResource(R.string.create_account_password_hint)) },
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            // Error message
            if (uiState.error != null) {
                Text(
                    text = uiState.error!!,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall
                )
            }

            Spacer(modifier = Modifier.weight(1f))

            // Import button
            Button(
                onClick = { viewModel.importAccount() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                enabled = !uiState.isLoading && uiState.seed.isNotBlank()
            ) {
                if (uiState.isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                } else {
                    Text(stringResource(R.string.home_import_account))
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

data class ImportAccountUiState(
    val seed: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val isSuccess: Boolean = false
)

@HiltViewModel
class ImportAccountViewModel @Inject constructor(
    private val repository: AskBoxRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ImportAccountUiState())
    val uiState: StateFlow<ImportAccountUiState> = _uiState

    fun setSeed(seed: String) {
        _uiState.value = _uiState.value.copy(seed = seed, error = null)
    }

    fun setPassword(password: String) {
        _uiState.value = _uiState.value.copy(password = password, error = null)
    }

    fun importAccount() {
        val state = _uiState.value

        if (state.seed.isBlank()) {
            _uiState.value = state.copy(error = "请输入种子")
            return
        }

        viewModelScope.launch {
            _uiState.value = state.copy(isLoading = true, error = null)
            try {
                val password = state.password.takeIf { it.length >= 8 }
                repository.importAccount(state.seed.trim(), password)
                repository.login()
                _uiState.value = _uiState.value.copy(isLoading = false, isSuccess = true)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "导入账户失败"
                )
            }
        }
    }
}
