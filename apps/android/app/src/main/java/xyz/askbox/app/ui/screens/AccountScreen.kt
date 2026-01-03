package xyz.askbox.app.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
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
import xyz.askbox.app.util.DebugLogger
import javax.inject.Inject

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountScreen(
    onBack: () -> Unit,
    onAccountDeleted: () -> Unit,
    onNavigateToDebug: () -> Unit = {},
    viewModel: AccountViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val isDebugEnabled by DebugLogger.isDebugEnabled.collectAsState()

    var showExportDialog by remember { mutableStateOf(false) }
    var showDeleteDialog by remember { mutableStateOf(false) }
    
    // Hidden debug entry - tap title 7 times
    var tapCount by remember { mutableIntStateOf(0) }
    var lastTapTime by remember { mutableLongStateOf(0L) }

    LaunchedEffect(uiState.isDeleted) {
        if (uiState.isDeleted) {
            onAccountDeleted()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { 
                    Text(
                        text = stringResource(R.string.account_title),
                        modifier = Modifier.clickable {
                            val now = System.currentTimeMillis()
                            if (now - lastTapTime > 2000) {
                                tapCount = 1
                            } else {
                                tapCount++
                            }
                            lastTapTime = now
                            
                            if (tapCount >= 7) {
                                tapCount = 0
                                DebugLogger.toggleDebug()
                                Toast.makeText(
                                    context,
                                    if (DebugLogger.isDebugEnabled.value) "调试模式已启用" else "调试模式已关闭",
                                    Toast.LENGTH_SHORT
                                ).show()
                            } else if (tapCount >= 4) {
                                Toast.makeText(
                                    context, 
                                    "再点击 ${7 - tapCount} 次启用调试模式",
                                    Toast.LENGTH_SHORT
                                ).show()
                            }
                        }
                    )
                },
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
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Debug mode entry (only visible when debug is enabled)
            if (isDebugEnabled) {
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer
                    ),
                    onClick = onNavigateToDebug
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.Warning,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.error
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                "调试模式",
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onErrorContainer
                            )
                            Text(
                                "查看详细日志",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onErrorContainer.copy(alpha = 0.7f)
                            )
                        }
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = null,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
            
            // Account info
            Card {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.Person,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.width(16.dp))
                        Column {
                            Text(
                                text = "我的账户",
                                style = MaterialTheme.typography.titleLarge
                            )
                            Text(
                                text = if (uiState.hasPassword) "密码保护已启用" else "无密码保护",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }

            // Export seed
            Card(
                onClick = { showExportDialog = true }
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Default.Key,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.width(16.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = stringResource(R.string.account_export_seed),
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text(
                            text = "导出种子短语用于备份或迁移",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Icon(
                        Icons.Default.ChevronRight,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            // Delete account
            OutlinedButton(
                onClick = { showDeleteDialog = true },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = MaterialTheme.colorScheme.error
                )
            ) {
                Icon(Icons.Default.Delete, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text(stringResource(R.string.account_delete))
            }
        }
    }

    // Export dialog
    if (showExportDialog) {
        ExportSeedDialog(
            needsPassword = uiState.hasPassword,
            password = uiState.exportPassword,
            exportedSeed = uiState.exportedSeed,
            error = uiState.exportError,
            isLoading = uiState.isExporting,
            onPasswordChange = { viewModel.setExportPassword(it) },
            onExport = { viewModel.exportSeed() },
            onCopy = {
                uiState.exportedSeed?.let { seed ->
                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    val clip = ClipData.newPlainText("Seed", seed)
                    clipboard.setPrimaryClip(clip)
                    Toast.makeText(context, "已复制到剪贴板", Toast.LENGTH_SHORT).show()
                }
            },
            onDismiss = {
                showExportDialog = false
                viewModel.clearExport()
            }
        )
    }

    // Delete confirmation dialog
    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            icon = {
                Icon(
                    Icons.Default.Warning,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.error
                )
            },
            title = { Text("删除账户") },
            text = { Text(stringResource(R.string.account_delete_confirm)) },
            confirmButton = {
                Button(
                    onClick = {
                        showDeleteDialog = false
                        viewModel.deleteAccount()
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text("删除")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) {
                    Text("取消")
                }
            }
        )
    }
}

@Composable
private fun ExportSeedDialog(
    needsPassword: Boolean,
    password: String,
    exportedSeed: String?,
    error: String?,
    isLoading: Boolean,
    onPasswordChange: (String) -> Unit,
    onExport: () -> Unit,
    onCopy: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("导出种子") },
        text = {
            Column {
                if (exportedSeed != null) {
                    // Show exported seed
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                    ) {
                        Text(
                            text = exportedSeed,
                            modifier = Modifier.padding(12.dp),
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "⚠️ 请妥善保管，不要泄露给他人",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                } else if (needsPassword) {
                    Text(
                        text = "请输入密码以导出种子",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    OutlinedTextField(
                        value = password,
                        onValueChange = onPasswordChange,
                        label = { Text("密码") },
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    if (error != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = error,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                } else {
                    Text(
                        text = "即将导出你的种子短语，请确保在安全环境下操作。",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
        },
        confirmButton = {
            if (exportedSeed != null) {
                Button(onClick = onCopy) {
                    Icon(Icons.Default.ContentCopy, contentDescription = null, Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("复制")
                }
            } else {
                Button(
                    onClick = onExport,
                    enabled = !isLoading && (!needsPassword || password.isNotEmpty())
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp
                        )
                    } else {
                        Text("导出")
                    }
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("关闭")
            }
        }
    )
}

data class AccountUiState(
    val hasPassword: Boolean = false,
    val exportPassword: String = "",
    val exportedSeed: String? = null,
    val exportError: String? = null,
    val isExporting: Boolean = false,
    val isDeleted: Boolean = false
)

@HiltViewModel
class AccountViewModel @Inject constructor(
    private val repository: AskBoxRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AccountUiState())
    val uiState: StateFlow<AccountUiState> = _uiState

    init {
        viewModelScope.launch {
            val account = repository.getStoredAccount()
            _uiState.value = _uiState.value.copy(hasPassword = account?.hasPassword == true)
        }
    }

    fun setExportPassword(password: String) {
        _uiState.value = _uiState.value.copy(exportPassword = password, exportError = null)
    }

    fun exportSeed() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isExporting = true, exportError = null)
            try {
                val password = _uiState.value.exportPassword.takeIf { _uiState.value.hasPassword }
                val seed = repository.exportSeed(password)
                _uiState.value = _uiState.value.copy(isExporting = false, exportedSeed = seed)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isExporting = false,
                    exportError = e.message ?: "导出失败"
                )
            }
        }
    }

    fun clearExport() {
        _uiState.value = _uiState.value.copy(
            exportPassword = "",
            exportedSeed = null,
            exportError = null
        )
    }

    fun deleteAccount() {
        viewModelScope.launch {
            repository.deleteAccount()
            _uiState.value = _uiState.value.copy(isDeleted = true)
        }
    }
}
