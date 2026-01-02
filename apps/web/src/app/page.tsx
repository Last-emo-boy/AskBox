'use client';

import { ArrowRight, Lock, Shield, Key } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
    <main className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-50 via-white to-zinc-100" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8882_1px,transparent_1px),linear-gradient(to_bottom,#8882_1px,transparent_1px)] bg-[size:14px_24px]" />

        <div className="relative mx-auto max-w-5xl px-6 py-24 sm:py-32 lg:py-40">
          <div className="text-center">
            <div className="mb-8 inline-flex items-center rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm text-zinc-600 shadow-sm">
              <Lock className="mr-2 h-3.5 w-3.5" />
              端到端加密 · 完全匿名
            </div>

            <h1 className="text-5xl font-bold tracking-tight text-zinc-900 sm:text-6xl lg:text-7xl">
              AskBox
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
              支持端到端加密的匿名提问箱。
              <br className="hidden sm:inline" />
              你的问题，只有你和箱主能看到。
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              {hasAccount === null ? (
                <div className="h-11 w-40 animate-pulse rounded-lg bg-zinc-200" />
              ) : hasAccount ? (
                <>
                  <Button asChild size="lg" className="w-full sm:w-auto">
                    <Link href="/dashboard">
                      进入控制台
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                    <Link href="/account">账户管理</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild size="lg" className="w-full sm:w-auto">
                    <Link href="/account/create">
                      创建账户
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                    <Link href="/account/import">导入账户</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="mx-auto max-w-5xl px-6 py-24">
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="group transition-all hover:shadow-md">
            <CardContent className="pt-6">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900 transition-colors group-hover:bg-zinc-900 group-hover:text-white">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">端到端加密</h3>
              <p className="text-sm text-zinc-500">
                问题在你的设备上加密，服务器无法看到任何内容，保护你的隐私。
              </p>
            </CardContent>
          </Card>

          <Card className="group transition-all hover:shadow-md">
            <CardContent className="pt-6">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900 transition-colors group-hover:bg-zinc-900 group-hover:text-white">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">完全匿名</h3>
              <p className="text-sm text-zinc-500">
                无需注册账号，使用回执即可取回私密回答，保护提问者身份。
              </p>
            </CardContent>
          </Card>

          <Card className="group transition-all hover:shadow-md">
            <CardContent className="pt-6">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900 transition-colors group-hover:bg-zinc-900 group-hover:text-white">
                <Key className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">自主掌控</h3>
              <p className="text-sm text-zinc-500">
                私钥保存在本地设备，可随时导出备份，你的数据你做主。
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <p className="text-center text-sm text-zinc-500">AskBox — 安全、私密、匿名的提问箱</p>
        </div>
      </footer>
    </main>
  );
}
