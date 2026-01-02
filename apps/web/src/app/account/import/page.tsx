'use client';

import {
  initCrypto,
  deriveAccountKeys,
  encryptSeedWithPassword,
  fromBase64Url,
  toBase64Url,
} from '@askbox/crypto';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

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
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="card">
          <h1 className="text-2xl font-bold text-center mb-6">导入账户</h1>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                输入种子
              </label>
              <textarea
                className="input min-h-[100px] font-mono text-sm"
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                placeholder="粘贴你的种子（base64url 格式）"
              />
            </div>

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

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={isImporting}
              className="btn-primary w-full"
            >
              {isImporting ? '导入中...' : '导入账户'}
            </button>

            <p className="text-center text-sm text-gray-500">
              还没有账户？
              <Link href="/account/create" className="text-primary-600 hover:underline ml-1">
                创建新账户
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
