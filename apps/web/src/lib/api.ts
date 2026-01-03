/**
 * API 客户端
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

class ApiClient {
  private accessToken: string | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      const error = data as ApiError;
      throw new Error(error.error?.message || 'API request failed');
    }

    return data as T;
  }

  // Auth
  async requestChallenge(pubSignKey: string, pubEncKey?: string) {
    return this.request<{
      nonce: string;
      challenge_id: string;
      expires_at: string;
    }>('POST', '/v1/auth/challenge', {
      pub_sign_key: pubSignKey,
      pub_enc_key: pubEncKey,
    });
  }

  async verifyChallenge(challengeId: string, signature: string) {
    return this.request<{
      access_token: string;
      expires_in: number;
      user_id: string;
    }>('POST', '/v1/auth/verify', { challenge_id: challengeId, signature });
  }

  // Boxes
  async createBox(slug?: string, settings?: { allow_anonymous?: boolean }) {
    return this.request<{
      box_id: string;
      slug: string;
      owner_pub_enc_key: string;
      created_at: string;
    }>('POST', '/v1/boxes', { slug, settings });
  }

  async getBox(slug: string) {
    return this.request<{
      box_id: string;
      slug: string;
      settings: { allow_anonymous: boolean };
      owner_pub_enc_key: string;
    }>('GET', `/v1/boxes/${slug}`);
  }

  async getMyBoxes() {
    return this.request<{
      boxes: Array<{
        box_id: string;
        slug: string;
        settings: unknown;
        owner_pub_enc_key: string;
        created_at: string;
      }>;
    }>('GET', '/v1/owner/boxes');
  }

  // Questions
  async submitQuestion(boxId: string, ciphertextQuestion: string, receiptPubEncKey?: string) {
    return this.request<{
      question_id: string;
      asker_token: string;
    }>('POST', `/v1/boxes/${boxId}/questions`, {
      ciphertext_question: ciphertextQuestion,
      receipt_pub_enc_key: receiptPubEncKey,
      client_created_at: new Date().toISOString(),
    });
  }

  async getMyQuestions(params?: { status?: 'unopened' | 'opened' | 'answered'; box_id?: string }) {
    const query = new URLSearchParams();
    if (params?.status) {
      query.set('status', params.status);
    }
    if (params?.box_id) {
      query.set('box_id', params.box_id);
    }

    return this.request<{
      questions: Array<{
        question_id: string;
        box_id: string;
        ciphertext_question: string;
        receipt_pub_enc_key: string | null;
        created_at: string;
        opened_at: string | null;
        has_answer: boolean;
      }>;
      total: number;
      has_more: boolean;
    }>('GET', `/v1/owner/questions?${query}`);
  }

  async openQuestion(questionId: string, openedSig?: string) {
    return this.request<{ ok: boolean }>('POST', `/v1/questions/${questionId}/open`, {
      opened_at: new Date().toISOString(),
      opened_sig: openedSig,
    });
  }

  // Answers
  async createPublicAnswer(questionId: string, publicText: string) {
    return this.request<{
      answer_id: string;
      created_at: string;
    }>('POST', `/v1/questions/${questionId}/answer`, {
      visibility: 'public',
      public_text: publicText,
    });
  }

  async createPrivateAnswer(
    questionId: string,
    ciphertextAnswer: string,
    nonce: string,
    dekForOwner: string,
    dekForAsker: string
  ) {
    return this.request<{
      answer_id: string;
      created_at: string;
    }>('POST', `/v1/questions/${questionId}/answer`, {
      visibility: 'private',
      ciphertext_answer: ciphertextAnswer,
      nonce,
      dek_for_owner: dekForOwner,
      dek_for_asker: dekForAsker,
    });
  }

  async getAnswerForAsker(questionId: string, askerToken: string) {
    return this.request<{
      answer_id: string;
      visibility: 'public' | 'private';
      public_text?: string;
      ciphertext_answer?: string;
      nonce?: string;
      dek_for_asker?: string;
      created_at: string;
    }>(
      'GET',
      `/v1/asker/answers?question_id=${questionId}&asker_token=${encodeURIComponent(askerToken)}`
    );
  }

  async getAnswerForOwner(questionId: string) {
    return this.request<{
      answer_id: string;
      visibility: 'public' | 'private';
      public_text?: string;
      ciphertext_answer?: string;
      nonce?: string;
      dek_for_owner?: string;
      created_at: string;
      published_at?: string;
    }>('GET', `/v1/owner/answers/${questionId}`);
  }

  async publishAnswer(answerId: string, publicText: string) {
    return this.request<{
      visibility: 'public';
      published_at: string;
    }>('POST', `/v1/answers/${answerId}/publish`, { public_text: publicText });
  }
}

export const api = new ApiClient();
