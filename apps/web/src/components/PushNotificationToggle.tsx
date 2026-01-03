'use client';

import { Bell, BellOff, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

import { api } from '@/lib/api';

interface PushNotificationToggleProps {
  className?: string;
}

/**
 * Convert a base64 URL-safe string to a Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushNotificationToggle({ className }: PushNotificationToggleProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkSupport();
  }, []);

  async function checkSupport() {
    // Check if push notifications are supported
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setIsSupported(false);
      setIsLoading(false);
      return;
    }

    setIsSupported(true);

    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('[Push] Service worker registered:', registration.scope);

      // Check existing subscription
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (err) {
      console.error('[Push] Error checking support:', err);
      setError('无法初始化推送通知');
    } finally {
      setIsLoading(false);
    }
  }

  async function subscribe() {
    setIsLoading(true);
    setError(null);

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('需要通知权限才能接收推送');
        setIsLoading(false);
        return;
      }

      // Get VAPID public key from server
      const { vapidPublicKey } = await api.getVapidPublicKey();
      if (!vapidPublicKey) {
        throw new Error('服务器未配置推送通知');
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      // Send subscription to server
      await api.subscribePush(subscription.toJSON() as PushSubscriptionJSON);

      setIsSubscribed(true);
      console.log('[Push] Subscribed successfully');
    } catch (err) {
      console.error('[Push] Error subscribing:', err);
      setError(err instanceof Error ? err.message : '订阅推送通知失败');
    } finally {
      setIsLoading(false);
    }
  }

  async function unsubscribe() {
    setIsLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Notify server
        await api.unsubscribePush(subscription.endpoint);

        // Unsubscribe locally
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      console.log('[Push] Unsubscribed successfully');
    } catch (err) {
      console.error('[Push] Error unsubscribing:', err);
      setError(err instanceof Error ? err.message : '取消订阅失败');
    } finally {
      setIsLoading(false);
    }
  }

  if (!isSupported) {
    return null; // Don't render anything if not supported
  }

  return (
    <div className={className}>
      <button
        onClick={isSubscribed ? unsubscribe : subscribe}
        disabled={isLoading}
        className={`
          flex items-center gap-2 rounded-lg px-3 py-2 transition-colors
          ${
            isSubscribed
              ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
          }
          disabled:cursor-not-allowed disabled:opacity-50
        `}
        title={isSubscribed ? '点击关闭推送通知' : '点击开启推送通知'}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isSubscribed ? (
          <Bell className="h-4 w-4" />
        ) : (
          <BellOff className="h-4 w-4" />
        )}
        <span className="text-sm">
          {isLoading ? '处理中...' : isSubscribed ? '通知已开启' : '开启通知'}
        </span>
      </button>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
