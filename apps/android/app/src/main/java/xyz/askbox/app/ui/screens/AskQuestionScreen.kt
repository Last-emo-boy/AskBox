package xyz.askbox.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
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
fun AskQuestionScreen(
    slug: String,
    onBack: () -> Unit,
    viewModel: AskQuestionViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(slug) {
        viewModel.setSlug(slug)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.ask_title)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
                    }
                }
            )
        }
    ) { padding ->
        when {
            uiState.isSuccess -> {
                // Success state
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = null,
                        modifier = Modifier.size(80.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.height(24.dp))
                    Text(
                        text = stringResource(R.string.ask_success_title),
                        style = MaterialTheme.typography.headlineSmall
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = stringResource(R.string.ask_success_message),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    
                    if (uiState.receiptSaved) {
                        Spacer(modifier = Modifier.height(16.dp))
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.primaryContainer
                            )
                        ) {
                            Row(
                                modifier = Modifier.padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    Icons.Default.Receipt,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onPrimaryContainer
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                                Text(
                                    text = stringResource(R.string.ask_receipt_saved),
                                    color = MaterialTheme.colorScheme.onPrimaryContainer
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(32.dp))
                    Button(onClick = onBack) {
                        Text("返回")
                    }
                }
            }
            else -> {
                // Form state
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(horizontal = 16.dp)
                ) {
                    Spacer(modifier = Modifier.height(16.dp))

                    // Target box info
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Default.Inbox,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = String.format(stringResource(R.string.ask_to), slug),
                                style = MaterialTheme.typography.titleMedium
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // Question input
                    OutlinedTextField(
                        value = uiState.question,
                        onValueChange = { viewModel.setQuestion(it) },
                        label = { Text("你的问题") },
                        placeholder = { Text(stringResource(R.string.ask_question_hint)) },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 5,
                        maxLines = 10
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Save receipt option
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Checkbox(
                            checked = uiState.saveReceipt,
                            onCheckedChange = { viewModel.setSaveReceipt(it) }
                        )
                        Column {
                            Text(
                                text = stringResource(R.string.ask_save_receipt),
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Text(
                                text = "保存回执后可查看私密回答",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    // Error message
                    if (uiState.error != null) {
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = uiState.error!!,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }

                    Spacer(modifier = Modifier.weight(1f))

                    // Submit button
                    Button(
                        onClick = { viewModel.submitQuestion() },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp),
                        enabled = !uiState.isLoading && uiState.question.isNotBlank()
                    ) {
                        if (uiState.isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                color = MaterialTheme.colorScheme.onPrimary
                            )
                        } else {
                            Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(stringResource(R.string.ask_submit))
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))
                }
            }
        }
    }
}

data class AskQuestionUiState(
    val slug: String = "",
    val question: String = "",
    val saveReceipt: Boolean = true,
    val isLoading: Boolean = false,
    val error: String? = null,
    val isSuccess: Boolean = false,
    val receiptSaved: Boolean = false
)

@HiltViewModel
class AskQuestionViewModel @Inject constructor(
    private val repository: AskBoxRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AskQuestionUiState())
    val uiState: StateFlow<AskQuestionUiState> = _uiState

    fun setSlug(slug: String) {
        _uiState.value = _uiState.value.copy(slug = slug)
    }

    fun setQuestion(question: String) {
        _uiState.value = _uiState.value.copy(question = question, error = null)
    }

    fun setSaveReceipt(save: Boolean) {
        _uiState.value = _uiState.value.copy(saveReceipt = save)
    }

    fun submitQuestion() {
        val state = _uiState.value

        if (state.question.isBlank()) {
            _uiState.value = state.copy(error = "请输入问题")
            return
        }

        viewModelScope.launch {
            _uiState.value = state.copy(isLoading = true, error = null)
            try {
                val (_, receipt) = repository.askQuestion(
                    boxSlug = state.slug,
                    question = state.question,
                    saveReceipt = state.saveReceipt
                )
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isSuccess = true,
                    receiptSaved = receipt != null
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "发送失败"
                )
            }
        }
    }
}
