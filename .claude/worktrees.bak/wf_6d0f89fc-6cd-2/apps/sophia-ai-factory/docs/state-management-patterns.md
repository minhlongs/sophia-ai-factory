# State Management Patterns

This document standardizes state management patterns in Sophia AI Factory.

## 1. Server Actions for Mutations

All data mutations MUST use Server Actions. Never use `fetch()` in component bodies for creating/updating/deleting data.

### ✅ Correct

```tsx
// app/actions/campaigns.ts
'use server';
export async function createCampaign(formData: FormData) {
  // validation, DB operations, revalidatePath
  return { success: true };
}

// component
'use client';
<form action={createCampaign}>
  <input name="title" />
  <button type="submit">Create</button>
</form>
```

### ❌ Incorrect

```tsx
// component
'use client';
async function handleSubmit() {
  await fetch('/api/campaigns', { method: 'POST', body: JSON.stringify(data) });
}
```

### Guidelines

- Place Server Actions in `app/actions/` or domain-specific subdirectories like `app/actions/billing/`.
- Use `revalidatePath()` after successful mutations to update caches.
- Return a consistent shape: `{ success: boolean; message?: string; [key: string]: any }`.
- Perform authentication checks via `getCurrentUser()`.
- Use Zod validation on formData before processing.

## 2. Client State with useState

For UI-only state (modals open/closed, form field values, toggles), use `useState` or custom hooks like `useScheduleForm`.

### Example: Form State Hook

```tsx
// components/schedule/use-schedule-form.ts
export function useScheduleForm() {
  const [formState, setFormState] = useState<FormState>(initial);
  const [showForm, setShowForm] = useState(false);
  // ... setters
  return { formState, setFormState, showForm, setShowForm, ... };
}
```

**Rule**: Keep state local unless multiple components need it. If >2 components need the same state, consider extracting a Context.

## 3. Context API for Cross-Component State

Use Context when state needs to be shared across multiple components at different nesting levels.

### AuthModeContext Example

```tsx
// seed/contexts/auth-mode-context.tsx
export function AuthModeProvider({ children }: { children: ReactNode }) {
  const [pageTab, setPageTab] = useState<'signin' | 'signup'>('signin');
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  return (
    <AuthModeContext.Provider value={{ pageTab, setPageTab, mode, setMode }}>
      {children}
    </AuthModeContext.Provider>
  );
}

// usage
import { useAuthMode } from '@/seed/contexts/auth-mode-context';
function LoginPage() {
  const { pageTab, setPageTab } = useAuthMode();
  // ...
}
```

**Rule**: Create context only when needed. Avoid premature abstraction.

## 4. React Query Usage

React Query (`@tanstack/react-query`) MUST be used only in **forest hooks** (e.g., `forest/hooks/use-usage-metrics.ts`). Never use `useQuery` or `useMutation` directly in pages or components.

### ✅ Correct

```tsx
// forest/hooks/use-usage-metrics.ts
export function useUsageMetrics() {
  return useQuery({ queryKey: ['usage'], queryFn: fetchUsage });
}

// component
'use client';
function DashboardPage() {
  const { data } = useUsageMetrics();
  // ...
}
```

### ❌ Incorrect

```tsx
'use client';
function DashboardPage() {
  const { data } = useQuery({ queryKey: ['usage'], queryFn: fetchUsage });
}
```

## 5. Form Wrapper Component

Use the standardized `<Form>` component from `@/seed/components/ui/form` when working with Server Actions.

### Benefits

- Consistent error display (non-field errors)
- Integrated `useActionState` boilerplate
- Reusable styling

### Example

```tsx
import { Form } from '@/seed/components/ui/form';
import { createScheduleAction } from '@/app/actions/schedule';

function SchedulePage() {
  return (
    <Form action={createScheduleAction} className="space-y-4">
      <input name="topic" />
      <Button type="submit">Create</Button>
    </Form>
  );
}
```

## 6. URL State for Server Data

For data that should be shareable via URL (filters, pagination, IDs), use URL search params, not client state.

### Example

```tsx
const searchParams = useSearchParams();
const tier = searchParams.get('tier');
```

## 7. LocalStorage for UI Preferences Only

`localStorage` may be used for client-side UI preferences (dark mode, dismissed banners). Never store server data in localStorage that could become stale.

### Example

```tsx
// Acceptable: remember a dismissible banner
const [dismissed, setDismissed] = useState(() => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('masterWelcomeDismissed') !== null;
  }
  return false;
});
```

## 8. Prop Drilling Guidelines

Pages passing >5 props to a child component should consider:
- Extracting the child into a separate component that manages its own state
- Using Context if multiple siblings need the same state
- Composing the UI differently

But **don't over-optimize**. Passing 6 props to a presentational component (like a table) is acceptable if those props are all used.

### Good Example

```tsx
// ScheduleList receives 6 props: schedules, loading, error, onToggle, onDelete, onRefresh
// This is acceptable because they are all needed and the component is purely presentational.
```

## 9. Error Handling Patterns

### Server Action Errors

Return `{ success: false, message: string }` from Server Actions. The `<Form>` component will automatically display the message.

### Field Errors

For field-level validation, return `{ fieldErrors: { fieldName: 'Error message' } }`. The parent component should display these next to the inputs.

### Network/API Errors

Client-side catch blocks should set local error state with `setError(err.message)` and display in UI.

## 10. Loading States

### Server Actions

Use `useFormStatus()` inside a form to show pending state:

```tsx
'use client';
import { useFormStatus } from 'react-dom';

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button disabled={pending}>Submitting...</Button>;
}
```

### Data Fetching

For data loading (not mutations), use React Query in forest hooks or manual `useEffect` + loading state.

---

## Checklist for New Features

- [ ] All mutations use Server Actions (no `fetch()` for writes)
- [ ] Server Actions placed in `app/actions/` or subfolder
- [ ] React Query only used inside forest hooks
- [ ] Context created only when state is needed in >2 components
- [ ] Form errors displayed consistently (use `<Form>` wrapper)
- [ ] URL params used for shareable state
- [ ] Prop count to children is <5 or justified
- [ ] Loading states use appropriate patterns (`useFormStatus`, React Query)
- [ ] TypeScript types are strict (no `any`, proper return types)

---

*Last updated: 2026-06-15*
