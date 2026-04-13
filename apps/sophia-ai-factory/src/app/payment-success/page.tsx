import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payment Successful — Sophia AI Factory",
  description: "Your payment has been received. Setting up your account.",
};

interface PaymentSuccessPageProps {
  searchParams: Promise<{ tier?: string; order_id?: string }>;
}

export default async function PaymentSuccessPage({
  searchParams,
}: PaymentSuccessPageProps) {
  const params = await searchParams;
  const tier = params.tier ?? "BASIC";
  const orderId = params.order_id ?? "";

  const tierNames: Record<string, string> = {
    BASIC: "Starter ($199/mo)",
    PREMIUM: "Growth ($399/mo)",
    ENTERPRISE: "Premium ($799/mo)",
    MASTER: "Master ($4,999/mo)",
  };

  const tierName = tierNames[tier] ?? tier;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-950 to-slate-900 p-4">
      <div className="w-full max-w-md rounded-2xl border border-emerald-500/20 bg-slate-900/80 p-8 text-center shadow-2xl">
        <div className="mb-4 text-5xl">&#10003;</div>
        <h1 className="mb-2 text-2xl font-bold text-white">
          Payment Received!
        </h1>
        <p className="mb-6 text-slate-400">
          Your <span className="text-emerald-400 font-semibold">{tierName}</span> plan
          is being activated.
        </p>

        <div className="mb-6 rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-left text-sm text-slate-300">
          <p className="mb-2">
            <strong>What happens next:</strong>
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Payment confirmation (1-5 minutes for crypto)</li>
            <li>Your account tier is automatically upgraded</li>
            <li>Configure your API keys in Settings</li>
            <li>Start creating AI content!</li>
          </ol>
          {orderId && (
            <p className="mt-3 text-xs text-slate-500">
              Order: {orderId}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <a
            href="/dashboard/settings"
            className="inline-block rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white transition hover:bg-emerald-500"
          >
            Go to Settings
          </a>
          <a
            href="/dashboard"
            className="inline-block rounded-lg border border-slate-600 px-6 py-3 font-medium text-slate-300 transition hover:border-slate-400"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
