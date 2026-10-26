import React from 'react';
import { getTranslations } from 'next-intl/server';
import { ResetPasswordFormView } from '@/components/stitch/screens/auth/reset-password-form-view';

export default async function ResetPasswordPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'resetPassword' });

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FC] dark:bg-[#090A10] text-[#0B0F19] dark:text-slate-100 p-6 antialiased"
      data-testid="reset-password-page"
    >
      <div className="w-full max-w-[440px] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#11131F] p-8 shadow-xl space-y-6">
        <div className="text-center space-y-1.5">
          <h1 className="text-2xl font-black tracking-tight text-foreground dark:text-white">
            {t('request_title')}
          </h1>
          <p className="text-xs text-muted-foreground">
            {t('request_subtitle')}
          </p>
        </div>
        <ResetPasswordFormView />
      </div>
    </main>
  );
}
