'use client';

import {
  initCrypto,
  deriveReceiptKeys,
  envelopeDecrypt,
  fromBase64Url,
  bytesToString,
} from '@askbox/crypto';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { getAllReceipts, deleteReceipt } from '@/lib/storage';


import type { StoredReceipt } from '@askbox/shared-types';

interface ReceiptWithAnswer extends StoredReceipt {
  answer?: {
    visibility: 'public' | 'private';
    public_text?: string;
    decrypted_text?: string;
    error?: string;
  };
  isLoading?: boolean;
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<ReceiptWithAnswer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadReceipts = async () => {
      const stored = await getAllReceipts();
      setReceipts(stored.map(r => ({ ...r, isLoading: false })));
      setIsLoading(false);
    };
    loadReceipts();
  }, []);

  const checkAnswer = async (receipt: ReceiptWithAnswer) => {
    setReceipts(prev =>
      prev.map(r =>
        r.question_id === receipt.question_id ? { ...r, isLoading: true } : r
      )
    );

    try {
      await initCrypto();

      const answer = await api.getAnswerForAsker(
        receipt.question_id,
        receipt.asker_token
      );

      let decryptedText: string | undefined;

      if (answer.visibility === 'private' && answer.ciphertext_answer && answer.nonce && answer.dek_for_asker) {
        // Decrypt the answer
        const receiptKeys = deriveReceiptKeys(fromBase64Url(receipt.receipt_seed));
        const aad = `${answer.answer_id}|${receipt.question_id}|v1`;

        const plaintext = envelopeDecrypt(
          fromBase64Url(answer.ciphertext_answer),
          fromBase64Url(answer.nonce),
          fromBase64Url(answer.dek_for_asker),
          aad,
          receiptKeys.encKeyPair
        );

        decryptedText = bytesToString(plaintext);
      }

      setReceipts(prev =>
        prev.map(r =>
          r.question_id === receipt.question_id
            ? {
                ...r,
                isLoading: false,
                answer: {
                  visibility: answer.visibility,
                  public_text: answer.public_text,
                  decrypted_text: decryptedText,
                },
              }
            : r
        )
      );
    } catch (err) {
      setReceipts(prev =>
        prev.map(r =>
          r.question_id === receipt.question_id
            ? {
                ...r,
                isLoading: false,
                answer: {
                  visibility: 'private',
                  error: err instanceof Error ? err.message : '获取回答失败',
                },
              }
            : r
        )
      );
    }
  };

  const handleDelete = async (questionId: string) => {
    if (!confirm('确定要删除这个回执吗？删除后将无法查看回答。')) {return;}
    await deleteReceipt(questionId);
    setReceipts(prev => prev.filter(r => r.question_id !== questionId));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">我的回执</h1>
          <Link href="/dashboard" className="btn-secondary">
            返回控制台
          </Link>
        </header>

        {receipts.length === 0 ? (
          <div className="card text-center text-gray-500 py-12">
            <p className="mb-4">还没有提问回执</p>
            <p className="text-sm">向他人的提问箱提问后，回执会保存在这里</p>
          </div>
        ) : (
          <div className="space-y-4">
            {receipts.map((receipt) => (
              <div key={receipt.question_id} className="card">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold">
                      提问给: {receipt.box_slug}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {new Date(receipt.created_at).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(receipt.question_id)}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    删除
                  </button>
                </div>

                {receipt.answer ? (
                  <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                    {receipt.answer.error ? (
                      <p className="text-red-600 text-sm">{receipt.answer.error}</p>
                    ) : receipt.answer.public_text ? (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">公开回答：</p>
                        <p className="whitespace-pre-wrap">{receipt.answer.public_text}</p>
                      </div>
                    ) : receipt.answer.decrypted_text ? (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">🔒 私密回答：</p>
                        <p className="whitespace-pre-wrap">{receipt.answer.decrypted_text}</p>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">暂无回答</p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => checkAnswer(receipt)}
                    disabled={receipt.isLoading}
                    className="btn-primary text-sm"
                  >
                    {receipt.isLoading ? '查询中...' : '查看回答'}
                  </button>
                )}

                <details className="mt-3">
                  <summary className="text-sm text-gray-500 cursor-pointer">
                    显示回执详情
                  </summary>
                  <div className="mt-2 p-3 bg-gray-50 rounded text-xs font-mono break-all">
                    <p><strong>问题ID:</strong> {receipt.question_id}</p>
                    <p><strong>回执种子:</strong> {receipt.receipt_seed}</p>
                  </div>
                </details>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
