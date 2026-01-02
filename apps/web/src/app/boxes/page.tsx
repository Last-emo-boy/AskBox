'use client';

import {
  initCrypto,
  deriveAccountKeys,
  decryptSeedWithPassword,
  signChallenge,
  fromBase64Url,
  toBase64Url,
} from '@askbox/crypto';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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

      // Request challenge
      const challenge = await api.requestChallenge(toBase64Url(keys.signKeyPair.publicKey));

      // Sign challenge
      const signature = signChallenge(fromBase64Url(challenge.nonce), keys.signKeyPair.privateKey);

      // Verify
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
      // If unauthorized, need to login
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
      // Ensure logged in
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

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-primary-600 h-12 w-12 animate-spin rounded-full border-b-2"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">我的提问箱</h1>
          <Link href="/dashboard" className="btn-secondary">
            返回控制台
          </Link>
        </header>

        {needPassword && account?.encrypted_seed && (
          <div className="card mb-6">
            <h2 className="mb-4 text-lg font-semibold">请输入密码以继续</h2>
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
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
        )}

        {!needPassword && (
          <>
            {/* 创建新提问箱 */}
            <div className="card mb-6">
              <h2 className="mb-4 text-lg font-semibold">创建新提问箱</h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  className="input flex-1"
                  value={newSlug}
                  onChange={(e) =>
                    setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                  }
                  placeholder="自定义链接（可选，如 my-box）"
                />
                <button onClick={handleCreateBox} disabled={isCreating} className="btn-primary">
                  {isCreating ? '创建中...' : '创建'}
                </button>
              </div>
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </div>

            {/* 提问箱列表 */}
            <div className="space-y-4">
              {boxes.length === 0 ? (
                <div className="card py-12 text-center text-gray-500">
                  <p>还没有提问箱，创建一个吧！</p>
                </div>
              ) : (
                boxes.map((box) => (
                  <div key={box.box_id} className="card">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">{box.slug}</h3>
                        <p className="text-sm text-gray-500">
                          创建于 {new Date(box.created_at).toLocaleDateString()}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          分享链接: {window.location.origin}/box/{box.slug}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/box/${box.slug}`} className="btn-secondary text-sm">
                          预览
                        </Link>
                        <Link
                          href={`/questions?box_id=${box.box_id}`}
                          className="btn-primary text-sm"
                        >
                          查看问题
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
