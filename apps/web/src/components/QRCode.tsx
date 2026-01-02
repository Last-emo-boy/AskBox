'use client';

import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';

interface QRCodeDisplayProps {
  data: string;
  size?: number;
  title?: string;
}

export function QRCodeDisplay({ data, size = 200, title }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (canvasRef.current && data) {
      QRCode.toCanvas(canvasRef.current, data, {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      }).catch((err) => {
        setError(err.message);
      });
    }
  }, [data, size]);

  const handleDownload = () => {
    if (!canvasRef.current) {return;}
    
    const link = document.createElement('a');
    link.download = `askbox-receipt-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  if (error) {
    return (
      <div className="text-red-600 text-sm">
        生成二维码失败: {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {title && (
        <p className="text-sm text-gray-600 font-medium">{title}</p>
      )}
      <div className="bg-white p-3 rounded-lg shadow-sm border">
        <canvas ref={canvasRef} />
      </div>
      <button
        onClick={handleDownload}
        className="text-sm text-primary-600 hover:underline"
      >
        下载二维码图片
      </button>
    </div>
  );
}

interface ReceiptQRCodeProps {
  receiptData: {
    question_id: string;
    asker_token: string;
    receipt_seed: string;
  };
  size?: number;
}

export function ReceiptQRCode({ receiptData, size = 200 }: ReceiptQRCodeProps) {
  // Create a compact receipt data format
  const data = JSON.stringify({
    v: 1, // version
    q: receiptData.question_id,
    t: receiptData.asker_token,
    s: receiptData.receipt_seed,
  });

  // Encode as base64url for QR code
  const encoded = btoa(data)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // Create a URL that can be used to import the receipt
  const receiptUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/receipts/import?data=${encoded}`;

  return (
    <div className="space-y-4">
      <QRCodeDisplay 
        data={receiptUrl} 
        size={size}
        title="扫码保存回执"
      />
      <div className="text-xs text-gray-500 text-center max-w-[200px] mx-auto">
        用手机扫描二维码或截图保存，可在其他设备导入回执
      </div>
    </div>
  );
}
