import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { CampaignTemplate } from "@/lib/templates/campaign-templates";
import { UpgradeBanner } from "@/components/UpgradeBanner";
import { Tier } from "@/types";
import { FormEvent } from "react";

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
  upgradeRequired: { required: boolean; tier: Tier };
  onChangeTemplate: () => void;
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
  upgradeRequired,
  onChangeTemplate
}: CampaignFormProps) {

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
        <h3 className="text-lg font-semibold text-foreground mb-4">Customize Your Campaign</h3>
      </div>

      <div className="space-y-2">
        <label htmlFor="title" className="block text-sm font-medium text-foreground">
          Campaign Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder={selectedTemplate.defaults.title}
          className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-background text-foreground"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="topic" className="block text-sm font-medium text-foreground">
          Video Topic
        </label>
        <input
          id="topic"
          name="topic"
          type="text"
          required
          value={formData.topic}
          onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
          placeholder={selectedTemplate.defaults.title}
          className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-background text-foreground"
        />
        <p className="text-xs text-muted-foreground">What should this video be about?</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="audience" className="block text-sm font-medium text-foreground">
          Target Audience
        </label>
        <input
          id="audience"
          name="audience"
          type="text"
          required
          value={formData.audience}
          onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
          placeholder={selectedTemplate.defaults.audience}
          className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-background text-foreground"
        />
        <p className="text-xs text-muted-foreground">Who is this video for?</p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Target Platforms
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
          Select platforms to publish to. Multiple platforms require Premium plan.
        </p>
      </div>

      {/* Template Info Display */}
      <div className="bg-muted p-4 rounded-lg">
        <h4 className="text-sm font-medium text-foreground mb-2">Template Settings</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Tone:</span>
            <span className="ml-2 font-medium text-foreground">{selectedTemplate.defaults.tone}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Duration:</span>
            <span className="ml-2 font-medium text-foreground">{selectedTemplate.defaults.suggestedDuration}s</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="space-y-4">
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
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
          Change Template
        </Button>

        <Button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto min-w-[150px]"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Create Campaign
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
