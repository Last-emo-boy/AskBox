package xyz.askbox.app.ui.debug

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import xyz.askbox.app.util.DebugLogger

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DebugLogScreen(
    onBack: () -> Unit
) {
    val logs by DebugLogger.logs.collectAsState()
    val listState = rememberLazyListState()
    val clipboardManager = LocalClipboardManager.current
    
    // Auto-scroll to bottom when new logs arrive
    LaunchedEffect(logs.size) {
        if (logs.isNotEmpty()) {
            listState.animateScrollToItem(logs.size - 1)
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("调试日志") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                    }
                },
                actions = {
                    IconButton(onClick = {
                        val logText = logs.joinToString("\n") { 
                            "[${it.timestamp}] ${it.level} [${it.tag}] ${it.message}" 
                        }
                        clipboardManager.setText(AnnotatedString(logText))
                    }) {
                        Icon(Icons.Default.Share, contentDescription = "复制日志")
                    }
                    IconButton(onClick = { DebugLogger.clearLogs() }) {
                        Icon(Icons.Default.Delete, contentDescription = "清除日志")
                    }
                }
            )
        }
    ) { padding ->
        if (logs.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    "暂无日志\n执行操作后日志将显示在这里",
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        } else {
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .background(Color(0xFF1E1E1E))
            ) {
                items(logs) { entry ->
                    LogEntryItem(entry)
                }
            }
        }
    }
}

@Composable
private fun LogEntryItem(entry: DebugLogger.LogEntry) {
    val levelColor = when (entry.level) {
        DebugLogger.LogLevel.DEBUG -> Color(0xFF9E9E9E)
        DebugLogger.LogLevel.INFO -> Color(0xFF4CAF50)
        DebugLogger.LogLevel.WARN -> Color(0xFFFFC107)
        DebugLogger.LogLevel.ERROR -> Color(0xFFF44336)
    }
    
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 2.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = entry.timestamp,
                color = Color(0xFF808080),
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = entry.level.name.first().toString(),
                color = levelColor,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "[${entry.tag}]",
                color = Color(0xFF64B5F6),
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace
            )
        }
        Text(
            text = entry.message,
            color = Color(0xFFE0E0E0),
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace,
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(start = 16.dp),
            maxLines = 10,
            overflow = TextOverflow.Ellipsis
        )
    }
    HorizontalDivider(
        color = Color(0xFF333333),
        thickness = 0.5.dp
    )
}
