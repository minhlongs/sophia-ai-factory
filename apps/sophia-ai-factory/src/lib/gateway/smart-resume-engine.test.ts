import { describe, it, expect, beforeEach } from 'vitest'
import { SmartResumeEngine } from './smart-resume-engine'
import type { Checkpoint } from './gateway-types'

describe('SmartResumeEngine', () => {
  let engine: SmartResumeEngine

  beforeEach(() => {
    engine = new SmartResumeEngine()
  })

  describe('checkpoint', () => {
    it('should save a checkpoint for a campaign step', async () => {
      await engine.checkpoint('camp-1', 'generate-script', { wordCount: 500 })

      const last = await engine.getLastCheckpoint('camp-1')
      expect(last).not.toBeNull()
      expect(last?.campaignId).toBe('camp-1')
      expect(last?.step).toBe('generate-script')
      expect(last?.metadata).toEqual({ wordCount: 500 })
      expect(last?.completedAt).toBeInstanceOf(Date)
    })

    it('should replace duplicate step checkpoints', async () => {
      await engine.checkpoint('camp-1', 'generate-script', { attempt: 1 })
      await engine.checkpoint('camp-1', 'generate-script', { attempt: 2 })

      const checkpoints = await engine.getCheckpoints('camp-1')
      // Should only have one checkpoint for 'generate-script'
      const scriptCheckpoints = checkpoints.filter(cp => cp.step === 'generate-script')
      expect(scriptCheckpoints).toHaveLength(1)
      expect(scriptCheckpoints[0].metadata).toEqual({ attempt: 2 })
    })

    it('should store multiple distinct step checkpoints', async () => {
      await engine.checkpoint('camp-1', 'generate-script')
      await engine.checkpoint('camp-1', 'generate-voiceover')
      await engine.checkpoint('camp-1', 'start-video-generation')

      const checkpoints = await engine.getCheckpoints('camp-1')
      expect(checkpoints).toHaveLength(3)
    })
  })

  describe('getLastCheckpoint', () => {
    it('should return null for unknown campaign', async () => {
      const result = await engine.getLastCheckpoint('nonexistent')
      expect(result).toBeNull()
    })

    it('should return the most recently completed checkpoint', async () => {
      await engine.checkpoint('camp-1', 'notify-start')
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10))
      await engine.checkpoint('camp-1', 'generate-script')

      const last = await engine.getLastCheckpoint('camp-1')
      expect(last?.step).toBe('generate-script')
    })
  })

  describe('getCheckpoints', () => {
    it('should return empty array for unknown campaign', async () => {
      const result = await engine.getCheckpoints('nonexistent')
      expect(result).toEqual([])
    })

    it('should return checkpoints ordered by completion time ascending', async () => {
      await engine.checkpoint('camp-1', 'notify-start')
      await new Promise(resolve => setTimeout(resolve, 10))
      await engine.checkpoint('camp-1', 'generate-script')

      const checkpoints = await engine.getCheckpoints('camp-1')
      expect(checkpoints[0].step).toBe('notify-start')
      expect(checkpoints[1].step).toBe('generate-script')
    })
  })

  describe('resumeFrom', () => {
    it('should return the next pipeline step', async () => {
      const checkpoint: Checkpoint = {
        campaignId: 'camp-1',
        step: 'generate-script',
        completedAt: new Date(),
      }

      const next = await engine.resumeFrom(checkpoint)
      expect(next).toBe('generate-voiceover')
    })

    it('should return first step for unknown step', async () => {
      const checkpoint: Checkpoint = {
        campaignId: 'camp-1',
        step: 'unknown-step',
        completedAt: new Date(),
      }

      const next = await engine.resumeFrom(checkpoint)
      expect(next).toBe('notify-start')
    })

    it('should return "complete" when at the last step', async () => {
      const checkpoint: Checkpoint = {
        campaignId: 'camp-1',
        step: 'finalize-campaign',
        completedAt: new Date(),
      }

      const next = await engine.resumeFrom(checkpoint)
      expect(next).toBe('complete')
    })

    it('should return correct next step for each pipeline stage', async () => {
      const steps = [
        { current: 'notify-start', expected: 'generate-script' },
        { current: 'generate-voiceover', expected: 'start-video-generation' },
        { current: 'start-video-generation', expected: 'poll-video-status' },
        { current: 'poll-video-status', expected: 'distribute-channels' },
        { current: 'distribute-channels', expected: 'finalize-campaign' },
      ]

      for (const { current, expected } of steps) {
        const checkpoint: Checkpoint = {
          campaignId: 'camp-1',
          step: current,
          completedAt: new Date(),
        }
        const next = await engine.resumeFrom(checkpoint)
        expect(next).toBe(expected)
      }
    })
  })

  describe('clearCheckpoints', () => {
    it('should remove all checkpoints for a campaign', async () => {
      await engine.checkpoint('camp-1', 'notify-start')
      await engine.checkpoint('camp-1', 'generate-script')

      await engine.clearCheckpoints('camp-1')

      const last = await engine.getLastCheckpoint('camp-1')
      expect(last).toBeNull()
    })

    it('should not affect other campaigns', async () => {
      await engine.checkpoint('camp-1', 'notify-start')
      await engine.checkpoint('camp-2', 'generate-script')

      await engine.clearCheckpoints('camp-1')

      const camp2Last = await engine.getLastCheckpoint('camp-2')
      expect(camp2Last).not.toBeNull()
      expect(camp2Last?.step).toBe('generate-script')
    })
  })

  describe('isStepCompleted', () => {
    it('should return true for completed step', async () => {
      await engine.checkpoint('camp-1', 'generate-script')

      const completed = await engine.isStepCompleted('camp-1', 'generate-script')
      expect(completed).toBe(true)
    })

    it('should return false for uncompleted step', async () => {
      await engine.checkpoint('camp-1', 'generate-script')

      const completed = await engine.isStepCompleted('camp-1', 'generate-voiceover')
      expect(completed).toBe(false)
    })

    it('should return false for unknown campaign', async () => {
      const completed = await engine.isStepCompleted('nonexistent', 'notify-start')
      expect(completed).toBe(false)
    })
  })
})
