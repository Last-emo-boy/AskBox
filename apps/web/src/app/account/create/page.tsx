'use client';

import {
  initCrypto,
  generateSeed,
  deriveAccountKeys,
  encryptSeedWithPassword,
  toBase64Url,
} from '@askbox/crypto';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

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
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="card">
          <h1 className="text-2xl font-bold text-center mb-6">创建新账户</h1>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="usePassword"
                checked={usePassword}
                onChange={(e) => setUsePassword(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="usePassword" className="text-sm text-gray-600">
                使用密码保护种子（强烈推荐）
              </label>
            </div>

            {usePassword && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    设置密码
                  </label>
                  <input
                    type="password"
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="至少 8 个字符"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    确认密码
                  </label>
                  <input
                    type="password"
                    className="input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入密码"
                  />
                </div>
              </>
            )}

            {!usePassword && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
                ⚠️ 不使用密码保护时，任何能访问此设备的人都可能获取你的私钥。请确保设备安全。
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="btn-primary w-full"
            >
              {isCreating ? '创建中...' : '创建账户'}
            </button>

            <p className="text-center text-sm text-gray-500">
              已有账户？
              <Link href="/account/import" className="text-primary-600 hover:underline ml-1">
                导入账户
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>创建账户后，请务必备份你的种子</p>
          <p>种子是恢复账户的唯一方式</p>
        </div>
      </div>
    </main>
  );
}
