package xyz.askbox.app.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
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
import androidx.compose.ui.platform.LocalContext
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
import xyz.askbox.app.data.remote.BoxItem
import xyz.askbox.app.data.repository.AskBoxRepository
import xyz.askbox.app.ui.components.ShareDialog
import javax.inject.Inject

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BoxesScreen(
    onBack: () -> Unit,
    onNavigateToQuestions: (String) -> Unit,
    viewModel: BoxesViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    var shareBoxSlug by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        viewModel.loadBoxes()
    }
    
    // Share dialog
    if (shareBoxSlug != null) {
        ShareDialog(
            slug = shareBoxSlug!!,
            onDismiss = { shareBoxSlug = null }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.boxes_title)) },
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
                .padding(horizontal = 16.dp)
        ) {
            // Create new box
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = stringResource(R.string.boxes_create_new),
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedTextField(
                            value = uiState.newSlug,
                            onValueChange = { viewModel.setNewSlug(it) },
                            placeholder = { Text(stringResource(R.string.boxes_slug_hint)) },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                        
                        Button(
                            onClick = { viewModel.createBox() },
                            enabled = !uiState.isCreating
                        ) {
                            if (uiState.isCreating) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(20.dp),
                                    strokeWidth = 2.dp
                                )
                            } else {
                                Icon(Icons.Default.Add, contentDescription = null)
                            }
                        }
                    }

                    if (uiState.createError != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = uiState.createError!!,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }

            // Box list
            when {
                uiState.isLoading -> {
                    Box(
                        modifier = Modifier.fillMaxWidth().padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }
                uiState.error != null -> {
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer
                        ),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = uiState.error!!,
                                color = MaterialTheme.colorScheme.onErrorContainer
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            TextButton(onClick = { viewModel.loadBoxes() }) {
                                Text(stringResource(R.string.retry))
                            }
                        }
                    }
                }
                uiState.boxes.isEmpty() -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                Icons.Default.Inbox,
                                contentDescription = null,
                                modifier = Modifier.size(64.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = stringResource(R.string.boxes_empty),
                                style = MaterialTheme.typography.titleMedium
                            )
                            Text(
                                text = stringResource(R.string.boxes_empty_hint),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
                else -> {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(uiState.boxes) { box ->
                            BoxListItem(
                                box = box,
                                onShare = { shareBoxSlug = box.slug },
                                onCopyLink = {
                                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                    val clip = ClipData.newPlainText("Box Link", "https://askbox.w33d.xyz/box/${box.slug}")
                                    clipboard.setPrimaryClip(clip)
                                    Toast.makeText(context, "链接已复制", Toast.LENGTH_SHORT).show()
                                },
                                onViewQuestions = { onNavigateToQuestions(box.slug) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun BoxListItem(
    box: BoxItem,
    onShare: () -> Unit,
    onCopyLink: () -> Unit,
    onViewQuestions: () -> Unit
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
                    Icons.Default.Inbox,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = box.slug,
                        style = MaterialTheme.typography.titleMedium
                    )
                    Text(
                        text = "askbox.w33d.xyz/box/${box.slug}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                // Share button in header
                IconButton(onClick = onShare) {
                    Icon(
                        Icons.Default.Share,
                        contentDescription = "分享",
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = onCopyLink,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.ContentCopy, contentDescription = null, Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("复制链接")
                }
                Button(
                    onClick = onViewQuestions,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.QuestionAnswer, contentDescription = null, Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("查看问题")
                }
            }
        }
    }
}

data class BoxesUiState(
    val boxes: List<BoxItem> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val newSlug: String = "",
    val isCreating: Boolean = false,
    val createError: String? = null
)

@HiltViewModel
class BoxesViewModel @Inject constructor(
    private val repository: AskBoxRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(BoxesUiState())
    val uiState: StateFlow<BoxesUiState> = _uiState

    fun loadBoxes() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val boxes = repository.getMyBoxes()
                _uiState.value = _uiState.value.copy(isLoading = false, boxes = boxes)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "加载失败"
                )
            }
        }
    }

    fun setNewSlug(slug: String) {
        val cleaned = slug.lowercase().replace(Regex("[^a-z0-9-]"), "")
        _uiState.value = _uiState.value.copy(newSlug = cleaned, createError = null)
    }

    fun createBox() {
        val state = _uiState.value
        
        viewModelScope.launch {
            _uiState.value = state.copy(isCreating = true, createError = null)
            try {
                val slug = state.newSlug.takeIf { it.isNotBlank() }
                val result = repository.createBox(slug)
                _uiState.value = _uiState.value.copy(
                    isCreating = false,
                    newSlug = "",
                    boxes = listOf(
                        BoxItem(
                            boxId = result.boxId,
                            slug = result.slug,
                            settings = xyz.askbox.app.data.remote.BoxSettings(),
                            ownerPubEncKey = result.ownerPubEncKey,
                            createdAt = result.createdAt
                        )
                    ) + _uiState.value.boxes
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isCreating = false,
                    createError = e.message ?: "创建失败"
                )
            }
        }
    }
}
