import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { CampaignTemplate } from "@/lib/templates/campaign-templates";
import { UpgradeBanner } from "@/components/UpgradeBanner";
import { AffiliateProgram, Tier } from "@/types";
import { FormEvent } from "react";
import { useTranslations } from 'next-intl';

interface CampaignFormProps {
  selectedTemplate: CampaignTemplate;
  formData: {
    title: string;
    topic: string;
    audience: string;
  };
  setFormData: (data: { title: string; topic: string; audience: string }) => void;
  selectedPlatforms: string[];
  setSelectedPlatforms: React.Dispatch<React.SetStateAction<string[]>>;
  onSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  loading: boolean;
  error: string | null;
  fieldErrors?: Record<string, string>;
  upgradeRequired: { required: boolean; tier: Tier };
  onChangeTemplate: () => void;
  /** Available affiliate programs to select from */
  affiliatePrograms?: AffiliateProgram[];
  /** Currently selected offer ID */
  selectedOfferId?: string;
  setSelectedOfferId?: (id: string) => void;
}

export function CampaignForm({
  selectedTemplate,
  formData,
  setFormData,
  selectedPlatforms,
  setSelectedPlatforms,
  onSubmit,
  loading,
  error,
  fieldErrors = {},
  upgradeRequired,
  onChangeTemplate,
  affiliatePrograms = [],
  selectedOfferId = '',
  setSelectedOfferId,
}: CampaignFormProps) {
  const t = useTranslations('campaign.customization');
  const tActions = useTranslations('campaign.actions');

  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6 bg-card p-6 rounded-xl border border-border">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">{t('title')}</h3>
      </div>

      <div className="space-y-2">
        <label htmlFor="title" className="block text-sm font-medium text-foreground">
          {t('campaign_title')}
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder={selectedTemplate.defaults.title}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-background text-foreground ${
            fieldErrors.title ? "border-destructive" : "border-input"
          }`}
        />
        {fieldErrors.title && (
          <p className="text-xs text-destructive">{fieldErrors.title}</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="topic" className="block text-sm font-medium text-foreground">
          {t('video_topic')}
        </label>
        <input
          id="topic"
          name="topic"
          type="text"
          required
          value={formData.topic}
          onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
          placeholder={selectedTemplate.defaults.title}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-background text-foreground ${
            fieldErrors.topic ? "border-destructive" : "border-input"
          }`}
        />
        {fieldErrors.topic ? (
          <p className="text-xs text-destructive">{fieldErrors.topic}</p>
        ) : (
          <p className="text-xs text-muted-foreground">{t('video_topic_hint')}</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="audience" className="block text-sm font-medium text-foreground">
          {t('target_audience')}
        </label>
        <input
          id="audience"
          name="audience"
          type="text"
          required
          value={formData.audience}
          onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
          placeholder={selectedTemplate.defaults.audience}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-background text-foreground ${
            fieldErrors.audience ? "border-destructive" : "border-input"
          }`}
        />
        {fieldErrors.audience ? (
          <p className="text-xs text-destructive">{fieldErrors.audience}</p>
        ) : (
          <p className="text-xs text-muted-foreground">{t('target_audience_hint')}</p>
        )}
      </div>

      {affiliatePrograms.length > 0 && (
        <div className="space-y-2">
          <label htmlFor="offer_id" className="block text-sm font-medium text-foreground">
            Affiliate Offer
          </label>
          <select
            id="offer_id"
            name="offer_id"
            value={selectedOfferId}
            onChange={(e) => setSelectedOfferId?.(e.target.value)}
            required
            className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-background text-foreground"
          >
            <option value="" disabled>Select an affiliate offer...</option>
            {affiliatePrograms.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name} — {program.commission}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            A CTA for this offer will be included in your video.
          </p>
          {/* Hidden field for server action */}
          <input type="hidden" name="offer_id" value={selectedOfferId} />
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          {t('target_platforms')}
        </label>
        <div className="flex gap-4">
          {['youtube', 'tiktok', 'instagram'].map((platform) => (
            <label key={platform} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedPlatforms.includes(platform)}
                onChange={() => handlePlatformToggle(platform)}
                className="w-4 h-4 text-primary rounded border-input focus:ring-primary"
              />
              <span className="capitalize text-foreground">{platform}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {t('platforms_hint')}
        </p>
      </div>

      {/* Template Info Display */}
      <div className="bg-muted p-4 rounded-lg">
        <h4 className="text-sm font-medium text-foreground mb-2">{t('template_settings')}</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">{t('tone')}:</span>
            <span className="ml-2 font-medium text-foreground">{selectedTemplate.defaults.tone}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('duration')}:</span>
            <span className="ml-2 font-medium text-foreground">{selectedTemplate.defaults.suggestedDuration}s</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="space-y-4">
          <div role="alert" className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
            {error}
          </div>

          {upgradeRequired.required && (
            <UpgradeBanner
              currentTier="BASIC" // Default assumption, or pass via props
              requiredTier={upgradeRequired.tier}
              featureName="this feature"
            />
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-center pt-4 gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={onChangeTemplate}
          className="w-full sm:w-auto"
        >
          {tActions('change_template')}
        </Button>

        <Button
          type="submit"
          disabled={loading || (affiliatePrograms.length > 0 && !selectedOfferId)}
          className="w-full sm:w-auto min-w-[150px]"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {tActions('creating')}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              {tActions('create_campaign')}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
