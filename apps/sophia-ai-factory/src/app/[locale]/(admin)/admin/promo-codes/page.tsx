/**
 * Admin Promo Code Manager — /dashboard/admin/promo-codes
 * List, create, and manage promo codes.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { Layers } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { listAdminCodes } from "@/land/promo/promo-repo";
import { PromoCodesClient } from "./promo-codes-client";

export const dynamic = "force-dynamic";

export default async function AdminPromoCodesPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/dashboard");

  const [t, codes] = await Promise.all([
    getTranslations("admin.promoCodes"),
    listAdminCodes({ limit: 100 }).catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
          <p className="text-sm text-zinc-400 mt-1">{t("subtitle")}</p>
        </div>
        <Link
          href="/admin/promo-codes/bulk"
          data-testid="bulk-generate-link"
          className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-medium rounded-md transition"
        >
          <Layers className="w-4 h-4" />
          {t("bulk.bulkButton")}
        </Link>
      </div>

      <PromoCodesClient initialCodes={codes} />
    </div>
  );
}
