/**
 * Tests for PipelineStatusCard component.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PipelineStatusCard } from '../pipeline-status-card';

const t = (key: string): string => key;

describe('PipelineStatusCard', () => {
  it('renders the title and status badge', () => {
    render(
      <PipelineStatusCard
        jobId="job-1"
        status="scheduled"
        title="My First Video"
        createdAt="2026-08-22T10:00:00.000Z"
        t={t}
      />,
    );
    expect(screen.getByText('My First Video')).toBeTruthy();
    expect(screen.getByText('scheduled')).toBeTruthy();
  });

  it('renders the job id', () => {
    render(
      <PipelineStatusCard
        jobId="job-abc"
        status="ready"
        title="Ready Video"
        createdAt="2026-08-22T10:00:00.000Z"
        t={t}
      />,
    );
    expect(screen.getByText('job-abc')).toBeTruthy();
  });

  it('renders stage when provided', () => {
    render(
      <PipelineStatusCard
        jobId="job-1"
        status="generating"
        title="Generating"
        createdAt="2026-08-22T10:00:00.000Z"
        stage="script"
        t={t}
      />,
    );
    expect(screen.getByText(/Stage: script/)).toBeTruthy();
  });

  it('does not render stage when omitted', () => {
    render(
      <PipelineStatusCard
        jobId="job-1"
        status="ready"
        title="Ready"
        createdAt="2026-08-22T10:00:00.000Z"
        t={t}
      />,
    );
    expect(screen.queryByText(/Stage:/)).toBeNull();
  });

  it('renders error block when error provided', () => {
    render(
      <PipelineStatusCard
        jobId="job-1"
        status="failed"
        title="Failed"
        createdAt="2026-08-22T10:00:00.000Z"
        error="boom"
        t={t}
      />,
    );
    expect(screen.getByText('boom')).toBeTruthy();
  });

  it('does not render error block when omitted', () => {
    render(
      <PipelineStatusCard
        jobId="job-1"
        status="ready"
        title="Ready"
        createdAt="2026-08-22T10:00:00.000Z"
        t={t}
      />,
    );
    expect(screen.queryByText('boom')).toBeNull();
  });

  it('renders cancelled status', () => {
    render(
      <PipelineStatusCard
        jobId="job-1"
        status="cancelled"
        title="Cancelled"
        createdAt="2026-08-22T10:00:00.000Z"
        t={t}
      />,
    );
    expect(screen.getByText('cancelled')).toBeTruthy();
  });

  it('renders the formatted creation date', () => {
    render(
      <PipelineStatusCard
        jobId="job-1"
        status="ready"
        title="Dated"
        createdAt="2026-08-22T10:00:00.000Z"
        t={t}
      />,
    );
    expect(screen.getByText(/2026/)).toBeTruthy();
  });

  it('applies status-specific badge classes', () => {
    render(
      <PipelineStatusCard
        jobId="job-1"
        status="failed"
        title="Failed"
        createdAt="2026-08-22T10:00:00.000Z"
        t={t}
      />,
    );
    const badge = screen.getByText('failed');
    expect(badge.className).toContain('bg-rose-50');
  });
});