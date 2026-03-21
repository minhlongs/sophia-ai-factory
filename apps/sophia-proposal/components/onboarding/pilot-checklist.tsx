'use client';

import { useState, useEffect } from 'react';

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  description?: string;
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  {
    id: 'signup',
    label: 'Complete account signup',
    description: 'Verify your email and set up your profile',
    completed: false,
  },
  {
    id: 'org',
    label: 'Create organization',
    description: 'Set up your company or team organization',
    completed: false,
  },
  {
    id: 'subscription',
    label: 'Select Premium plan ($499/mo)',
    description: 'Choose the Premium tier for pilot benefits',
    completed: false,
  },
  {
    id: 'payment',
    label: 'Complete Polar checkout',
    description: 'Finish the payment process securely',
    completed: false,
  },
  {
    id: 'onboarding',
    label: 'Schedule 30-min onboarding call',
    description: 'Book a call with our team to get started',
    completed: false,
  },
  {
    id: 'first-proposal',
    label: 'Generate first proposal',
    description: 'Create your first AI-powered proposal',
    completed: false,
  },
  {
    id: 'feedback',
    label: 'Submit initial feedback',
    description: 'Share your thoughts to help us improve',
    completed: false,
  },
];

interface PilotChecklistProps {
  items?: ChecklistItem[];
  onItemToggle?: (itemId: string, completed: boolean) => void;
}

export function PilotChecklist({ items, onItemToggle }: PilotChecklistProps) {
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(
    items || DEFAULT_CHECKLIST
  );

  // Update internal state when props change
  useEffect(() => {
    if (items) {
      setChecklistItems(items);
    }
  }, [items]);

  const completedCount = checklistItems.filter(i => i.completed).length;
  const progress = (completedCount / checklistItems.length) * 100;

  const handleToggle = (itemId: string, completed: boolean) => {
    setChecklistItems(prev =>
      prev.map(i => (i.id === itemId ? { ...i, completed } : i))
    );
    onItemToggle?.(itemId, completed);
  };

  return (
    <div className="border border-green-200 rounded-xl p-6 bg-gradient-to-br from-green-50 to-white">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-green-900">
            Pilot Onboarding Checklist
          </h3>
          <span className="text-sm font-medium text-green-700">
            {completedCount}/{checklistItems.length} steps
          </span>
        </div>
        <div className="h-3 bg-green-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <ul className="space-y-3">
        {checklistItems.map((item, index) => (
          <li
            key={item.id}
            className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
              item.completed ? 'bg-green-50' : 'bg-white hover:bg-gray-50'
            }`}
          >
            <input
              type="checkbox"
              checked={item.completed}
              onChange={(e) => handleToggle(item.id, e.target.checked)}
              className="mt-1 h-5 w-5 rounded border-green-300 text-green-600 focus:ring-green-500 cursor-pointer"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full bg-green-100 text-green-700 mr-2">
                  {index + 1}
                </span>
                <span
                  className={`font-medium ${
                    item.completed
                      ? 'text-green-700 line-through'
                      : 'text-gray-900'
                  }`}
                >
                  {item.label}
                </span>
              </div>
              {item.description && (
                <p className="text-sm text-gray-500 ml-7 mt-1">
                  {item.description}
                </p>
              )}
            </div>
            {item.completed && (
              <svg
                className="w-5 h-5 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </li>
        ))}
      </ul>

      {progress === 100 && (
        <div className="mt-6 p-4 bg-green-100 border border-green-200 rounded-lg">
          <div className="flex items-center gap-3">
            <svg
              className="w-6 h-6 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-green-800 font-medium">
              Congratulations! You have completed the pilot onboarding.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
