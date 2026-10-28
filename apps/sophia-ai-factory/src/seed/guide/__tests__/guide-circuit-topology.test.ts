/**
 * Unit tests for the circuit topology.
 *
 * The wire table decides what the workbench shows when the user crosses from the
 * pipeline view into the pillar view, so it is a product decision encoded as
 * data. These tests pin the behaviour the UI relies on — in particular that a
 * station with several wired pillars always crosses to the same one — instead of
 * leaving it to be rediscovered by clicking.
 */

import { describe, expect, it } from 'vitest';
import {
  GUIDE_CIRCUIT_WIRES,
  GUIDE_SVG_CHIPS,
  GUIDE_SVG_COORDS,
  GUIDE_SVG_STATIONS,
  crossPeer,
} from '../guide-circuit-topology';
import { GUIDE_BACKEND_PILLARS } from '../guide-backend-pillars-data';
import { GUIDE_PIPELINE_STAGES } from '../guide-backend-catalog';
import type { GuideActiveTarget, GuidePillarNumber, GuideStageStep } from '../guide-hash-codec';

/** Walks the catalogue with the branded index types instead of casting. */
const stageStep = (value: number) => value as GuideStageStep;
const pillarNumber = (value: number) => value as GuidePillarNumber;

/** Narrows a peer to a station so its index can be asserted. */
function peerStep(peer: GuideActiveTarget | null): GuideStageStep | null {
  return peer === null || peer.mode !== 'stage' ? null : peer.step;
}

describe('GUIDE_CIRCUIT_WIRES', () => {
  it('wires every entry to something real on the other side', () => {
    GUIDE_CIRCUIT_WIRES.forEach((wire) => {
      expect(GUIDE_PIPELINE_STAGES.some((s) => s.step === wire.stageStep)).toBe(true);
      expect(GUIDE_BACKEND_PILLARS.some((p) => p.number === wire.pillarNumber)).toBe(true);
    });
  });

  it('declares each station/pillar pair at most once', () => {
    const seen = new Set(GUIDE_CIRCUIT_WIRES.map((w) => `${w.stageStep}-${w.pillarNumber}`));
    expect(seen.size).toBe(GUIDE_CIRCUIT_WIRES.length);
  });

  it('leaves no gap below the highest wired station', () => {
    const wired = new Set(GUIDE_CIRCUIT_WIRES.map((w) => w.stageStep));
    const highest = GUIDE_CIRCUIT_WIRES.reduce((max, w) => Math.max(max, w.stageStep), 1);
    for (let step = 1; step <= highest; step += 1) {
      expect(wired.has(stageStep(step))).toBe(true);
    }
  });
});

describe('crossPeer', () => {
  // Some stations power several pillars; the workbench must always cross to the
  // first wire in table order, so the mapping is deterministic rather than an
  // artefact of whichever catalogue entry sorts first.
  it('crosses a multi-wired station to its first wired pillar', () => {
    const step = GUIDE_CIRCUIT_WIRES[0].stageStep;
    const wire = GUIDE_CIRCUIT_WIRES.find((w) => w.stageStep === step);
    expect(crossPeer({ mode: 'stage', step })).toEqual({
      mode: 'pillar',
      number: wire?.pillarNumber,
    });
  });

  it('is stable across repeated calls for every station', () => {
    GUIDE_PIPELINE_STAGES.forEach((stage) => {
      const target: GuideActiveTarget = { mode: 'stage', step: stageStep(stage.step) };
      expect(crossPeer(target)).toEqual(crossPeer(target));
    });
  });

  it('crosses every pillar back to a station that genuinely powers it', () => {
    GUIDE_BACKEND_PILLARS.forEach((pillar) => {
      const peer = crossPeer({ mode: 'pillar', number: pillarNumber(pillar.number) });
      const wire = GUIDE_CIRCUIT_WIRES.find((w) => w.pillarNumber === pillar.number);
      expect(peer).toEqual({ mode: 'stage', step: wire?.stageStep });
      // The peer must be one of the stations this pillar actually powers.
      expect(peerStep(peer)).not.toBeNull();
      expect(
        GUIDE_CIRCUIT_WIRES.some(
          (w) => w.pillarNumber === pillar.number && w.stageStep === peerStep(peer),
        ),
      ).toBe(true);
    });
  });

  it('returns null for an unwired station instead of guessing a pillar', () => {
    const unwired = GUIDE_PIPELINE_STAGES.find(
      (s) => !GUIDE_CIRCUIT_WIRES.some((w) => w.stageStep === s.step),
    );
    if (unwired !== undefined) {
      expect(crossPeer({ mode: 'stage', step: stageStep(unwired.step) })).toBeNull();
    }
  });

  it('round-trips a station through its pillar back to a wired station', () => {
    GUIDE_CIRCUIT_WIRES.forEach((wire) => {
      const pillar = crossPeer({ mode: 'stage', step: wire.stageStep });
      expect(pillar).not.toBeNull();
      const back = crossPeer(pillar!);
      expect(back).not.toBeNull();
      expect(GUIDE_CIRCUIT_WIRES.some((w) => w.stageStep === peerStep(back))).toBe(true);
    });
  });
});

describe('GUIDE_SVG_COORDS', () => {
  it('lays out exactly one node per catalogue entry', () => {
    expect(GUIDE_SVG_STATIONS.length).toBe(GUIDE_PIPELINE_STAGES.length);
    expect(GUIDE_SVG_CHIPS.length).toBe(GUIDE_BACKEND_PILLARS.length);
    expect(GUIDE_SVG_COORDS.stations).toEqual(GUIDE_SVG_STATIONS);
    expect(GUIDE_SVG_COORDS.chips).toEqual(GUIDE_SVG_CHIPS);
  });

  it('labels every node in both locales so no node can render blank', () => {
    [...GUIDE_SVG_STATIONS, ...GUIDE_SVG_CHIPS].forEach((node) => {
      expect(node.label.vi.length).toBeGreaterThan(0);
      expect(node.label.en.length).toBeGreaterThan(0);
    });
  });

  it('keeps every node inside the declared viewBox', () => {
    const [, , width, height] = GUIDE_SVG_COORDS.viewBox.split(' ').map(Number);
    [...GUIDE_SVG_STATIONS, ...GUIDE_SVG_CHIPS].forEach((node) => {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(width);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(height);
    });
  });
});
