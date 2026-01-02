'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getStoredAccount } from '@/lib/storage';

export default function DashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const account = await getStoredAccount();
      if (!account) {
        router.push('/');
        return;
      }
      setIsLoading(false);
    };
    checkAuth();
  }, [router]);

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
          <h1 className="text-3xl font-bold">控制台</h1>
          <Link href="/account" className="btn-secondary">
            账户管理
          </Link>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">📦 我的提问箱</h2>
            <p className="text-gray-600 mb-4">创建和管理你的提问箱</p>
            <Link href="/boxes" className="btn-primary inline-block">
              管理提问箱
            </Link>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold mb-4">📬 收到的问题</h2>
            <p className="text-gray-600 mb-4">查看和回答收到的问题</p>
            <Link href="/questions" className="btn-primary inline-block">
              查看问题
            </Link>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold mb-4">🎫 我的回执</h2>
            <p className="text-gray-600 mb-4">查看你提过的问题的回答</p>
            <Link href="/receipts" className="btn-primary inline-block">
              查看回执
            </Link>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold mb-4">⚙️ 设置</h2>
            <p className="text-gray-600 mb-4">导出种子、修改密码等</p>
            <Link href="/account" className="btn-secondary inline-block">
              前往设置
            </Link>
          </div>
        </div>

        <div className="mt-8 card bg-primary-50 border-primary-200">
          <h3 className="font-semibold text-primary-800 mb-2">🔐 安全提示</h3>
          <ul className="text-sm text-primary-700 space-y-1">
            <li>• 请定期备份你的账户种子</li>
            <li>• 种子是恢复账户的唯一方式，请妥善保管</li>
            <li>• 不要将种子分享给任何人</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
