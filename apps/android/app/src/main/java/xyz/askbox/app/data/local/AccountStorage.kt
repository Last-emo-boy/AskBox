package xyz.askbox.app.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.accountDataStore: DataStore<Preferences> by preferencesDataStore(name = "askbox_account")

@Singleton
class AccountStorage @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private object Keys {
        val PUB_SIGN_KEY = stringPreferencesKey("pub_sign_key")
        val PUB_ENC_KEY = stringPreferencesKey("pub_enc_key")
        val ENCRYPTED_SEED_CIPHERTEXT = stringPreferencesKey("encrypted_seed_ciphertext")
        val ENCRYPTED_SEED_NONCE = stringPreferencesKey("encrypted_seed_nonce")
        val ENCRYPTED_SEED_SALT = stringPreferencesKey("encrypted_seed_salt")
        val PLAINTEXT_SEED = stringPreferencesKey("plaintext_seed")
        val CREATED_AT = longPreferencesKey("created_at")
    }

    suspend fun saveAccount(account: StoredAccount) {
        context.accountDataStore.edit { prefs ->
            prefs[Keys.PUB_SIGN_KEY] = account.pubSignKey
            prefs[Keys.PUB_ENC_KEY] = account.pubEncKey
            
            if (account.encryptedSeedCiphertext != null) {
                prefs[Keys.ENCRYPTED_SEED_CIPHERTEXT] = account.encryptedSeedCiphertext
                prefs[Keys.ENCRYPTED_SEED_NONCE] = account.encryptedSeedNonce!!
                prefs[Keys.ENCRYPTED_SEED_SALT] = account.encryptedSeedSalt!!
                prefs.remove(Keys.PLAINTEXT_SEED)
            } else if (account.plaintextSeed != null) {
                prefs[Keys.PLAINTEXT_SEED] = account.plaintextSeed
                prefs.remove(Keys.ENCRYPTED_SEED_CIPHERTEXT)
                prefs.remove(Keys.ENCRYPTED_SEED_NONCE)
                prefs.remove(Keys.ENCRYPTED_SEED_SALT)
            }
            
            prefs[Keys.CREATED_AT] = account.createdAt
        }
    }

    suspend fun getAccount(): StoredAccount? {
        return context.accountDataStore.data.map { prefs ->
            val pubSignKey = prefs[Keys.PUB_SIGN_KEY] ?: return@map null
            val pubEncKey = prefs[Keys.PUB_ENC_KEY] ?: return@map null
            
            StoredAccount(
                pubSignKey = pubSignKey,
                pubEncKey = pubEncKey,
                encryptedSeedCiphertext = prefs[Keys.ENCRYPTED_SEED_CIPHERTEXT],
                encryptedSeedNonce = prefs[Keys.ENCRYPTED_SEED_NONCE],
                encryptedSeedSalt = prefs[Keys.ENCRYPTED_SEED_SALT],
                plaintextSeed = prefs[Keys.PLAINTEXT_SEED],
                createdAt = prefs[Keys.CREATED_AT] ?: System.currentTimeMillis()
            )
        }.first()
    }

    suspend fun deleteAccount() {
        context.accountDataStore.edit { it.clear() }
    }

    fun needsPassword(): kotlinx.coroutines.flow.Flow<Boolean> {
        return context.accountDataStore.data.map { prefs ->
            prefs[Keys.ENCRYPTED_SEED_CIPHERTEXT] != null
        }
    }
}

data class StoredAccount(
    val pubSignKey: String,
    val pubEncKey: String,
    val encryptedSeedCiphertext: String?,
    val encryptedSeedNonce: String?,
    val encryptedSeedSalt: String?,
    val plaintextSeed: String?,
    val createdAt: Long
) {
    val hasPassword: Boolean get() = encryptedSeedCiphertext != null
}
