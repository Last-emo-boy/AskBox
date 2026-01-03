package xyz.askbox.app.crypto

import android.util.Base64
import com.goterl.lazysodium.LazySodiumAndroid
import com.goterl.lazysodium.SodiumAndroid
import com.goterl.lazysodium.interfaces.AEAD
import com.goterl.lazysodium.interfaces.Box
import com.goterl.lazysodium.interfaces.PwHash
import com.goterl.lazysodium.interfaces.SecretBox
import com.goterl.lazysodium.interfaces.Sign
import com.sun.jna.NativeLong
import xyz.askbox.app.util.DebugLogger
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Cryptographic operations using libsodium via Lazysodium.
 * Compatible with the web client's crypto implementation.
 */
@Singleton
class CryptoManager @Inject constructor() {

    private val lazySodium: LazySodiumAndroid = LazySodiumAndroid(SodiumAndroid())
    private val sodium: SodiumAndroid = SodiumAndroid()
    
    private fun log(message: String, data: Map<String, String>? = null) {
        debugLogger.log("CRYPTO", message, data)
    }
    
    private fun logBytes(message: String, vararg namedBytes: Pair<String, ByteArray>) {
        debugLogger.logBytes("CRYPTO", message, *namedBytes)
    }
    
    private fun logError(message: String, error: Throwable) {
        debugLogger.logError("CRYPTO", message, error)
    }

    // ========================================
    // Base64url encoding/decoding
    // ========================================

