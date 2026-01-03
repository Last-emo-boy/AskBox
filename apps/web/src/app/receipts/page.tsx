'use client';

import {
  initCrypto,
  deriveReceiptKeys,
  envelopeDecrypt,
  fromBase64Url,
  bytesToString,
} from '@askbox/crypto';
import { ChevronDown, Globe, Inbox, Loader2, Lock, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Header } from '@/components/Header';
import { CardSkeleton } from '@/components/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
      setReceipts(stored.map((r) => ({ ...r, isLoading: false })));
      setIsLoading(false);
    };
    loadReceipts();
  }, []);

  const checkAnswer = async (receipt: ReceiptWithAnswer) => {
    setReceipts((prev) =>
      prev.map((r) => (r.question_id === receipt.question_id ? { ...r, isLoading: true } : r))
    );

    try {
      await initCrypto();

      const answer = await api.getAnswerForAsker(receipt.question_id, receipt.asker_token);

      let decryptedText: string | undefined;

      if (
        answer.visibility === 'private' &&
        answer.ciphertext_answer &&
        answer.nonce &&
        answer.dek_for_asker
      ) {
        const receiptKeys = deriveReceiptKeys(fromBase64Url(receipt.receipt_seed));
        // AAD uses question_id only (must match encryption)
        const aad = `${receipt.question_id}|v1`;

        const plaintext = envelopeDecrypt(
          fromBase64Url(answer.ciphertext_answer),
          fromBase64Url(answer.nonce),
          fromBase64Url(answer.dek_for_asker),
          aad,
          receiptKeys.encKeyPair
        );

        decryptedText = bytesToString(plaintext);
      }

      setReceipts((prev) =>
        prev.map((r) =>
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
      setReceipts((prev) =>
        prev.map((r) =>
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
    if (!confirm('确定要删除这个回执吗？删除后将无法查看回答。')) {
      return;
    }
    await deleteReceipt(questionId);
    setReceipts((prev) => prev.filter((r) => r.question_id !== questionId));
  };

  if (isLoading) {
    return (
      <>
        <Header />
        <main className="bg-background min-h-screen">
          <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-12">
            <CardSkeleton />
            <div className="mt-4">
              <CardSkeleton />
            </div>
            <div className="mt-4">
              <CardSkeleton />
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="bg-background min-h-screen">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-12">
          <header className="mb-6 sm:mb-8">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">我的回执</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              查看你发送的提问和收到的回复
            </p>
          </header>

          {receipts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Inbox className="text-muted-foreground mb-4 h-12 w-12" />
                <p className="text-muted-foreground mb-2">还没有提问回执</p>
                <p className="text-muted-foreground text-center text-sm">
                  向他人的提问箱提问后，回执会保存在这里
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {receipts.map((receipt) => (
                <Card key={receipt.question_id}>
                  <CardContent className="p-4 sm:p-6">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold">提问给: {receipt.box_slug}</h3>
                        <p className="text-muted-foreground text-sm">
                          {new Date(receipt.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        onClick={() => handleDelete(receipt.question_id)}
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        <span className="hidden sm:inline">删除</span>
                      </Button>
                    </div>

                    {receipt.answer ? (
                      <div className="bg-muted mt-3 rounded-lg p-4">
                        {receipt.answer.error ? (
                          <p className="text-destructive text-sm">{receipt.answer.error}</p>
                        ) : receipt.answer.public_text ? (
                          <div>
                            <div className="mb-2 flex items-center gap-2">
                              <Badge
                                variant="secondary"
                                className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                              >
                                <Globe className="mr-1 h-3 w-3" />
                                公开回答
                              </Badge>
                            </div>
                            <p className="whitespace-pre-wrap text-sm">
                              {receipt.answer.public_text}
                            </p>
                          </div>
                        ) : receipt.answer.decrypted_text ? (
                          <div>
                            <div className="mb-2 flex items-center gap-2">
                              <Badge
                                variant="secondary"
                                className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                              >
                                <Lock className="mr-1 h-3 w-3" />
                                私密回答
                              </Badge>
                            </div>
                            <p className="whitespace-pre-wrap text-sm">
                              {receipt.answer.decrypted_text}
                            </p>
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">暂无回答</p>
                        )}
                      </div>
                    ) : (
                      <Button
                        onClick={() => checkAnswer(receipt)}
                        disabled={receipt.isLoading}
                        size="sm"
                      >
                        {receipt.isLoading ? (
                          <>
                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                            查询中...
                          </>
                        ) : (
                          <>
                            <Search className="mr-1.5 h-4 w-4" />
                            查看回答
                          </>
                        )}
                      </Button>
                    )}

                    <details className="mt-3">
                      <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-sm">
                        <ChevronDown className="h-4 w-4" />
                        显示回执详情
                      </summary>
                      <div className="bg-muted mt-2 rounded-lg p-3 font-mono text-xs">
                        <p className="break-all">
                          <strong>问题ID:</strong> {receipt.question_id}
                        </p>
                        <p className="mt-1 break-all">
                          <strong>回执种子:</strong> {receipt.receipt_seed}
                        </p>
                      </div>
                    </details>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
