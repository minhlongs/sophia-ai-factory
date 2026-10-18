/**
 * Review Decision Modals (Approve & Request Changes)
 * Layer: forest/agency (UI components & presentation)
 *
 * @module forest/agency/review-portal/review-decision-modals
 */

import React from 'react';
import { CheckCircle2, RotateCcw, Check } from 'lucide-react';
import type { ReviewDecisionType } from './types';
import { getDecisionModalCopy } from './review-decision-copy';

interface ReviewDecisionModalsProps {
  activeModal: ReviewDecisionType | null;
  onClose: () => void;
  decisionNote: string;
  setDecisionNote: (val: string) => void;
  isSubmittingDecision: boolean;
  onDecision: (decision: ReviewDecisionType) => void;
  accentColor: string;
  isVi: boolean;
}

export function ReviewDecisionModals({
  activeModal,
  onClose,
  decisionNote,
  setDecisionNote,
  isSubmittingDecision,
  onDecision,
  accentColor,
  isVi,
}: ReviewDecisionModalsProps) {
  if (!activeModal) return null;
  const isApprove = activeModal === 'approve';
  const copy = getDecisionModalCopy(activeModal, isVi, isSubmittingDecision);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in">
        <div className="flex items-center gap-3">
          <div
            className={
              isApprove
                ? 'w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center'
                : 'w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center'
            }
          >
            {isApprove ? <CheckCircle2 className="w-6 h-6" /> : <RotateCcw className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-white">{copy.title}</h3>
            <p className="text-xs text-slate-400">{copy.subtitle}</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">{copy.label}</label>
          <textarea
            rows={isApprove ? 3 : 4}
            value={decisionNote}
            onChange={(e) => setDecisionNote(e.target.value)}
            placeholder={copy.placeholder}
            className={
              isApprove
                ? 'w-full text-xs rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none'
                : 'w-full text-xs rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none'
            }
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmittingDecision}
            className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
          >
            {copy.cancelText}
          </button>
          <button
            type="button"
            onClick={() => onDecision(activeModal)}
            disabled={isSubmittingDecision || (!isApprove && !decisionNote.trim())}
            className={
              isApprove
                ? 'px-5 py-2 text-xs font-semibold rounded-lg text-white shadow-lg transition flex items-center gap-2'
                : 'px-5 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow-lg transition disabled:opacity-50 flex items-center gap-2'
            }
            style={isApprove ? { backgroundColor: accentColor } : undefined}
          >
            {isApprove ? <Check className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
            {copy.submitText}
          </button>
        </div>
      </div>
    </div>
  );
}
