import React from "react";
import { ArrowRight, Check, Rocket, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/navigation";

export interface FinishStepProps {
  saveError: string | null;
  saveFailed?: boolean;
  onRetry?: () => void;
}

export function FinishStep({
  saveError,
  saveFailed,
  onRetry,
}: FinishStepProps) {
  const t = useTranslations("setupWizard.finish");
  const tActions = useTranslations("setupWizard.actions");

  return (
    <div className="flex flex-col items-center justify-center text-center py-8">
      <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
        <Check className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-2xl font-semibold text-foreground mb-2">
        {t("subtitle")}
      </h2>
      <p className="text-muted-foreground mb-6 max-w-sm">
        {saveFailed ? t("errorOccurred") : t("readyToUse")}
      </p>

      {saveFailed ? (
        <div className="w-full max-w-xs space-y-3">
          <p className="text-sm text-destructive mb-2">{saveError}</p>
          <button
            onClick={onRetry}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors text-sm font-medium"
          >
            <Rocket className="w-4 h-4" />
            {tActions("launch")}
          </button>
        </div>
      ) : (
        <div className="w-full max-w-xs space-y-3">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium shadow-sm"
          >
            <Rocket className="w-4 h-4" />
            {t("launchBtn")}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/dashboard/challenges"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg border border-border text-foreground hover:bg-muted transition-colors text-sm font-medium"
          >
            <Trophy className="w-4 h-4" />
            {t("continueToChallenges")}
          </Link>
        </div>
      )}
    </div>
  );
}
