"use client";

import { useEffect } from "react";
import * as Sentry from '@sentry/nextjs';
import { Button } from "@/seed/components/ui/button";
import { AlertTriangle, RefreshCw, Home, Wifi, LogIn, Server } from "lucide-react";

function classifyError(error: Error): {
  icon: typeof AlertTriangle;
  title: string;
  description: string;
  action: string;
} {
  const msg = (error.message || "").toLowerCase();

  if (msg.includes("unauthorized") || msg.includes("auth") || msg.includes("login")) {
    return {
      icon: LogIn,
      title: "Phiên đăng nhập hết hạn",
      description: "Vui lòng đăng nhập lại để tiếp tục sử dụng.",
      action: "login",
    };
  }

  if (msg.includes("fetch") || msg.includes("network") || msg.includes("timeout")) {
    return {
      icon: Wifi,
      title: "Lỗi kết nối",
      description: "Kiểm tra kết nối internet hoặc thử lại sau vài giây.",
      action: "retry",
    };
  }

  if (msg.includes("d1") || msg.includes("database") || msg.includes("500")) {
    return {
      icon: Server,
      title: "Lỗi hệ thống",
      description: "Hệ thống đang gặp sự cố tạm thời. Vui lòng thử lại sau.",
      action: "retry",
    };
  }

  return {
    icon: AlertTriangle,
    title: "Đã xảy ra lỗi",
    description: "Xin lỗi vì sự bất tiện. Vui lòng thử lại hoặc quay về trang chủ.",
    action: "retry",
  };
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const classified = classifyError(error);
  const Icon = classified.icon;

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-center justify-center min-h-screen p-4 space-y-6 text-center">
      <div className="p-4 rounded-full bg-destructive/10">
        <Icon className="w-10 h-10 text-destructive" />
      </div>
      <div className="space-y-2 w-full max-w-md">
        <h1 className="text-2xl font-bold text-foreground">
          {classified.title}
        </h1>
        <p className="text-muted-foreground">
          {classified.description}
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        {classified.action === "login" ? (
          <Button
            onClick={() => (window.location.href = "/login")}
            className="flex items-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            Đăng nhập
          </Button>
        ) : (
          <Button
            onClick={() => reset()}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Thử lại
          </Button>
        )}
        <Button
          onClick={() => (window.location.href = "/")}
          variant="ghost"
          className="flex items-center gap-2"
        >
          <Home className="w-4 h-4" />
          Về trang chủ
        </Button>
      </div>
    </div>
  );
}