    /**
     * Encode bytes to base64url (no padding)
     */
    fun toBase64Url(data: ByteArray): String {
        return Base64.encodeToString(data, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    }

    /**
     * Decode base64url to bytes
     */
    fun fromBase64Url(data: String): ByteArray {
        return Base64.decode(data, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    }

    // ========================================
    // Key generation and derivation
    // ========================================

    /**
     * Generate a random 32-byte seed
     */
    fun generateSeed(): ByteArray {
        return lazySodium.randomBytesBuf(32)
    }

    /**
     * Derive account keys from seed.
     * Produces Ed25519 signing keypair and X25519 encryption keypair.
     */
    fun deriveAccountKeys(seed: ByteArray): AccountKeys {
        require(seed.size == 32) { "Seed must be 32 bytes" }

        // Derive signing keypair (Ed25519)
        val signPublicKey = ByteArray(Sign.ED25519_PUBLICKEYBYTES)
        val signPrivateKey = ByteArray(Sign.ED25519_SECRETKEYBYTES)
        sodium.crypto_sign_seed_keypair(signPublicKey, signPrivateKey, seed)

        // Derive encryption keypair (X25519)
        // Use HKDF-like derivation: hash seed with context "enc"
        val encSeed = ByteArray(32)
        val encContext = "enc".toByteArray()
        sodium.crypto_generichash(encSeed, 32, seed, seed.size.toLong(), encContext, encContext.size)

        val encPublicKey = ByteArray(Box.PUBLICKEYBYTES)
        val encPrivateKey = ByteArray(Box.SECRETKEYBYTES)
        sodium.crypto_box_seed_keypair(encPublicKey, encPrivateKey, encSeed)

        return AccountKeys(
            seed = seed,
            signKeyPair = SignKeyPair(signPublicKey, signPrivateKey),
            encKeyPair = EncKeyPair(encPublicKey, encPrivateKey)
        )
    }

    /**
     * Derive receipt keys from seed.
     * Produces X25519 encryption keypair only.
     */
    fun deriveReceiptKeys(seed: ByteArray): ReceiptKeys {
        require(seed.size == 32) { "Seed must be 32 bytes" }

        val encPublicKey = ByteArray(Box.PUBLICKEYBYTES)
        val encPrivateKey = ByteArray(Box.SECRETKEYBYTES)
        sodium.crypto_box_seed_keypair(encPublicKey, encPrivateKey, seed)

        return ReceiptKeys(
            seed = seed,
            encKeyPair = EncKeyPair(encPublicKey, encPrivateKey)
        )
    }

    /**
     * Generate new receipt keys
     */
    fun generateReceiptKeys(): ReceiptKeys {
        val seed = generateSeed()
        return deriveReceiptKeys(seed)
    }

    // ========================================
    // Password-based encryption
    // ========================================

    /**
     * Encrypt seed with password using Argon2id + SecretBox
     */
    fun encryptSeedWithPassword(seed: ByteArray, password: String): EncryptedSeed {
        val salt = lazySodium.randomBytesBuf(PwHash.ARGON2ID_SALTBYTES)

        // Derive key from password using Argon2id
        val key = ByteArray(SecretBox.KEYBYTES)
        val passwordBytes = password.toByteArray(Charsets.UTF_8)
        
        // Use same parameters as Web: opsLimit=3, memLimit=64MB
        // Note: OPSLIMIT_INTERACTIVE=2, but Web uses 3 for compatibility
        val opsLimit = 3L
        val memLimit = 65536L * 1024L // 64 MB
        
        sodium.crypto_pwhash(
            key,
            key.size.toLong(),
            passwordBytes,
            passwordBytes.size.toLong(),
            salt,
            opsLimit,
            NativeLong(memLimit),
            PwHash.Alg.PWHASH_ALG_ARGON2ID13.value.toInt()
        )

        // Encrypt seed with derived key
        val nonce = lazySodium.randomBytesBuf(SecretBox.NONCEBYTES)

        val ciphertext = ByteArray(seed.size + SecretBox.MACBYTES)
        sodium.crypto_secretbox_easy(ciphertext, seed, seed.size.toLong(), nonce, key)

        return EncryptedSeed(
            ciphertext = toBase64Url(ciphertext),
            nonce = toBase64Url(nonce),
            salt = toBase64Url(salt)
        )
    }

    /**
     * Decrypt seed with password
     */
    fun decryptSeedWithPassword(encrypted: EncryptedSeed, password: String): ByteArray {
        val salt = fromBase64Url(encrypted.salt)
        val nonce = fromBase64Url(encrypted.nonce)
        val ciphertext = fromBase64Url(encrypted.ciphertext)

        // Derive key from password
        val key = ByteArray(SecretBox.KEYBYTES)
        val passwordBytes = password.toByteArray(Charsets.UTF_8)
        
        // Use same parameters as Web: opsLimit=3, memLimit=64MB
        val opsLimit = 3L
        val memLimit = 65536L * 1024L // 64 MB
        
        sodium.crypto_pwhash(
            key,
            key.size.toLong(),
            passwordBytes,
            passwordBytes.size.toLong(),
            salt,
            opsLimit,
            NativeLong(memLimit),
            PwHash.Alg.PWHASH_ALG_ARGON2ID13.value.toInt()
        )

        // Decrypt seed
        val seed = ByteArray(ciphertext.size - SecretBox.MACBYTES)
        val success = sodium.crypto_secretbox_open_easy(seed, ciphertext, ciphertext.size.toLong(), nonce, key)

        if (success != 0) {
            throw CryptoException("Failed to decrypt seed - incorrect password")
        }

        return seed
    }

    // ========================================
    // Signing
    // ========================================

    /**
     * Sign a challenge nonce
     */
    fun signChallenge(nonce: ByteArray, privateKey: ByteArray): ByteArray {
        val signature = ByteArray(Sign.ED25519_BYTES)
        sodium.crypto_sign_detached(signature, null, nonce, nonce.size.toLong(), privateKey)
        return signature
    }

    // ========================================
    // Sealed Box (anonymous encryption)
    // ========================================

    /**
     * Encrypt message with sealed box (anonymous sender)
     */
    fun sealedBoxEncrypt(message: ByteArray, recipientPublicKey: ByteArray): ByteArray {
        val ciphertext = ByteArray(message.size + Box.SEALBYTES)
        sodium.crypto_box_seal(ciphertext, message, message.size.toLong(), recipientPublicKey)
        return ciphertext
    }

    /**
     * Decrypt sealed box message
     */
    fun sealedBoxDecrypt(ciphertext: ByteArray, publicKey: ByteArray, privateKey: ByteArray): ByteArray {
        val message = ByteArray(ciphertext.size - Box.SEALBYTES)
        val success = sodium.crypto_box_seal_open(message, ciphertext, ciphertext.size.toLong(), publicKey, privateKey)

        if (success != 0) {
            throw CryptoException("Failed to decrypt sealed box")
        }

        return message
    }

    // ========================================
    // Envelope Encryption (for answers)
    // Uses XChaCha20-Poly1305 AEAD to match Web implementation
    // ========================================

    /**
     * Encrypt with envelope encryption (DEK encrypted for multiple recipients)
     * Uses XChaCha20-Poly1305 AEAD with AAD
     */
    fun envelopeEncrypt(
        plaintext: ByteArray,
        aad: String,
        ownerPublicKey: ByteArray,
        askerPublicKey: ByteArray?
    ): EnvelopeEncrypted {
        // Generate random DEK (32 bytes for XChaCha20)
        val dek = lazySodium.randomBytesBuf(AEAD.XCHACHA20POLY1305_IETF_KEYBYTES)

        // Generate nonce (24 bytes for XChaCha20)
        val nonce = lazySodium.randomBytesBuf(AEAD.XCHACHA20POLY1305_IETF_NPUBBYTES)

        // AEAD encrypt plaintext with DEK
        val aadBytes = aad.toByteArray(Charsets.UTF_8)
        val ciphertext = ByteArray(plaintext.size + AEAD.XCHACHA20POLY1305_IETF_ABYTES)
        val ciphertextLen = LongArray(1)
        
        val encryptResult = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
            ciphertext,
            ciphertextLen,
            plaintext,
            plaintext.size.toLong(),
            aadBytes,
            aadBytes.size.toLong(),
            null, // nsec (not used)
            nonce,
            dek
        )
        
        if (encryptResult != 0) {
            throw CryptoException("AEAD encryption failed")
        }

        DebugLogger.logCrypto("envelopeEncrypt", mapOf(
            "aad" to aad,
            "plaintextLen" to plaintext.size,
            "ciphertextLen" to ciphertextLen[0],
            "ownerPubKey" to toBase64Url(ownerPublicKey),
            "askerPubKey" to askerPublicKey?.let { toBase64Url(it) }
        ))

        // Encrypt DEK for owner using sealed box
        val dekForOwner = sealedBoxEncrypt(dek, ownerPublicKey)

        // Encrypt DEK for asker (if provided)
        val dekForAsker = askerPublicKey?.let { sealedBoxEncrypt(dek, it) }

        return EnvelopeEncrypted(
            ciphertext = ciphertext,
            nonce = nonce,
            dekForOwner = dekForOwner,
            dekForAsker = dekForAsker
        )
    }

    /**
     * Decrypt envelope encrypted data using XChaCha20-Poly1305 AEAD
     */
    fun envelopeDecrypt(
        ciphertext: ByteArray,
        nonce: ByteArray,
        encryptedDek: ByteArray,
        aad: String,
        publicKey: ByteArray,
        privateKey: ByteArray
    ): ByteArray {
        DebugLogger.logCrypto("envelopeDecrypt.start", mapOf(
            "aad" to aad,
            "ciphertextLen" to ciphertext.size,
            "nonceLen" to nonce.size,
            "encryptedDekLen" to encryptedDek.size,
            "publicKey" to toBase64Url(publicKey)
        ))
        
        // Decrypt DEK using sealed box
        val dek = sealedBoxDecrypt(encryptedDek, publicKey, privateKey)
        DebugLogger.d("Crypto", "envelopeDecrypt: DEK decrypted successfully, dekLen=${dek.size}")

        // AEAD decrypt ciphertext
        val aadBytes = aad.toByteArray(Charsets.UTF_8)
        val plaintext = ByteArray(ciphertext.size - AEAD.XCHACHA20POLY1305_IETF_ABYTES)
        val plaintextLen = LongArray(1)
        
        val decryptResult = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
            plaintext,
            plaintextLen,
            null, // nsec (not used)
            ciphertext,
            ciphertext.size.toLong(),
            aadBytes,
            aadBytes.size.toLong(),
            nonce,
            dek
        )

        if (decryptResult != 0) {
            DebugLogger.e("Crypto", "envelopeDecrypt FAILED! result=$decryptResult, aad=$aad")
            throw CryptoException("Failed to decrypt envelope: ciphertext cannot be decrypted using that key")
        }

        DebugLogger.d("Crypto", "envelopeDecrypt: success, plaintextLen=${plaintextLen[0]}")
        return plaintext.copyOf(plaintextLen[0].toInt())
    }

