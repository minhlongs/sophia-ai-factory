/**
 * Inngest cron function: Auto-Discover Affiliates
 *
 * Runs daily at 8 AM UTC. Scans affiliate programs, scores them
 * against configured niches, stores high-scoring results in Supabase,
 * and sends a Telegram notification summary.
 */

import { inngest } from "@/lib/inngest/client";
import { getAllPrograms, getCategories } from "@/lib/affiliates";
import {
  scoreAffiliates,
  type AffiliateScore,
} from "@/lib/discovery/affiliate-ai-scorer";
import { sendMessage as sendTelegramMessage } from "@/tree/telegram/handlers/utils";
import { createServerClient } from '@/seed/db/client';

/** Default niches to scan when no user-configured niches exist */
const DEFAULT_NICHES = [
  "saas productivity workflow",
  "marketing automation",
  "ai tools artificial intelligence",
  "ecommerce online store",
];

export const autoDiscoverAffiliates = inngest.createFunction(
  {
    id: "auto-discover-affiliates",
    name: "Auto-Discover Affiliates",
  },
  { cron: "0 8 * * *" },
  async ({ step }) => {
    // Step 1: Fetch affiliate categories and programs
    const programs = await step.run("fetch-programs", async () => {
      const allPrograms = getAllPrograms();
      const categories = getCategories();
      return { programs: allPrograms, categories };
    });

    // Step 2: Score programs across all niches
    const scoredResults = await step.run("score-affiliates", async () => {
      const allScores: Array<AffiliateScore & { niche: string }> = [];

      for (const niche of DEFAULT_NICHES) {
        const scores = scoreAffiliates(programs.programs, niche);
        const recommended = scores.filter((s) => s.recommended);

        for (const score of recommended) {
          allScores.push({ ...score, niche });
        }
      }

      // Deduplicate by programId, keeping highest score
      const bestScores = new Map<
        string,
        AffiliateScore & { niche: string }
      >();

      for (const score of allScores) {
        const existing = bestScores.get(score.programId);
        if (!existing || score.relevanceScore > existing.relevanceScore) {
          bestScores.set(score.programId, score);
        }
      }

      return Array.from(bestScores.values()).sort(
        (a, b) => b.relevanceScore - a.relevanceScore
      );
    });

    // Step 3: Store high-score results in Supabase
    const stored = await step.run("store-results", async () => {
      if (scoredResults.length === 0) {
        return { count: 0, newCount: 0 };
      }

      const db = createServerClient();
      let newDiscoveries = 0;

      // Check which programs already exist in affiliate_products
      const programIds = scoredResults.map((s) => s.programId);
      const { data: existing } = await db
        .from("affiliate_products")
        .select("external_id")
        .in("external_id", programIds);

      // Cast to expected shape to avoid Supabase generic inference issues
      type ExistingRow = { external_id: string };
      const existingRows = (existing ?? []) as ExistingRow[];
      const existingIds = new Set(
        existingRows.map((row) => row.external_id)
      );

      // Only insert truly new discoveries
      for (const score of scoredResults) {
        if (existingIds.has(score.programId)) {
          continue;
        }

        const matchedProgram = programs.programs.find(
          (p) => p.id === score.programId
        );
        if (!matchedProgram) continue;

        const { error } = await db
          .from("affiliate_products")
          .insert({
            external_id: matchedProgram.id,
            network_id: "clickbank" as const,
            title: matchedProgram.name,
            description: score.reasoning,
            affiliate_link: matchedProgram.link,
            commission_rate: parseFloat(
              matchedProgram.commission.replace(/[^0-9.]/g, "") || "0"
            ),
            avg_earnings_usd: matchedProgram.epc,
            sps_score: score.relevanceScore,
            is_hidden_gem: score.relevanceScore >= 85,
            raw_metrics: {
              cookieDuration: matchedProgram.cookieDuration,
              commissionType: matchedProgram.commissionType,
              niche: score.niche,
              components: score.components,
            },
          });

        if (!error) {
          newDiscoveries++;
        }
      }

      return { count: scoredResults.length, newCount: newDiscoveries };
    });

    // Step 4: Send Telegram notification to admin
    await step.run("notify-discovery-results", async () => {
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
      if (!adminChatId) {
        return { notified: false, reason: "No admin chat ID configured" };
      }

      const topPrograms = scoredResults
        .slice(0, 5)
        .map(
          (s, i) =>
            `${i + 1}. *${s.programName}* (${s.relevanceScore}/100) - ${s.niche}`
        )
        .join("\n");

      const message = [
        "🔍 *Sophia Auto-Discovery Report*",
        "",
        `Found *${stored.count}* high-potential affiliates`,
        `New discoveries: *${stored.newCount}*`,
        `Categories scanned: *${programs.categories.length}*`,
        "",
        "*Top 5 Programs:*",
        topPrograms || "No programs scored above threshold",
        "",
        `_${new Date().toISOString().split("T")[0]}_`,
      ].join("\n");

      await sendTelegramMessage(adminChatId, message);
      return { notified: true };
    });

    return {
      discovered: stored.count,
      newDiscoveries: stored.newCount,
      nichesScanned: DEFAULT_NICHES.length,
      categoriesAvailable: programs.categories.length,
    };
  }
);
