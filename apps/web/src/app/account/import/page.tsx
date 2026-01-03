'use client';

import {
  initCrypto,
  deriveAccountKeys,
  encryptSeedWithPassword,
  fromBase64Url,
  toBase64Url,
} from '@askbox/crypto';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { saveAccount } from '@/lib/storage';

import type { StoredAccount } from '@askbox/shared-types';

export default function ImportAccountPage() {
  const router = useRouter();
  const [seedInput, setSeedInput] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [usePassword, setUsePassword] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');

  const handleImport = async () => {
    setError('');

    if (!seedInput.trim()) {
      setError('请输入种子');
      return;
    }

    if (usePassword) {
      if (password.length < 8) {
        setError('密码至少需要 8 个字符');
        return;
      }
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致');
        return;
      }
    }

    setIsImporting(true);

    try {
      await initCrypto();

      // Parse seed
      const seed = fromBase64Url(seedInput.trim());
      if (seed.length !== 32) {
        throw new Error('无效的种子格式');
      }

      // Derive keys
      const keys = deriveAccountKeys(seed);

      // Create stored account
      const account: StoredAccount = {
        pub_sign_key: toBase64Url(keys.signKeyPair.publicKey),
        pub_enc_key: toBase64Url(keys.encKeyPair.publicKey),
        created_at: new Date().toISOString(),
      };

      if (usePassword) {
        account.encrypted_seed = encryptSeedWithPassword(seed, password);
      } else {
        account.plaintext_seed = toBase64Url(seed);
      }

      // Save to IndexedDB
      await saveAccount(account);

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入账户失败');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <main className="bg-background min-h-screen">
      {/* Theme Toggle */}
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>

      <div className="mx-auto max-w-md px-4 py-8 sm:px-6 sm:py-16">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center text-sm transition-colors sm:mb-8"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回首页
        </Link>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl sm:text-2xl">导入账户</CardTitle>
            <CardDescription>使用已有的种子恢复账户</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 sm:space-y-6">
            <div className="space-y-2">
              <Label htmlFor="seed">输入种子</Label>
              <Textarea
                id="seed"
                className="min-h-[80px] font-mono text-xs sm:text-sm"
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                placeholder="粘贴你的种子（base64url 格式）"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="usePassword"
                checked={usePassword}
                onChange={(e) => setUsePassword(e.target.checked)}
                className="border-border text-primary focus:ring-primary h-4 w-4 rounded"
              />
              <Label htmlFor="usePassword" className="text-muted-foreground text-sm font-normal">
                使用密码保护种子（强烈推荐）
              </Label>
            </div>

            {usePassword && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">设置密码</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="至少 8 个字符"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">确认密码</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入密码"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm">
                {error}
              </div>
            )}

            <Button onClick={handleImport} disabled={isImporting} className="w-full" size="lg">
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  导入中...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  导入账户
                </>
              )}
            </Button>

            <p className="text-muted-foreground text-center text-sm">
              还没有账户？
              <Link
                href="/account/create"
                className="text-foreground ml-1 underline-offset-4 hover:underline"
              >
                创建新账户
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
