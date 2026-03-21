'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function BillingSuccessPage() {
  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check for subscription status
    const checkSubscription = async () => {
      try {
        const res = await fetch('/api/billing/subscription');
        if (res.ok) {
          setSuccess(true);
        }
      } catch (error) {
        console.error('Verification error:', error);
      } finally {
        setVerifying(false);
      }
    };

    checkSubscription();
  }, []);

  if (verifying) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Verifying your subscription...</h1>
        <p className="text-gray-600">Please wait while we confirm your payment.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto text-center py-12">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="material-symbols-outlined text-3xl text-green-600">check_circle</span>
      </div>

      {success ? (
        <>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
          <p className="text-gray-600 mb-6">
            Thank you for your subscription. Your account has been upgraded.
          </p>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">What's Next?</h2>
            <ul className="text-left space-y-2 text-gray-600">
              <li className="flex items-center">
                <span className="material-symbols-outlined text-green-600 mr-2">check</span>
                Your MCU balance has been credited
              </li>
              <li className="flex items-center">
                <span className="material-symbols-outlined text-green-600 mr-2">check</span>
                You can now generate AI proposals
              </li>
              <li className="flex items-center">
                <span className="material-symbols-outlined text-green-600 mr-2">check</span>
                Track your usage in the dashboard
              </li>
            </ul>
          </div>
          <div className="flex gap-4 justify-center">
            <Link
              href="/billing"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              View Billing Dashboard
            </Link>
            <Link
              href="/proposals/new"
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
            >
              Create Your First Proposal
            </Link>
          </div>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome!</h1>
          <p className="text-gray-600 mb-6">
            Start exploring our platform and create your first proposal.
          </p>
          <Link
            href="/proposals/new"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Create Your First Proposal
          </Link>
        </>
      )}
    </div>
  );
}
