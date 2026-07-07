'use client';

/**
 * Local Engine Setup Guide — shown on customer dashboard.
 * Provides a step-by-step zero-config guide for local rendering.
 *
 * @module app/[locale]/dashboard/components/local-setup-guide
 */

import { useState } from 'react';
import { Terminal, Key, Copy, Check, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface Props {
  apiKey: string | null;
  locale: 'en' | 'vi';
}

export function LocalSetupGuide({ apiKey, locale }: Props) {
  const isVi = locale === 'vi';
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const command = 'curl -s https://platform.sophia.ai/install-m1.sh | bash';

  const copyToClipboard = async (text: string, setCopied: (val: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-border bg-muted/60 backdrop-blur p-5 text-muted-foreground">
      <div className="flex items-center gap-2 mb-4">
        <Terminal size={18} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">
          {isVi ? 'Hướng dẫn thiết lập Zero-Config (Engine cục bộ)' : 'Zero-Config Setup Guide (Local Engine)'}
        </h2>
      </div>

      <p className="text-xs text-muted-foreground mb-5">
        {isVi
          ? 'Chạy kết xuất video trực tiếp trên máy của bạn để có tốc độ nhanh hơn và không giới hạn dung lượng.'
          : 'Render videos locally on your own hardware for maximum performance and zero storage limits.'}
      </p>

      <div className="space-y-4">
        {/* Step 1: API Key */}
        <div className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground border border-border">
              1
            </span>
            <div className="w-[1px] flex-1 bg-muted my-1"></div>
          </div>
          <div className="flex-1 pb-2">
            <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Key size={12} className="text-primary" />
              {isVi ? 'Lấy API Key kết nối' : 'Get Connection API Key'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {isVi
                ? 'Dùng để xác thực trình render cục bộ của bạn với hệ thống Sophia.'
                : 'Used to authenticate your local renderer with the Sophia platform.'}
            </p>

            <div className="mt-2">
              {apiKey ? (
                <div className="flex items-center justify-between rounded-lg bg-background border border-border px-3 py-1.5 font-mono text-xs text-foreground max-w-md">
                  <span>{apiKey}</span>
                  <button
                    onClick={() => copyToClipboard(apiKey, setCopiedKey)}
                    className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
                    title={isVi ? 'Sao chép API Key' : 'Copy API Key'}
                  >
                    {copiedKey ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-yellow-900/30 bg-yellow-950/10 p-3 max-w-md">
                  <p className="text-xs text-yellow-500/90 leading-normal">
                    {isVi
                      ? 'Không tìm thấy API Key đang hoạt động. Bạn cần có API Key để kết nối engine cục bộ.'
                      : 'No active connection API key found. You need an API key to connect your local engine.'}
                  </p>
                  <Link
                    href={`/${locale}/dashboard/api-keys`}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/70 transition-colors"
                  >
                    {isVi ? 'Tạo API Key mới' : 'Generate API Key'}
                    <ExternalLink size={10} />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step 2: Run command */}
        <div className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground border border-border">
              2
            </span>
            <div className="w-[1px] flex-1 bg-muted my-1"></div>
          </div>
          <div className="flex-1 pb-2">
            <h3 className="text-xs font-semibold text-foreground">
              {isVi ? 'Chạy lệnh cài đặt' : 'Run Installation Command'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {isVi
                ? 'Sao chép và chạy lệnh bên dưới trong Terminal của máy Mac (hỗ trợ chip Apple Silicon M1/M2/M3).'
                : 'Copy and run the installer command in your Mac terminal (supports Apple Silicon M1/M2/M3).'}
            </p>

            <div className="mt-2 flex items-center justify-between rounded-lg bg-background border border-border px-3 py-2 font-mono text-xs text-foreground max-w-xl overflow-x-auto">
              <span className="whitespace-nowrap select-all">{command}</span>
              <button
                onClick={() => copyToClipboard(command, setCopiedCommand)}
                className="ml-4 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                title={isVi ? 'Sao chép lệnh' : 'Copy command'}
              >
                {copiedCommand ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              </button>
            </div>
          </div>
        </div>

        {/* Step 3: Run Engine */}
        <div className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground border border-border">
              3
            </span>
          </div>
          <div className="flex-1">
            <h3 className="text-xs font-semibold text-foreground">
              {isVi ? 'Khởi chạy và Render' : 'Start Engine & Render'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-normal">
              {isVi
                ? 'Nhập API key kết nối khi trình cài đặt yêu cầu hoặc cấu hình trong file .env. Engine sẽ tự động nhận diện và xử lý các tác vụ render của bạn.'
                : 'Input your connection API key when prompted by the installer, or configure it in the .env file. The engine will run in the background and auto-process your render jobs.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