    // ========================================
    // Utility
    // ========================================

    /**
     * Generate random bytes
     */
    fun randomBytes(size: Int): ByteArray {
        return lazySodium.randomBytesBuf(size)
    }

    /**
     * Hash bytes using BLAKE2b
     */
    fun hash(data: ByteArray, outputSize: Int = 32): ByteArray {
        val hash = ByteArray(outputSize)
        sodium.crypto_generichash(hash, outputSize, data, data.size.toLong(), null, 0)
        return hash
    }
}

// Data classes

data class SignKeyPair(
    val publicKey: ByteArray,
    val privateKey: ByteArray
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as SignKeyPair
        return publicKey.contentEquals(other.publicKey) && privateKey.contentEquals(other.privateKey)
    }

    override fun hashCode(): Int {
        var result = publicKey.contentHashCode()
        result = 31 * result + privateKey.contentHashCode()
        return result
    }
}

data class EncKeyPair(
    val publicKey: ByteArray,
    val privateKey: ByteArray
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as EncKeyPair
        return publicKey.contentEquals(other.publicKey) && privateKey.contentEquals(other.privateKey)
    }

    override fun hashCode(): Int {
        var result = publicKey.contentHashCode()
        result = 31 * result + privateKey.contentHashCode()
        return result
    }
}

