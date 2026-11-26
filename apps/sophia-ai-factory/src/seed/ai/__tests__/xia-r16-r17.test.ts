/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { filterAndChunkPainComments } from '../comment-pain-point-miner';
import {
  createBanditSnapshot,
  selectThompsonWinningArm,
  updateBanditArm,
} from '../thompson-bandit-engine';

describe('ak-xia Rounds 16-17: Comment Pain-Point Miner & Thompson Bandit Engine', () => {
  it('filters buyer pain-point comments locally, deduplicates, and chunks into bounded batches', () => {
    const batches = filterAndChunkPainComments(
      [
        { id: 'c1', text: 'Great video thanks!', source: 'youtube' },
        { id: 'c2', text: 'The withdrawal fees are way too expensive compared to alternatives.', source: 'youtube' },
        { id: 'c2', text: 'Duplicate id should be skipped.', source: 'youtube' },
        { id: 'c3', text: 'Phí cao quá, có sàn nào thay thế không anh em?', source: 'reddit' },
      ],
      1,
    );
    expect(batches).toHaveLength(2);
    expect(batches[0].comments[0].id).toBe('c2');
    expect(batches[1].comments[0].id).toBe('c3');
  });

  it('converges Thompson Sampling bandit toward the higher-converting hook arm deterministically', () => {
    let snap = createBanditSnapshot(['hook_a', 'hook_b']);
    for (let i = 0; i < 25; i++) {
      snap = updateBanditArm(snap, 'hook_a', true, 0.99);
      snap = updateBanditArm(snap, 'hook_b', false, 0.99);
    }
    const winner = selectThompsonWinningArm(snap, 42);
    expect(winner).toBe('hook_a');
  });
});
