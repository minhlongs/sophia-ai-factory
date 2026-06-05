/**
 * Tests: arg-resolver.ts — {{config.field}} substitution
 *
 * Verifies that configValues from no-code install form are correctly
 * substituted into step args via the {{config.*}} placeholder syntax.
 */

import { describe, it, expect } from 'vitest';
import { resolveArgs } from './arg-resolver';

describe('resolveArgs — config placeholder substitution', () => {
  it('substitutes {{config.field}} from configValues', () => {
    const args = { to: '{{config.recipient_email}}', subject: 'Hello' };
    const result = resolveArgs(args, [], undefined, { recipient_email: 'owner@agency.com' });
    expect(result.to).toBe('owner@agency.com');
    expect(result.subject).toBe('Hello');
  });

  it('substitutes nested {{config.social.handle}}', () => {
    const args = { handle: '{{config.social.handle}}' };
    const result = resolveArgs(
      args,
      [],
      undefined,
      { social: { handle: '@agencyos' } },
    );
    expect(result.handle).toBe('@agencyos');
  });

  it('leaves placeholder unchanged if config field missing', () => {
    const args = { token: '{{config.api_token}}' };
    const result = resolveArgs(args, [], undefined, {});
    expect(result.token).toBe('{{config.api_token}}');
  });

  it('leaves placeholder unchanged when configValues is undefined', () => {
    const args = { url: '{{config.webhook_url}}' };
    const result = resolveArgs(args, [], undefined, undefined);
    expect(result.url).toBe('{{config.webhook_url}}');
  });

  it('mixes config + step + trigger placeholders in same args object', () => {
    const stepResults = [{ order: 1, command: 'content:plan', missionId: 'mid-1', output: { topic: 'AI news' } }];
    // triggerPayload is the body itself; {{trigger.body.source}} → triggerPayload.source
    const triggerPayload = { source: 'telegram' };
    const configValues = { brand_name: 'Sophia' };

    const args = {
      topic: '{{step_1.output.topic}}',
      source: '{{trigger.body.source}}',
      brand: '{{config.brand_name}}',
    };

    const result = resolveArgs(args, stepResults, triggerPayload, configValues);
    expect(result.topic).toBe('AI news');
    expect(result.source).toBe('telegram');
    expect(result.brand).toBe('Sophia');
  });

  it('handles numeric config values by converting to string', () => {
    const args = { max_posts: '{{config.max_posts}}' };
    const result = resolveArgs(args, [], undefined, { max_posts: 5 });
    expect(result.max_posts).toBe('5');
  });

  it('handles boolean config values by converting to string', () => {
    const args = { enabled: '{{config.notify}}' };
    const result = resolveArgs(args, [], undefined, { notify: true });
    expect(result.enabled).toBe('true');
  });

  it('preserves array and object values for exact placeholders', () => {
    const stepResults = [{
      order: 1,
      command: 'social:publish',
      missionId: 'mid-1',
      output: {
        publishedChannels: ['youtube', 'tiktok'],
        metadata: { scheduled: true },
      },
    }];

    const args = {
      channels: '{{step_1.output.publishedChannels}}',
      metadata: '{{step_1.output.metadata}}',
      nested: {
        firstChannel: '{{step_1.output.publishedChannels[0]}}',
        allChannels: '{{step_1.output.publishedChannels}}',
      },
    };

    const result = resolveArgs(args, stepResults);

    expect(result.channels).toEqual(['youtube', 'tiktok']);
    expect(result.metadata).toEqual({ scheduled: true });
    expect(result.nested).toEqual({
      firstChannel: 'youtube',
      allChannels: ['youtube', 'tiktok'],
    });
  });

  it('does not mutate the original args object', () => {
    const args = { field: '{{config.x}}' };
    const original = { ...args };
    resolveArgs(args, [], undefined, { x: 'value' });
    expect(args).toEqual(original);
  });
});
