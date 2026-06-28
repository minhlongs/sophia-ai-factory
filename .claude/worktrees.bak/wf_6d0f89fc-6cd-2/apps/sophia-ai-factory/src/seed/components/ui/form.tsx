'use client';

import { useActionState, type ReactNode } from 'react';

interface FormProps {
  /** Server Action to call on form submission */
  action: (formData: FormData) => Promise<{ success?: boolean; message?: string } | void | null>;
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
 * - Uses React's useActionState for progressive enhancement
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
  // Wrapper that adapts (formData) => result to (state, formData) => result
  const adaptedAction = async (
    _state: { success?: boolean; message?: string } | null,
    formData: FormData
  ): Promise<{ success?: boolean; message?: string } | null> => {
    const result = await action(formData);
    // Normalize: treat undefined/void as null (no message to display)
    return result ?? null;
  };

  const [state, formAction] = useActionState(adaptedAction, null);

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
