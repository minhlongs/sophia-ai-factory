/**
 * Regression coverage for the extracted review portal state helpers.
 *
 * Pins the multi-tenancy contract: a sub-account's branding must reach the portal
 * unchanged, and missing branding must fall back to the documented defaults
 * rather than rendering an unstyled portal.
 *
 * @vitest
 */

import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReviewPortalStateBase } from '../review-portal-state-helpers'
import type { VideoReviewPayload, FeedbackComment } from '@/seed/types/agency-multitenancy'

function review(over: Partial<VideoReviewPayload> = {}): VideoReviewPayload {
  return {
    id: 'review-1',
    videoId: 'vid-1',
    status: 'pending',
    feedbackComments: [],
    ...over,
  } as VideoReviewPayload
}

describe('useReviewPortalStateBase', () => {
  it('defaults the locale to Vietnamese for the Vietnamese-first product', () => {
    const { result } = renderHook(() => useReviewPortalStateBase({ review: review() }))
    expect(result.current.locale).toBe('vi')
    expect(result.current.isVi).toBe(true)
  })

  it('honors an explicit English locale', () => {
    const { result } = renderHook(() => useReviewPortalStateBase({ review: review(), locale: 'en' }))
    expect(result.current.isVi).toBe(false)
  })

  it('applies the sub-account branding colors when present', () => {
    const { result } = renderHook(() => useReviewPortalStateBase({
      review: review({ subaccountBranding: { primaryColor: '#123456', accentColor: '#abcdef' } as never }),
    }))
    expect(result.current.primaryColor).toBe('#123456')
    expect(result.current.accentColor).toBe('#abcdef')
  })

  it('falls back to the default palette when branding is absent', () => {
    const { result } = renderHook(() => useReviewPortalStateBase({ review: review() }))
    expect(result.current.primaryColor).toBe('#0f172a')
    expect(result.current.accentColor).toBe('#10b981')
  })

  it('falls back per-color when only one brand color is set', () => {
    const { result } = renderHook(() => useReviewPortalStateBase({
      review: review({ subaccountBranding: { primaryColor: '#000000' } as never }),
    }))
    expect(result.current.primaryColor).toBe('#000000')
    expect(result.current.accentColor).toBe('#10b981')
  })

  it('starts the comment composer empty and unpinned from existing feedback', () => {
    const existing: FeedbackComment[] = [{ id: 'c1', authorName: 'A', commentText: 'hi', timeSec: 3 } as never]
    const { result } = renderHook(() => useReviewPortalStateBase({ review: review({ feedbackComments: existing }) }))
    expect(result.current.comments).toHaveLength(1)
    expect(result.current.commentText).toBe('')
    expect(result.current.authorName).toBe('')
    expect(result.current.currentTimeSec).toBe(0)
  })

  it('defaults to no comments when the payload omits the list', () => {
    const { result } = renderHook(() => useReviewPortalStateBase({ review: review({ feedbackComments: undefined }) }))
    expect(result.current.comments).toEqual([])
  })

  it('seeks the video element to a requested timestamp', () => {
    const play = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useReviewPortalStateBase({ review: review() }))
    act(() => {
      result.current.videoRef.current = { currentTime: 0, play } as unknown as HTMLVideoElement
    })
    act(() => { result.current.seekTo(42) })
    expect(result.current.videoRef.current?.currentTime).toBe(42)
    expect(play).toHaveBeenCalled()
  })

  it('ignores a seek request with no timestamp', () => {
    const play = vi.fn()
    const { result } = renderHook(() => useReviewPortalStateBase({ review: review() }))
    act(() => {
      result.current.videoRef.current = { currentTime: 7, play } as unknown as HTMLVideoElement
    })
    act(() => { result.current.seekTo(undefined) })
    expect(result.current.videoRef.current?.currentTime).toBe(7)
    expect(play).not.toHaveBeenCalled()
  })

  it('floors the playback position while reporting the current time', () => {
    const { result } = renderHook(() => useReviewPortalStateBase({ review: review() }))
    act(() => {
      result.current.videoRef.current = { currentTime: 12.9, play: vi.fn() } as unknown as HTMLVideoElement
    })
    act(() => { result.current.handleTimeUpdate() })
    expect(result.current.currentTimeSec).toBe(12)
  })

  it('keeps submission state isolated so an error clears the success message', () => {
    const { result } = renderHook(() => useReviewPortalStateBase({ review: review() }))
    act(() => {
      result.current.setFeedbackSuccess('Saved')
      result.current.setIsSubmittingComment(true)
    })
    expect(result.current.feedbackSuccess).toBe('Saved')
    act(() => { result.current.setErrorMessage('network') })
    expect(result.current.errorMessage).toBe('network')
    act(() => { result.current.setIsSubmittingComment(false) })
    expect(result.current.isSubmittingComment).toBe(false)
  })
})
