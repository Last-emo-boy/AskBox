// ========================================
// AskBox Shared Types
// ========================================

// ----------------------------------------
// Common Types
// ----------------------------------------

/** Base64url encoded binary data */
export type Base64Url = string;

/** UUID v4 string */
export type UUID = string;

/** ISO8601 timestamp string */
export type ISOTimestamp = string;

/** Visibility enum for answers */
export type Visibility = 'public' | 'private';

/** Question status */
export type QuestionStatus = 'unopened' | 'opened' | 'answered';

// ----------------------------------------
// User & Auth Types
// ----------------------------------------

export interface User {
  user_id: UUID;
  pub_sign_key: Base64Url;
  pub_enc_key: Base64Url;
  created_at: ISOTimestamp;
}

export interface AuthChallengeRequest {
  pub_sign_key: Base64Url;
}

export interface AuthChallengeResponse {
  nonce: Base64Url;
  challenge_id: UUID;
  expires_at: ISOTimestamp;
}

export interface AuthVerifyRequest {
  challenge_id: UUID;
  signature: Base64Url;
}

export interface AuthVerifyResponse {
  access_token: string;
  expires_in: number;
}

// ----------------------------------------
// Box Types
// ----------------------------------------

export interface BoxSettings {
  allow_anonymous: boolean;
  require_captcha: boolean;
  custom_theme?: string;
}

export interface Box {
  box_id: UUID;
  slug: string;
  owner_user_id: UUID;
  owner_pub_enc_key: Base64Url;
  settings: BoxSettings;
  created_at: ISOTimestamp;
}

export interface CreateBoxRequest {
  slug?: string;
  settings: BoxSettings;
}

export interface CreateBoxResponse {
  box_id: UUID;
  slug: string;
  owner_pub_enc_key: Base64Url;
  created_at: ISOTimestamp;
}

export interface GetBoxResponse {
  box_id: UUID;
  slug: string;
  settings: BoxSettings;
  owner_pub_enc_key: Base64Url;
}

// ----------------------------------------
// Question Types
// ----------------------------------------

export interface Question {
  question_id: UUID;
  box_id: UUID;
  ciphertext_question: Base64Url;
  receipt_pub_enc_key?: Base64Url;
  created_at: ISOTimestamp;
  opened_at?: ISOTimestamp;
  opened_sig?: Base64Url;
  has_answer: boolean;
}

export interface CreateQuestionRequest {
  ciphertext_question: Base64Url;
  receipt_pub_enc_key?: Base64Url;
  client_created_at: ISOTimestamp;
}

export interface CreateQuestionResponse {
  question_id: UUID;
  asker_token: string;
}

export interface OpenQuestionRequest {
  opened_at: ISOTimestamp;
  opened_sig?: Base64Url;
}

export interface QuestionListResponse {
  questions: Question[];
  total: number;
  has_more: boolean;
}

// ----------------------------------------
// Answer Types
// ----------------------------------------

export interface Answer {
  answer_id: UUID;
  question_id: UUID;
  visibility: Visibility;
  public_text?: string;
  ciphertext_answer?: Base64Url;
  nonce?: Base64Url;
  dek_for_owner?: Base64Url;
  dek_for_asker?: Base64Url;
  created_at: ISOTimestamp;
  published_at?: ISOTimestamp;
}

export interface CreatePublicAnswerRequest {
  visibility: 'public';
  public_text: string;
}

export interface CreatePrivateAnswerRequest {
  visibility: 'private';
  ciphertext_answer: Base64Url;
  nonce: Base64Url;
  dek_for_owner: Base64Url;
  dek_for_asker: Base64Url;
}

export type CreateAnswerRequest = CreatePublicAnswerRequest | CreatePrivateAnswerRequest;

export interface CreateAnswerResponse {
  answer_id: UUID;
  created_at: ISOTimestamp;
}

export interface GetAnswerResponse {
  answer_id: UUID;
  visibility: Visibility;
  public_text?: string;
  ciphertext_answer?: Base64Url;
  nonce?: Base64Url;
  dek_for_asker?: Base64Url;
}

export interface PublishAnswerRequest {
  public_text: string;
}

export interface PublishAnswerResponse {
  visibility: 'public';
  published_at: ISOTimestamp;
}

// ----------------------------------------
// Error Types
// ----------------------------------------

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'INVALID_SIGNATURE'
  | 'CHALLENGE_EXPIRED'
  | 'CHALLENGE_USED'
  | 'BOX_NOT_FOUND'
  | 'QUESTION_NOT_FOUND'
  | 'ANSWER_NOT_FOUND'
  | 'ALREADY_ANSWERED'
  | 'ALREADY_PUBLIC'
  | 'INTERNAL_ERROR';

// ----------------------------------------
// Crypto Types (for client-side)
// ----------------------------------------

export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface AccountKeys {
  seed: Uint8Array;
  signKeyPair: KeyPair;
  encKeyPair: KeyPair;
}

export interface ReceiptKeys {
  seed: Uint8Array;
  encKeyPair: KeyPair;
}

export interface EncryptedSeed {
  ciphertext: Base64Url;
  salt: Base64Url;
  nonce: Base64Url;
}

export interface SealedMessage {
  ciphertext: Base64Url;
}

export interface EnvelopeEncrypted {
  ciphertext: Base64Url;
  nonce: Base64Url;
  dek_for_owner: Base64Url;
  dek_for_asker: Base64Url;
}

// ----------------------------------------
// Local Storage Types
// ----------------------------------------

export interface StoredAccount {
  pub_sign_key: Base64Url;
  pub_enc_key: Base64Url;
  encrypted_seed?: EncryptedSeed;
  plaintext_seed?: Base64Url; // Only if no password set
  created_at: ISOTimestamp;
}

export interface StoredReceipt {
  question_id: UUID;
  box_slug: string;
  asker_token: string;
  receipt_seed: Base64Url;
  created_at: ISOTimestamp;
}
