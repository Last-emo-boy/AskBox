'use client';

import {
  initCrypto,
  deriveAccountKeys,
  decryptSeedWithPassword,
  signChallenge,
  openSealedMessage,
  envelopeEncrypt,
  envelopeDecrypt,
  fromBase64Url,
  toBase64Url,
  bytesToString,
  stringToBytes,
} from '@askbox/crypto';
import {
  CheckCircle2,
  Eye,
  Filter,
  Globe,
  Inbox,
  Loader2,
  Lock,
  LockOpen,
  MessageSquare,
  Send,
  X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { Header } from '@/components/Header';
import { QuestionSkeleton } from '@/components/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { getStoredAccount } from '@/lib/storage';

import type { StoredAccount } from '@askbox/shared-types';

interface Answer {
  answer_id: string;
  visibility: 'public' | 'private';
  public_text?: string;
  decrypted_text?: string;
  created_at: string;
  published_at?: string;
}

interface Question {
  question_id: string;
  box_id: string;
  ciphertext_question: string;
  receipt_pub_enc_key: string | null;
  created_at: string;
  opened_at: string | null;
  has_answer: boolean;
  plaintext?: string;
  decryptError?: string;
  answer?: Answer;
  answerLoading?: boolean;
}

export default function QuestionsPage() {
  return (
    <Suspense
      fallback={
        <>
          <Header />
          <main className="bg-background min-h-screen">
            <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-12">
              <QuestionSkeleton />
              <QuestionSkeleton />
              <QuestionSkeleton />
            </div>
          </main>
        </>
      }
    >
      <QuestionsContent />
    </Suspense>
  );
}

function QuestionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const boxId = searchParams.get('box_id');

  const [account, setAccount] = useState<StoredAccount | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [needPassword, setNeedPassword] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'unopened' | 'opened' | 'answered'>('all');

  // For answering
  const [answeringQuestion, setAnsweringQuestion] = useState<Question | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [answerVisibility, setAnswerVisibility] = useState<'public' | 'private'>('public');
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);

  // For publishing
  const [publishingQuestion, setPublishingQuestion] = useState<Question | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  // Account keys (stored after login)
  const [accountKeys, setAccountKeys] = useState<{
    signKeyPair: { publicKey: Uint8Array; privateKey: Uint8Array };
    encKeyPair: { publicKey: Uint8Array; privateKey: Uint8Array };
  } | null>(null);

  useEffect(() => {
    const init = async () => {
      const stored = await getStoredAccount();
      if (!stored) {
        router.push('/');
        return;
      }
      setAccount(stored);

      // If has encrypted seed, need password first
      if (stored.encrypted_seed) {
        setNeedPassword(true);
        setIsLoading(false);
      } else {
        // Has plaintext seed, can login and load automatically
        setNeedPassword(false);
        // Will load in the second useEffect
      }
    };
    init();
  }, [router]);

  // Auto-login and load when account is ready and no password needed
  useEffect(() => {
    if (account && !needPassword && !account.encrypted_seed && !accountKeys) {
      login().then((success) => {
        if (success) {
          // loadQuestions will be triggered by the next useEffect when accountKeys is set
        }
        setIsLoading(false);
      });
    }
  }, [account, needPassword, accountKeys]);

  const login = async (): Promise<boolean> => {
    if (!account) {
      return false;
    }

    try {
      await initCrypto();

      let seed: Uint8Array;
      if (account.plaintext_seed) {
        seed = fromBase64Url(account.plaintext_seed);
      } else if (account.encrypted_seed) {
        if (!password) {
          setError('请输入密码');
          return false;
        }
        seed = decryptSeedWithPassword(account.encrypted_seed, password);
      } else {
        throw new Error('无法获取种子');
      }

      const keys = deriveAccountKeys(seed);
      setAccountKeys(keys);

      const challenge = await api.requestChallenge(
        toBase64Url(keys.signKeyPair.publicKey),
        toBase64Url(keys.encKeyPair.publicKey)
      );
      const signature = signChallenge(fromBase64Url(challenge.nonce), keys.signKeyPair.privateKey);
      const auth = await api.verifyChallenge(challenge.challenge_id, toBase64Url(signature));
      api.setAccessToken(auth.access_token);

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
      return false;
    }
  };

  const loadQuestions = async () => {
    try {
      const params: { status?: 'unopened' | 'opened' | 'answered'; box_id?: string } = {};
      if (filter !== 'all') {
        params.status = filter as 'unopened' | 'opened' | 'answered';
      }
      if (boxId) {
        params.box_id = boxId;
      }

      const result = await api.getMyQuestions(params);
      setQuestions(result.questions);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Unauthorized')) {
        setNeedPassword(true);
      } else {
        setError(err instanceof Error ? err.message : '加载失败');
      }
    }
  };

  const handleLogin = async () => {
    const success = await login();
    if (success) {
      await loadQuestions();
      setNeedPassword(false);
    }
  };

  const decryptQuestion = async (question: Question) => {
    if (!accountKeys) {
      return;
    }

    try {
      const ciphertext = fromBase64Url(question.ciphertext_question);
      const plaintext = openSealedMessage(ciphertext, accountKeys.encKeyPair);

      setQuestions((prev) =>
        prev.map((q) =>
          q.question_id === question.question_id ? { ...q, plaintext: bytesToString(plaintext) } : q
        )
      );

      // Mark as opened
      if (!question.opened_at) {
        await api.openQuestion(question.question_id);
        setQuestions((prev) =>
          prev.map((q) =>
            q.question_id === question.question_id
              ? { ...q, opened_at: new Date().toISOString() }
              : q
          )
        );
      }
    } catch (err) {
      setQuestions((prev) =>
        prev.map((q) =>
          q.question_id === question.question_id
            ? { ...q, decryptError: err instanceof Error ? err.message : '解密失败' }
            : q
        )
      );
    }
  };

  const loadAnswer = async (question: Question) => {
    if (!accountKeys || !question.has_answer) {
      return;
    }

    setQuestions((prev) =>
      prev.map((q) => (q.question_id === question.question_id ? { ...q, answerLoading: true } : q))
    );

    try {
      const answerData = await api.getAnswerForOwner(question.question_id);

      let decryptedText: string | undefined;

      // If private and not yet published, decrypt
      if (
        answerData.visibility === 'private' &&
        !answerData.public_text &&
        answerData.ciphertext_answer &&
        answerData.nonce &&
        answerData.dek_for_owner
      ) {
        const aad = `${answerData.answer_id}|${question.question_id}|v1`;

        const plaintext = envelopeDecrypt(
          fromBase64Url(answerData.ciphertext_answer),
          fromBase64Url(answerData.nonce),
          fromBase64Url(answerData.dek_for_owner),
          aad,
          accountKeys.encKeyPair
        );

        decryptedText = bytesToString(plaintext);
      }

      setQuestions((prev) =>
        prev.map((q) =>
          q.question_id === question.question_id
            ? {
                ...q,
                answerLoading: false,
                answer: {
                  answer_id: answerData.answer_id,
                  visibility: answerData.visibility,
                  public_text: answerData.public_text,
                  decrypted_text: decryptedText,
                  created_at: answerData.created_at,
                  published_at: answerData.published_at,
                },
              }
            : q
        )
      );
    } catch (err) {
      setQuestions((prev) =>
        prev.map((q) =>
          q.question_id === question.question_id ? { ...q, answerLoading: false } : q
        )
      );
      setError(err instanceof Error ? err.message : '加载回答失败');
    }
  };

  const handlePublish = async () => {
    if (!publishingQuestion?.answer) {
      return;
    }

    const textToPublish =
      publishingQuestion.answer.decrypted_text || publishingQuestion.answer.public_text;
    if (!textToPublish) {
      setError('没有可公开的内容');
      return;
    }

    setIsPublishing(true);

    try {
      await api.publishAnswer(publishingQuestion.answer.answer_id, textToPublish);

      // Update local state
      setQuestions((prev) =>
        prev.map((q) =>
          q.question_id === publishingQuestion.question_id
            ? {
                ...q,
                answer: q.answer
                  ? {
                      ...q.answer,
                      public_text: textToPublish,
                      published_at: new Date().toISOString(),
                    }
                  : undefined,
              }
            : q
        )
      );

      setPublishingQuestion(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '公开失败');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!answeringQuestion || !answerText.trim() || !accountKeys) {
      return;
    }

    setIsSubmittingAnswer(true);

    try {
      if (answerVisibility === 'public') {
        await api.createPublicAnswer(answeringQuestion.question_id, answerText);
      } else {
        // Private answer - need to encrypt
        if (!answeringQuestion.receipt_pub_enc_key) {
          throw new Error('此问题没有回执公钥，无法发送私密回答');
        }

        const ownerPubKey = accountKeys.encKeyPair.publicKey;
        const askerPubKey = fromBase64Url(answeringQuestion.receipt_pub_enc_key);
        const aad = `pending|${answeringQuestion.question_id}|v1`; // answer_id pending

        const encrypted = envelopeEncrypt(stringToBytes(answerText), aad, ownerPubKey, askerPubKey);

        await api.createPrivateAnswer(
          answeringQuestion.question_id,
          toBase64Url(encrypted.ciphertext),
          toBase64Url(encrypted.nonce),
          toBase64Url(encrypted.dekForOwner),
          toBase64Url(encrypted.dekForAsker)
        );
      }

      // Update question state
      setQuestions((prev) =>
        prev.map((q) =>
          q.question_id === answeringQuestion.question_id ? { ...q, has_answer: true } : q
        )
      );

      setAnsweringQuestion(null);
      setAnswerText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '回答失败');
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  useEffect(() => {
    if (!needPassword && accountKeys) {
      loadQuestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, needPassword, accountKeys]);

  if (isLoading) {
    return (
      <>
        <Header />
        <main className="bg-background min-h-screen">
          <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-12">
            <QuestionSkeleton />
            <QuestionSkeleton />
            <QuestionSkeleton />
          </div>
        </main>
      </>
    );
  }

  const filterLabels = {
    all: '全部',
    unopened: '未拆开',
    opened: '已拆开',
    answered: '已回答',
  };

  return (
    <>
      <Header />
      <main className="bg-background min-h-screen">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-12">
          <header className="mb-6 sm:mb-8">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">收到的问题</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">查看和回复匿名提问</p>
          </header>

          {needPassword && account?.encrypted_seed && (
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">请输入密码以继续</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    type="password"
                    className="flex-1"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="输入密码"
                  />
                  <Button onClick={handleLogin} className="w-full sm:w-auto">
                    登录
                  </Button>
                </div>
                {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
              </CardContent>
            </Card>
          )}

          {!needPassword && (
            <>
              {/* Filter */}
              <div className="mb-6 flex items-center gap-2">
                <Filter className="text-muted-foreground h-4 w-4" />
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(filterLabels) as (keyof typeof filterLabels)[]).map((f) => (
                    <Button
                      key={f}
                      onClick={() => setFilter(f)}
                      variant={filter === f ? 'default' : 'outline'}
                      size="sm"
                    >
                      {filterLabels[f]}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Questions list */}
              <div className="space-y-4">
                {questions.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Inbox className="text-muted-foreground mb-4 h-12 w-12" />
                      <p className="text-muted-foreground">暂无问题</p>
                    </CardContent>
                  </Card>
                ) : (
                  questions.map((question) => (
                    <Card key={question.question_id}>
                      <CardContent className="p-4 sm:p-6">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {!question.opened_at && (
                              <Badge
                                variant="secondary"
                                className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                              >
                                <Lock className="mr-1 h-3 w-3" />
                                未拆开
                              </Badge>
                            )}
                            {question.has_answer && (
                              <Badge
                                variant="secondary"
                                className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              >
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                已回答
                              </Badge>
                            )}
                          </div>
                          <span className="text-muted-foreground text-xs sm:text-sm">
                            {new Date(question.created_at).toLocaleString()}
                          </span>
                        </div>

                        {question.plaintext ? (
                          <div className="bg-muted mb-4 rounded-lg p-4">
                            <p className="whitespace-pre-wrap text-sm sm:text-base">
                              {question.plaintext}
                            </p>
                          </div>
                        ) : question.decryptError ? (
                          <div className="bg-destructive/10 text-destructive mb-4 rounded-lg p-4">
                            {question.decryptError}
                          </div>
                        ) : (
                          <div className="mb-4">
                            <Button
                              onClick={() => decryptQuestion(question)}
                              variant="outline"
                              size="sm"
                            >
                              <LockOpen className="mr-1.5 h-4 w-4" />
                              拆开查看
                            </Button>
                          </div>
                        )}

                        {question.plaintext && !question.has_answer && (
                          <Button onClick={() => setAnsweringQuestion(question)} size="sm">
                            <MessageSquare className="mr-1.5 h-4 w-4" />
                            回答问题
                          </Button>
                        )}

                        {/* Show answer section for answered questions */}
                        {question.plaintext && question.has_answer && (
                          <div className="dark:border-border mt-4 border-t pt-4">
                            {question.answerLoading ? (
                              <div className="text-muted-foreground flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>加载回答中...</span>
                              </div>
                            ) : question.answer ? (
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground text-sm">我的回答：</span>
                                  {question.answer.public_text ? (
                                    <Badge
                                      variant="secondary"
                                      className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                    >
                                      <Globe className="mr-1 h-3 w-3" />
                                      已公开
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="secondary"
                                      className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                                    >
                                      <Lock className="mr-1 h-3 w-3" />
                                      私密
                                    </Badge>
                                  )}
                                </div>
                                <div className="bg-primary/5 dark:bg-primary/10 rounded-lg p-3">
                                  <p className="whitespace-pre-wrap text-sm">
                                    {question.answer.public_text || question.answer.decrypted_text}
                                  </p>
                                </div>
                                {question.answer.visibility === 'private' &&
                                  !question.answer.public_text && (
                                    <Button
                                      onClick={() => setPublishingQuestion(question)}
                                      size="sm"
                                    >
                                      <Globe className="mr-1.5 h-4 w-4" />
                                      一键公开
                                    </Button>
                                  )}
                              </div>
                            ) : (
                              <Button
                                onClick={() => loadAnswer(question)}
                                variant="outline"
                                size="sm"
                              >
                                <Eye className="mr-1.5 h-4 w-4" />
                                查看回答
                              </Button>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </>
          )}

          {/* Answer Dialog */}
          <Dialog
            open={!!answeringQuestion}
            onOpenChange={(open) => !open && setAnsweringQuestion(null)}
          >
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>回答问题</DialogTitle>
                <DialogDescription>选择回答方式并输入你的回答</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-muted-foreground mb-1 text-xs">问题：</p>
                  <p className="text-sm">{answeringQuestion?.plaintext}</p>
                </div>

                <div className="space-y-2">
                  <Label>回答方式</Label>
                  <div className="flex gap-4">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="visibility"
                        checked={answerVisibility === 'public'}
                        onChange={() => setAnswerVisibility('public')}
                        className="text-primary"
                      />
                      <Globe className="h-4 w-4" />
                      公开回答
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="visibility"
                        checked={answerVisibility === 'private'}
                        onChange={() => setAnswerVisibility('private')}
                        disabled={!answeringQuestion?.receipt_pub_enc_key}
                        className="text-primary"
                      />
                      <Lock className="h-4 w-4" />
                      私密回答
                      {!answeringQuestion?.receipt_pub_enc_key && (
                        <span className="text-muted-foreground text-xs">（不支持）</span>
                      )}
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="answerText">回答内容</Label>
                  <Textarea
                    id="answerText"
                    className="min-h-[150px] resize-none"
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder="输入你的回答..."
                  />
                </div>

                {error && <p className="text-destructive text-sm">{error}</p>}
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAnsweringQuestion(null);
                    setAnswerText('');
                    setError('');
                  }}
                  className="w-full sm:w-auto"
                >
                  <X className="mr-1.5 h-4 w-4" />
                  取消
                </Button>
                <Button
                  onClick={handleSubmitAnswer}
                  disabled={isSubmittingAnswer || !answerText.trim()}
                  className="w-full sm:w-auto"
                >
                  {isSubmittingAnswer ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    <>
                      <Send className="mr-1.5 h-4 w-4" />
                      提交回答
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Publish Confirmation Dialog */}
          <Dialog
            open={!!publishingQuestion}
            onOpenChange={(open) => !open && setPublishingQuestion(null)}
          >
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>确认公开回答</DialogTitle>
                <DialogDescription>
                  公开后，任何人都可以看到这个回答。此操作不可撤销。
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/30">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    ⚠️ 公开后，任何人都可以看到这个回答。此操作不可撤销。
                  </p>
                </div>

                <div className="bg-muted rounded-lg p-4">
                  <p className="text-muted-foreground mb-1 text-xs">问题：</p>
                  <p className="mb-3 text-sm">{publishingQuestion?.plaintext}</p>
                  <p className="text-muted-foreground mb-1 text-xs">回答（将被公开）：</p>
                  <p className="whitespace-pre-wrap text-sm">
                    {publishingQuestion?.answer?.decrypted_text ||
                      publishingQuestion?.answer?.public_text}
                  </p>
                </div>

                {error && <p className="text-destructive text-sm">{error}</p>}
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPublishingQuestion(null);
                    setError('');
                  }}
                  className="w-full sm:w-auto"
                >
                  取消
                </Button>
                <Button
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className="w-full sm:w-auto"
                >
                  {isPublishing ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      公开中...
                    </>
                  ) : (
                    <>
                      <Globe className="mr-1.5 h-4 w-4" />
                      确认公开
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </>
  );
}
