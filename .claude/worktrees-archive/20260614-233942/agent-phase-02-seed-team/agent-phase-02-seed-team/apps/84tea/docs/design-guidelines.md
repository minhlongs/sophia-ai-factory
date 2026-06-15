# 84tea Design Guidelines

## 1. Brand Identity: Indochine Luxury x Modern Zen

**Philosophy:** "Ancient Tea, Modern Spirit" (Cổ thụ, Tinh thần mới)
Combining the reverence for 500-year-old Shan Tuyet tea trees with the precision of modern Material Design 3.

### Core Elements
- **Heritage:** French Indochine typography (*Playfair Display*) + Vietnamese cultural motifs (Lotus, Bronze Drum patterns subtly applied).
- **Modernity:** Clean lines, generous whitespace, "Surface" based layouts from MD3.
- **Nature:** Biophilic elements, raw textures (stone, wood, unbleached paper).

## 2. Color System (Material Design 3)

### Primary Palette
- **Imperial Green** (`#1B5E20`): Represents the ancient Shan Tuyet forests. Used for primary actions, logos, and emphasis.
- **Gold Leaf** (`#C5A962`): Represents the golden camellia and premium status. Used for accents and highlights.

### Surface Palette
- **Ivory Silk** (`#FBF8F3`): The main background. Warmer than white, evoking raw silk or rice paper.
- **Rosewood** (`#4E342E`): Used for text on light surfaces. Dark, earthy brown instead of harsh black.

### Dark Mode
- **Imperial Green (Dark)** (`#A5D6A7`): Lighter, desaturated for readability.
- **Surface (Dark)** (`#121212`): Deep charcoal, not pure black.

## 3. Typography

### Display Font: Playfair Display
Used for Headlines, Hero text, and Quotes.
- **Weights:** 400 (Regular), 600 (SemiBold), 700 (Bold).
- **Usage:** "Thức tỉnh vị giác", "Shan Tuyết Cổ Thụ".

### Body Font: Inter
Used for UI elements, buttons, body text, and prices.
- **Weights:** 300, 400, 500, 600.
- **Usage:** Menu items, product descriptions, checkout forms.

## 4. UI Components & Patterns

### Buttons
- **Filled:** Primary actions. Rounded corners (Stadium shape).
- **Outlined:** Secondary actions. 1px border.
- **Text:** Tertiary actions.

### Cards
- **Elevated:** Product items, Franchise models. Subtle shadow (`shadow-md` to `shadow-xl`).
- **Filled:** Featured content. Uses `Surface Variant` colors.

### Feedback
- **Ripple Effect:** Subtle interaction feedback on all clickable elements.
- **Transitions:** Fluid motion (200-300ms ease-in-out).

## 5. Imagery Style
- **Photography:** Chiaroscuro lighting (high contrast). Focus on steam, texture of tea leaves, and clarity of the liquor.
- **Architecture:** Symmetrical, centered compositions. Warm lighting (2700K).
- **Human:** Staff in uniform, diverse Asian representation, engaged in the craft.

## 6. Implementation Notes
- **Tailwind:** Use `bg-primary`, `text-on-surface`, etc., defined in `tailwind.config.ts`.
- **Icons:** Material Symbols Rounded (`material-symbols-rounded`).
- **Responsive:** Mobile-first approach. Drawer navigation for mobile, Top bar for desktop.
