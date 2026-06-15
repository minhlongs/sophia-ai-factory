/**
 * Workflow Labels — bilingual (vi + en) labels for step types and statuses.
 * Sophia Handover Rule: all client-facing labels must be bilingual.
 */

export interface BilingualLabel {
  en: string
  vi: string
}

export const STEP_LABELS: Record<string, BilingualLabel> = {
  create_plan: {
    en: 'Create Plan',
    vi: 'Lập kế hoạch',
  },
  execute_development: {
    en: 'Execute Development',
    vi: 'Triển khai code',
  },
  run_tests: {
    en: 'Run Tests',
    vi: 'Chạy kiểm thử',
  },
}

export const STATUS_LABELS: Record<string, BilingualLabel> = {
  queued: {
    en: 'Queued',
    vi: 'Chờ xử lý',
  },
  blocked: {
    en: 'Blocked',
    vi: 'Bị chặn',
  },
  planning: {
    en: 'Planning',
    vi: 'Đang lập kế hoạch',
  },
  executing: {
    en: 'Executing',
    vi: 'Đang triển khai',
  },
  verifying: {
    en: 'Verifying',
    vi: 'Đang kiểm thử',
  },
  completed: {
    en: 'Completed',
    vi: 'Hoàn thành',
  },
  failed: {
    en: 'Failed',
    vi: 'Thất bại',
  },
  running: {
    en: 'Running',
    vi: 'Đang chạy',
  },
}

export const WORKFLOW_LABELS = {
  pageTitle: { en: 'Workflows', vi: 'Quy trình' },
  pageSubtitle: {
    en: 'Supervisor Agent — 3-step automated workflows',
    vi: 'Supervisor Agent — quy trình tự động 3 bước',
  },
  newWorkflow: { en: 'New Workflow', vi: 'Quy trình mới' },
  backToList: { en: 'Back to Workflows', vi: 'Trở về danh sách' },
  promptLabel: { en: 'Describe your task', vi: 'Mô tả nhiệm vụ' },
  promptPlaceholder: {
    en: 'e.g. Build a login form with unit tests and documentation',
    vi: 'Ví dụ: Xây dựng form đăng nhập với unit test và tài liệu',
  },
  submit: { en: 'Start Workflow', vi: 'Bắt đầu quy trình' },
  submitting: { en: 'Starting...', vi: 'Đang khởi tạo...' },
  noWorkflows: {
    en: 'No workflows yet. Start your first one above.',
    vi: 'Chưa có quy trình nào. Tạo quy trình đầu tiên ở trên.',
  },
  finalResult: { en: 'Final Result', vi: 'Kết quả cuối' },
  step: { en: 'Step', vi: 'Bước' },
  timeline: { en: 'Timeline', vi: 'Tiến trình' },
}

/** Returns label for current locale; defaults to English */
export function getLabel(label: BilingualLabel, locale = 'en'): string {
  return locale === 'vi' ? label.vi : label.en
}
