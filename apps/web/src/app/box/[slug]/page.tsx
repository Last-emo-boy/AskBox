'use client';

import {
  initCrypto,
  generateReceiptKeys,
  sealMessage,
  stringToBytes,
  toBase64Url,
} from '@askbox/crypto';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ReceiptQRCode } from '@/components/QRCode';
import { api } from '@/lib/api';
import { saveReceipt } from '@/lib/storage';


interface BoxInfo {
  box_id: string;
  slug: string;
  settings: { allow_anonymous?: boolean };
  owner_pub_enc_key: string;
}

export default function BoxPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [box, setBox] = useState<BoxInfo | null>(null);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{
    question_id: string;
    asker_token: string;
    receipt_seed: string;
  } | null>(null);

  useEffect(() => {
    const loadBox = async () => {
      try {
        const data = await api.getBox(slug);
        setBox(data);
      } catch (err) {
        setError('提问箱不存在或已关闭');
      } finally {
        setIsLoading(false);
      }
    };
    loadBox();
  }, [slug]);

  const handleSubmit = async () => {
    if (!box || !question.trim()) {return;}

    setError('');
    setIsSubmitting(true);

    try {
      await initCrypto();

      // Generate receipt keys for anonymous question
      const receiptKeys = generateReceiptKeys();
      const receiptPubKey = toBase64Url(receiptKeys.encKeyPair.publicKey);
      const receiptSeed = toBase64Url(receiptKeys.seed);

      // Encrypt question with box owner's public key
      const ownerPubKey = fromBase64Url(box.owner_pub_enc_key);
      const encryptedQuestion = sealMessage(stringToBytes(question), ownerPubKey);
      const ciphertextQuestion = toBase64Url(encryptedQuestion);

      // Submit question
      const result = await api.submitQuestion(box.box_id, ciphertextQuestion, receiptPubKey);

      // Save receipt locally
      await saveReceipt({
        question_id: result.question_id,
        box_slug: box.slug,
        asker_token: result.asker_token,
        receipt_seed: receiptSeed,
        created_at: new Date().toISOString(),
      });

      setSuccess({
        question_id: result.question_id,
        asker_token: result.asker_token,
        receipt_seed: receiptSeed,
      });
      setQuestion('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!box) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="card text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">提问箱不存在</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link href="/" className="btn-primary">
            返回首页
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-lg w-full">
        <div className="card">
          <h1 className="text-2xl font-bold text-center mb-2">
            向 {slug} 提问
          </h1>
          <p className="text-center text-gray-600 mb-6">
            你的问题将被端到端加密，只有箱主能看到
          </p>

          {success ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-2">✅ 提问成功！</h3>
                <p className="text-sm text-green-700 mb-3">
                  请保存以下回执信息，用于查看箱主的回复：
                </p>
                <div className="bg-white rounded p-3 border text-sm">
                  <p className="text-gray-500 mb-1">回执码（请妥善保存）：</p>
                  <p className="font-mono break-all">{success.receipt_seed}</p>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
                ⚠️ 回执码是查看私密回答的唯一凭证，丢失后无法恢复！
              </div>

              <ReceiptQRCode
                receiptData={{
                  question_id: success.question_id,
                  asker_token: success.asker_token,
                  receipt_seed: success.receipt_seed,
                }}
                size={200}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(success.receipt_seed);
                    alert('回执码已复制');
                  }}
                  className="btn-primary flex-1"
                >
                  复制回执码
                </button>
                <button
                  onClick={() => setSuccess(null)}
                  className="btn-secondary"
                >
                  继续提问
                </button>
              </div>

              <Link
                href="/receipts"
                className="block text-center text-primary-600 hover:underline text-sm"
              >
                在「我的回执」中查看
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <textarea
                className="input min-h-[150px] resize-none"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="输入你的问题..."
                maxLength={5000}
              />

              <div className="flex justify-between text-sm text-gray-500">
                <span>{question.length} / 5000</span>
                <span>🔒 端到端加密</span>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !question.trim()}
                className="btn-primary w-full"
              >
                {isSubmitting ? '提交中...' : '提交问题'}
              </button>

              <p className="text-xs text-gray-500 text-center">
                提交后将生成回执码，请妥善保存以查看回复
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// Helper function (should be imported from crypto)
function fromBase64Url(data: string): Uint8Array {
  // This should use the crypto library's function
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
