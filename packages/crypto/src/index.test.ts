import { describe, it, expect, beforeAll } from 'vitest';

import {
  initCrypto,
  generateSeed,
  deriveAccountKeys,
  generateReceiptKeys,
  encryptSeedWithPassword,
  decryptSeedWithPassword,
  sealMessage,
  openSealedMessage,
  envelopeEncrypt,
  envelopeDecrypt,
  sign,
  verify,
  toBase64Url,
  fromBase64Url,
  stringToBytes,
  bytesToString,
  sha256,
} from '../src/index';

describe('Crypto Library', () => {
  beforeAll(async () => {
    await initCrypto();
  });

  describe('Base64url encoding', () => {
    it('should encode and decode correctly', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5, 255, 254, 253]);
      const encoded = toBase64Url(original);
      const decoded = fromBase64Url(encoded);
      expect(decoded).toEqual(original);
    });
  });

  describe('Key generation', () => {
    it('should generate 32-byte seed', () => {
      const seed = generateSeed();
      expect(seed.length).toBe(32);
    });

    it('should derive deterministic keys from seed', () => {
      const seed = generateSeed();
      const keys1 = deriveAccountKeys(seed);
      const keys2 = deriveAccountKeys(seed);

      expect(keys1.signKeyPair.publicKey).toEqual(keys2.signKeyPair.publicKey);
      expect(keys1.encKeyPair.publicKey).toEqual(keys2.encKeyPair.publicKey);
    });

    it('should generate different keys from different seeds', () => {
      const seed1 = generateSeed();
      const seed2 = generateSeed();
      const keys1 = deriveAccountKeys(seed1);
      const keys2 = deriveAccountKeys(seed2);

      expect(keys1.signKeyPair.publicKey).not.toEqual(keys2.signKeyPair.publicKey);
    });

    it('should generate receipt keys', () => {
      const receipt = generateReceiptKeys();
      expect(receipt.seed.length).toBe(32);
      expect(receipt.encKeyPair.publicKey.length).toBe(32);
    });
  });

  describe('Password-based seed encryption', () => {
    it('should encrypt and decrypt seed with password', () => {
      const seed = generateSeed();
      const password = 'test-password-123';

      const encrypted = encryptSeedWithPassword(seed, password);
      const decrypted = decryptSeedWithPassword(encrypted, password);

      expect(decrypted).toEqual(seed);
    });

    it('should fail with wrong password', () => {
      const seed = generateSeed();
      const encrypted = encryptSeedWithPassword(seed, 'correct-password');

      expect(() => {
        decryptSeedWithPassword(encrypted, 'wrong-password');
      }).toThrow();
    });
  });

  describe('Sealed Box', () => {
    it('should seal and open message', () => {
      const keys = deriveAccountKeys(generateSeed());
      const message = stringToBytes('Hello, World!');

      const sealed = sealMessage(message, keys.encKeyPair.publicKey);
      const opened = openSealedMessage(sealed, keys.encKeyPair);

      expect(bytesToString(opened)).toBe('Hello, World!');
    });

    it('should fail to open with wrong key', () => {
      const keys1 = deriveAccountKeys(generateSeed());
      const keys2 = deriveAccountKeys(generateSeed());
      const message = stringToBytes('Secret message');

      const sealed = sealMessage(message, keys1.encKeyPair.publicKey);

      expect(() => {
        openSealedMessage(sealed, keys2.encKeyPair);
      }).toThrow();
    });
  });

  describe('Envelope Encryption', () => {
    it('should encrypt and decrypt for owner', () => {
      const ownerKeys = deriveAccountKeys(generateSeed());
      const askerKeys = generateReceiptKeys();
      const message = stringToBytes('Private answer');
      const aad = 'answer123|question456|v1';

      const encrypted = envelopeEncrypt(
        message,
        aad,
        ownerKeys.encKeyPair.publicKey,
        askerKeys.encKeyPair.publicKey
      );

      const decrypted = envelopeDecrypt(
        encrypted.ciphertext,
        encrypted.nonce,
        encrypted.dekForOwner,
        aad,
        ownerKeys.encKeyPair
      );

      expect(bytesToString(decrypted)).toBe('Private answer');
    });

    it('should encrypt and decrypt for asker', () => {
      const ownerKeys = deriveAccountKeys(generateSeed());
      const askerKeys = generateReceiptKeys();
      const message = stringToBytes('Private answer for asker');
      const aad = 'answer789|question012|v1';

      const encrypted = envelopeEncrypt(
        message,
        aad,
        ownerKeys.encKeyPair.publicKey,
        askerKeys.encKeyPair.publicKey
      );

      const decrypted = envelopeDecrypt(
        encrypted.ciphertext,
        encrypted.nonce,
        encrypted.dekForAsker,
        aad,
        askerKeys.encKeyPair
      );

      expect(bytesToString(decrypted)).toBe('Private answer for asker');
    });

    it('should fail with wrong AAD', () => {
      const ownerKeys = deriveAccountKeys(generateSeed());
      const askerKeys = generateReceiptKeys();
      const message = stringToBytes('Private answer');

      const encrypted = envelopeEncrypt(
        message,
        'correct-aad',
        ownerKeys.encKeyPair.publicKey,
        askerKeys.encKeyPair.publicKey
      );

      expect(() => {
        envelopeDecrypt(
          encrypted.ciphertext,
          encrypted.nonce,
          encrypted.dekForOwner,
          'wrong-aad',
          ownerKeys.encKeyPair
        );
      }).toThrow();
    });
  });

  describe('Signatures', () => {
    it('should sign and verify', () => {
      const keys = deriveAccountKeys(generateSeed());
      const message = stringToBytes('Message to sign');

      const signature = sign(message, keys.signKeyPair.privateKey);
      const isValid = verify(message, signature, keys.signKeyPair.publicKey);

      expect(isValid).toBe(true);
    });

    it('should fail verification with wrong public key', () => {
      const keys1 = deriveAccountKeys(generateSeed());
      const keys2 = deriveAccountKeys(generateSeed());
      const message = stringToBytes('Message to sign');

      const signature = sign(message, keys1.signKeyPair.privateKey);
      const isValid = verify(message, signature, keys2.signKeyPair.publicKey);

      expect(isValid).toBe(false);
    });

    it('should fail verification with tampered message', () => {
      const keys = deriveAccountKeys(generateSeed());
      const message = stringToBytes('Original message');

      const signature = sign(message, keys.signKeyPair.privateKey);
      const tamperedMessage = stringToBytes('Tampered message');
      const isValid = verify(tamperedMessage, signature, keys.signKeyPair.publicKey);

      expect(isValid).toBe(false);
    });
  });

  describe('Hash functions', () => {
    it('should compute SHA-256', () => {
      const data = stringToBytes('Hello');
      const hash = sha256(data);
      expect(hash.length).toBe(32);
    });

    it('should produce same hash for same input', () => {
      const data = stringToBytes('Test data');
      const hash1 = sha256(data);
      const hash2 = sha256(data);
      expect(hash1).toEqual(hash2);
    });
  });
});
