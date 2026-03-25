import { ReferralDashboard } from '@/components/dashboard/referral-dashboard';

export const metadata = {
  title: 'Referrals — Sophia AI',
  description: 'Manage your referral codes and track earnings',
};

export default function ReferralsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Referrals</h1>
        <p className="text-gray-500 mt-1">
          Earn 20% revenue share for 12 months on every customer you refer.
        </p>
      </div>
      <ReferralDashboard />
    </div>
  );
}
