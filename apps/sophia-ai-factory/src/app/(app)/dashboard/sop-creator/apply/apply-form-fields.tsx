// i18n-namespace: sop.creator
import React from 'react';
import { Send } from 'lucide-react';

export function CreatorApplicationFormCard({ t }: { t: (key: string) => string }) {
  return (
    <div className="bg-card border rounded-xl p-6">
      <h3 className="text-lg font-semibold text-foreground mb-6 text-center">{t('apply.form.title')}</h3>
      <div className="space-y-4">
        <div>
          <label htmlFor="website" className="block text-sm font-medium text-foreground mb-2">
            {t('apply.form.website.label')}
          </label>
          <input type="url" id="website" name="website" className="input w-full" placeholder="https://your-channel.com" required />
          <p className="text-xs text-muted-foreground mt-1">{t('apply.form.website.hint')}</p>
        </div>

        <div>
          <label htmlFor="niche" className="block text-sm font-medium text-foreground mb-2">
            {t('apply.form.niche.label')}
          </label>
          <select id="niche" name="niche" className="input w-full" required>
            <option value="">{t('apply.form.niche.placeholder')}</option>
            <option value="tech">{t('apply.form.niche.options.tech')}</option>
            <option value="finance">{t('apply.form.niche.options.finance')}</option>
            <option value="lifestyle">{t('apply.form.niche.options.lifestyle')}</option>
            <option value="education">{t('apply.form.niche.options.education')}</option>
            <option value="gaming">{t('apply.form.niche.options.gaming')}</option>
            <option value="health">{t('apply.form.niche.options.health')}</option>
            <option value="business">{t('apply.form.niche.options.business')}</option>
            <option value="other">{t('apply.form.niche.options.other')}</option>
          </select>
        </div>

        <div>
          <label htmlFor="subscribers" className="block text-sm font-medium text-foreground mb-2">
            {t('apply.form.subscribers.label')}
          </label>
          <select id="subscribers" name="subscribers" className="input w-full" required>
            <option value="">{t('apply.form.subscribers.placeholder')}</option>
            <option value="0-1k">{t('apply.form.subscribers.options.0-1k')}</option>
            <option value="1k-10k">{t('apply.form.subscribers.options.1k-10k')}</option>
            <option value="10k-100k">{t('apply.form.subscribers.options.10k-100k')}</option>
            <option value="100k-500k">{t('apply.form.subscribers.options.100k-500k')}</option>
            <option value="500k+">{t('apply.form.subscribers.options.500k+')}</option>
          </select>
        </div>

        <div>
          <label htmlFor="monthlyViews" className="block text-sm font-medium text-foreground mb-2">
            {t('apply.form.monthlyViews.label')}
          </label>
          <select id="monthlyViews" name="monthlyViews" className="input w-full" required>
            <option value="">{t('apply.form.monthlyViews.placeholder')}</option>
            <option value="0-10k">{t('apply.form.monthlyViews.options.0-10k')}</option>
            <option value="10k-50k">{t('apply.form.monthlyViews.options.10k-50k')}</option>
            <option value="50k-200k">{t('apply.form.monthlyViews.options.50k-200k')}</option>
            <option value="200k-1m">{t('apply.form.monthlyViews.options.200k-1m')}</option>
            <option value="1m+">{t('apply.form.monthlyViews.options.1m+')}</option>
          </select>
        </div>

        <div>
          <label htmlFor="experience" className="block text-sm font-medium text-foreground mb-2">
            {t('apply.form.experience.label')}
          </label>
          <textarea id="experience" name="experience" rows={4} className="input w-full" placeholder={t('apply.form.experience.placeholder')} required />
          <p className="text-xs text-muted-foreground mt-1">{t('apply.form.experience.hint')}</p>
        </div>

        <div>
          <label htmlFor="whyJoin" className="block text-sm font-medium text-foreground mb-2">
            {t('apply.form.whyJoin.label')}
          </label>
          <textarea id="whyJoin" name="whyJoin" rows={4} className="input w-full" placeholder={t('apply.form.whyJoin.placeholder')} required />
          <p className="text-xs text-muted-foreground mt-1">{t('apply.form.whyJoin.hint')}</p>
        </div>

        <div>
          <label htmlFor="sampleContent" className="block text-sm font-medium text-foreground mb-2">
            {t('apply.form.sampleContent.label')}
          </label>
          <input type="url" id="sampleContent" name="sampleContent" className="input w-full" placeholder="https://youtube.com/watch?v=..." />
          <p className="text-xs text-muted-foreground mt-1">{t('apply.form.sampleContent.hint')}</p>
        </div>
      </div>

      <button type="submit" className="btn btn-primary w-full mt-6 py-3 text-lg">
        <Send className="w-5 h-5 mr-2" />
        {t('apply.form.submit')}
      </button>
    </div>
  );
}
