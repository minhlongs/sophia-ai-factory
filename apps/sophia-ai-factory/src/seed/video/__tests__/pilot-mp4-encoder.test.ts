// @vitest-environment node
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { encodePilotSlidesToMp4 } from '../pilot-mp4-encoder';
import { hasMediaMagicBytes } from '@/land/video/render/render-adapter';

function hasLocalFfprobe(): boolean {
  try {
    execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe('pilot-mp4-encoder (1-Key ISO BMFF H.264 MP4 proof)', () => {
  it('encodes multi-scene slides + CTA & referral shortlink into a genuine decodable H.264 MP4', async () => {
    const artifact = await encodePilotSlidesToMp4({
      width: 320,
      height: 576,
      slides: [
        {
          label: 'SCENE 1 • #QuảngCáo',
          headline: 'Bí quyết nhắc lịch hẹn phòng khám trong 60 giây',
          body: '40% khách quên lịch tái khám nếu chỉ nhắn thủ công.',
          footerCta: 'Nhấn link nhận bộ mẫu tự động hóa miễn phí',
          referralShortUrl: 'https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev/api/r/abcdefghij',
          durationSec: 4,
          accentIndex: 0,
        },
        {
          label: 'SCENE 2 • #QuảngCáo',
          headline: 'Tự động hóa quy trình chăm sóc sau khám',
          body: 'Tăng tỷ lệ quay lại mà không tốn thêm nhân sự trực.',
          footerCta: 'Nhấn link nhận bộ mẫu tự động hóa miễn phí',
          referralShortUrl: 'https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev/api/r/abcdefghij',
          durationSec: 4,
          accentIndex: 1,
        },
        {
          label: 'CALL TO ACTION • #QuảngCáo',
          headline: 'Nhấn link nhận bộ mẫu tự động hóa miễn phí',
          body: 'Mở ngay đường dẫn ở phần mô tả video.',
          footerCta: 'Nhấn link nhận bộ mẫu tự động hóa miễn phí',
          referralShortUrl: 'https://sophia-ai-factory-pilot.agencyos-openclaw.workers.dev/api/r/abcdefghij',
          durationSec: 3,
          accentIndex: 2,
        },
      ],
    });

    expect(artifact.codec).toBe('h264');
    expect(artifact.containerBrand).toBe('isom');
    expect(artifact.width).toBe(320);
    expect(artifact.height).toBe(576);
    expect(artifact.durationSec).toBe(11);
    expect(artifact.byteSize).toBeGreaterThan(10_000);
    expect(artifact.sha256Hex).toMatch(/^[a-f0-9]{64}$/);
    expect(hasMediaMagicBytes(artifact.bytes)).toBe(true);

    // Verify ISO BMFF 'ftyp' box + 'isom' major brand at bytes 4..12
    const headerAscii = Buffer.from(artifact.bytes.subarray(4, 12)).toString('ascii');
    expect(headerAscii).toBe('ftypisom');

    if (hasLocalFfprobe()) {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sophia-pilot-mp4-'));
      const mp4Path = path.join(tmpDir, 'customer-pilot.mp4');
      try {
        fs.writeFileSync(mp4Path, artifact.bytes);
        const probeRaw = execFileSync(
          'ffprobe',
          [
            '-v',
            'error',
            '-show_entries',
            'format=format_name,duration:stream=codec_name,codec_type,width,height',
            '-of',
            'json',
            mp4Path,
          ],
          { encoding: 'utf8' },
        );
        const parsed = JSON.parse(probeRaw) as {
          streams: Array<{ codec_name: string; codec_type: string; width: number; height: number }>;
          format: { format_name: string; duration: string };
        };
        expect(parsed.format.format_name).toContain('mp4');
        expect(Number(parsed.format.duration)).toBeCloseTo(11, 1);
        expect(parsed.streams[0]).toMatchObject({
          codec_name: 'h264',
          codec_type: 'video',
          width: 320,
          height: 576,
        });

        // Full stream decode check (-v error -xerror)
        execFileSync(
          'ffmpeg',
          [
            '-hide_banner',
            '-nostdin',
            '-v',
            'error',
            '-xerror',
            '-i',
            mp4Path,
            '-map',
            '0:v?',
            '-f',
            'null',
            '-',
          ],
          { encoding: 'utf8' },
        );
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }
  });
});
