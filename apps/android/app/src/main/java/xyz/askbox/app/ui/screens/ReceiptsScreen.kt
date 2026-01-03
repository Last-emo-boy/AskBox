package xyz.askbox.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import xyz.askbox.app.data.local.StoredReceipt
import xyz.askbox.app.data.repository.AskBoxRepository
import xyz.askbox.app.data.repository.DecryptedAnswer
import javax.inject.Inject

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReceiptsScreen(
    onBack: () -> Unit,
    viewModel: ReceiptsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadReceipts()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.receipts_title)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
                    }
                }
            )
        }
    ) { padding ->
        when {
            uiState.isLoading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            uiState.receipts.isEmpty() -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            Icons.Default.Receipt,
                            contentDescription = null,
                            modifier = Modifier.size(64.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = stringResource(R.string.receipts_empty),
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text(
                            text = stringResource(R.string.receipts_empty_hint),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
            else -> {
                LazyColumn(
                    modifier = Modifier.padding(padding),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(uiState.receipts) { receipt ->
                        ReceiptCard(
                            receipt = receipt,
                            answer = uiState.answers[receipt.questionId],
                            isChecking = uiState.checkingQuestionId == receipt.questionId,
                            onCheckAnswer = { viewModel.checkAnswer(receipt) },
                            onDelete = { viewModel.deleteReceipt(receipt.questionId) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ReceiptCard(
    receipt: StoredReceipt,
    answer: DecryptedAnswer?,
    isChecking: Boolean,
    onCheckAnswer: () -> Unit,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Default.Receipt,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "提问箱: ${receipt.boxSlug}",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Text(
                        text = "问题 ID: ${receipt.questionId.take(8)}...",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                IconButton(onClick = onDelete) {
                    Icon(
                        Icons.Default.Delete,
                        contentDescription = "删除",
                        tint = MaterialTheme.colorScheme.error
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Answer content or check button
            when {
                answer != null -> {
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    if (answer.visibility == "private") Icons.Default.Lock else Icons.Default.Public,
                                    contentDescription = null,
                                    modifier = Modifier.size(16.dp),
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = if (answer.visibility == "private") "私密回答" else "公开回答",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = answer.text,
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                    }
                }
                else -> {
                    Button(
                        onClick = onCheckAnswer,
                        enabled = !isChecking,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        if (isChecking) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp
                            )
                        } else {
                            Icon(Icons.Default.Refresh, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(stringResource(R.string.receipts_check_answer))
                        }
                    }
                }
            }
        }
    }
}

data class ReceiptsUiState(
    val receipts: List<StoredReceipt> = emptyList(),
    val answers: Map<String, DecryptedAnswer> = emptyMap(),
    val isLoading: Boolean = false,
    val checkingQuestionId: String? = null
)

@HiltViewModel
class ReceiptsViewModel @Inject constructor(
    private val repository: AskBoxRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ReceiptsUiState())
    val uiState: StateFlow<ReceiptsUiState> = _uiState

    fun loadReceipts() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val receipts = repository.getReceipts()
                _uiState.value = _uiState.value.copy(isLoading = false, receipts = receipts)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }

    fun checkAnswer(receipt: StoredReceipt) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(checkingQuestionId = receipt.questionId)
            try {
                val answer = repository.getAnswerForReceipt(receipt)
                if (answer != null) {
                    _uiState.value = _uiState.value.copy(
                        checkingQuestionId = null,
                        answers = _uiState.value.answers + (receipt.questionId to answer)
                    )
                } else {
                    _uiState.value = _uiState.value.copy(checkingQuestionId = null)
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(checkingQuestionId = null)
            }
        }
    }

    fun deleteReceipt(questionId: String) {
        viewModelScope.launch {
            repository.deleteReceipt(questionId)
            _uiState.value = _uiState.value.copy(
                receipts = _uiState.value.receipts.filter { it.questionId != questionId },
                answers = _uiState.value.answers - questionId
            )
        }
    }
}
