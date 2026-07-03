"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/navigation";
import { cn } from "@/seed/utils/cn";
import { Bell, Search, Globe, ChevronDown, LogOut, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/seed/components/ui/dropdown-menu";

interface DashboardHeaderProps {
  userName?: string;
  userEmail?: string;
  notificationCount?: number;
}

export function DashboardHeader({
  userName = "User",
  userEmail = "user@sophia.app",
  notificationCount = 3,
}: DashboardHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (searchOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [searchOpen]);

  const handleLocaleChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-30 flex flex-col gap-3 border-b border-zinc-800 bg-zinc-900 px-4 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-0">
      {/* Search */}
      <div className="relative w-full sm:w-60">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
        <input
          ref={searchRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search..."
          className={cn(
            "w-full rounded-lg border border-zinc-700 bg-zinc-950 py-2 pl-10 pr-3",
            "text-sm text-white placeholder-zinc-500",
            "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50",
            "focus-visible:ring-2 focus-visible:ring-indigo-500",
            "transition-colors"
          )}
          aria-label="Search"
        />
        <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400 md:flex">
          <span>⌘</span>K
        </kbd>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4 self-end sm:self-auto">
        {/* Notifications */}
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
          aria-label={`Notifications${notificationCount > 0 ? `, ${notificationCount} unread` : ""}`}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {notificationCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {notificationCount > 99 ? "99+" : notificationCount}
            </span>
          )}
        </button>

        {/* Locale Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
              aria-label="Switch Language"
            >
              <Globe className="h-5 w-5" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-50 min-w-[120px] rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-lg">
            <DropdownMenuItem
              onClick={() => handleLocaleChange("en")}
              className={cn(
                "cursor-pointer rounded-md px-3 py-2 text-sm transition-colors",
                locale === "en" ? "bg-indigo-500/10 text-indigo-400" : "text-zinc-400 hover:bg-white/5 hover:text-white"
              )}
            >
              English
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleLocaleChange("vi")}
              className={cn(
                "cursor-pointer rounded-md px-3 py-2 text-sm transition-colors",
                locale === "vi" ? "bg-indigo-500/10 text-indigo-400" : "text-zinc-400 hover:bg-white/5 hover:text-white"
              )}
            >
              Tiếng Việt
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Avatar Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg p-1.5 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
              aria-label="User menu"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white">
                {userInitials}
              </div>
              <ChevronDown className="hidden h-4 w-4 md:block" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-50 min-w-[200px] rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-lg">
            <div className="border-b border-zinc-700 px-3 py-2">
              <p className="text-sm font-medium text-white">{userName}</p>
              <p className="text-xs text-zinc-400">{userEmail}</p>
            </div>
            <DropdownMenuItem
              onClick={() => router.push("/dashboard/settings")}
              className="cursor-pointer rounded-md px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="mx-2 border-zinc-700" />
            <DropdownMenuItem
              onClick={() => {
                // Logout logic
              }}
              className="cursor-pointer rounded-md px-3 py-2 text-sm text-red-400 transition-colors hover:text-red-300 hover:bg-red-500/10"
            >
              <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
