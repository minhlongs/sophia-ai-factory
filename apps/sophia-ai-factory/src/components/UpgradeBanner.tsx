import Link from "next/link";
import { Sparkles, ArrowRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tier } from "@/types";

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
  // Don't show if user already has required tier (simple check)
  // In practice, the parent component might handle this, but good to have a safety check logic if needed.
  // However, tier hierarchy checking is better done with a helper.
  // For now, we assume this component is rendered WHEN the user needs to upgrade.

  const isEnterprise = requiredTier === "ENTERPRISE";
  const upgradeLabel = isEnterprise ? "Contact Sales" : "Upgrade to Premium";
  const upgradeLink = isEnterprise ? "/contact" : "/pricing"; // or a billing portal link

  return (
    <Card className={`bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 ${className}`}>
      <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white rounded-full shadow-sm">
            <Lock className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              Unlock {featureName}
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                {requiredTier}
              </span>
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Your current {currentTier} plan doesn't support this feature.
              Upgrade to access {featureName} and more.
            </p>
          </div>
        </div>

        <Button asChild className="whitespace-nowrap bg-blue-600 hover:bg-blue-700">
          <Link href={upgradeLink}>
            {upgradeLabel} <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
