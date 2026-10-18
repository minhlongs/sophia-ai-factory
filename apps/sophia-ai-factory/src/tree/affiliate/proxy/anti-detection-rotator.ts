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
} from './anti-detection-types';

export { generateConsistentFingerprint } from './fingerprint-generator';

/**
 * Evaluates whether a channel is eligible to dispatch a new video upload.
 */
export function evaluateChannelUploadEligibility(
  account: CreatorChannelAccount,
  currentTimeMs: number,
  proxyPool: ProxyNode[],
): DispatchEligibilityResult {
  if (account.dailyUploadCount >= account.maxDailyUploads) {
    return {
      allowed: false,
      reason: `Đã chạm ngưỡng upload tối đa trong ngày (${account.dailyUploadCount}/${account.maxDailyUploads})`,
      nextAvailableTimeMs: currentTimeMs + 12 * 3600 * 1000,
    };
  }

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

  let selectedProxy = proxyPool.find(
    (p) => p.id === account.assignedProxyId && p.status === 'HEALTHY',
  );

  if (!selectedProxy) {
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
