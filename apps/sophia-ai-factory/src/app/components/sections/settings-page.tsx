"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/seed/utils/cn";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/seed/components/ui/card";
import { Button } from "@/seed/components/ui/button";
import { Input } from "@/seed/components/ui/input";
import { Label } from "@/seed/components/ui/label";
import {
  User,
  Key,
  CreditCard,
  Bell,
  Users,
  Sun,
  Trash2,
  AlertTriangle,
  Save,
  Upload,
  Circle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────

interface SubNavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface ApiKeyRow {
  service: string;
  label: string;
  configured: boolean;
}

interface LocaleOption {
  code: string;
  label: string;
  nativeLabel: string;
  flag: string;
}

// ─── Sub-navigation ───────────────────────────────────────────────

const subNavItems: SubNavItem[] = [
  { id: "account", label: "Account", icon: User },
  { id: "api-keys", label: "API Keys", icon: Key },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "team", label: "Team", icon: Users },
  { id: "appearance", label: "Appearance", icon: Sun },
];

// ─── API Key Presets ──────────────────────────────────────────────

const apiKeyDefaults: ApiKeyRow[] = [
  { service: "elevenlabs", label: "ElevenLabs", configured: true },
  { service: "openrouter", label: "OpenRouter", configured: true },
  { service: "did", label: "D-ID", configured: false },
];

// ─── Locale Options ───────────────────────────────────────────────

const localeOptions: LocaleOption[] = [
  { code: "vi", label: "Vietnamese", nativeLabel: "Tieng Viet", flag: "VN" },
  { code: "en", label: "English", nativeLabel: "English", flag: "US" },
];

// ─── SubNav ───────────────────────────────────────────────────────

function SettingsSubNav({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="space-y-1" aria-label="Settings sections">
      {subNavItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
              active === item.id
                ? "bg-indigo-500/10 text-indigo-400"
                : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

// ─── Profile Section ──────────────────────────────────────────────

function ProfileSection() {
  const t = useTranslations("settings");
  const [name, setName] = useState("John Doe");
  const [email, setEmail] = useState("john@example.com");

  return (
    <div className="space-y-6">
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">
            {t("profile") || "Profile"}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {t("profile_description") || "Manage your personal information"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Avatar Upload */}
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/20 text-xl font-bold text-indigo-400">
              JD
            </div>
            <div>
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-700 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
              >
                <Upload className="mr-1.5 h-5 w-5" aria-hidden="true" />
                {t("upload_avatar") || "Upload Avatar"}
              </Button>
              <p className="mt-1 text-xs text-zinc-400">
                {t("avatar_hint") || "PNG, JPG. Max 2MB."}
              </p>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="settings-name" className="text-sm text-zinc-400">
              {t("name") || "Name"}
            </Label>
            <Input
              id="settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-zinc-700 bg-zinc-800 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="settings-email" className="text-sm text-zinc-400">
              {t("email") || "Email"}
            </Label>
            <Input
              id="settings-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-zinc-700 bg-zinc-800 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
            />
          </div>

          {/* Save */}
          <Button className="bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900">
            <Save className="mr-2 h-5 w-5" aria-hidden="true" />
            {t("save_changes") || "Save Changes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── API Keys Section ─────────────────────────────────────────────

function ApiKeysSection() {
  const t = useTranslations("settings");

  return (
    <div className="space-y-6">
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">
            {t("api_keys") || "API Keys"}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {t("api_keys_description") || "Manage your third-party API credentials"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {apiKeyDefaults.map((keyRow) => (
            <div key={keyRow.service} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor={`api-key-${keyRow.service}`}
                  className="text-sm text-zinc-400"
                >
                  {keyRow.label}
                </Label>
                <div className="flex items-center gap-1.5">
                  <Circle
                    className={cn(
                      "h-2.5 w-2.5 fill-current",
                      keyRow.configured ? "text-emerald-400" : "text-red-400"
                    )}
                    aria-hidden="true"
                  />
                  <span
                    className={cn(
                      "text-xs",
                      keyRow.configured ? "text-emerald-400" : "text-red-400"
                    )}
                  >
                    {keyRow.configured
                      ? t("configured") || "Configured"
                      : t("not_configured") || "Not configured"}
                  </span>
                </div>
              </div>
              <Input
                id={`api-key-${keyRow.service}`}
                type="password"
                placeholder={
                  keyRow.configured
                    ? "************"
                    : `${t("enter_key") || "Enter"} ${keyRow.label} ${t("api_key") || "API key"}`
                }
                className="border-zinc-700 bg-zinc-800 text-white placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
              />
            </div>
          ))}

          <Button className="bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900">
            <Save className="mr-2 h-5 w-5" aria-hidden="true" />
            {t("save_api_keys") || "Save API Keys"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Danger Zone ──────────────────────────────────────────────────

function DangerZoneSection() {
  const t = useTranslations("settings");

  return (
    <Card className="border-red-500/30 bg-zinc-900">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
          <CardTitle className="text-lg font-semibold text-red-400">
            {t("danger_zone") || "Danger Zone"}
          </CardTitle>
        </div>
        <CardDescription className="text-zinc-400">
          {t("danger_zone_description") || "Irreversible actions. Proceed with caution."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">
              {t("delete_account") || "Delete Account"}
            </p>
            <p className="text-xs text-zinc-400">
              {t("delete_account_hint") || "Permanently remove your account and all data"}
            </p>
          </div>
          <Button
            variant="outline"
            className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
          >
            <Trash2 className="mr-1.5 h-5 w-5" aria-hidden="true" />
            {t("delete") || "Delete"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Locale Selector ──────────────────────────────────────────────

function LocaleSelector() {
  const t = useTranslations("settings");
  const [selectedLocale, setSelectedLocale] = useState("vi");

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-white">
          {t("language") || "Language"}
        </CardTitle>
        <CardDescription className="text-zinc-400">
          {t("language_description") || "Choose your preferred language"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {localeOptions.map((locale) => (
            <button
              key={locale.code}
              onClick={() => setSelectedLocale(locale.code)}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-4 text-left transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
                selectedLocale === locale.code
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold text-white">
                {locale.flag}
              </span>
              <div>
                <p className="text-sm font-medium text-white">{locale.label}</p>
                <p className="text-xs text-zinc-400">{locale.nativeLabel}</p>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export function SettingsPage() {
  const t = useTranslations("settings");
  const [activeSection, setActiveSection] = useState("account");

  const renderSection = () => {
    switch (activeSection) {
      case "account":
        return (
          <div className="space-y-6">
            <ProfileSection />
            <LocaleSelector />
            <DangerZoneSection />
          </div>
        );
      case "api-keys":
        return <ApiKeysSection />;
      default:
        return (
          <Card className="border-zinc-800 bg-zinc-900">
            <CardContent className="flex items-center justify-center py-16">
              <p className="text-sm text-zinc-400">
                {t("coming_soon") || "Coming soon..."}
              </p>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-sm text-zinc-400">
        <ol className="flex items-center gap-2">
          <li>
            <span className="text-white">{t("settings_title") || "Settings"}</span>
          </li>
        </ol>
      </nav>

      {/* Page Heading */}
      <div>
        <h1 className="text-[28px] font-bold leading-tight text-white">
          {t("settings_title") || "Settings"}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {t("settings_subtitle") || "Manage your account, API keys, and preferences"}
        </p>
      </div>

      {/* Content Layout */}
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        {/* Left Sub-nav */}
        <SettingsSubNav active={activeSection} onSelect={setActiveSection} />

        {/* Right Content Panel */}
        <div className="min-w-0">{renderSection()}</div>
      </div>
    </div>
  );
}
