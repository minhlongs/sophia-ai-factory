'use client';

import { useActionState } from 'react-dom';
import type { ReactNode } from 'react';

interface FormProps {
  /** Server Action to call on form submission */
  action: (formData: FormData) => Promise<{ success?: boolean; message?: string } | void>;
  /** Form content */
  children: ReactNode;
  /** Optional CSS class for the form element */
  className?: string;
}

/**
 * Standardized form component for Server Actions.
 *
 * Features:
 * - Automatically displays non-field errors from action response
 * - Uses React DOM's useActionState for progressive enhancement
 * - Consistent error styling across forms
 *
 * @example
 * ```tsx
 * <Form action={createScheduleAction}>
 *   <input name="topic" />
 *   <Button type="submit">Submit</Button>
 * </Form>
 * ```
 */
export function Form({ action, children, className }: FormProps) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className={className}>
      {state && 'message' in state && typeof state.message === 'string' && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200 mb-4">
          {state.message}
        </div>
      )}
      {children}
    </form>
  );
}
