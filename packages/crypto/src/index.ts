/**
 * AskBox Crypto Library
 *
 * 基于 libsodium 的端到端加密工具库
 * 实现 sealed box、envelope encryption 等核心加密功能
 */

import sodium from 'libsodium-wrappers-sumo';

import type {
  AccountKeys,
  ReceiptKeys,
  EncryptedSeed,
  Base64Url,
  KeyPair,
} from '@askbox/shared-types';

// ========================================
// 初始化
// ========================================

let isReady = false;

/**
 * 初始化 libsodium
 * 必须在使用任何加密函数前调用
 */
export async function initCrypto(): Promise<void> {
  if (isReady) {
    return;
  }
  await sodium.ready;
  isReady = true;
}

/**
 * 确保已初始化
 */
function ensureReady(): void {
  if (!isReady) {
    throw new Error('Crypto not initialized. Call initCrypto() first.');
  }
}

// ========================================
// Base64url 编解码
// ========================================

/**
 * Uint8Array 转 base64url
 */
export function toBase64Url(data: Uint8Array): Base64Url {
  ensureReady();
  return sodium.to_base64(data, sodium.base64_variants.URLSAFE_NO_PADDING);
}

/**
 * base64url 转 Uint8Array
 */
export function fromBase64Url(data: Base64Url): Uint8Array {
  ensureReady();
  return sodium.from_base64(data, sodium.base64_variants.URLSAFE_NO_PADDING);
}

// ========================================
// 密钥生成与派生
// ========================================

/**
 * 生成随机种子 (32 bytes)
 */
export function generateSeed(): Uint8Array {
  ensureReady();
  return sodium.randombytes_buf(32);
}

/**
 * 从种子派生账户密钥对
 */
export function deriveAccountKeys(seed: Uint8Array): AccountKeys {
  ensureReady();

  if (seed.length !== 32) {
    throw new Error('Seed must be 32 bytes');
  }

  // 派生签名密钥对 (Ed25519)
  const signKeyPair = sodium.crypto_sign_seed_keypair(seed);

  // 派生加密密钥对 (X25519)
  // 使用 HKDF 从 seed 派生不同的密钥材料
  const encSeed = sodium.crypto_generichash(32, seed, sodium.from_string('enc'));
  const encKeyPair = sodium.crypto_box_seed_keypair(encSeed);

  return {
    seed,
    signKeyPair: {
      publicKey: signKeyPair.publicKey,
      privateKey: signKeyPair.privateKey,
    },
    encKeyPair: {
      publicKey: encKeyPair.publicKey,
      privateKey: encKeyPair.privateKey,
    },
  };
}

/**
 * 从种子派生回执密钥对
 */
export function deriveReceiptKeys(seed: Uint8Array): ReceiptKeys {
  ensureReady();

  if (seed.length !== 32) {
    throw new Error('Seed must be 32 bytes');
  }

  const encKeyPair = sodium.crypto_box_seed_keypair(seed);

  return {
    seed,
    encKeyPair: {
      publicKey: encKeyPair.publicKey,
      privateKey: encKeyPair.privateKey,
    },
  };
}

/**
 * 生成新的回执密钥
 */
export function generateReceiptKeys(): ReceiptKeys {
  const seed = generateSeed();
  return deriveReceiptKeys(seed);
}

// ========================================
// 本地存储加密 (Argon2id + SecretBox)
// ========================================

/**
 * 使用密码加密种子
 */
export function encryptSeedWithPassword(
  seed: Uint8Array,
  password: string
): EncryptedSeed {
  ensureReady();

  // 生成随机 salt
  const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);

  // 使用 Argon2id 派生 KEK
  const kek = sodium.crypto_pwhash(
    32,
    password,
    salt,
    3, // ops limit (t)
    65536 * 1024, // mem limit (m) = 64MB
    sodium.crypto_pwhash_ALG_ARGON2ID13
  );

  // 生成 nonce
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);

  // 加密种子
  const ciphertext = sodium.crypto_secretbox_easy(seed, nonce, kek);

  // 清零 KEK
  sodium.memzero(kek);

  return {
    ciphertext: toBase64Url(ciphertext),
    salt: toBase64Url(salt),
    nonce: toBase64Url(nonce),
  };
}

/**
 * 使用密码解密种子
 */
export function decryptSeedWithPassword(
  encrypted: EncryptedSeed,
  password: string
): Uint8Array {
  ensureReady();

  const ciphertext = fromBase64Url(encrypted.ciphertext);
  const salt = fromBase64Url(encrypted.salt);
  const nonce = fromBase64Url(encrypted.nonce);

  // 使用 Argon2id 派生 KEK
  const kek = sodium.crypto_pwhash(
    32,
    password,
    salt,
    3,
    65536 * 1024,
    sodium.crypto_pwhash_ALG_ARGON2ID13
  );

  // 解密种子
  const seed = sodium.crypto_secretbox_open_easy(ciphertext, nonce, kek);

  // 清零 KEK
  sodium.memzero(kek);

  if (!seed) {
    throw new Error('Decryption failed: invalid password or corrupted data');
  }

  return seed;
}

