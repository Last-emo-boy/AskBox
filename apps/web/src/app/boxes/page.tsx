'use client';

import {
  initCrypto,
  deriveAccountKeys,
  decryptSeedWithPassword,
  signChallenge,
  fromBase64Url,
  toBase64Url,
} from '@askbox/crypto';
import { Copy, Eye, Inbox, Loader2, MessageSquare, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Header } from '@/components/Header';
import { BoxListSkeleton } from '@/components/Skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { getStoredAccount } from '@/lib/storage';

import type { StoredAccount } from '@askbox/shared-types';

interface Box {
  box_id: string;
  slug: string;
  settings: { allow_anonymous?: boolean };
  created_at: string;
}

export default function BoxesPage() {
  const router = useRouter();
  const [account, setAccount] = useState<StoredAccount | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [password, setPassword] = useState('');
  const [needPassword, setNeedPassword] = useState(false);
  const [error, setError] = useState('');
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

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

  const loadBoxes = async () => {
    try {
      const result = await api.getMyBoxes();
      setBoxes(result.boxes as Box[]);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Unauthorized')) {
        const success = await login();
        if (success) {
          const result = await api.getMyBoxes();
          setBoxes(result.boxes as Box[]);
        }
      } else {
        setError(err instanceof Error ? err.message : '加载失败');
      }
    }
  };

  const handleLogin = async () => {
    const success = await login();
    if (success) {
      await loadBoxes();
      setNeedPassword(false);
    }
  };

  const handleCreateBox = async () => {
    setError('');
    setIsCreating(true);

    try {
      const success = await login();
      if (!success) {
        setIsCreating(false);
        return;
      }

      const result = await api.createBox(newSlug || undefined, { allow_anonymous: true });
      setBoxes([
        ...boxes,
        {
          box_id: result.box_id,
          slug: result.slug,
          settings: { allow_anonymous: true },
          created_at: result.created_at,
        },
      ]);
      setNewSlug('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = (slug: string) => {
    const url = `${window.location.origin}/box/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  if (isLoading) {
    return (
      <>
        <Header />
        <main className="bg-background min-h-screen">
          <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-12">
            <BoxListSkeleton />
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
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">我的提问箱</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">创建和管理你的提问箱</p>
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
              {/* 创建新提问箱 */}
              <Card className="mb-6">
                <CardHeader className="pb-3 sm:pb-6">
                  <div className="flex items-center gap-2">
                    <Plus className="text-muted-foreground h-5 w-5" />
                    <CardTitle className="text-lg">创建新提问箱</CardTitle>
                  </div>
                  <CardDescription>自定义链接只能包含小写字母、数字和连字符</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="slug" className="sr-only">
                        自定义链接
                      </Label>
                      <Input
                        id="slug"
                        type="text"
                        value={newSlug}
                        onChange={(e) =>
                          setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                        }
                        placeholder="自定义链接（可选，如 my-box）"
                      />
                    </div>
                    <Button
                      onClick={handleCreateBox}
                      disabled={isCreating}
                      className="w-full sm:w-auto"
                    >
                      {isCreating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          创建中...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          创建
                        </>
                      )}
                    </Button>
                  </div>
                  {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
                </CardContent>
              </Card>

              {/* 提问箱列表 */}
              <div className="space-y-4">
                {boxes.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Inbox className="text-muted-foreground mb-4 h-12 w-12" />
                      <p className="text-muted-foreground">还没有提问箱，创建一个吧！</p>
                    </CardContent>
                  </Card>
                ) : (
                  boxes.map((box) => (
                    <Card key={box.box_id}>
                      <CardContent className="p-4 sm:p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-lg font-semibold">{box.slug}</h3>
                            <p className="text-muted-foreground text-sm">
                              创建于 {new Date(box.created_at).toLocaleDateString()}
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <code className="bg-muted truncate rounded px-2 py-1 text-xs">
                                {window.location.origin}/box/{box.slug}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={() => handleCopyLink(box.slug)}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              {copiedSlug === box.slug && (
                                <span className="text-xs text-green-600 dark:text-green-400">
                                  已复制
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/box/${box.slug}`}>
                                <Eye className="mr-1.5 h-3.5 w-3.5" />
                                <span className="hidden sm:inline">预览</span>
                              </Link>
                            </Button>
                            <Button asChild size="sm">
                              <Link href={`/questions?box_id=${box.box_id}`}>
                                <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                                <span className="hidden sm:inline">查看问题</span>
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
