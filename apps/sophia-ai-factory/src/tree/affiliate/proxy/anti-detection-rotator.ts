/**
 * Multi-Account Anti-Detection & Creator Proxy Rotator
 *
 * Enforces residential proxy rotation, consistent browser fingerprint isolation,
 * and cadence pacing to prevent account shadowbans across multi-platform networks.
 *
 * Layer: tree/affiliate/proxy (Domain Logic)
 * @module tree/affiliate/proxy/anti-detection-rotator
 */

import type {
  CreatorChannelAccount,
  ProxyNode,
  DispatchEligibilityResult,
  BrowserFingerprint,
} from './anti-detection-types';

/**
 * Generates a consistent, deterministic browser fingerprint per channel.
 */
export function generateConsistentFingerprint(
  seed: string,
  countryCode = 'US',
): BrowserFingerprint {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);

  const viewports = [
    { width: 390, height: 844, dpr: 3 }, // iPhone 14 / 15
    { width: 412, height: 915, dpr: 2.625 }, // Pixel 7
    { width: 393, height: 852, dpr: 3 }, // iPhone 15 Pro
  ];
  const vp = viewports[positiveHash % viewports.length];

  return {
    userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SophiaCreator/${positiveHash % 100}`,
    viewportWidth: vp.width,
    viewportHeight: vp.height,
    devicePixelRatio: vp.dpr,
    platform: 'iPhone',
    canvasNoiseSeed: positiveHash % 999983,
    webglVendor: 'Apple Inc. (Apple GPU)',
    locale: countryCode.toLowerCase() === 'vn' ? 'vi-VN' : 'en-US',
  };
}

/**
 * Evaluates whether a channel is eligible to dispatch a new video upload.
 */
export function evaluateChannelUploadEligibility(
  account: CreatorChannelAccount,
  currentTimeMs: number,
  proxyPool: ProxyNode[],
): DispatchEligibilityResult {
  // Check daily upload cap
  if (account.dailyUploadCount >= account.maxDailyUploads) {
    return {
      allowed: false,
      reason: `Đã chạm ngưỡng upload tối đa trong ngày (${account.dailyUploadCount}/${account.maxDailyUploads})`,
      nextAvailableTimeMs: currentTimeMs + 12 * 3600 * 1000, // available next cycle
    };
  }

  // Check minimum spacing interval
  const minIntervalMs = account.minIntervalHours * 3600 * 1000;
  const timeSinceLastUpload = currentTimeMs - account.lastUploadTimestampMs;
  if (account.lastUploadTimestampMs > 0 && timeSinceLastUpload < minIntervalMs) {
    const remainingMs = minIntervalMs - timeSinceLastUpload;
    return {
      allowed: false,
      reason: `Khoảng cách giữa các bài đăng chưa đủ ${account.minIntervalHours} giờ. Cần chờ thêm ${Math.ceil(remainingMs / 60000)} phút`,
      nextAvailableTimeMs: account.lastUploadTimestampMs + minIntervalMs,
    };
  }

  // Find a healthy proxy for the channel
  let selectedProxy = proxyPool.find(
    (p) => p.id === account.assignedProxyId && p.status === 'HEALTHY',
  );

  if (!selectedProxy) {
    // Select the least recently used healthy proxy
    const healthyProxies = proxyPool.filter((p) => p.status === 'HEALTHY');
    if (healthyProxies.length === 0) {
      return {
        allowed: false,
        reason: 'Không có proxy khả dụng (Proxy pool cạn kiệt hoặc bị degrade)',
      };
    }
    selectedProxy = [...healthyProxies].sort((a, b) => a.lastUsedMs - b.lastUsedMs)[0];
  }

  return {
    allowed: true,
    reason: 'Đủ điều kiện đăng bài an toàn (Cadence hợp lệ, proxy sẵn sàng)',
    assignedProxy: selectedProxy,
    fingerprint: account.fingerprint,
  };
}

/**
 * Updates channel account and proxy state after an upload attempt.
 */
export function recordUploadExecution(
  account: CreatorChannelAccount,
  success: boolean,
  timestampMs: number,
  proxy?: ProxyNode,
): { updatedAccount: CreatorChannelAccount; updatedProxy?: ProxyNode } {
  const updatedAccount: CreatorChannelAccount = {
    ...account,
    dailyUploadCount: success ? account.dailyUploadCount + 1 : account.dailyUploadCount,
    lastUploadTimestampMs: success ? timestampMs : account.lastUploadTimestampMs,
    assignedProxyId: proxy ? proxy.id : account.assignedProxyId,
  };

  if (!proxy) {
    return { updatedAccount };
  }

  const failures = success ? 0 : proxy.consecutiveFailures + 1;
  let status = proxy.status;

  if (failures >= 5) {
    status = 'BANNED';
  } else if (failures >= 3) {
    status = 'DEGRADED';
  } else if (success) {
    status = 'HEALTHY';
  }

  const updatedProxy: ProxyNode = {
    ...proxy,
    status,
    consecutiveFailures: failures,
    lastUsedMs: timestampMs,
    assignedChannelId: success ? account.channelId : proxy.assignedChannelId,
  };

  return { updatedAccount, updatedProxy };
}
