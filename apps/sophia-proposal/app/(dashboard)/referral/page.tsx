import { ReferralDashboard } from '@/components/referral/referral-dashboard';

export const metadata = {
  title: 'Referral Program — Sophia AI Factory',
  description: 'Earn MCU credits by referring agencies to Sophia AI Factory.',
};

export default function ReferralPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Referral Program</h1>
        <p className="text-gray-600 mt-1">
          Refer agencies to Sophia AI Factory and earn 20% commission as MCU credits
          for their first 3 months.
        </p>
      </div>
      <ReferralDashboard />
    </div>
  );
}
