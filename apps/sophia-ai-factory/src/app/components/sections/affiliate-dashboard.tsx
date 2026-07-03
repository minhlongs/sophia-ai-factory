"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/seed/components/ui/card";
import { Badge } from "@/seed/components/ui/badge";
import { Button } from "@/seed/components/ui/button";
import { Input } from "@/seed/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/seed/components/ui/table";
import {
  Users,
  UserCheck,
  DollarSign,
  Clock,
  Copy,
  Check,
  ExternalLink,
  Gift,
  Wallet,
  Send,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  subtext?: string;
  icon: React.ElementType;
}

interface AffiliateOffer {
  name: string;
  commission: string;
  niche: string;
  conversionRate: string;
  channelIcons: string[];
}

interface ConversionRow {
  referrer: string;
  amount: string;
  commission: string;
  date: string;
  status: "paid" | "pending" | "cancelled";
}

// ─── KPI Card ─────────────────────────────────────────────────────

function KpiCard({ label, value, subtext, icon: Icon }: KpiCardProps) {
  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-400">{label}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
            {subtext && <p className="text-xs text-zinc-400">{subtext}</p>}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
            <Icon className="h-5 w-5 text-indigo-400" aria-hidden="true" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Referral Link Section ────────────────────────────────────────

function ReferralLinkSection() {
  const t = useTranslations("affiliate");
  const [copied, setCopied] = useState(false);
  const referralLink = "https://sophia.agencyos.network/ref/john-doe-2026";

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
          <Gift className="h-5 w-5 text-indigo-400" aria-hidden="true" />
          {t("referral_link_title") || "Referral Link"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              value={referralLink}
              readOnly
              className="border-zinc-700 bg-zinc-800 text-sm text-zinc-400"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            className="h-10 w-10 shrink-0 border-zinc-700 hover:bg-zinc-700/50 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            aria-label={copied ? t("copied") || "Copied" : t("copy_link") || "Copy link"}
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <Copy className="h-4 w-4 text-zinc-400" />
            )}
          </Button>
          <Button className="shrink-0 bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2">
            {t("share_link") || "Share"}
            <ExternalLink className="ml-1.5 h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          {t("referral_link_hint") || "Share this link to earn 20% commission on referrals"}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── USDT Wallet Section ──────────────────────────────────────────

function UsdtWalletSection() {
  const t = useTranslations("affiliate");
  const [walletCopied, setWalletCopied] = useState(false);
  const maskedAddress = "TR7...3F9K";

  const handleCopyWallet = () => {
    navigator.clipboard.writeText("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgj3F9K").then(() => {
      setWalletCopied(true);
      setTimeout(() => setWalletCopied(false), 2000);
    });
  };

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-white">
          <Wallet className="h-5 w-5 text-indigo-400" aria-hidden="true" />
          {t("usdt_wallet") || "USDT Wallet (TRC20)"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Balance */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-400">{t("balance") || "Balance"}</p>
          <p className="text-2xl font-bold text-white">$247.00</p>
        </div>

        {/* Address */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-zinc-400">
            {t("wallet_address") || "Wallet Address"}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-400">
              {maskedAddress}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyWallet}
              className="h-9 w-9 shrink-0 border-zinc-700 hover:bg-zinc-700/50 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              aria-label={walletCopied ? t("copied") || "Copied" : t("copy_address") || "Copy address"}
            >
              {walletCopied ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4 text-zinc-400" />
              )}
            </Button>
          </div>
        </div>

        {/* Withdraw Button */}
        <Button className="w-full bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2">
          <Send className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("withdraw") || "Withdraw"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Affiliate Offer Card ─────────────────────────────────────────

interface OfferCardProps {
  offer: AffiliateOffer;
}

function OfferCard({ offer }: OfferCardProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 transition-all hover:border-indigo-500/30">
      <div className="mb-2 flex items-start justify-between">
        <h3 className="font-medium text-white">{offer.name}</h3>
        <Badge variant="outline" className="border-indigo-500/30 text-xs text-indigo-400">
          {offer.niche}
        </Badge>
      </div>
      <div className="mb-3 flex items-center gap-2 text-sm text-zinc-400">
        <DollarSign className="h-4 w-4 text-emerald-400" aria-hidden="true" />
        <span className="font-semibold text-emerald-400">{offer.commission}</span>
        <span className="mx-1">&middot;</span>
        <TrendUp className="h-4 w-4" aria-hidden="true" />
        <span>{offer.conversionRate}</span>
      </div>
      <div className="flex items-center gap-1.5 text-zinc-400">
        {offer.channelIcons.map((icon, i) => (
          <span key={i} className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">
            {icon}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────

const affiliateOffers: AffiliateOffer[] = [
  {
    name: "Premium Video Package",
    commission: "20% recurring",
    niche: "video",
    conversionRate: "3.2% conv",
    channelIcons: ["YT", "TikTok"],
  },
  {
    name: "AI Script Generator",
    commission: "25% recurring",
    niche: "ai-tools",
    conversionRate: "4.1% conv",
    channelIcons: ["YT", "IG"],
  },
  {
    name: "Thumbnail Designer",
    commission: "15% recurring",
    niche: "design",
    conversionRate: "2.8% conv",
    channelIcons: ["FB", "IG"],
  },
  {
    name: "Voiceover Studio",
    commission: "20% recurring",
    niche: "audio",
    conversionRate: "5.0% conv",
    channelIcons: ["TT", "YT"],
  },
];

const recentConversions: ConversionRow[] = [
  { referrer: "Alex M.", amount: "$199", commission: "$39.80", date: "2026-07-03", status: "paid" },
  { referrer: "Sarah K.", amount: "$399", commission: "$79.80", date: "2026-07-02", status: "paid" },
  { referrer: "Tom H.", amount: "$199", commission: "$39.80", date: "2026-07-01", status: "pending" },
  { referrer: "Lisa W.", amount: "$799", commission: "$159.80", date: "2026-06-30", status: "pending" },
  { referrer: "James R.", amount: "$199", commission: "$39.80", date: "2026-06-29", status: "cancelled" },
];

const conversionStatusVariant = (status: ConversionRow["status"]): "basic" | "secondary" | "destructive" | "default" | "outline" | "premium" | "enterprise" => {
  switch (status) {
    case "paid": return "basic";
    case "pending": return "secondary";
    case "cancelled": return "destructive";
  }
};

// ─── Helpers ──────────────────────────────────────────────────────

// Local inline icon since lucide may not export TrendUp under that name
function TrendUp({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export function AffiliateDashboard() {
  const t = useTranslations("affiliate");

  return (
    <div className="space-y-6">
      {/* Page Heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-bold leading-tight text-white">
            {t("dashboard_title") || "Affiliate Dashboard"}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {t("dashboard_subtitle") || "Track your referrals, commissions, and payouts"}
          </p>
        </div>
        <Button className="bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2">
          <Users className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("refer_a_friend") || "Refer a Friend"}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t("total_referrals") || "Total Referrals"}
          value="47"
          subtext={t("total_referrals_sub") || "All time"}
          icon={Users}
        />
        <KpiCard
          label={t("active_referrals") || "Active"}
          value="32"
          subtext={t("active_referrals_sub") || "Converted this month"}
          icon={UserCheck}
        />
        <KpiCard
          label={t("commission_earned") || "Commission"}
          value="$3,847"
          subtext={t("commission_earned_sub") || "Total earned"}
          icon={DollarSign}
        />
        <KpiCard
          label={t("pending_commission") || "Pending"}
          value="$892"
          subtext={t("pending_commission_sub") || "Awaiting payout"}
          icon={Clock}
        />
      </div>

      {/* Referral Link + USDT Wallet */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ReferralLinkSection />
        <UsdtWalletSection />
      </div>

      {/* Affiliate Offers + Recent Conversions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Affiliate Offers (left 2/3) */}
        <div className="lg:col-span-2">
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-white">
                {t("affiliate_offers") || "Affiliate Offers"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {affiliateOffers.map((offer) => (
                  <OfferCard key={offer.name} offer={offer} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Conversions (right 1/3) */}
        <div>
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-white">
                {t("recent_conversions") || "Recent Conversions"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead scope="col" className="text-zinc-400">{t("referrer") || "Referrer"}</TableHead>
                    <TableHead scope="col" className="text-zinc-400">{t("commission_short") || "Comm."}</TableHead>
                    <TableHead scope="col" className="text-right text-zinc-400">{t("status") || "Status"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentConversions.map((row) => (
                    <TableRow key={row.referrer} className="border-zinc-800 hover:bg-zinc-800/50">
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-white">{row.referrer}</p>
                          <p className="text-xs text-zinc-400">{row.date}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-white">{row.commission}</p>
                        <p className="text-xs text-zinc-400">{row.amount}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={conversionStatusVariant(row.status)}
                          className="capitalize"
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
