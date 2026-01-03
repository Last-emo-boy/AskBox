package xyz.askbox.app.data.repository

import xyz.askbox.app.crypto.AccountKeys
import xyz.askbox.app.crypto.CryptoManager
import xyz.askbox.app.crypto.ReceiptKeys
import xyz.askbox.app.data.local.AccountStorage
import xyz.askbox.app.data.local.ReceiptStorage
import xyz.askbox.app.data.local.StoredAccount
import xyz.askbox.app.data.local.StoredReceipt
import xyz.askbox.app.data.remote.*
import xyz.askbox.app.util.DebugLogger
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AskBoxRepository @Inject constructor(
    private val api: AskBoxApi,
    private val crypto: CryptoManager,
    private val accountStorage: AccountStorage,
    private val receiptStorage: ReceiptStorage
) {
    private var accessToken: String? = null
    private var currentKeys: AccountKeys? = null

    // ========================================
    // Account Management
    // ========================================

    suspend fun hasAccount(): Boolean {
        return accountStorage.getAccount() != null
    }

    suspend fun getStoredAccount(): StoredAccount? {
        return accountStorage.getAccount()
    }

    suspend fun createAccount(password: String?): AccountKeys {
        val seed = crypto.generateSeed()
        val keys = crypto.deriveAccountKeys(seed)

        val account = if (password != null) {
            val encrypted = crypto.encryptSeedWithPassword(seed, password)
            StoredAccount(
                pubSignKey = crypto.toBase64Url(keys.signKeyPair.publicKey),
                pubEncKey = crypto.toBase64Url(keys.encKeyPair.publicKey),
                encryptedSeedCiphertext = encrypted.ciphertext,
                encryptedSeedNonce = encrypted.nonce,
                encryptedSeedSalt = encrypted.salt,
                plaintextSeed = null,
                createdAt = System.currentTimeMillis()
            )
        } else {
            StoredAccount(
                pubSignKey = crypto.toBase64Url(keys.signKeyPair.publicKey),
                pubEncKey = crypto.toBase64Url(keys.encKeyPair.publicKey),
                encryptedSeedCiphertext = null,
                encryptedSeedNonce = null,
                encryptedSeedSalt = null,
                plaintextSeed = crypto.toBase64Url(seed),
                createdAt = System.currentTimeMillis()
            )
        }

        accountStorage.saveAccount(account)
        currentKeys = keys
        return keys
    }

    suspend fun importAccount(seedBase64: String, password: String?): AccountKeys {
        val seed = crypto.fromBase64Url(seedBase64)
        val keys = crypto.deriveAccountKeys(seed)

        val account = if (password != null) {
            val encrypted = crypto.encryptSeedWithPassword(seed, password)
            StoredAccount(
                pubSignKey = crypto.toBase64Url(keys.signKeyPair.publicKey),
                pubEncKey = crypto.toBase64Url(keys.encKeyPair.publicKey),
                encryptedSeedCiphertext = encrypted.ciphertext,
                encryptedSeedNonce = encrypted.nonce,
                encryptedSeedSalt = encrypted.salt,
                plaintextSeed = null,
                createdAt = System.currentTimeMillis()
            )
        } else {
            StoredAccount(
                pubSignKey = crypto.toBase64Url(keys.signKeyPair.publicKey),
                pubEncKey = crypto.toBase64Url(keys.encKeyPair.publicKey),
                encryptedSeedCiphertext = null,
                encryptedSeedNonce = null,
                encryptedSeedSalt = null,
                plaintextSeed = crypto.toBase64Url(seed),
                createdAt = System.currentTimeMillis()
            )
        }

        accountStorage.saveAccount(account)
        currentKeys = keys
        return keys
    }

    suspend fun unlockAccount(password: String): AccountKeys {
        val account = accountStorage.getAccount()
            ?: throw IllegalStateException("No account found")

        val seed = if (account.plaintextSeed != null) {
            crypto.fromBase64Url(account.plaintextSeed)
        } else if (account.encryptedSeedCiphertext != null &&
            account.encryptedSeedNonce != null &&
            account.encryptedSeedSalt != null) {
            crypto.decryptSeedWithPassword(
                xyz.askbox.app.crypto.EncryptedSeed(
                    ciphertext = account.encryptedSeedCiphertext,
                    nonce = account.encryptedSeedNonce,
                    salt = account.encryptedSeedSalt
                ),
                password
            )
        } else {
            throw IllegalStateException("Invalid account state")
        }

        val keys = crypto.deriveAccountKeys(seed)
        currentKeys = keys
        return keys
    }

    suspend fun unlockAccountNoPassword(): AccountKeys {
        val account = accountStorage.getAccount()
            ?: throw IllegalStateException("No account found")

        val seed = account.plaintextSeed?.let { crypto.fromBase64Url(it) }
            ?: throw IllegalStateException("Account requires password")

        val keys = crypto.deriveAccountKeys(seed)
        currentKeys = keys
        return keys
    }

    fun isUnlocked(): Boolean = currentKeys != null

    fun getAccountKeys(): AccountKeys? = currentKeys

    suspend fun deleteAccount() {
        accountStorage.deleteAccount()
        accessToken = null
        currentKeys = null
    }

    suspend fun exportSeed(password: String?): String {
        val account = accountStorage.getAccount()
            ?: throw IllegalStateException("No account found")

        val seed = if (account.plaintextSeed != null) {
            crypto.fromBase64Url(account.plaintextSeed)
        } else if (password != null &&
            account.encryptedSeedCiphertext != null &&
            account.encryptedSeedNonce != null &&
            account.encryptedSeedSalt != null) {
            crypto.decryptSeedWithPassword(
                xyz.askbox.app.crypto.EncryptedSeed(
                    ciphertext = account.encryptedSeedCiphertext,
                    nonce = account.encryptedSeedNonce,
                    salt = account.encryptedSeedSalt
                ),
                password
            )
        } else {
            throw IllegalStateException("Password required")
        }

        return crypto.toBase64Url(seed)
    }

    // ========================================
    // Authentication
    // ========================================

    suspend fun login(): String {
        val keys = currentKeys ?: throw IllegalStateException("Account not unlocked")

        val challenge = api.requestChallenge(
            ChallengeRequest(
                pubSignKey = crypto.toBase64Url(keys.signKeyPair.publicKey),
                pubEncKey = crypto.toBase64Url(keys.encKeyPair.publicKey)
            )
        )

        val nonce = crypto.fromBase64Url(challenge.nonce)
        val signature = crypto.signChallenge(nonce, keys.signKeyPair.privateKey)

        val auth = api.verifyChallenge(
            VerifyRequest(
                challengeId = challenge.challengeId,
                signature = crypto.toBase64Url(signature)
            )
        )

        accessToken = auth.accessToken
        return auth.accessToken
    }

    private suspend fun ensureLoggedIn(): String {
        return accessToken ?: login()
    }

    private fun authHeader(token: String): String = "Bearer $token"

    // ========================================
    // Boxes
    // ========================================

    suspend fun createBox(slug: String? = null): CreateBoxResponse {
        val token = ensureLoggedIn()
        return api.createBox(
            authHeader(token),
            CreateBoxRequest(slug = slug)
        )
    }

    suspend fun getBox(slug: String): GetBoxResponse {
        return api.getBox(slug)
    }

    suspend fun getMyBoxes(): List<BoxItem> {
        val token = ensureLoggedIn()
        return api.getMyBoxes(authHeader(token)).boxes
    }

    // ========================================
    // Questions
    // ========================================

    suspend fun askQuestion(
        boxSlug: String,
        question: String,
        saveReceipt: Boolean
    ): Pair<CreateQuestionResponse, StoredReceipt?> {
        val box = api.getBox(boxSlug)
        val ownerPubKey = crypto.fromBase64Url(box.ownerPubEncKey)

        // Encrypt question with sealed box
        val ciphertext = crypto.sealedBoxEncrypt(question.toByteArray(Charsets.UTF_8), ownerPubKey)

        // Generate receipt keys if saving receipt
        val receiptKeys = if (saveReceipt) crypto.generateReceiptKeys() else null
        val receiptPubEncKey = receiptKeys?.let { crypto.toBase64Url(it.encKeyPair.publicKey) }

        val response = api.createQuestion(
            boxId = box.boxId,
            request = CreateQuestionRequest(
                ciphertextQuestion = crypto.toBase64Url(ciphertext),
                receiptPubEncKey = receiptPubEncKey,
                clientCreatedAt = java.time.Instant.now().toString()
            )
        )

        // Save receipt locally - asker_token is returned from server
        val receipt = if (receiptKeys != null) {
            StoredReceipt(
                questionId = response.questionId,
                boxSlug = boxSlug,
                askerToken = response.askerToken,
                receiptSeed = crypto.toBase64Url(receiptKeys.seed),
                createdAt = System.currentTimeMillis()
            ).also { receiptStorage.saveReceipt(it) }
        } else null

        return Pair(response, receipt)
    }

    suspend fun getQuestions(boxSlug: String, status: String? = null): List<DecryptedQuestion> {
        val token = ensureLoggedIn()
        val keys = currentKeys ?: throw IllegalStateException("Account not unlocked")

        // First get the box to get its ID
        val box = api.getBox(boxSlug)
        val response = api.getQuestions(authHeader(token), boxId = box.boxId, status = status)

        return response.questions.map { q ->
            try {
                val ciphertext = crypto.fromBase64Url(q.ciphertextQuestion)
                val plaintext = crypto.sealedBoxDecrypt(
                    ciphertext,
                    keys.encKeyPair.publicKey,
                    keys.encKeyPair.privateKey
                )
                DecryptedQuestion(
                    questionId = q.questionId,
                    boxId = q.boxId,
                    plaintext = String(plaintext, Charsets.UTF_8),
                    receiptPubEncKey = q.receiptPubEncKey,
                    createdAt = q.createdAt,
                    openedAt = q.openedAt,
                    hasAnswer = q.hasAnswer,
                    decryptError = null
                )
            } catch (e: Exception) {
                DecryptedQuestion(
                    questionId = q.questionId,
                    boxId = q.boxId,
                    plaintext = null,
                    receiptPubEncKey = q.receiptPubEncKey,
                    createdAt = q.createdAt,
                    openedAt = q.openedAt,
                    hasAnswer = q.hasAnswer,
                    decryptError = e.message
                )
            }
        }
    }

    suspend fun openQuestion(questionId: String): Boolean {
        val token = ensureLoggedIn()

        val response = api.openQuestion(
            authHeader(token),
            questionId,
            OpenQuestionRequest(
                openedAt = java.time.Instant.now().toString()
            )
        )

        return response.ok
    }

    // ========================================
    // Answers
    // ========================================

    suspend fun answerPublic(questionId: String, text: String): CreateAnswerResponse {
        val token = ensureLoggedIn()
        return api.createAnswer(
            authHeader(token),
            questionId,
            CreateAnswerRequest(
                visibility = "public",
                publicText = text
            )
        )
    }

    suspend fun answerPrivate(
        questionId: String,
        text: String,
        receiptPubEncKey: String
    ): CreateAnswerResponse {
        val token = ensureLoggedIn()
        val keys = currentKeys ?: throw IllegalStateException("Account not unlocked")

        val ownerPubKey = keys.encKeyPair.publicKey
        val askerPubKey = crypto.fromBase64Url(receiptPubEncKey)
        
        // AAD uses question_id only (must match Web implementation)
        val aad = "${questionId}|v1"

        val encrypted = crypto.envelopeEncrypt(
            text.toByteArray(Charsets.UTF_8),
            aad,
            ownerPubKey,
            askerPubKey
        )

        return api.createAnswer(
            authHeader(token),
            questionId,
            CreateAnswerRequest(
                visibility = "private",
                ciphertextAnswer = crypto.toBase64Url(encrypted.ciphertext),
                nonce = crypto.toBase64Url(encrypted.nonce),
                dekForOwner = crypto.toBase64Url(encrypted.dekForOwner),
                dekForAsker = crypto.toBase64Url(encrypted.dekForAsker!!)
            )
        )
    }

    suspend fun getAnswerForReceipt(receipt: StoredReceipt): DecryptedAnswer? {
        DebugLogger.d("Repository", "getAnswerForReceipt: questionId=${receipt.questionId}")
        
        val receiptKeys = crypto.deriveReceiptKeys(crypto.fromBase64Url(receipt.receiptSeed))
        DebugLogger.logCrypto("deriveReceiptKeys", mapOf(
            "receiptSeed" to receipt.receiptSeed,
            "pubKey" to crypto.toBase64Url(receiptKeys.encKeyPair.publicKey)
        ))

        val response = try {
            api.getAskerAnswer(receipt.questionId, receipt.askerToken)
        } catch (e: Exception) {
            DebugLogger.e("Repository", "getAskerAnswer failed", e)
            return null
        }
        
        DebugLogger.d("Repository", "getAskerAnswer response: visibility=${response.visibility}, " +
            "hasCiphertext=${response.ciphertextAnswer != null}, hasNonce=${response.nonce != null}, " +
            "hasDek=${response.dekForAsker != null}")

        return if (response.visibility == "public") {
            DecryptedAnswer(
                answerId = response.answerId,
                visibility = response.visibility,
                text = response.publicText ?: "",
                createdAt = response.createdAt ?: ""
            )
        } else if (response.ciphertextAnswer != null &&
            response.nonce != null &&
            response.dekForAsker != null) {
            try {
                // AAD uses question_id only (must match Web implementation)
                val aad = "${receipt.questionId}|v1"
                DebugLogger.d("Repository", "Attempting envelope decrypt with aad=$aad")
                
                val plaintext = crypto.envelopeDecrypt(
                    crypto.fromBase64Url(response.ciphertextAnswer),
                    crypto.fromBase64Url(response.nonce),
                    crypto.fromBase64Url(response.dekForAsker),
                    aad,
                    receiptKeys.encKeyPair.publicKey,
                    receiptKeys.encKeyPair.privateKey
                )
                DecryptedAnswer(
                    answerId = response.answerId,
                    visibility = response.visibility,
                    text = String(plaintext, Charsets.UTF_8),
                    createdAt = response.createdAt ?: ""
                ).also {
                    DebugLogger.i("Repository", "Envelope decrypt SUCCESS for ${receipt.questionId}")
                }
            } catch (e: Exception) {
                DebugLogger.e("Repository", "Envelope decrypt FAILED for ${receipt.questionId}", e)
                DecryptedAnswer(
                    answerId = response.answerId,
                    visibility = response.visibility,
                    text = "[解密失败]",
                    createdAt = response.createdAt ?: "",
                    decryptError = e.message
                )
            }
        } else {
            null
        }
    }

    // ========================================
    // Receipts
    // ========================================

    suspend fun getReceipts(): List<StoredReceipt> {
        return receiptStorage.getAllReceipts()
    }

    suspend fun deleteReceipt(questionId: String) {
        receiptStorage.deleteReceipt(questionId)
    }
}

data class DecryptedQuestion(
    val questionId: String,
    val boxId: String,
    val plaintext: String?,
    val receiptPubEncKey: String?,
    val createdAt: String,
    val openedAt: String?,
    val hasAnswer: Boolean,
    val decryptError: String?
)

data class DecryptedAnswer(
    val answerId: String,
    val visibility: String,
    val text: String,
    val createdAt: String,
    val decryptError: String? = null
)
