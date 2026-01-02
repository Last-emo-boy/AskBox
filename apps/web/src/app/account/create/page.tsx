'use client';

import {
  initCrypto,
  generateSeed,
  deriveAccountKeys,
  encryptSeedWithPassword,
  toBase64Url,
} from '@askbox/crypto';
import { AlertTriangle, ArrowLeft, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveAccount } from '@/lib/storage';

import type { StoredAccount } from '@askbox/shared-types';

export default function CreateAccountPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [usePassword, setUsePassword] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setError('');

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

    setIsCreating(true);

    try {
      await initCrypto();

      // Generate seed and derive keys
      const seed = generateSeed();
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
      setError(err instanceof Error ? err.message : '创建账户失败');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-md px-6 py-16">
        <Link
          href="/"
          className="mb-8 inline-flex items-center text-sm text-zinc-500 transition-colors hover:text-zinc-900"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回首页
        </Link>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">创建新账户</CardTitle>
            <CardDescription>设置密码保护你的私钥</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="usePassword"
                checked={usePassword}
                onChange={(e) => setUsePassword(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
              />
              <Label htmlFor="usePassword" className="text-sm font-normal text-zinc-600">
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

            {!usePassword && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                <p className="text-sm text-amber-800">
                  不使用密码保护时，任何能访问此设备的人都可能获取你的私钥。请确保设备安全。
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                {error}
              </div>
            )}

            <Button onClick={handleCreate} disabled={isCreating} className="w-full" size="lg">
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  创建中...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  创建账户
                </>
              )}
            </Button>

            <p className="text-center text-sm text-zinc-500">
              已有账户？
              <Link
                href="/account/import"
                className="ml-1 text-zinc-900 underline-offset-4 hover:underline"
              >
                导入账户
              </Link>
            </p>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-zinc-500">
          创建账户后，请务必备份你的种子
          <br />
          种子是恢复账户的唯一方式
        </p>
      </div>
    </main>
  );
}
