'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { getStoredAccount } from '@/lib/storage';

export default function Home() {
  const [hasAccount, setHasAccount] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAccount = async () => {
      const account = await getStoredAccount();
      setHasAccount(!!account);
    };
    checkAccount();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          AskBox
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          支持端到端加密的匿名提问箱
          <br />
          你的问题，只有你和箱主能看到
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {hasAccount === null ? (
            <div className="animate-pulse">
              <div className="h-12 w-32 bg-gray-200 rounded-lg"></div>
            </div>
          ) : hasAccount ? (
            <>
              <Link href="/dashboard" className="btn-primary text-lg px-8 py-3">
                进入控制台
              </Link>
              <Link href="/account" className="btn-secondary text-lg px-8 py-3">
                账户管理
              </Link>
            </>
          ) : (
            <>
              <Link href="/account/create" className="btn-primary text-lg px-8 py-3">
                创建账户
              </Link>
              <Link href="/account/import" className="btn-secondary text-lg px-8 py-3">
                导入账户
              </Link>
            </>
          )}
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="card">
            <div className="text-3xl mb-4">🔒</div>
            <h3 className="text-lg font-semibold mb-2">端到端加密</h3>
            <p className="text-gray-600 text-sm">
              问题在你的设备上加密，服务器无法看到内容
            </p>
          </div>
          <div className="card">
            <div className="text-3xl mb-4">👤</div>
            <h3 className="text-lg font-semibold mb-2">完全匿名</h3>
            <p className="text-gray-600 text-sm">
              无需注册，用回执取回私密回答
            </p>
          </div>
          <div className="card">
            <div className="text-3xl mb-4">🔑</div>
            <h3 className="text-lg font-semibold mb-2">自主掌控</h3>
            <p className="text-gray-600 text-sm">
              私钥保存在本地，可随时导出备份
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