// ========================================
// Sealed Box (匿名加密)
// ========================================

/**
 * 使用收件人公钥加密消息 (Sealed Box)
 * 适用于：匿名提问加密
 */
export function sealMessage(
  message: Uint8Array,
  recipientPublicKey: Uint8Array
): Uint8Array {
  ensureReady();
  return sodium.crypto_box_seal(message, recipientPublicKey);
}

/**
 * 使用接收者密钥对解密消息 (Sealed Box)
 */
export function openSealedMessage(
  ciphertext: Uint8Array,
  recipientKeyPair: KeyPair
): Uint8Array {
  ensureReady();

  const plaintext = sodium.crypto_box_seal_open(
    ciphertext,
    recipientKeyPair.publicKey,
    recipientKeyPair.privateKey
  );

  if (!plaintext) {
    throw new Error('Failed to open sealed message');
  }

  return plaintext;
}

// ========================================
// Envelope Encryption (信封加密)
// ========================================

export interface EnvelopeEncryptResult {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  dekForOwner: Uint8Array;
  dekForAsker: Uint8Array;
}

/**
 * 信封加密：用于私密回答
 * 生成 DEK，用 AEAD 加密内容，然后分别用 sealed box 封装 DEK 给双方
 */
export function envelopeEncrypt(
  plaintext: Uint8Array,
  aad: string,
  ownerPublicKey: Uint8Array,
  askerPublicKey: Uint8Array
): EnvelopeEncryptResult {
  ensureReady();

  // 生成随机 DEK
  const dek = sodium.randombytes_buf(32);

  // 生成 nonce
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);

  // AEAD 加密
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext,
    sodium.from_string(aad),
    null, // nsec (not used)
    nonce,
    dek
  );

  // 用 sealed box 封装 DEK
  const dekForOwner = sodium.crypto_box_seal(dek, ownerPublicKey);
  const dekForAsker = sodium.crypto_box_seal(dek, askerPublicKey);

  // 清零 DEK
  sodium.memzero(dek);

  return {
    ciphertext,
    nonce,
    dekForOwner,
    dekForAsker,
  };
}

/**
 * 信封解密：用于解密私密回答
 */
export function envelopeDecrypt(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  encryptedDek: Uint8Array,
  aad: string,
  recipientKeyPair: KeyPair
): Uint8Array {
  ensureReady();

  // 解密 DEK
  const dek = sodium.crypto_box_seal_open(
    encryptedDek,
    recipientKeyPair.publicKey,
    recipientKeyPair.privateKey
  );

  if (!dek) {
    throw new Error('Failed to decrypt DEK');
  }

  // AEAD 解密
  const plaintext = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null, // nsec (not used)
    ciphertext,
    sodium.from_string(aad),
    nonce,
    dek
  );

  // 清零 DEK
  sodium.memzero(dek);

  if (!plaintext) {
    throw new Error('Failed to decrypt message: invalid AAD or corrupted data');
  }

  return plaintext;
}

// ========================================
// 签名
// ========================================

/**
 * 签名消息
 */
export function sign(message: Uint8Array, privateKey: Uint8Array): Uint8Array {
  ensureReady();
  return sodium.crypto_sign_detached(message, privateKey);
}

/**
 * 验证签名
 */
export function verify(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array
): boolean {
  ensureReady();
  return sodium.crypto_sign_verify_detached(signature, message, publicKey);
}

/**
 * 签名挑战 (用于登录)
 */
export function signChallenge(
  nonce: Uint8Array,
  privateKey: Uint8Array
): Uint8Array {
  ensureReady();
  return sodium.crypto_sign_detached(nonce, privateKey);
}

// ========================================
// 工具函数
// ========================================

/**
 * 生成随机 bytes
 */
export function randomBytes(length: number): Uint8Array {
  ensureReady();
  return sodium.randombytes_buf(length);
}

/**
 * 安全比较两个 byte 数组
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  ensureReady();
  if (a.length !== b.length) {
    return false;
  }
  return sodium.memcmp(a, b);
}

/**
 * 清零敏感数据
 */
export function secureZero(data: Uint8Array): void {
  ensureReady();
  sodium.memzero(data);
}

/**
 * 计算 SHA-256 哈希
 */
export function sha256(data: Uint8Array): Uint8Array {
  ensureReady();
  return sodium.crypto_hash_sha256(data);
}

/**
 * 字符串转 Uint8Array
 */
export function stringToBytes(str: string): Uint8Array {
  ensureReady();
  return sodium.from_string(str);
}

/**
 * Uint8Array 转字符串
 */
export function bytesToString(data: Uint8Array): string {
  ensureReady();
  return sodium.to_string(data);
}

// ========================================
// 导出
// ========================================

export {
  sodium,
  type AccountKeys,
  type ReceiptKeys,
  type EncryptedSeed,
  type KeyPair,
};
