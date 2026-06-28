import { FileText } from "lucide-react";
import { Campaign } from "@/seed/types";
import { ScriptOutput } from "@/land/services/types";

interface CampaignScriptViewProps {
  campaign: Campaign;
  t: (key: string) => string;
}

export function CampaignScriptView({ campaign, t }: CampaignScriptViewProps) {
  if (!campaign.script_content) return null;

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center text-foreground">
        <FileText className="w-5 h-5 mr-2 text-primary" aria-hidden="true" />
        {t('script')}
      </h3>
      <div className="prose prose-sm max-w-none bg-muted p-4 rounded-lg dark:prose-invert">
        {(campaign.script_content as unknown as ScriptOutput)?.scenes ? (
           <div className="space-y-4">
             {(campaign.script_content as unknown as ScriptOutput).scenes.map((scene, idx: number) => (
               <div key={idx} className="border-l-2 border-primary/50 pl-4">
                 <p className="font-medium text-foreground text-xs uppercase mb-1">{t('scene')} {idx + 1}</p>
                 <p className="text-muted-foreground mb-2">{scene.narration}</p>
                 <p className="text-xs text-muted-foreground italic">{t('visual')}: {scene.visual_description}</p>
               </div>
             ))}
           </div>
        ) : (
          <pre className="whitespace-pre-wrap text-xs text-foreground">
            {JSON.stringify(campaign.script_content, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
