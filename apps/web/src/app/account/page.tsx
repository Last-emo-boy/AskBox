'use client';

import {
  initCrypto,
  decryptSeedWithPassword,
  toBase64Url,
} from '@askbox/crypto';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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
    if (!account) {return;}
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

  const handleCopySeed = () => {
    if (seed) {
      navigator.clipboard.writeText(seed);
      alert('种子已复制到剪贴板');
    }
  };

  if (isLoading || !account) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">账户管理</h1>
          <Link href="/dashboard" className="btn-secondary">
            返回控制台
          </Link>
        </header>

        <div className="space-y-6">
          {/* 账户信息 */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">账户信息</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-500">签名公钥</label>
                <p className="font-mono text-sm bg-gray-50 p-2 rounded break-all">
                  {account.pub_sign_key}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">加密公钥</label>
                <p className="font-mono text-sm bg-gray-50 p-2 rounded break-all">
                  {account.pub_enc_key}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">创建时间</label>
                <p className="text-gray-700">
                  {new Date(account.created_at).toLocaleString()}
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500">密码保护</label>
                <p className="text-gray-700">
                  {account.encrypted_seed ? '✅ 已启用' : '❌ 未启用'}
                </p>
              </div>
            </div>
          </div>

          {/* 导出种子 */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">导出种子</h2>
            <p className="text-sm text-gray-600 mb-4">
              种子是恢复账户的唯一方式，请妥善保管。
            </p>

            {!showSeed ? (
              <div className="space-y-3">
                {account.encrypted_seed && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      输入密码以显示种子
                    </label>
                    <input
                      type="password"
                      className="input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="输入你的密码"
                    />
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <button onClick={handleShowSeed} className="btn-primary">
                  显示种子
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 mb-2 font-medium">
                    ⚠️ 请安全保存以下种子，不要分享给任何人：
                  </p>
                  <p className="font-mono text-sm bg-white p-3 rounded border break-all">
                    {seed}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCopySeed} className="btn-secondary">
                    复制种子
                  </button>
                  <button
                    onClick={() => {
                      setShowSeed(false);
                      setSeed(null);
                      setPassword('');
                    }}
                    className="btn-secondary"
                  >
                    隐藏种子
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 危险区域 */}
          <div className="card border-red-200">
            <h2 className="text-xl font-semibold text-red-600 mb-4">危险区域</h2>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                删除本地账户
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-red-600">
                  确定要删除本地账户吗？删除后，如果没有备份种子，将无法恢复。
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    确认删除
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="btn-secondary"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
