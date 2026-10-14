export const AUTOMATION_EVENTS = {
  MISSION_CREATED: 'mission:created',
  MISSION_DISPATCHED: 'mission:dispatched',
  AUTOMATION_RAN: 'automation:ran',
} as const;

export interface AutomationHookSpec {
  event: string;
  label: string;
  description: string;
}

export const AUTOMATION_HOOK_SPECS: AutomationHookSpec[] = [
  {
    event: AUTOMATION_EVENTS.MISSION_CREATED,
    label: 'Auto-dispatch on mission created',
    description: 'Classifies mission and dispatches agent fleet when confidence is high.',
  },
  {
    event: AUTOMATION_EVENTS.MISSION_DISPATCHED,
    label: 'Audit mission dispatch',
    description: 'Logs every dispatch attempt for observability.',
  },
  {
    event: AUTOMATION_EVENTS.AUTOMATION_RAN,
    label: 'Record automation outcome',
    description: 'Persists success / failure counts for coverage metrics.',
  },
];

export interface MissionPayload {
  missionId: string;
  missionText: string;
  tenantId: string;
  triggeredBy: 'user' | 'cron' | 'webhook';
}

export type HookRegistration = {
  event: string;
  handler: (payload: unknown) => Promise<void>;
  unsubscribe: () => void;
};
