'use client';

import { ArrowRight, Lock, Shield, Key } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { ThemeToggle } from '@/components/ThemeToggle';
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
    <main className="bg-background min-h-screen">
      {/* Theme Toggle */}
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="from-muted/50 via-background to-muted/30 absolute inset-0 bg-gradient-to-br" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--muted))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--muted))_1px,transparent_1px)] bg-[size:14px_24px] opacity-50" />

        <div className="relative mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24 lg:py-32">
          <div className="text-center">
            <div className="border-border bg-card text-muted-foreground mb-6 inline-flex items-center rounded-full border px-3 py-1 text-xs shadow-sm sm:mb-8 sm:px-4 sm:py-1.5 sm:text-sm">
              <Lock className="mr-1.5 h-3 w-3 sm:mr-2 sm:h-3.5 sm:w-3.5" />
              端到端加密 · 完全匿名
            </div>

            <h1 className="text-foreground text-4xl font-bold tracking-tight sm:text-5xl lg:text-7xl">
              AskBox
            </h1>
            <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-base leading-7 sm:mt-6 sm:text-lg sm:leading-8">
              支持端到端加密的匿名提问箱。
              <br className="hidden sm:inline" />
              你的问题，只有你和箱主能看到。
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:mt-10 sm:flex-row sm:gap-4">
              {hasAccount === null ? (
                <div className="bg-muted h-11 w-40 animate-pulse rounded-lg" />
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
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
          <Card className="dark:hover:shadow-primary/5 group transition-all hover:shadow-md">
            <CardContent className="p-5 pt-5 sm:pt-6">
              <div className="bg-muted text-foreground group-hover:bg-primary group-hover:text-primary-foreground mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors sm:mb-4 sm:h-12 sm:w-12">
                <Lock className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <h3 className="mb-2 text-base font-semibold sm:text-lg">端到端加密</h3>
              <p className="text-muted-foreground text-xs sm:text-sm">
                问题在你的设备上加密，服务器无法看到任何内容，保护你的隐私。
              </p>
            </CardContent>
          </Card>

          <Card className="dark:hover:shadow-primary/5 group transition-all hover:shadow-md">
            <CardContent className="p-5 pt-5 sm:pt-6">
              <div className="bg-muted text-foreground group-hover:bg-primary group-hover:text-primary-foreground mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors sm:mb-4 sm:h-12 sm:w-12">
                <Shield className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <h3 className="mb-2 text-base font-semibold sm:text-lg">完全匿名</h3>
              <p className="text-muted-foreground text-xs sm:text-sm">
                无需注册账号，使用回执即可取回私密回答，保护提问者身份。
              </p>
            </CardContent>
          </Card>

          <Card className="dark:hover:shadow-primary/5 group transition-all hover:shadow-md">
            <CardContent className="p-5 pt-5 sm:pt-6">
              <div className="bg-muted text-foreground group-hover:bg-primary group-hover:text-primary-foreground mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors sm:mb-4 sm:h-12 sm:w-12">
                <Key className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <h3 className="mb-2 text-base font-semibold sm:text-lg">自主掌控</h3>
              <p className="text-muted-foreground text-xs sm:text-sm">
                私钥保存在本地设备，可随时导出备份，你的数据你做主。
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-border bg-muted/30 border-t">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          <p className="text-muted-foreground text-center text-xs sm:text-sm">
            AskBox — 安全、私密、匿名的提问箱
          </p>
        </div>
      </footer>
    </main>
  );
}
