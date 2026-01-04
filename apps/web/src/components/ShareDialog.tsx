'use client';

import QRCode from 'qrcode';
import { useState, useRef, useEffect } from 'react';

import { useWechatShare } from '../hooks/useWechatShare';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  boxSlug: string;
  boxUrl: string;
}

export default function ShareDialog({ isOpen, onClose, boxSlug, boxUrl }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isWechatBrowser, isReady: wechatReady, configureShare } = useWechatShare();

  // Generate QR code when dialog opens
  useState(() => {
    if (isOpen) {
      QRCode.toDataURL(boxUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      }).then(setQrDataUrl);
    }
  });

  // Configure WeChat share when ready
  useEffect(() => {
    if (isOpen && wechatReady) {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      configureShare({
        title: 'AskBox 匿名提问箱',
        desc: '向我匿名提问吧！安全加密，保护隐私',
        link: boxUrl,
        imgUrl: `${origin}/logo.png`,
      });
    }
  }, [isOpen, wechatReady, boxUrl, configureShare]);

  if (!isOpen) {
    return null;
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(boxUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'AskBox 匿名提问箱',
          text: `向我匿名提问吧！`,
          url: boxUrl,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    }
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) {
      return;
    }
    const link = document.createElement('a');
    link.download = `askbox-${boxSlug}-qr.png`;
    link.href = qrDataUrl;
    link.click();
  };

  const handleDownloadPoster = async () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    // Set canvas size
    canvas.width = 400;
    canvas.height = 500;

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 400, 500);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 400, 500);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('向我提问吧！', 200, 60);

    // Subtitle
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('匿名提问，安全加密', 200, 90);

    // QR Code background
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(100, 120, 200, 200, 12);
    ctx.fill();

    // Draw QR code
    if (qrDataUrl) {
      const qrImg = new Image();
      qrImg.onload = () => {
        ctx.drawImage(qrImg, 110, 130, 180, 180);

        // URL text
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px monospace';
        ctx.fillText(boxUrl, 200, 360);

        // Instructions
        ctx.font = '18px system-ui, sans-serif';
        ctx.fillText('扫码或访问链接', 200, 400);

        // Footer
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillText('Powered by AskBox', 200, 480);

        // Download
        const link = document.createElement('a');
        link.download = `askbox-${boxSlug}-poster.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      };
      qrImg.src = qrDataUrl;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">分享问题箱</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* QR Code */}
        <div className="mb-6 flex justify-center">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" className="h-48 w-48 rounded-lg shadow" />
          ) : (
            <div className="h-48 w-48 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
          )}
        </div>

        {/* URL */}
        <div className="mb-6">
          <div className="flex items-center gap-2 rounded-lg bg-gray-100 p-3 dark:bg-gray-700">
            <input
              type="text"
              value={boxUrl}
              readOnly
              className="flex-1 bg-transparent text-sm text-gray-600 outline-none dark:text-gray-300"
            />
            <button
              onClick={handleCopyLink}
              className="rounded-md bg-blue-500 px-3 py-1 text-sm text-white transition hover:bg-blue-600"
            >
              {copied ? '已复制' : '复制'}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          {/* WeChat share hint - only show in WeChat browser */}
          {isWechatBrowser && (
            <div className="col-span-2 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 01-.023-.156.49.49 0 01.201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.02-.407-.032zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.969-.982z" />
              </svg>
              <span className="text-sm">
                {wechatReady ? '点击右上角 ••• 即可分享到朋友圈或好友' : '微信分享加载中...'}
              </span>
            </div>
          )}

          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
            <button
              onClick={handleNativeShare}
              className="flex items-center justify-center gap-2 rounded-lg bg-green-500 p-3 text-white transition hover:bg-green-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
              分享
            </button>
          )}
          <button
            onClick={handleDownloadQR}
            className="flex items-center justify-center gap-2 rounded-lg bg-purple-500 p-3 text-white transition hover:bg-purple-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            下载二维码
          </button>
          <button
            onClick={handleDownloadPoster}
            className="col-span-2 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 p-3 text-white transition hover:opacity-90"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            下载分享海报
          </button>
        </div>

        {/* Hidden canvas for poster generation */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
