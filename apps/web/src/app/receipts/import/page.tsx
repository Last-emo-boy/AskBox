'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

import { saveReceipt, getAllReceipts } from '@/lib/storage';

import type { StoredReceipt } from '@askbox/shared-types';

function ImportContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'duplicate'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function importReceipt() {
      const data = searchParams.get('data');

      if (!data) {
        setStatus('error');
        setMessage('缺少回执数据');
        return;
      }

      try {
        // Decode base64url
        const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
        const padding = '='.repeat((4 - (base64.length % 4)) % 4);
        const decoded = atob(base64 + padding);
        const receipt = JSON.parse(decoded);

        // Validate receipt format
        if (!receipt.v || !receipt.q || !receipt.t || !receipt.s) {
          throw new Error('Invalid receipt format');
        }

        // Check for duplicates
        const existing = await getAllReceipts();
        const duplicate = existing.find((r: StoredReceipt) => r.question_id === receipt.q);

        if (duplicate) {
          setStatus('duplicate');
          setMessage('此回执已存在');
          return;
        }

        // Save receipt
        await saveReceipt({
          question_id: receipt.q,
          box_slug: receipt.b || 'unknown',
          asker_token: receipt.t,
          receipt_seed: receipt.s,
          created_at: new Date().toISOString(),
        });

        setStatus('success');
        setMessage('回执导入成功！');
      } catch {
        setStatus('error');
        setMessage('回执数据无效');
      }
    }

    importReceipt();
  }, [searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="card text-center">
          {status === 'loading' && (
            <div className="space-y-4">
              <div className="border-primary-600 mx-auto h-12 w-12 animate-spin rounded-full border-b-2"></div>
              <p className="text-gray-600">正在导入回执...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <div className="mb-4 text-5xl text-green-500">✅</div>
              <h1 className="text-xl font-bold text-gray-900">{message}</h1>
              <p className="text-sm text-gray-600">你可以在「我的回执」页面查看此回执</p>
              <div className="flex justify-center gap-3">
                <Link href="/receipts" className="btn-primary">
                  查看我的回执
                </Link>
              </div>
            </div>
          )}

          {status === 'duplicate' && (
            <div className="space-y-4">
              <div className="mb-4 text-5xl text-yellow-500">⚠️</div>
              <h1 className="text-xl font-bold text-gray-900">{message}</h1>
              <p className="text-sm text-gray-600">这个回执已经保存在你的设备上了</p>
              <div className="flex justify-center gap-3">
                <Link href="/receipts" className="btn-primary">
                  查看我的回执
                </Link>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <div className="mb-4 text-5xl text-red-500">❌</div>
              <h1 className="text-xl font-bold text-gray-900">导入失败</h1>
              <p className="text-sm text-gray-600">{message}</p>
              <div className="flex justify-center gap-3">
                <Link href="/" className="btn-secondary">
                  返回首页
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ReceiptImportPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center p-8">
          <div className="border-primary-600 h-12 w-12 animate-spin rounded-full border-b-2"></div>
        </main>
      }
    >
      <ImportContent />
    </Suspense>
  );
}
