/**
 * Unit tests for TimelineBrowserPreview (zero-cost DOM preview + inline caption/headline editing).
 * @module components/video/__tests__/timeline-browser-preview.test
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SophiaVideoTimelineSchema } from '@/seed/types/video-timeline-schema';
import { TimelineBrowserPreview } from '../timeline-browser-preview';

describe('TimelineBrowserPreview', () => {
  const sampleTimeline = SophiaVideoTimelineSchema.parse({
    timelineId: 'tl_preview_1',
    tenantId: 'org_1',
    title: 'Preview Test Video',
    scenes: [
      {
        sceneId: 's1',
        kind: 'GENERATIVE_HOOK_BROLL',
        headline: 'Initial Hook Headline',
        startFrame: 0,
        durationInFrames: 90,
      },
      {
        sceneId: 's2',
        kind: 'COMPLIANCE_END_CARD',
        headline: 'Final CTA Card',
        startFrame: 90,
        durationInFrames: 60,
      },
    ],
    captions: [{ id: 'cap_1', text: 'Original caption text', startSec: 0, endSec: 2.0 }],
  });

  it('renders DOM preview stage, allows inline headline & caption editing, and emits updated timeline on render trigger', () => {
    const onTriggerRender = vi.fn();
    render(
      <TimelineBrowserPreview
        initialTimeline={sampleTimeline}
        onTriggerRender={onTriggerRender}
      />,
    );

    expect(screen.getByTestId('preview-active-headline').textContent).toBe('Initial Hook Headline');
    expect(screen.getByTestId('preview-caption-cap_1').textContent).toBe('Original caption text');

    // Edit headline inline
    fireEvent.change(screen.getByTestId('scene-headline-input'), {
      target: { value: 'Edited Viral Hook' },
    });
    expect(screen.getByTestId('preview-active-headline').textContent).toBe('Edited Viral Hook');

    // Edit caption inline
    fireEvent.change(screen.getByTestId('caption-input-cap_1'), {
      target: { value: 'Updated synchronized caption' },
    });
    expect(screen.getByTestId('preview-caption-cap_1').textContent).toBe(
      'Updated synchronized caption',
    );

    // Switch engine to remotion and trigger MP4 render
    fireEvent.change(screen.getByTestId('video-renderer-engine-select'), {
      target: { value: 'remotion' },
    });
    fireEvent.click(screen.getByTestId('trigger-mp4-render-btn'));

    expect(onTriggerRender).toHaveBeenCalledTimes(1);
    const [emittedTimeline, emittedEngine] = onTriggerRender.mock.calls[0];
    expect(emittedEngine).toBe('remotion');
    expect(emittedTimeline.scenes[0].headline).toBe('Edited Viral Hook');
    expect(emittedTimeline.captions[0].text).toBe('Updated synchronized caption');
  });
});
