/**
 * Tier 3: Pairwise Combinations E2E Test Suite
 * Autonomous Growth & Revenue Engine ($1M MRR Path)
 *
 * Requirements: Pairwise interaction tests between core features (>=15 tests).
 * - Pairwise 1 (F1 + F2): Trend scouting -> hook scoring & SES forecast
 * - Pairwise 2 (F2 + F3): Hook score & forecast -> campaign generator
 * - Pairwise 3 (F3 + F4): Campaign blueprint -> viral feedback loop & OCC CAS
 * - Pairwise 4 (F4 + F1): Viral feedback scores -> trend scouting prioritization
 * - Pairwise 5 (F3 + F5): Synthesized blueprints -> marketplace discovery listing
 * - Pairwise 6 (F5 + F6): Marketplace discovery -> 1-click studio clone & cost preflight
 * - Pairwise 7 (F6 + F7): Studio clone -> remix lineage & royalty attribution
 * - Pairwise 8 (F7 + F9): Creator royalties -> dual-entry ledger & pending hold
 * - Pairwise 9 (F8 + F9): Affiliate webhook HMAC -> 14-day hold ledger entry
 * - Pairwise 10 (F9 + F10): Expired hold flip -> NOWPayments USDT batch claim
 * - Pairwise 11 (F8 + F9): Refund clawback event -> negative adjustment row
 * - Pairwise 12 (F10 + F9): Batch payout -> daily financial reconciliation audit
 * - Pairwise 13 (F3 + F11): Campaign generator synthesis -> Mekong hybrid routing
 * - Pairwise 14 (F11 + F12): Mekong router -> 15s health preflight check
 * - Pairwise 15 (F12 + F11): Node heartbeat timeout (>15s) -> auto-failover to cloud BYOK
 * - Pairwise 16 (F1 + F8): Trend scout sub-ID -> affiliate conversion revenue attribution
 *
 * @module tests/e2e/growth-engine/tier3-pairwise-combinations.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createGrowthEngineD1,
  scoutTrendingSignals,
  calculateHookScore,
  calculateSESForecast,
  generateDailyCampaignBlueprints,
  ingestEngagementFeedback,
  listMarketplaceBlueprints,
  estimateBlueprintStudioCost,
  cloneBlueprintForMission,
  recordBlueprintRemixAndAccrueRoyalty,
  verifyAffiliateHmac,
  processAffiliateWebhook,
  flipPendingToPayable,
  recordClawbackAdjustment,
  getNetAffiliateBalance,
  processPayoutBatch,
  reconcileDailyFinancials,
  routeInferenceTask,
  probeEdgeNode,
  checkClusterHealth,
  type MockD1Database,
} from './growth-engine-harness';

describe('Tier 3: Pairwise Combinatorial Interactions (16 Tests)', () => {
  let db: MockD1Database;

  beforeEach(() => {
    db = createGrowthEngineD1();
  });

  it('P1 (F1 + F2): Trend scouting signals feed directly into hook scoring and SES forecasting', async () => {
    const signals = await scoutTrendingSignals('tiktok', 'ai_automation', db);
    expect(signals.length).toBeGreaterThan(0);

    const topSignal = signals[0];
    const hookEval = calculateHookScore({
      hookText: `The #1 secret about ${topSignal.hashtag} in 2026`,
      style: 'curiosity_gap',
      pacingScore: 85,
      retentionScore: 90,
      ctaScore: 80,
    });

    expect(hookEval.viralScore).toBeGreaterThanOrEqual(85);
    expect(hookEval.verdict).toBe('viral');

    // Run SES forecast on signal velocity history
    const velocitySeries = [100, 120, 140, 160, topSignal.velocity];
    const forecast = calculateSESForecast(velocitySeries, 0.4, 7);
    expect(forecast.points).toHaveLength(7);
    expect(forecast.level).toBeGreaterThan(100);
  });

  it('P2 (F2 + F3): High-scoring hooks and pattern forecasts drive daily campaign blueprint generation', async () => {
    const hookScore = calculateHookScore({
      hookText: 'Stop paying monthly subscriptions for video generation!',
      style: 'bold_claim',
      pacingScore: 92,
      retentionScore: 88,
      ctaScore: 85,
    });

    // Persist winning pattern discovered from high scoring hook
    await db
      .prepare(
        `INSERT INTO playbook_patterns (
          id, workspace_id, feature_key, feature_value, metric, avg_metric,
          sample_size, confidence, detected_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('pat_win_hook', 'ws_pair2', 'hook_style', hookScore.style, 'ces', hookScore.viralScore, 30, 0.88, Date.now(), Date.now())
      .run();

    const blueprints = await generateDailyCampaignBlueprints(db, 'ws_pair2', 0.8);
    expect(blueprints.length).toBe(1);
    expect(blueprints[0].hookStyle).toBe('bold_claim');
    expect(blueprints[0].confidence).toBe(0.88);
  });

  it('P3 (F3 + F4): Campaign blueprints generate missions whose engagement feedback triggers OCC CAS updates', async () => {
    const now = 1710000000000;
    await db
      .prepare(
        `INSERT INTO playbook_patterns (
          id, workspace_id, feature_key, feature_value, metric, avg_metric,
          sample_size, confidence, detected_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('pat_loop', 'ws_loop', 'hook_style', 'question', 'ces', 65.0, 10, 0.72, now, now)
      .run();

    const bps = await generateDailyCampaignBlueprints(db, 'ws_loop', 0.7, now);
    expect(bps.length).toBe(1);

    // Mission executes and feeds back engagement metrics
    const feedbackRes = await ingestEngagementFeedback(
      db,
      {
        patternId: 'pat_loop',
        views: 15000,
        shares: 750,
        watchTimeSeconds: 375000,
        durationSeconds: 30,
        conversions: 150,
        spendCents: 300,
        expectedDetectedAt: now,
      },
      now + 5000,
    );

    expect(feedbackRes.success).toBe(true);
    expect(feedbackRes.newSampleSize).toBe(11);
    expect(feedbackRes.newDetectedAt).toBe(now + 5000);
  });

  it('P4 (F4 + F1): Viral feedback scores reprioritize hashtag scouting queries across platforms', async () => {
    // Initial pattern with high viral score
    await db
      .prepare(
        `INSERT INTO playbook_patterns (
          id, workspace_id, feature_key, feature_value, metric, avg_metric,
          sample_size, confidence, detected_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('pat_trending_topic', 'ws_t', 'topic', 'solopreneur', 'ces', 88.0, 50, 0.95, Date.now(), Date.now())
      .run();

    const topPattern = await db
      .prepare('SELECT feature_value FROM playbook_patterns ORDER BY confidence DESC LIMIT 1')
      .first<{ feature_value: string }>();

    expect(topPattern?.feature_value).toBe('solopreneur');

    // Scout trends using top-performing pattern topic
    const signals = await scoutTrendingSignals('tiktok', topPattern!.feature_value, db);
    expect(signals.every((s) => s.topic === 'solopreneur')).toBe(true);
  });

  it('P5 (F3 + F5): Autonomous campaign blueprints are published and discoverable in the Marketplace', async () => {
    await db
      .prepare(
        `INSERT INTO playbook_patterns (
          id, workspace_id, feature_key, feature_value, metric, avg_metric,
          sample_size, confidence, detected_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('pat_mkt_bp', 'ws_mkt_gen', 'hook_style', 'before_after', 'ctr', 0.09, 25, 0.85, Date.now(), Date.now())
      .run();

    const blueprints = await generateDailyCampaignBlueprints(db, 'ws_mkt_gen', 0.8);
    const bp = blueprints[0];

    // Mark blueprint as listed in marketplace
    await db
      .prepare(
        `UPDATE campaign_blueprints
         SET marketplace_listed = 1, niche = 'growth_hacking', conversion_rate = 0.082, creator_id = 'creator_auto'
         WHERE id = ?`,
      )
      .bind(bp.id)
      .run();

    // Query marketplace
    const marketplace = await listMarketplaceBlueprints(db, { niche: 'growth_hacking' });
    expect(marketplace.items.some((item) => item.id === bp.id)).toBe(true);
    expect(marketplace.items[0].conversionRate).toBe(0.082);
  });

  it('P6 (F5 + F6): Marketplace discovery filtered blueprints are 1-click cloned into Studio with preflight cost', async () => {
    // Seed marketplace blueprint
    await db
      .prepare(
        `INSERT INTO campaign_blueprints (
          id, workspace_id, title, hook_style, target_platform, aspect_ratios,
          estimated_scenes, estimated_duration_seconds, estimated_cost_cents,
          marketplace_listed, niche, conversion_rate, remix_count, creator_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        'bp_mkt_clone',
        'ws_pub',
        'Top Converting TikTok Hook',
        'curiosity_gap',
        'tiktok',
        '["9:16"]',
        5,
        30,
        45,
        1,
        'saas',
        0.095,
        0,
        'creator_mark',
        Date.now(),
      )
      .run();

    // Search marketplace
    const discovery = await listMarketplaceBlueprints(db, { niche: 'saas', minConversionRate: 0.05 });
    const selectedBp = discovery.items[0];

    // Clone into studio
    const cloneRes = await cloneBlueprintForMission(db, selectedBp.id, 'user_buyer', 'ws_studio_clone');
    expect(cloneRes.success).toBe(true);
    expect(cloneRes.preflightCostCents).toBeGreaterThan(0);

    // Verify remix_count incremented
    const updatedBp = await db
      .prepare('SELECT remix_count FROM campaign_blueprints WHERE id = ?')
      .bind(selectedBp.id)
      .first<{ remix_count: number }>();
    expect(updatedBp?.remix_count).toBe(1);
  });

  it('P7 (F6 + F7): Studio cloned missions track derivative lineage and accrue creator royalties', async () => {
    // Create parent blueprint
    await db
      .prepare(
        `INSERT INTO campaign_blueprints (
          id, workspace_id, title, hook_style, target_platform,
          estimated_scenes, estimated_duration_seconds, estimated_cost_cents, creator_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('bp_parent_roy', 'ws_root', 'Master Blueprint', 'bold_claim', 'tiktok', 5, 30, 40, 'creator_original', Date.now())
      .run();

    // Clone blueprint
    const clone = await cloneBlueprintForMission(db, 'bp_parent_roy', 'user_remixer', 'ws_remix');
    expect(clone.success).toBe(true);

    // Accrue royalty from derivative mission monetization ($50.00 mission with 10% royalty)
    const royalty = await recordBlueprintRemixAndAccrueRoyalty(db, {
      blueprintId: 'bp_parent_roy',
      parentCreatorId: 'creator_original',
      remixerUserId: 'user_remixer',
      missionId: clone.missionId!,
      revenueCents: 5000,
      royaltyPercent: 10,
    });

    expect(royalty.success).toBe(true);
    expect(royalty.royaltyCents).toBe(500);

    // Check lineage row
    const remixRow = await db
      .prepare('SELECT * FROM blueprint_remixes WHERE id = ?')
      .bind(royalty.remixId)
      .first<{ blueprint_id: string; mission_id: string }>();

    expect(remixRow?.blueprint_id).toBe('bp_parent_roy');
    expect(remixRow?.mission_id).toBe(clone.missionId);
  });

  it('P8 (F7 + F9): Creator royalties enter creator earnings ledger with pending status', async () => {
    const royalty = await recordBlueprintRemixAndAccrueRoyalty(db, {
      blueprintId: 'bp_p8',
      parentCreatorId: 'creator_p8',
      remixerUserId: 'user_p8',
      missionId: 'mis_p8',
      revenueCents: 12000, // $120.00
      royaltyPercent: 20, // $24.00
    });

    expect(royalty.royaltyCents).toBe(2400);

    const ledgerEntry = await db
      .prepare('SELECT * FROM creator_earnings_ledger WHERE id = ?')
      .bind(royalty.ledgerId)
      .first<{ creator_id: string; amount_cents: number; status: string }>();

    expect(ledgerEntry?.creator_id).toBe('creator_p8');
    expect(ledgerEntry?.amount_cents).toBe(2400);
    expect(ledgerEntry?.status).toBe('pending');
  });

  it('P9 (F8 + F9): Affiliate webhook ingestion verifies HMAC and creates pending 14-day hold ledger entries', async () => {
    const secret = 'wh_secret_p9';
    const now = 1700000000000;
    const body = JSON.stringify({
      conversionId: 'tt_conv_p9',
      affiliateId: 'aff_p9',
      orderValueCents: 8000,
      commissionCents: 800,
      subId: 'sub_tok_01',
    });

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sigArray = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const sig = Array.from(new Uint8Array(sigArray)).map((b) => b.toString(16).padStart(2, '0')).join('');

    const webhookRes = await processAffiliateWebhook(db, 'tiktok_shop', body, sig, secret, now);
    expect(webhookRes.success).toBe(true);

    const row = await db
      .prepare('SELECT * FROM commission_ledger WHERE external_conversion_id = ?')
      .bind('tt_conv_p9')
      .first<{ status: string; hold_days: number; payable_at: number }>();

    expect(row?.status).toBe('pending');
    expect(row?.hold_days).toBe(14);
    expect(row?.payable_at).toBe(now + 14 * 86400 * 1000);
  });

  it('P10 (F9 + F10): 14-day expired hold entries flip to payable and are claimed by NOWPayments USDT batch processor', async () => {
    const attributedAt = 1700000000000;
    const payableAt = attributedAt + 14 * 86400 * 1000;

    await db
      .prepare(
        `INSERT INTO commission_ledger (
          id, affiliate_id, network, external_conversion_id, commission_cents,
          status, hold_days, attributed_at, payable_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('com_p10', 'aff_p10', 'amazon_associates', 'c_p10', 4500, 'pending', 14, attributedAt, payableAt, attributedAt)
      .run();

    // Fast-forward time past 14 days
    const flipTime = payableAt + 3600000;
    const flippedCount = await flipPendingToPayable(db, flipTime);
    expect(flippedCount).toBe(1);

    // Batch processor claims payable row
    const batch = await processPayoutBatch(db, 'nowpayments_usdt', flipTime);
    expect(batch.claimedRowIds).toContain('com_p10');
    expect(batch.totalAmountCents).toBe(4500);

    const row = await db
      .prepare('SELECT status, payout_batch_id FROM commission_ledger WHERE id = ?')
      .bind('com_p10')
      .first<{ status: string; payout_batch_id: string }>();

    expect(row?.status).toBe('paying');
    expect(row?.payout_batch_id).toBe(batch.batchId);
  });

  it('P11 (F8 + F9): Refund clawback event generates negative adjustment row without mutating historical conversion', async () => {
    await db
      .prepare(
        `INSERT INTO commission_ledger (
          id, affiliate_id, network, external_conversion_id, commission_cents,
          status, hold_days, attributed_at, payable_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('com_orig_p11', 'aff_p11', 'clickbank', 'conv_cb_p11', 3500, 'pending', 14, 1000, 2000, 1000)
      .run();

    // Customer returns product -> clawback adjustment
    const clawback = await recordClawbackAdjustment(db, 'conv_cb_p11', 3500);
    expect(clawback.success).toBe(true);

    // Verify dual-entry: original row + negative row
    const rows = await db
      .prepare('SELECT * FROM commission_ledger WHERE affiliate_id = ?')
      .bind('aff_p11')
      .all<{ status: string; commission_cents: number }>();

    expect(rows.results).toHaveLength(2);
    expect(rows.results[0].commission_cents).toBe(3500);
    expect(rows.results[1].commission_cents).toBe(-3500);
    expect(rows.results[1].status).toBe('clawback');

    const net = await getNetAffiliateBalance(db, 'aff_p11');
    expect(net).toBe(0);
  });

  it('P12 (F10 + F9): Post-batch daily financial reconciliation audits ledger claims against payout transaction confirmations', async () => {
    await db
      .prepare(
        `INSERT INTO commission_ledger (
          id, affiliate_id, network, external_conversion_id, commission_cents,
          status, hold_days, attributed_at, payable_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('com_recon_1', 'aff_rec', 'tiktok_shop', 'conv_r1', 15000, 'payable', 14, 1000, 2000, 1000)
      .run();

    const batch = await processPayoutBatch(db, 'nowpayments_usdt');
    expect(batch.totalAmountCents).toBe(15000);

    // Daily reconciliation receives blockchain receipt for $150.00
    const recon = await reconcileDailyFinancials(db, batch.batchId!, 15000);
    expect(recon.isReconciled).toBe(true);

    const savedBatch = await db
      .prepare('SELECT status FROM payout_batches WHERE id = ?')
      .bind(batch.batchId)
      .first<{ status: string }>();

    expect(savedBatch?.status).toBe('confirmed');
  });

  it('P13 (F3 + F11): Campaign generator multi-track video generation tasks route through Mekong hybrid router', async () => {
    // Register local M1 node
    await db
      .prepare(
        `INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('node_mekong_p13', 'M1 Max', 'https://node-p13.cashclaw.cc', 'tok_p13', 'ONLINE', 'apple_m1_max', 'unmetered', Date.now(), Date.now())
      .run();

    // Generate campaign blueprint
    await db
      .prepare(
        `INSERT INTO playbook_patterns (
          id, workspace_id, feature_key, feature_value, metric, avg_metric,
          sample_size, confidence, detected_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('pat_p13', 'ws_p13', 'hook_style', 'question', 'ces', 80.0, 20, 0.85, Date.now(), Date.now())
      .run();

    const blueprints = await generateDailyCampaignBlueprints(db, 'ws_p13', 0.8);
    const bp = blueprints[0];

    // Route script synthesis for generated blueprint
    const inference = await routeInferenceTask(
      {
        taskId: `gen_${bp.id}`,
        type: 'llm',
        prompt: `Write 5-scene viral script for ${bp.title}`,
        model: 'qwen2.5:14b',
      },
      db,
      'node_mekong_p13',
    );

    expect(inference.provider).toBe('mekong_m1_max');
    expect(inference.costKind).toBe('unmetered');
    expect(inference.encrypted).toBe(true);
  });

  it('P14 (F11 + F12): Mekong hybrid router queries 15s health monitor before dispatching to local node', async () => {
    const now = Date.now();
    await db
      .prepare(
        `INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('node_h14', 'Healthy M1', 'https://healthy.cashclaw.cc', 'tok', 'ONLINE', 'm1', 'unmetered', now - 2000, now)
      .run();

    // Check cluster health
    const health = await checkClusterHealth(db, now, 15);
    expect(health.onlineCount).toBe(1);

    const probe = await probeEdgeNode('https://healthy.cashclaw.cc', 'tok');
    expect(probe.status).toBe('ONLINE');

    // Route task
    const res = await routeInferenceTask(
      { taskId: 't_h14', type: 'tts', prompt: 'Narration voice text', model: 'kokoro' },
      db,
      'node_h14',
    );

    expect(res.provider).toBe('mekong_m1_max');
  });

  it('P15 (F12 + F11): Node health failure (>15s timeout) triggers transparent cloud BYOK fallback in hybrid router', async () => {
    const now = Date.now();
    const staleTime = now - 25000; // 25s stale (>15s)

    await db
      .prepare(
        `INSERT INTO edge_nodes (
          id, name, tunnel_url, bearer_token, status, hardware_profile, cost_kind, last_heartbeat_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind('node_stale_p15', 'Stale Node', 'https://stale.cashclaw.cc', 'tok', 'ONLINE', 'm1', 'unmetered', staleTime, now)
      .run();

    // Health check marks stale node OFFLINE
    const health = await checkClusterHealth(db, now, 15);
    expect(health.transitionsToOffline).toContain('node_stale_p15');

    // Routing immediately detects OFFLINE and executes cloud fallback
    const res = await routeInferenceTask(
      { taskId: 'task_failover', type: 'llm', prompt: 'Urgent script generation', model: 'claude-3-5' },
      db,
      'node_stale_p15',
    );

    expect(res.provider).toBe('cloud_byok');
    expect(res.costKind).toBe('metered');
  });

  it('P16 (F1 + F8): Trend-driven affiliate campaigns cross-correlate sub-IDs with affiliate conversion revenue', async () => {
    // Scout trending hashtag
    const signals = await scoutTrendingSignals('tiktok', 'home_gym', db);
    const signal = signals[0];
    const campaignSubId = `camp_${signal.hashtag.replace('#', '')}_2026`;

    // Webhook receives conversion tagged with this subId
    const secret = 'aff_secret_p16';
    const body = JSON.stringify({
      conversionId: 'tt_gym_999',
      affiliateId: 'aff_gym_creator',
      subId: campaignSubId,
      orderValueCents: 20000, // $200.00
      commissionCents: 2000, // $20.00
    });

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sigArray = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const sig = Array.from(new Uint8Array(sigArray)).map((b) => b.toString(16).padStart(2, '0')).join('');

    const webhook = await processAffiliateWebhook(db, 'tiktok_shop', body, sig, secret);
    expect(webhook.success).toBe(true);

    // Query attribution performance for the trend campaign
    const conversion = await db
      .prepare('SELECT commission_cents, sub_id FROM commission_ledger WHERE sub_id = ?')
      .bind(campaignSubId)
      .first<{ commission_cents: number; sub_id: string }>();

    expect(conversion?.commission_cents).toBe(2000);
    expect(conversion?.sub_id).toBe(campaignSubId);
  });
});
