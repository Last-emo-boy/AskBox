'use client';

import { useCallback, useEffect, useState } from 'react';

declare global {
  interface Window {
    wx?: WechatJSSDK;
  }
}

interface WechatJSSDK {
  config: (options: WxConfigOptions) => void;
  ready: (callback: () => void) => void;
  error: (callback: (res: { errMsg: string }) => void) => void;
  updateAppMessageShareData: (options: WxShareOptions) => void;
  updateTimelineShareData: (options: WxTimelineShareOptions) => void;
  checkJsApi: (options: { jsApiList: string[]; success: (res: unknown) => void }) => void;
}

interface WxConfigOptions {
  debug?: boolean;
  appId: string;
  timestamp: number;
  nonceStr: string;
  signature: string;
  jsApiList: string[];
}

interface WxShareOptions {
  title: string;
  desc: string;
  link: string;
  imgUrl: string;
  success?: () => void;
  fail?: (res: { errMsg: string }) => void;
}

interface WxTimelineShareOptions {
  title: string;
  link: string;
  imgUrl: string;
  success?: () => void;
  fail?: (res: { errMsg: string }) => void;
}

interface WechatShareConfig {
  title: string;
  desc: string;
  link: string;
  imgUrl: string;
}

interface UseWechatShareResult {
  isWechatBrowser: boolean;
  isReady: boolean;
  isEnabled: boolean;
  error: string | null;
  configureShare: (config: WechatShareConfig) => void;
}

const WECHAT_SDK_URL = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js';
const WECHAT_SDK_URL_BACKUP = 'https://res2.wx.qq.com/open/js/jweixin-1.6.0.js';

// Check if we're in WeChat browser
function isWechatBrowser(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const ua = window.navigator.userAgent.toLowerCase();
  return ua.includes('micromessenger');
}

// Load WeChat JS-SDK script
function loadWechatSDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.wx) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = WECHAT_SDK_URL;
    script.async = true;

    script.onload = () => resolve();
    script.onerror = () => {
      // Try backup URL
      script.src = WECHAT_SDK_URL_BACKUP;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load WeChat SDK'));
    };

    document.head.appendChild(script);
  });
}

// Get signature from backend
async function getSignature(
  url: string
): Promise<{ appId: string; timestamp: number; nonceStr: string; signature: string }> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const response = await fetch(`${apiUrl}/v1/wechat/signature`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get signature');
  }

  return response.json();
}

// Check if WeChat sharing is enabled
async function checkWechatStatus(): Promise<boolean> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const response = await fetch(`${apiUrl}/v1/wechat/status`);
    if (!response.ok) {
      return false;
    }
    const data = await response.json();
    return data.enabled;
  } catch {
    return false;
  }
}

export function useWechatShare(): UseWechatShareResult {
  const [isReady, setIsReady] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInWechat] = useState(() => isWechatBrowser());

  useEffect(() => {
    if (!isInWechat) {
      return;
    }

    let mounted = true;

    async function init() {
      try {
        // Check if WeChat sharing is enabled on backend
        const enabled = await checkWechatStatus();
        if (!mounted) {
          return;
        }

        if (!enabled) {
          setIsEnabled(false);
          return;
        }

        setIsEnabled(true);

        // Load SDK
        await loadWechatSDK();
        if (!mounted) {
          return;
        }

        // Get signature
        const currentUrl = window.location.href.split('#')[0] as string;
        const signatureData = await getSignature(currentUrl);
        if (!mounted) {
          return;
        }

        // Configure WeChat SDK
        window.wx?.config({
          debug: process.env.NODE_ENV === 'development',
          appId: signatureData.appId,
          timestamp: signatureData.timestamp,
          nonceStr: signatureData.nonceStr,
          signature: signatureData.signature,
          jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData', 'checkJsApi'],
        });

        window.wx?.ready(() => {
          if (mounted) {
            setIsReady(true);
          }
        });

        window.wx?.error((res) => {
          if (mounted) {
            setError(res.errMsg);
            console.error('WeChat SDK error:', res.errMsg);
          }
        });
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          console.error('WeChat init error:', err);
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [isInWechat]);

  const configureShare = useCallback(
    (config: WechatShareConfig) => {
      if (!isReady || !window.wx) {
        return;
      }

      // Configure share to friends
      window.wx.updateAppMessageShareData({
        title: config.title,
        desc: config.desc,
        link: config.link,
        imgUrl: config.imgUrl,
        success: () => {
          console.log('WeChat share to friend configured');
        },
      });

      // Configure share to timeline
      window.wx.updateTimelineShareData({
        title: config.title,
        link: config.link,
        imgUrl: config.imgUrl,
        success: () => {
          console.log('WeChat share to timeline configured');
        },
      });
    },
    [isReady]
  );

  return {
    isWechatBrowser: isInWechat,
    isReady,
    isEnabled,
    error,
    configureShare,
  };
}
