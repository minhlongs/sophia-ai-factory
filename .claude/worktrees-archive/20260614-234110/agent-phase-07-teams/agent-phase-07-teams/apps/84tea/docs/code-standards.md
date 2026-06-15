# Code Standards

## 1. Naming Conventions

### Files & Directories
- **Kebab-case**: All file and directory names must use kebab-case.
  - ✅ `product-card.tsx`, `user-profile/`
  - ❌ `ProductCard.tsx`, `UserProfile/`
- **Descriptive Names**: Filenames should describe the component or purpose clearly.
  - ✅ `franchise-application-form.tsx`
  - ❌ `form.tsx`

### Components & Functions
- **PascalCase**: React components.
  - `export function ProductCard({ ... })`
- **camelCase**: Functions, variables, hooks.
  - `const [isOpen, setIsOpen] = useState(false)`
  - `function calculateTotal()`

### Types & Interfaces
- **PascalCase**: Type definitions.
  - `type Product = { ... }`
  - `interface CartItem { ... }`

## 2. React / Next.js Patterns

### Functional Components
- Use `function` declaration for components (not `const` arrow functions) for better stack traces.
- Explicit return types are optional for components but recommended for complex logic.

### Props
- Use `type` aliases for props definition.
- Destructure props in the function signature.
- Avoid passing massive objects; pass only what's needed.

### Hooks
- Place hooks at the top of the component.
- Use custom hooks to extract complex logic (e.g., `useCart`).
- **Rule:** Do not set state directly in `useEffect` if it triggers synchronous cascading renders. Use `setTimeout(..., 0)` if necessary for deferred updates from external sources (localStorage/URL).

### Server vs Client Components
- Default to **Server Components** (no `'use client'`).
- Add `'use client'` only when interactivity (state, effects, event listeners) is required.
- Keep Client Components at the leaf nodes of the tree where possible.

## 3. Styling (Tailwind CSS)

### Class Ordering
- Use `cn()` utility for conditional classes.
- Group classes logically (Layout -> Box Model -> Typography -> Visuals -> Interaction).
- Example:
  ```tsx
  className="flex items-center justify-between p-4 bg-surface rounded-lg hover:bg-surface-variant transition-colors"
  ```

### MD3 Token Usage
- **Do not** use arbitrary hex codes. Use the defined semantic color tokens.
  - ✅ `text-primary`, `bg-surface-variant`
  - ❌ `text-[#1B5E20]`, `bg-[#E8E1D9]`

## 4. TypeScript

### Strictness
- `noImplicitAny`: true.
- Avoid `any`. Use `unknown` if type is truly ambiguous, but prefer specific types.
- Ensure all inputs and API responses are typed.

### Empty Interfaces
- Use `type` instead of empty `interface` (ESLint rule: `@typescript-eslint/no-empty-object-type`).

## 5. Accessibility (a11y)

- **Images**: Always provide meaningful `alt` text.
- **Buttons**: Use `aria-label` for icon-only buttons.
- **Semantic HTML**: Use `<main>`, `<section>`, `<nav>`, `<button>` appropriately.
- **Focus**: Ensure visible focus states (`focus-visible:outline...`).
