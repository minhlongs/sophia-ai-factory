"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, LogIn, Wifi, Server } from "lucide-react";

function classifyError(error: Error): {
  icon: typeof AlertTriangle;
  title: string;
  description: string;
  action: "retry" | "login";
} {
  const msg = (error.message || "").toLowerCase();

  if (msg.includes("unauthorized") || msg.includes("auth")) {
    return {
      icon: LogIn,
      title: "Phiên đăng nhập hết hạn",
      description: "Vui lòng đăng nhập lại.",
      action: "login",
    };
  }

  if (msg.includes("fetch") || msg.includes("network") || msg.includes("timeout")) {
    return {
      icon: Wifi,
      title: "Lỗi kết nối",
      description: "Kiểm tra kết nối internet hoặc thử lại.",
      action: "retry",
    };
  }

  if (msg.includes("d1") || msg.includes("database")) {
    return {
      icon: Server,
      title: "Lỗi cơ sở dữ liệu",
      description: "Hệ thống đang bảo trì. Thử lại sau vài giây.",
      action: "retry",
    };
  }

  return {
    icon: AlertTriangle,
    title: "Đã xảy ra lỗi",
    description: "Thử lại hoặc quay về trang chủ.",
    action: "retry",
  };
}

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const classified = classifyError(error);
  const Icon = classified.icon;

  useEffect(() => {
    console.error("[Dashboard Error]", error.message, error.digest);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-center justify-center min-h-[50vh] gap-5">
      <div className="p-3 rounded-full bg-destructive/10">
        <Icon className="w-8 h-8 text-destructive" />
      </div>
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold text-foreground">{classified.title}</h2>
        <p className="text-sm text-muted-foreground">{classified.description}</p>
      </div>
      <div className="flex gap-3">
        {classified.action === "login" ? (
          <button
            onClick={() => (window.location.href = "/login")}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 text-sm"
          >
            <LogIn className="w-4 h-4" />
            Đăng nhập
          </button>
        ) : (
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Thử lại
          </button>
        )}
      </div>
    </div>
  );
}
