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
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

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
  // Decrypted locally
  plaintext?: string;
  decryptError?: string;
  // Answer info
  answer?: Answer;
  answerLoading?: boolean;
}

export default function QuestionsPage() {
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
      setNeedPassword(!!stored.encrypted_seed);
      setIsLoading(false);
    };
    init();
  }, [router]);

  const login = async (): Promise<boolean> => {
    if (!account) {return false;}

    try {
      await initCrypto();

      // Get seed
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

      // Request challenge
      const challenge = await api.requestChallenge(toBase64Url(keys.signKeyPair.publicKey));

      // Sign challenge
      const signature = signChallenge(
        fromBase64Url(challenge.nonce),
        keys.signKeyPair.privateKey
      );

      // Verify
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
      const params: { status?: string; box_id?: string } = {};
      if (filter !== 'all') {params.status = filter;}
      if (boxId) {params.box_id = boxId;}

      const result = await api.getMyQuestions(params as { status?: string; box_id?: string });
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
    if (!accountKeys) {return;}

    try {
      const ciphertext = fromBase64Url(question.ciphertext_question);
      const plaintext = openSealedMessage(ciphertext, accountKeys.encKeyPair);
      
      setQuestions(prev =>
        prev.map(q =>
          q.question_id === question.question_id
            ? { ...q, plaintext: bytesToString(plaintext) }
            : q
        )
      );

      // Mark as opened
      if (!question.opened_at) {
        await api.openQuestion(question.question_id);
        setQuestions(prev =>
          prev.map(q =>
            q.question_id === question.question_id
              ? { ...q, opened_at: new Date().toISOString() }
              : q
          )
        );
      }
    } catch (err) {
      setQuestions(prev =>
        prev.map(q =>
          q.question_id === question.question_id
            ? { ...q, decryptError: err instanceof Error ? err.message : '解密失败' }
            : q
        )
      );
    }
  };

  const loadAnswer = async (question: Question) => {
    if (!accountKeys || !question.has_answer) {return;}

    setQuestions(prev =>
      prev.map(q =>
        q.question_id === question.question_id
          ? { ...q, answerLoading: true }
          : q
      )
    );

    try {
      const answerData = await api.getAnswerForOwner(question.question_id);
      
      let decryptedText: string | undefined;

      // If private and not yet published, decrypt
      if (answerData.visibility === 'private' && !answerData.public_text && 
          answerData.ciphertext_answer && answerData.nonce && answerData.dek_for_owner) {
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

      setQuestions(prev =>
        prev.map(q =>
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
      setQuestions(prev =>
        prev.map(q =>
          q.question_id === question.question_id
            ? { ...q, answerLoading: false }
            : q
        )
      );
      setError(err instanceof Error ? err.message : '加载回答失败');
    }
  };

  const handlePublish = async () => {
    if (!publishingQuestion?.answer) {return;}

    const textToPublish = publishingQuestion.answer.decrypted_text || publishingQuestion.answer.public_text;
    if (!textToPublish) {
      setError('没有可公开的内容');
      return;
    }

    setIsPublishing(true);

    try {
      await api.publishAnswer(publishingQuestion.answer.answer_id, textToPublish);

      // Update local state
      setQuestions(prev =>
        prev.map(q =>
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
    if (!answeringQuestion || !answerText.trim() || !accountKeys) {return;}

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

        const encrypted = envelopeEncrypt(
          stringToBytes(answerText),
          aad,
          ownerPubKey,
          askerPubKey
        );

        await api.createPrivateAnswer(
          answeringQuestion.question_id,
          toBase64Url(encrypted.ciphertext),
          toBase64Url(encrypted.nonce),
          toBase64Url(encrypted.dekForOwner),
          toBase64Url(encrypted.dekForAsker)
        );
      }

      // Update question state
      setQuestions(prev =>
        prev.map(q =>
          q.question_id === answeringQuestion.question_id
            ? { ...q, has_answer: true }
            : q
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">收到的问题</h1>
          <Link href="/dashboard" className="btn-secondary">
            返回控制台
          </Link>
        </header>

        {needPassword && account?.encrypted_seed && (
          <div className="card mb-6">
            <h2 className="text-lg font-semibold mb-4">请输入密码以继续</h2>
            <div className="flex gap-3">
              <input
                type="password"
                className="input flex-1"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入密码"
              />
              <button onClick={handleLogin} className="btn-primary">
                登录
              </button>
            </div>
            {error && (
              <p className="text-red-600 text-sm mt-2">{error}</p>
            )}
          </div>
        )}

        {!needPassword && (
          <>
            {/* Filter */}
            <div className="flex gap-2 mb-6">
              {(['all', 'unopened', 'opened', 'answered'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm ${
                    filter === f
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {f === 'all' && '全部'}
                  {f === 'unopened' && '未拆开'}
                  {f === 'opened' && '已拆开'}
                  {f === 'answered' && '已回答'}
                </button>
              ))}
            </div>

            {/* Questions list */}
            <div className="space-y-4">
              {questions.length === 0 ? (
                <div className="card text-center text-gray-500 py-12">
                  <p>暂无问题</p>
                </div>
              ) : (
                questions.map((question) => (
                  <div key={question.question_id} className="card">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex gap-2 items-center">
                        {!question.opened_at && (
                          <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                            未拆开
                          </span>
                        )}
                        {question.has_answer && (
                          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                            已回答
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(question.created_at).toLocaleString()}
                      </span>
                    </div>

                    {question.plaintext ? (
                      <div className="bg-gray-50 rounded-lg p-4 mb-3">
                        <p className="whitespace-pre-wrap">{question.plaintext}</p>
                      </div>
                    ) : question.decryptError ? (
                      <div className="bg-red-50 rounded-lg p-4 mb-3 text-red-600">
                        {question.decryptError}
                      </div>
                    ) : (
                      <div className="mb-3">
                        <button
                          onClick={() => decryptQuestion(question)}
                          className="btn-primary text-sm"
                        >
                          🔓 拆开查看
                        </button>
                      </div>
                    )}

                    {question.plaintext && !question.has_answer && (
                      <button
                        onClick={() => setAnsweringQuestion(question)}
                        className="btn-secondary text-sm"
                      >
                        回答问题
                      </button>
                    )}

                    {/* Show answer section for answered questions */}
                    {question.plaintext && question.has_answer && (
                      <div className="mt-3 border-t pt-3">
                        {question.answerLoading ? (
                          <div className="flex items-center gap-2 text-gray-500">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                            <span>加载回答中...</span>
                          </div>
                        ) : question.answer ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">我的回答：</span>
                              {question.answer.public_text ? (
                                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                                  已公开
                                </span>
                              ) : (
                                <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded">
                                  私密
                                </span>
                              )}
                            </div>
                            <div className="bg-blue-50 rounded-lg p-3">
                              <p className="whitespace-pre-wrap text-sm">
                                {question.answer.public_text || question.answer.decrypted_text}
                              </p>
                            </div>
                            {/* One-click publish button for private answers */}
                            {question.answer.visibility === 'private' && !question.answer.public_text && (
                              <button
                                onClick={() => setPublishingQuestion(question)}
                                className="btn-primary text-sm"
                              >
                                🌐 一键公开
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => loadAnswer(question)}
                            className="btn-secondary text-sm"
                          >
                            查看回答
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* Answer modal */}
        {answeringQuestion && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="card max-w-lg w-full max-h-[80vh] overflow-y-auto">
              <h2 className="text-xl font-semibold mb-4">回答问题</h2>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-500 mb-1">问题：</p>
                <p>{answeringQuestion.plaintext}</p>
              </div>

              <div className="space-y-4">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="visibility"
                      checked={answerVisibility === 'public'}
                      onChange={() => setAnswerVisibility('public')}
                    />
                    公开回答
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="visibility"
                      checked={answerVisibility === 'private'}
                      onChange={() => setAnswerVisibility('private')}
                      disabled={!answeringQuestion.receipt_pub_enc_key}
                    />
                    私密回答
                    {!answeringQuestion.receipt_pub_enc_key && (
                      <span className="text-xs text-gray-500">（此问题不支持）</span>
                    )}
                  </label>
                </div>

                <textarea
                  className="input min-h-[150px] resize-none"
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="输入你的回答..."
                />

                {error && (
                  <p className="text-red-600 text-sm">{error}</p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={isSubmittingAnswer || !answerText.trim()}
                    className="btn-primary flex-1"
                  >
                    {isSubmittingAnswer ? '提交中...' : '提交回答'}
                  </button>
                  <button
                    onClick={() => {
                      setAnsweringQuestion(null);
                      setAnswerText('');
                      setError('');
                    }}
                    className="btn-secondary"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Publish confirmation modal */}
        {publishingQuestion && publishingQuestion.answer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="card max-w-lg w-full">
              <h2 className="text-xl font-semibold mb-4">确认公开回答</h2>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800">
                  ⚠️ 公开后，任何人都可以看到这个回答。此操作不可撤销。
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-500 mb-1">问题：</p>
                <p className="text-sm mb-3">{publishingQuestion.plaintext}</p>
                <p className="text-sm text-gray-500 mb-1">回答（将被公开）：</p>
                <p className="text-sm whitespace-pre-wrap">
                  {publishingQuestion.answer.decrypted_text || publishingQuestion.answer.public_text}
                </p>
              </div>

              {error && (
                <p className="text-red-600 text-sm mb-4">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className="btn-primary flex-1"
                >
                  {isPublishing ? '公开中...' : '确认公开'}
                </button>
                <button
                  onClick={() => {
                    setPublishingQuestion(null);
                    setError('');
                  }}
                  className="btn-secondary"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
