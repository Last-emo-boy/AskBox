'use client';

import { initCrypto, decryptSeedWithPassword, toBase64Url } from '@askbox/crypto';
import { AlertTriangle, Check, Copy, Eye, EyeOff, Key, Shield, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Header } from '@/components/Header';
import { CardSkeleton } from '@/components/Skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getStoredAccount, deleteAccount } from '@/lib/storage';

import type { StoredAccount } from '@askbox/shared-types';

export default function AccountPage() {
  const router = useRouter();
  const [account, setAccount] = useState<StoredAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSeed, setShowSeed] = useState(false);
  const [password, setPassword] = useState('');
  const [seed, setSeed] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loadAccount = async () => {
      const stored = await getStoredAccount();
      if (!stored) {
        router.push('/');
        return;
      }
      setAccount(stored);
      setIsLoading(false);
    };
    loadAccount();
  }, [router]);

  const handleShowSeed = async () => {
    if (!account) {
      return;
    }
    setError('');

    try {
      await initCrypto();

      if (account.plaintext_seed) {
        setSeed(account.plaintext_seed);
        setShowSeed(true);
      } else if (account.encrypted_seed) {
        if (!password) {
          setError('请输入密码');
          return;
        }
        const decrypted = decryptSeedWithPassword(account.encrypted_seed, password);
        setSeed(toBase64Url(decrypted));
        setShowSeed(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '解密失败');
    }
  };

  const handleDelete = async () => {
    await deleteAccount();
    router.push('/');
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading || !account) {
    return (
      <>
        <Header />
        <main className="bg-background min-h-screen">
          <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-12">
            <div className="space-y-6">
              <CardSkeleton />
              <CardSkeleton />
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
        <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-12">
          <header className="mb-6 sm:mb-8">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">账户管理</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              管理你的账户信息和安全设置
            </p>
          </header>

          <div className="space-y-4 sm:space-y-6">
            {/* 账户信息 */}
            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <div className="flex items-center gap-2">
                  <Key className="text-muted-foreground h-5 w-5" />
                  <CardTitle className="text-lg sm:text-xl">账户信息</CardTitle>
                </div>
                <CardDescription>你的公钥信息和账户状态</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs sm:text-sm">签名公钥</Label>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted flex-1 break-all rounded-md px-3 py-2 font-mono text-xs sm:text-sm">
                      {account.pub_sign_key}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => handleCopy(account.pub_sign_key)}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs sm:text-sm">加密公钥</Label>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted flex-1 break-all rounded-md px-3 py-2 font-mono text-xs sm:text-sm">
                      {account.pub_enc_key}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => handleCopy(account.pub_enc_key)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <Label className="text-muted-foreground text-xs sm:text-sm">创建时间</Label>
                    <p className="text-sm sm:text-base">
                      {new Date(account.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs sm:text-sm">密码保护</Label>
                    <p className="text-sm sm:text-base">
                      {account.encrypted_seed ? (
                        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                          <Shield className="h-4 w-4" /> 已启用
                        </span>
                      ) : (
                        <span className="text-muted-foreground">未启用</span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 导出种子 */}
            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <div className="flex items-center gap-2">
                  <Eye className="text-muted-foreground h-5 w-5" />
                  <CardTitle className="text-lg sm:text-xl">导出种子</CardTitle>
                </div>
                <CardDescription>种子是恢复账户的唯一方式，请妥善保管</CardDescription>
              </CardHeader>
              <CardContent>
                {!showSeed ? (
                  <div className="space-y-4">
                    {account.encrypted_seed && (
                      <div className="space-y-2">
                        <Label htmlFor="password">输入密码以显示种子</Label>
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="输入你的密码"
                        />
                      </div>
                    )}

                    {error && (
                      <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm">
                        {error}
                      </div>
                    )}

                    <Button onClick={handleShowSeed} className="w-full sm:w-auto">
                      <Eye className="mr-2 h-4 w-4" />
                      显示种子
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
                      <p className="mb-3 flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                        <AlertTriangle className="h-4 w-4" />
                        请安全保存以下种子，不要分享给任何人
                      </p>
                      <code className="bg-background block break-all rounded-md border p-3 font-mono text-xs sm:text-sm">
                        {seed}
                      </code>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        variant="secondary"
                        onClick={() => seed && handleCopy(seed)}
                        className="w-full sm:w-auto"
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        复制种子
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowSeed(false);
                          setSeed(null);
                          setPassword('');
                        }}
                        className="w-full sm:w-auto"
                      >
                        <EyeOff className="mr-2 h-4 w-4" />
                        隐藏种子
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 危险区域 */}
            <Card className="border-destructive/50">
              <CardHeader className="pb-3 sm:pb-6">
                <div className="text-destructive flex items-center gap-2">
                  <Trash2 className="h-5 w-5" />
                  <CardTitle className="text-lg sm:text-xl">危险区域</CardTitle>
                </div>
                <CardDescription>删除本地账户数据（不可恢复）</CardDescription>
              </CardHeader>
              <CardContent>
                {!showDeleteConfirm ? (
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full sm:w-auto"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    删除本地账户
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm">
                      确定要删除本地账户吗？删除后，如果没有备份种子，将无法恢复。
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        variant="destructive"
                        onClick={handleDelete}
                        className="w-full sm:w-auto"
                      >
                        确认删除
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="w-full sm:w-auto"
                      >
                        取消
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
