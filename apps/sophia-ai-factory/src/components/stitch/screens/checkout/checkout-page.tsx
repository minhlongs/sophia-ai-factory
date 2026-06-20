'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { CreditCard, Lock, Check } from 'lucide-react';
import { Button, Card, CardHeader, CardContent, Input } from '@/components/stitch';

const plans = [
  { id: 'starter', nameKey: 'payment.plans.starter.name', price: 29, popular: false },
  { id: 'pro', nameKey: 'payment.plans.pro.name', price: 79, popular: true },
  { id: 'business', nameKey: 'payment.plans.business.name', price: 199, popular: false },
];

export default function CheckoutPage() {
  const t = useTranslations('stitch.checkout');
  const [selectedPlan, setSelectedPlan] = React.useState('pro');
  const [step, setStep] = React.useState<'payment' | 'success'>('payment');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Process payment via NOWPayments
    await new Promise(resolve => setTimeout(resolve, 2000));
    setStep('success');
  };

  const selectedPlanData = plans.find(p => p.id === selectedPlan);

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-md">
        <Card className="w-full max-w-[500px] text-center" padding="xl">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-lg">
            <Check className="w-8 h-8 text-emerald-600" />
          </div>
          <CardHeader className="!p-0">
            <h1 className="font-headline-xl text-headline-xl text-on-surface mb-sm">
              {t('success.title')}
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {t('success.subtitle', { plan: t(selectedPlanData?.nameKey || 'payment.plans.pro.name') })}
            </p>
          </CardHeader>
          <CardContent className="!p-0 mt-xl space-y-md">
            <Button fullWidth href="/dashboard">
              {t('success.dashboardLink')}
            </Button>
            <Button variant="outline" fullWidth href="/settings">
              {t('success.viewReceipt')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-md">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-xl">
          <h1 className="font-headline-xl text-headline-xl text-on-surface mb-sm">
            {t('payment.title')}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {t('payment.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-xl">
          {/* Plan Summary */}
          <div className="lg:col-span-1 space-y-md">
            <Card padding="lg">
              <h3 className="font-headline-sm text-headline-sm text-on-surface mb-md">{t('payment.yourPlan')}</h3>
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`
                    p-md rounded-xl mb-sm cursor-pointer border-2 transition-all
                    ${selectedPlan === plan.id
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent hover:bg-surface-container'}
                  `}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-label-md text-on-surface">{t(plan.nameKey)}</p>
                      <p className="font-headline-md text-primary">${plan.price}{t('payment.perMonth')}</p>
                    </div>
                    {selectedPlan === plan.id && (
                      <Check className="w-5 h-5 text-primary" />
                    )}
                  </div>
                </div>
              ))}
            </Card>

            <Card padding="lg">
              <h3 className="font-headline-sm text-headline-sm text-on-surface mb-md">{t('payment.orderSummary')}</h3>
              <div className="space-y-sm">
                <div className="flex justify-between font-body-sm">
                  <span className="text-on-surface-variant">{t('payment.monthlySubscription')}</span>
                  <span className="text-on-surface">${selectedPlanData?.price}</span>
                </div>
                <div className="flex justify-between font-body-sm">
                  <span className="text-on-surface-variant">{t('payment.taxes')}</span>
                  <span className="text-on-surface">$0.00</span>
                </div>
                <div className="border-t border-outline-variant pt-sm mt-sm">
                  <div className="flex justify-between font-headline-md">
                    <span className="text-on-surface">{t('payment.total')}</span>
                    <span className="text-primary">${selectedPlanData?.price}</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Payment Form */}
          <div className="lg:col-span-2">
            <Card padding="lg">
              <CardHeader>
                <h3 className="font-headline-sm text-headline-sm text-on-surface mb-sm">
                  {t('payment.detailsTitle')}
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {t('payment.securityMessage')}
                </p>
              </CardHeader>
              <CardContent>
                <form className="space-y-lg" onSubmit={handleSubmit}>
                  <div className="space-y-sm">
                    <label className="font-label-md text-label-md text-on-surface">
                      {t('payment.cardNumber')}
                    </label>
                    <div className="relative">
                      <Input placeholder="1234 5678 9012 3456" />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                        <div className="w-8 h-5 bg-blue-600 rounded text-white text-[8px] flex items-center justify-center font-bold">VISA</div>
                        <div className="w-8 h-5 bg-red-500 rounded text-white text-[8px] flex items-center justify-center font-bold">MC</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-lg">
                    <div className="space-y-sm">
                      <label className="font-label-md text-label-md text-on-surface">
                        {t('payment.expiryDate')}
                      </label>
                      <Input placeholder="MM/YY" />
                    </div>
                    <div className="space-y-sm">
                      <label className="font-label-md text-label-md text-on-surface">
                        {t('payment.cvc')}
                      </label>
                      <Input placeholder="123" />
                    </div>
                  </div>

                  <div className="space-y-sm">
                    <label className="font-label-md text-label-md text-on-surface">
                      {t('payment.cardholderName')}
                    </label>
                    <Input placeholder="John Doe" />
                  </div>

                  <div className="bg-surface-container-low rounded-xl p-md flex items-start gap-sm">
                    <Lock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-on-surface-variant">
                      {t('payment.securityMessage')}
                    </p>
                  </div>

                  <div className="flex items-center gap-sm pt-md border-t border-outline-variant">
                    <input
                      type="checkbox"
                      id="saveCard"
                      className="w-4 h-4 text-primary"
                    />
                    <label htmlFor="saveCard" className="font-body-sm text-on-surface-variant">
                      {t('payment.saveCard')}
                    </label>
                  </div>

                  <Button type="submit" fullWidth size="lg" className="h-12 mt-lg">
                    <CreditCard className="w-5 h-5 mr-2" />
                    {t('payment.button', { amount: selectedPlanData!.price })}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
