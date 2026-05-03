/**
 * Admin Promo Code Manager — /dashboard/admin/promo-codes
 * List, create, and manage promo codes.
 */

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/better-auth-session";
import { listAdminCodes } from "@/lib/promo/promo-repo";
import { PromoCodesClient } from "./promo-codes-client";

export const dynamic = "force-dynamic";

export default async function AdminPromoCodesPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/dashboard");

  const codes = await listAdminCodes({ limit: 100 }).catch(() => []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Promo Codes</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage discount and free trial codes for customer onboarding.
          </p>
        </div>
      </div>

      <PromoCodesClient initialCodes={codes} />
    </div>
  );
}
