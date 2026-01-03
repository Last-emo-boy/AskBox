'use client';

import {
  initCrypto,
  generateReceiptKeys,
  sealMessage,
  stringToBytes,
  toBase64Url,
  fromBase64Url,
} from '@askbox/crypto';
import { AlertTriangle, ArrowLeft, Check, Copy, Loader2, Lock, Send } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ReceiptQRCode } from '@/components/QRCode';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
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
  const [copied, setCopied] = useState(false);
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
      } catch {
        setError('提问箱不存在或已关闭');
      } finally {
        setIsLoading(false);
      }
    };
    loadBox();
  }, [slug]);

  const handleSubmit = async () => {
    if (!box || !question.trim()) {
      return;
    }

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

  const handleCopy = async () => {
    if (success) {
      await navigator.clipboard.writeText(success.receipt_seed);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!box) {
    return (
      <main className="bg-background flex min-h-screen items-center justify-center p-4 sm:p-6">
        <Card className="max-w-md text-center">
          <CardHeader>
            <CardTitle>提问箱不存在</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/">返回首页</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="bg-background min-h-screen">
      {/* Theme Toggle */}
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>

      <div className="mx-auto max-w-lg px-4 py-8 sm:px-6 sm:py-16">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center text-sm transition-colors sm:mb-8"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回首页
        </Link>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl sm:text-2xl">向 {slug} 提问</CardTitle>
            <CardDescription className="flex items-center justify-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              你的问题将被端到端加密，只有箱主能看到
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-4 sm:space-y-6">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/30">
                  <div className="mb-2 flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-200">
                    <Check className="h-5 w-5" />
                    提问成功！
                  </div>
                  <p className="mb-4 text-sm text-emerald-700 dark:text-emerald-300">
                    请保存以下回执信息，用于查看箱主的回复：
                  </p>
                  <div className="bg-card rounded-lg border border-emerald-200 p-3 dark:border-emerald-700">
                    <p className="text-muted-foreground mb-1 text-xs">回执码（请妥善保存）</p>
                    <p className="break-all font-mono text-xs sm:text-sm">{success.receipt_seed}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/30">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    回执码是查看私密回答的唯一凭证，丢失后无法恢复！
                  </p>
                </div>

                <div className="flex justify-center">
                  <ReceiptQRCode
                    receiptData={{
                      question_id: success.question_id,
                      asker_token: success.asker_token,
                      receipt_seed: success.receipt_seed,
                    }}
                    size={160}
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    onClick={handleCopy}
                    className="flex-1"
                    variant={copied ? 'secondary' : 'default'}
                  >
                    {copied ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        复制回执码
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setSuccess(null)} className="flex-1">
                    继续提问
                  </Button>
                </div>

                <Link
                  href="/receipts"
                  className="text-muted-foreground hover:text-foreground block text-center text-sm underline-offset-4 hover:underline"
                >
                  在「我的回执」中查看
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="输入你的问题..."
                    className="min-h-[120px] resize-none sm:min-h-[150px]"
                    maxLength={5000}
                  />
                  <div className="text-muted-foreground flex justify-between text-xs">
                    <span>{question.length} / 5000</span>
                    <span className="flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      端到端加密
                    </span>
                  </div>
                </div>

                {error && (
                  <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm">
                    {error}
                  </div>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !question.trim()}
                  className="w-full"
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      提交问题
                    </>
                  )}
                </Button>

                <p className="text-muted-foreground text-center text-xs">
                  提交后将生成回执码，请妥善保存以查看回复
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
