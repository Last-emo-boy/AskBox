'use client';

import { ArrowRight, Inbox, MessageSquare, Settings, ShieldAlert, Ticket } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Header } from '@/components/Header';
import { DashboardSkeleton } from '@/components/Skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
      <>
        <Header />
        <main className="bg-background min-h-screen">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-12">
            <DashboardSkeleton />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="bg-background min-h-screen">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-12">
          {/* Header - 隐藏在移动端因为有顶部导航 */}
          <header className="mb-6 sm:mb-10">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">控制台</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">管理你的提问箱和问题</p>
          </header>

          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
            <Card className="group transition-all hover:shadow-md">
              <CardHeader className="pb-3 sm:pb-6">
                <div className="bg-secondary text-secondary-foreground group-hover:bg-primary group-hover:text-primary-foreground mb-2 inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors sm:h-12 sm:w-12">
                  <Inbox className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <CardTitle className="text-lg sm:text-xl">我的提问箱</CardTitle>
                <CardDescription>创建和管理你的提问箱</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button asChild className="w-full">
                  <Link href="/boxes">
                    管理提问箱
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="group transition-all hover:shadow-md">
              <CardHeader className="pb-3 sm:pb-6">
                <div className="bg-secondary text-secondary-foreground group-hover:bg-primary group-hover:text-primary-foreground mb-2 inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors sm:h-12 sm:w-12">
                  <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <CardTitle className="text-lg sm:text-xl">收到的问题</CardTitle>
                <CardDescription>查看和回答收到的问题</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button asChild className="w-full">
                  <Link href="/questions">
                    查看问题
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="group transition-all hover:shadow-md">
              <CardHeader className="pb-3 sm:pb-6">
                <div className="bg-secondary text-secondary-foreground group-hover:bg-primary group-hover:text-primary-foreground mb-2 inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors sm:h-12 sm:w-12">
                  <Ticket className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <CardTitle className="text-lg sm:text-xl">我的回执</CardTitle>
                <CardDescription>查看你提过的问题的回答</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button asChild className="w-full">
                  <Link href="/receipts">
                    查看回执
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="group transition-all hover:shadow-md">
              <CardHeader className="pb-3 sm:pb-6">
                <div className="bg-secondary text-secondary-foreground group-hover:bg-primary group-hover:text-primary-foreground mb-2 inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors sm:h-12 sm:w-12">
                  <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <CardTitle className="text-lg sm:text-xl">账户设置</CardTitle>
                <CardDescription>导出种子、修改密码等</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button asChild variant="secondary" className="w-full">
                  <Link href="/account">
                    前往设置
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6 border-amber-200 bg-amber-50 sm:mt-8 dark:border-amber-900 dark:bg-amber-950">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <ShieldAlert className="h-5 w-5" />
                <CardTitle className="text-base">安全提示</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-300">
                <li>• 请定期备份你的账户种子</li>
                <li>• 种子是恢复账户的唯一方式，请妥善保管</li>
                <li>• 不要将种子分享给任何人</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
