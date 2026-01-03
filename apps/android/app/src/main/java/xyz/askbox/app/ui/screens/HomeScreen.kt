package xyz.askbox.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
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

@Composable
fun HomeScreen(
    onCreateAccount: () -> Unit,
    onImportAccount: () -> Unit,
    onEnterDashboard: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val hasAccount by viewModel.hasAccount.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Logo / Icon
        Icon(
            imageVector = Icons.Default.Lock,
            contentDescription = null,
            modifier = Modifier.size(80.dp),
            tint = MaterialTheme.colorScheme.primary
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Title
        Text(
            text = stringResource(R.string.home_title),
            style = MaterialTheme.typography.displaySmall,
            color = MaterialTheme.colorScheme.onBackground
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Subtitle
        Text(
            text = stringResource(R.string.home_subtitle),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(48.dp))

        // Buttons
        when (hasAccount) {
            null -> {
                CircularProgressIndicator()
            }
            true -> {
                Button(
                    onClick = onEnterDashboard,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp)
                ) {
                    Text(stringResource(R.string.home_enter_dashboard))
                }
            }
            false -> {
                Button(
                    onClick = onCreateAccount,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp)
                ) {
                    Text(stringResource(R.string.home_create_account))
                }

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedButton(
                    onClick = onImportAccount,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp)
                ) {
                    Text(stringResource(R.string.home_import_account))
                }
            }
        }
    }
}

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val repository: AskBoxRepository
) : ViewModel() {
    
    private val _hasAccount = MutableStateFlow<Boolean?>(null)
    val hasAccount: StateFlow<Boolean?> = _hasAccount

    init {
        viewModelScope.launch {
            _hasAccount.value = repository.hasAccount()
        }
    }
}
