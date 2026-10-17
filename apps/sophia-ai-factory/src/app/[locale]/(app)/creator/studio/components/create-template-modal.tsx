'use client';

import React from 'react';
import type { TemplateFormData } from './types';
import {
  CreateTemplateFormFields,
  type CreateTemplateFormFieldsProps,
} from './create-template-form-fields';

export { CreateTemplateFormFields, type CreateTemplateFormFieldsProps };

export interface CreateTemplateModalProps {
  isVi: boolean;
  isOpen: boolean;
  submitting: boolean;
  formData: TemplateFormData;
  onChange: (data: TemplateFormData) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function CreateTemplateModal({
  isVi,
  isOpen,
  submitting,
  formData,
  onChange,
  onClose,
  onSubmit,
}: CreateTemplateModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-xl space-y-4 my-8 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h2 className="text-lg font-bold text-zinc-100">
            {isVi ? 'Đóng Gói Mẫu Video Nhà Sáng Tạo' : 'Publish Reusable Video Template'}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-sm">
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 text-sm">
          <CreateTemplateFormFields
            isVi={isVi}
            formData={formData}
            onChange={onChange}
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            >
              {isVi ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-primary-700 hover:bg-primary text-white font-medium disabled:opacity-50"
            >
              {submitting
                ? isVi ? 'Đang gửi...' : 'Submitting...'
                : isVi ? 'Gửi Duyệt Mẫu' : 'Submit for Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
