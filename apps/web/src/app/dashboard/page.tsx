'use client';

import {
  ArrowRight,
  Inbox,
  Loader2,
  MessageSquare,
  Settings,
  ShieldAlert,
  Ticket,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">控制台</h1>
            <p className="mt-1 text-zinc-500">管理你的提问箱和问题</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/account">
              <Settings className="mr-2 h-4 w-4" />
              账户管理
            </Link>
          </Button>
        </header>

        <div className="grid gap-6 sm:grid-cols-2">
          <Card className="group transition-all hover:shadow-md">
            <CardHeader>
              <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 transition-colors group-hover:bg-zinc-900 group-hover:text-white">
                <Inbox className="h-6 w-6" />
              </div>
              <CardTitle>我的提问箱</CardTitle>
              <CardDescription>创建和管理你的提问箱</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/boxes">
                  管理提问箱
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="group transition-all hover:shadow-md">
            <CardHeader>
              <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 transition-colors group-hover:bg-zinc-900 group-hover:text-white">
                <MessageSquare className="h-6 w-6" />
              </div>
              <CardTitle>收到的问题</CardTitle>
              <CardDescription>查看和回答收到的问题</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/questions">
                  查看问题
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="group transition-all hover:shadow-md">
            <CardHeader>
              <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 transition-colors group-hover:bg-zinc-900 group-hover:text-white">
                <Ticket className="h-6 w-6" />
              </div>
              <CardTitle>我的回执</CardTitle>
              <CardDescription>查看你提过的问题的回答</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/receipts">
                  查看回执
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="group transition-all hover:shadow-md">
            <CardHeader>
              <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 transition-colors group-hover:bg-zinc-900 group-hover:text-white">
                <Settings className="h-6 w-6" />
              </div>
              <CardTitle>账户设置</CardTitle>
              <CardDescription>导出种子、修改密码等</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="secondary" className="w-full">
                <Link href="/account">
                  前往设置
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8 border-amber-200 bg-amber-50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-amber-800">
              <ShieldAlert className="h-5 w-5" />
              <CardTitle className="text-base">安全提示</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-1 text-sm text-amber-700">
              <li>• 请定期备份你的账户种子</li>
              <li>• 种子是恢复账户的唯一方式，请妥善保管</li>
              <li>• 不要将种子分享给任何人</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
