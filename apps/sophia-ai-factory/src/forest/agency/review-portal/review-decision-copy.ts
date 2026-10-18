import type { ReviewDecisionType } from './types';

export interface DecisionModalCopy {
  title: string;
  subtitle: string;
  label: string;
  placeholder: string;
  cancelText: string;
  submitText: string;
}

const APPROVE_COPY = {
  vi: {
    title: 'Xác nhận Phê duyệt Video',
    subtitle: 'Video sẽ được chuyển sang trạng thái sẵn sàng xuất bản.',
    label: 'Lời nhắn phê duyệt (tùy chọn):',
    placeholder: 'VD: Video rất đẹp, đồng ý đăng tải!',
    cancelText: 'Hủy bỏ',
    idleText: 'Xác nhận Duyệt',
    busyText: 'Đang xử lý...',
  },
  en: {
    title: 'Confirm Video Approval',
    subtitle: 'The video will be scheduled for distribution.',
    label: 'Approval note (optional):',
    placeholder: 'e.g. Looks great, ready to publish!',
    cancelText: 'Cancel',
    idleText: 'Confirm Approval',
    busyText: 'Processing...',
  },
} as const;

const REVISION_COPY = {
  vi: {
    title: 'Yêu cầu chỉnh sửa bản nháp',
    subtitle: 'Gửi ghi chú yêu cầu thay đổi tới nhóm biên tập viên.',
    label: 'Nội dung cần chỉnh sửa (bắt buộc):',
    placeholder: 'Mô tả chi tiết những điểm cần đổi (font chữ, đoạn cắt, nhạc nền...)',
    cancelText: 'Hủy bỏ',
    idleText: 'Gửi yêu cầu sửa',
    busyText: 'Đang gửi...',
  },
  en: {
    title: 'Request Video Revision',
    subtitle: 'Send feedback to the video editor team.',
    label: 'Revision notes (required):',
    placeholder: 'Describe details to modify (cuts, audio, typography...)',
    cancelText: 'Cancel',
    idleText: 'Submit Revisions',
    busyText: 'Sending...',
  },
} as const;

export function getDecisionModalCopy(
  activeModal: ReviewDecisionType,
  isVi: boolean,
  isSubmitting: boolean,
): DecisionModalCopy {
  const dict = activeModal === 'approve' ? APPROVE_COPY : REVISION_COPY;
  const lang = isVi ? dict.vi : dict.en;
  return {
    title: lang.title,
    subtitle: lang.subtitle,
    label: lang.label,
    placeholder: lang.placeholder,
    cancelText: lang.cancelText,
    submitText: isSubmitting ? lang.busyText : lang.idleText,
  };
}