data class AccountKeys(
    val seed: ByteArray,
    val signKeyPair: SignKeyPair,
    val encKeyPair: EncKeyPair
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as AccountKeys
        return seed.contentEquals(other.seed) && signKeyPair == other.signKeyPair && encKeyPair == other.encKeyPair
    }

    override fun hashCode(): Int {
        var result = seed.contentHashCode()
        result = 31 * result + signKeyPair.hashCode()
        result = 31 * result + encKeyPair.hashCode()
        return result
    }
}

data class ReceiptKeys(
    val seed: ByteArray,
    val encKeyPair: EncKeyPair
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as ReceiptKeys
        return seed.contentEquals(other.seed) && encKeyPair == other.encKeyPair
    }

    override fun hashCode(): Int {
        var result = seed.contentHashCode()
        result = 31 * result + encKeyPair.hashCode()
        return result
    }
}

data class EncryptedSeed(
    val ciphertext: String,
    val nonce: String,
    val salt: String
)

data class EnvelopeEncrypted(
    val ciphertext: ByteArray,
    val nonce: ByteArray,
    val dekForOwner: ByteArray,
    val dekForAsker: ByteArray?
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as EnvelopeEncrypted
        return ciphertext.contentEquals(other.ciphertext) &&
                nonce.contentEquals(other.nonce) &&
                dekForOwner.contentEquals(other.dekForOwner) &&
                dekForAsker?.contentEquals(other.dekForAsker ?: ByteArray(0)) ?: (other.dekForAsker == null)
    }

    override fun hashCode(): Int {
        var result = ciphertext.contentHashCode()
        result = 31 * result + nonce.contentHashCode()
        result = 31 * result + dekForOwner.contentHashCode()
        result = 31 * result + (dekForAsker?.contentHashCode() ?: 0)
        return result
    }
}

class CryptoException(message: String) : Exception(message)
