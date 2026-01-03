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
import xyz.askbox.app.data.repository.AskBoxRepository
import xyz.askbox.app.data.repository.DecryptedQuestion
import javax.inject.Inject

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuestionsScreen(
    slug: String,
    onBack: () -> Unit,
    viewModel: QuestionsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(slug) {
        viewModel.loadQuestions(slug)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(slug) },
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
        ) {
            // Filter tabs
            TabRow(
                selectedTabIndex = uiState.filter.ordinal
            ) {
                QuestionFilter.entries.forEach { filter ->
                    Tab(
                        selected = uiState.filter == filter,
                        onClick = { viewModel.setFilter(filter, slug) },
                        text = {
                            Text(
                                when (filter) {
                                    QuestionFilter.ALL -> stringResource(R.string.questions_filter_all)
                                    QuestionFilter.UNANSWERED -> stringResource(R.string.questions_filter_unanswered)
                                    QuestionFilter.ANSWERED -> stringResource(R.string.questions_filter_answered)
                                }
                            )
                        }
                    )
                }
            }

            when {
                uiState.isLoading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }
                uiState.error != null -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = uiState.error!!,
                                color = MaterialTheme.colorScheme.error
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(onClick = { viewModel.loadQuestions(slug) }) {
                                Text(stringResource(R.string.retry))
                            }
                        }
                    }
                }
                uiState.questions.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                Icons.Default.QuestionAnswer,
                                contentDescription = null,
                                modifier = Modifier.size(64.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = stringResource(R.string.questions_empty),
                                style = MaterialTheme.typography.titleMedium
                            )
                            Text(
                                text = stringResource(R.string.questions_empty_hint),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
                else -> {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(uiState.questions) { question ->
                            QuestionCard(
                                question = question,
                                onAnswer = { viewModel.showAnswerDialog(question) }
                            )
                        }
                    }
                }
            }
        }
    }

    // Answer dialog
    if (uiState.answeringQuestion != null) {
        AnswerDialog(
            question = uiState.answeringQuestion!!,
            answerText = uiState.answerText,
            isPrivate = uiState.isPrivateAnswer,
            isSubmitting = uiState.isSubmittingAnswer,
            onAnswerTextChange = { viewModel.setAnswerText(it) },
            onPrivateChange = { viewModel.setPrivateAnswer(it) },
            onSubmit = { viewModel.submitAnswer(slug) },
            onDismiss = { viewModel.dismissAnswerDialog() }
        )
    }
}

@Composable
private fun QuestionCard(
    question: DecryptedQuestion,
    onAnswer: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            // Question content
            if (question.decryptError != null) {
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.Warning,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "解密失败: ${question.decryptError}",
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            } else {
                Text(
                    text = question.plaintext ?: "",
                    style = MaterialTheme.typography.bodyLarge
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Metadata
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (question.receiptPubEncKey != null) {
                        AssistChip(
                            onClick = {},
                            label = { Text("有回执") },
                            leadingIcon = {
                                Icon(
                                    Icons.Default.Receipt,
                                    contentDescription = null,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        )
                    }
                    if (question.hasAnswer) {
                        AssistChip(
                            onClick = {},
                            label = { Text("已回答") },
                            colors = AssistChipDefaults.assistChipColors(
                                containerColor = MaterialTheme.colorScheme.primaryContainer
                            ),
                            leadingIcon = {
                                Icon(
                                    Icons.Default.Check,
                                    contentDescription = null,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        )
                    }
                }

                if (!question.hasAnswer && question.decryptError == null) {
                    Button(
                        onClick = onAnswer,
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)
                    ) {
                        Text("回答")
                    }
                }
            }
        }
    }
}

@Composable
private fun AnswerDialog(
    question: DecryptedQuestion,
    answerText: String,
    isPrivate: Boolean,
    isSubmitting: Boolean,
    onAnswerTextChange: (String) -> Unit,
    onPrivateChange: (Boolean) -> Unit,
    onSubmit: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("回答问题") },
        text = {
            Column {
                // Original question
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                ) {
                    Text(
                        text = question.plaintext ?: "",
                        modifier = Modifier.padding(12.dp),
                        style = MaterialTheme.typography.bodyMedium
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Answer input
                OutlinedTextField(
                    value = answerText,
                    onValueChange = onAnswerTextChange,
                    label = { Text("你的回答") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3,
                    maxLines = 6
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Private option (only if receipt exists)
                if (question.receiptPubEncKey != null) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Checkbox(
                            checked = isPrivate,
                            onCheckedChange = onPrivateChange
                        )
                        Text("私密回答（只有提问者能看到）")
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = onSubmit,
                enabled = !isSubmitting && answerText.isNotBlank()
            ) {
                if (isSubmitting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Text("发送")
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("取消")
            }
        }
    )
}

enum class QuestionFilter {
    ALL, UNANSWERED, ANSWERED
}

data class QuestionsUiState(
    val questions: List<DecryptedQuestion> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val filter: QuestionFilter = QuestionFilter.ALL,
    val answeringQuestion: DecryptedQuestion? = null,
    val answerText: String = "",
    val isPrivateAnswer: Boolean = false,
    val isSubmittingAnswer: Boolean = false
)

@HiltViewModel
class QuestionsViewModel @Inject constructor(
    private val repository: AskBoxRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(QuestionsUiState())
    val uiState: StateFlow<QuestionsUiState> = _uiState

    fun loadQuestions(slug: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val status = when (_uiState.value.filter) {
                    QuestionFilter.ALL -> null
                    QuestionFilter.UNANSWERED -> "unanswered"
                    QuestionFilter.ANSWERED -> "answered"
                }
                val questions = repository.getQuestions(slug, status)
                _uiState.value = _uiState.value.copy(isLoading = false, questions = questions)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "加载失败"
                )
            }
        }
    }

    fun setFilter(filter: QuestionFilter, slug: String) {
        _uiState.value = _uiState.value.copy(filter = filter)
        loadQuestions(slug)
    }

    fun showAnswerDialog(question: DecryptedQuestion) {
        _uiState.value = _uiState.value.copy(
            answeringQuestion = question,
            answerText = "",
            isPrivateAnswer = question.receiptPubEncKey != null
        )
    }

    fun dismissAnswerDialog() {
        _uiState.value = _uiState.value.copy(answeringQuestion = null)
    }

    fun setAnswerText(text: String) {
        _uiState.value = _uiState.value.copy(answerText = text)
    }

    fun setPrivateAnswer(private: Boolean) {
        _uiState.value = _uiState.value.copy(isPrivateAnswer = private)
    }

    fun submitAnswer(slug: String) {
        val state = _uiState.value
        val question = state.answeringQuestion ?: return

        viewModelScope.launch {
            _uiState.value = state.copy(isSubmittingAnswer = true)
            try {
                if (state.isPrivateAnswer && question.receiptPubEncKey != null) {
                    repository.answerPrivate(
                        question.questionId,
                        state.answerText,
                        question.receiptPubEncKey
                    )
                } else {
                    repository.answerPublic(question.questionId, state.answerText)
                }

                // Update question status
                val updatedQuestions = _uiState.value.questions.map {
                    if (it.questionId == question.questionId) {
                        it.copy(hasAnswer = true)
                    } else it
                }
                _uiState.value = _uiState.value.copy(
                    isSubmittingAnswer = false,
                    answeringQuestion = null,
                    questions = updatedQuestions
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isSubmittingAnswer = false)
                // TODO: Show error
            }
        }
    }
}
