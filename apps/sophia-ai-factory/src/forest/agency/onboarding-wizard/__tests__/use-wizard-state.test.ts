/**
 * Regression coverage for the agency onboarding wizard state hook.
 *
 * The wizard is the Setup Wizard's agency-facing twin and a protected onboarding
 * flow, so its step transitions and launch delegation are pinned here: stepping
 * back must clear prior errors, the first step must not go negative, and both
 * advance and launch must forward the full wizard state to the injected actions
 * rather than reaching for anything ambient.
 *
 * @vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWizardState } from '../use-wizard-state'
import type { AgencyOnboardingWizardActions } from '../types'

const ORG_ID = 'org-1'

function actions(over: Partial<AgencyOnboardingWizardActions> = {}): AgencyOnboardingWizardActions {
  return {
    validateStep: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
    submitOnboarding: vi.fn().mockResolvedValue({ success: true, orgId: ORG_ID }),
    ...over,
  } as unknown as AgencyOnboardingWizardActions
}

function mount(acts: AgencyOnboardingWizardActions, isVi = true) {
  return renderHook(() => useWizardState({ agencyOrgId: ORG_ID, isVi, actions: acts }))
}

describe('useWizardState', () => {
  beforeEach(() => vi.clearAllMocks())

  it('starts on step one with the default seed agents', () => {
    const { result } = mount(actions())
    expect(result.current.currentStep).toBe(1)
    expect(result.current.seedAgents.length).toBeGreaterThan(0)
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.generalError).toBeNull()
    expect(result.current.stepErrors).toEqual([])
  })

  it('derives the subdomain from the client name until one is set', () => {
    const { result } = mount(actions())
    act(() => { result.current.handleClientNameChange('Acme Media Co') })
    expect(result.current.profile.clientName).toBe('Acme Media Co')
    expect(result.current.domain.subdomain).toBe('acme-media-co')

    // an operator-supplied subdomain wins over later name edits
    act(() => { result.current.setDomain((d) => ({ ...d, subdomain: 'custom-domain' })) })
    act(() => { result.current.handleClientNameChange('Renamed Agency') })
    expect(result.current.domain.subdomain).toBe('custom-domain')
  })

  it('clears errors when stepping back but never below the first step', () => {
    const { result } = mount(actions())

    act(() => { result.current.setCurrentStep(2) })
    act(() => { result.current.setGeneralError('stale failure') })
    act(() => { result.current.setStepErrors(['name is required']) })
    act(() => { result.current.handlePrevStep() })

    expect(result.current.currentStep).toBe(1)
    expect(result.current.generalError).toBeNull()
    expect(result.current.stepErrors).toEqual([])

    act(() => { result.current.handlePrevStep() })
    expect(result.current.currentStep).toBe(1)
  })

  it('forwards the step number and its own payload when advancing', async () => {
    const acts = actions()
    const { result } = mount(acts)

    // step 2 validates the branding slice, not the whole wizard
    await act(async () => { result.current.setCurrentStep(2) })
    await act(async () => { await result.current.handleNextStep() })

    expect(acts.validateStep).toHaveBeenCalledTimes(1)
    const calls = (acts.validateStep as unknown as { mock: { calls: unknown[][] } }).mock.calls
    expect(calls[0][0]).toBe(2)
    expect(calls[0][1]).toMatchObject({ primaryColor: expect.any(String) })
  })

  it('advances to the next step once validation passes', async () => {
    const acts = actions({ validateStep: vi.fn().mockResolvedValue({ valid: true, errors: [] }) })
    const { result } = mount(acts)

    await act(async () => { await result.current.handleNextStep() })

    expect(result.current.currentStep).toBe(2)
    expect(result.current.stepErrors).toEqual([])
  })

  it('surfaces a validation failure as step errors without advancing', async () => {
    const acts = actions({ validateStep: vi.fn().mockResolvedValue({ valid: false, errors: ['agency name is required'] }) })
    const { result } = mount(acts)

    await act(async () => { await result.current.handleNextStep() })

    expect(result.current.currentStep).toBe(1)
    expect(result.current.stepErrors).toEqual(['agency name is required'])
    expect(acts.submitOnboarding).not.toHaveBeenCalled()
  })

  it('submits the full profile, branding, domain and agent selection on launch', async () => {
    const acts = actions({ submitOnboarding: vi.fn().mockResolvedValue({ success: true }) })
    const { result } = mount(acts)

    await act(async () => { result.current.handleClientNameChange('Acme Media') })
    await act(async () => { await result.current.handleLaunch() })

    expect(acts.submitOnboarding).toHaveBeenCalledTimes(1)
    const submission = (acts.submitOnboarding as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0] as Record<string, unknown>
    expect(submission).toMatchObject({ agencyOrgId: ORG_ID })
    expect(submission.profile).toMatchObject({ clientName: 'Acme Media' })
    expect(submission.branding).toBeDefined()
    expect(submission.domain).toBeDefined()
    expect(Array.isArray(submission.seedAgents)).toBe(true)
  })

  it('keeps a rejected launch out of the success state and clears the spinner', async () => {
    const acts = actions({ submitOnboarding: vi.fn().mockResolvedValue({ success: false, error: 'Provider unavailable' }) })
    const { result } = mount(acts)

    await act(async () => { await result.current.handleLaunch() })

    expect(result.current.launchResult).toBeNull()
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.generalError).toBe('Provider unavailable')
  })

  it('surfaces per-field step errors returned by a rejected launch', async () => {
    const acts = actions({
      submitOnboarding: vi.fn().mockResolvedValue({ success: false, stepErrors: { domain: ['subdomain is taken'] } }),
    })
    const { result } = mount(acts)

    await act(async () => { await result.current.handleLaunch() })

    expect(result.current.stepErrors).toEqual(['subdomain is taken'])
    expect(result.current.launchResult).toBeNull()
  })

  it('reports a thrown launch in Vietnamese when the operator locale is Vietnamese', async () => {
    const acts = actions({ submitOnboarding: vi.fn().mockRejectedValue(new Error('network')) })
    const { result } = mount(acts, true)

    await act(async () => { await result.current.handleLaunch() })

    expect(result.current.generalError).toMatch(/lỗi|không gian/i)
    expect(result.current.launchResult).toBeNull()
  })

  it('records the launch result and notifies the caller on success', async () => {
    const launchResult = { success: true, orgId: ORG_ID, agentsDeployed: 3 }
    const onSuccess = vi.fn()
    const acts = actions({ submitOnboarding: vi.fn().mockResolvedValue(launchResult) })
    const { result } = renderHook(() => useWizardState({ agencyOrgId: ORG_ID, isVi: true, actions: acts, onSuccess }))

    await act(async () => { await result.current.handleLaunch() })

    expect(result.current.launchResult).toEqual(launchResult)
    expect(result.current.generalError).toBeNull()
    expect(onSuccess).toHaveBeenCalledWith(launchResult)
  })

  it('refuses to launch when no submit action is configured', async () => {
    const { result } = renderHook(() => useWizardState({ agencyOrgId: ORG_ID, isVi: false }))

    await act(async () => { await result.current.handleLaunch() })

    expect(result.current.generalError).toMatch(/submit action not provided/i)
    expect(result.current.launchResult).toBeNull()
  })
})
