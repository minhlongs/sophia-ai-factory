/**
 * Admin Bulk Promo Generator — /[locale]/admin/promo-codes/bulk
 * Generates 1..1000 unique FREE100-XXXX codes via Phase 03 API.
 */

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { BulkFormClient } from "./bulk-form-client";

export const dynamic = "force-dynamic";

export default async function AdminPromoBulkPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/dashboard");
  return <BulkFormClient />;
}
