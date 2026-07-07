import { Link } from "@/navigation";
import { ArrowRight, Lock } from "lucide-react";
import { Button } from "@/seed/components/ui/button";
import { Card, CardContent } from "@/seed/components/ui/card";
import { TIER_CONFIGS } from "@/seed/config/tiers";
import { Tier } from "@/seed/types";

interface UpgradeBannerProps {
  currentTier: Tier;
  requiredTier: Tier;
  featureName: string;
  className?: string;
}

export function UpgradeBanner({
  currentTier,
  requiredTier,
  featureName,
  className = ""
}: UpgradeBannerProps) {
  // Parent component handles tier-gating; this renders when upgrade is needed

  const requiredName = TIER_CONFIGS[requiredTier].name;
  const upgradeLabel = requiredTier === "ENTERPRISE" ? "Contact Sales" : `Upgrade to ${requiredName}`;
  const upgradeLink = requiredTier === "ENTERPRISE" ? "mailto:support@mekongmind.com" : "/pricing";

  return (
    <Card className={`bg-gradient-to-r from-primary to-primary dark:from-primary/20 dark:to-primary/20 border-primary/30 dark:border-primary/30 ${className}`}>
      <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-background rounded-full shadow-sm">
            <Lock className="w-6 h-6 text-primary dark:text-primary" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              Unlock {featureName}
              <span className="text-xs bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary px-2 py-0.5 rounded-full font-medium">
                {TIER_CONFIGS[requiredTier].name}
              </span>
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Your current {TIER_CONFIGS[currentTier].name} plan doesn&apos;t support this feature.
              Upgrade to access {featureName} and more.
            </p>
          </div>
        </div>

        <Button asChild className="whitespace-nowrap bg-primary/10 hover:bg-primary/10 text-white">
          <Link href={upgradeLink}>
            {upgradeLabel} <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
