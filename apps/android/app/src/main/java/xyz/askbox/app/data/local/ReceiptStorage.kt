package xyz.askbox.app.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

private val Context.receiptDataStore: DataStore<Preferences> by preferencesDataStore(name = "askbox_receipts")

@Singleton
class ReceiptStorage @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val json = Json { ignoreUnknownKeys = true }

    private fun receiptKey(questionId: String) = stringPreferencesKey("receipt_$questionId")

    suspend fun saveReceipt(receipt: StoredReceipt) {
        context.receiptDataStore.edit { prefs ->
            prefs[receiptKey(receipt.questionId)] = json.encodeToString(receipt)
        }
    }

    suspend fun getReceipt(questionId: String): StoredReceipt? {
        return context.receiptDataStore.data.map { prefs ->
            prefs[receiptKey(questionId)]?.let { json.decodeFromString<StoredReceipt>(it) }
        }.first()
    }

    suspend fun getAllReceipts(): List<StoredReceipt> {
        return context.receiptDataStore.data.map { prefs ->
            prefs.asMap()
                .filter { it.key.name.startsWith("receipt_") }
                .mapNotNull { (_, value) ->
                    try {
                        json.decodeFromString<StoredReceipt>(value as String)
                    } catch (e: Exception) {
                        null
                    }
                }
                .sortedByDescending { it.createdAt }
        }.first()
    }

    suspend fun deleteReceipt(questionId: String) {
        context.receiptDataStore.edit { prefs ->
            prefs.remove(receiptKey(questionId))
        }
    }
}

@Serializable
data class StoredReceipt(
    val questionId: String,
    val boxSlug: String,
    val askerToken: String,
    val receiptSeed: String,
    val createdAt: Long
)
