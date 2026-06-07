# 🌌 OpenClaw Setup UI - Design System Standards (v5.8.0)

Welcome to the official Design System documentation for the OpenClaw Setup UI. This document defines the premium, space-tech inspired visual identity designed to align with the core `openclaw.ai` brand.

---

## 🎨 Design Philosophy: Space-Tech Dark Mode

The OpenClaw Setup UI is built upon a high-contrast, immersive space-tech aesthetic that feels futuristic, engineered, and premium. The theme features a deep black space canvas, subtle radial gradients resembling nebulae, steel-blue surface panels, and contrasting coral/teal neon accents.

### Core Visual Principles:
- **Deep Space Contrast:** The interface stands out with a space-black backdrop (`#030712`) highlighted by vibrant, neon-glowing elements.
- **Glassmorphism & Steel Panels:** Card elements and navigation components utilize steel-blue steel colors with subtle glassmorphic backdrop blurs for depth.
- **Clean Action Hierarchy:** Action cues strictly follow a primary/secondary visual hierarchy, ensuring a clear focus on the most important installation steps.
- **Vietnamese Readability:** Uses `'Be Vietnam Pro'` as the primary sans-serif font family, ensuring 100% correct, elegant Vietnamese rendering with geometric balance.
- **Monospace Precision:** Terminal streams and telemetry metrics are set in `'JetBrains Mono'` for precise engineering presentation.

---

## 💎 Design Tokens

### 1. Colors & Palettes

#### 🌌 Deep Space Base
- **Canvas (`--canvas`):** `#030712` — Deepest space black, serving as the main background.
- **Surface (`--surface`):** `#090e1a` — Medium steel-blue surface for primary containers and panels.
- **Surface 2 (`--surface2`):** `#0b1329` — Slightly lighter steel-blue fill for responsive sidebar items and segments.
- **Hairline / Border (`--hair`):** `#1e293b` — Thin slate-steel border color for outlines and dividers.

#### ⚡ Chromatic Accents
- **Primary Coral (`--primary`):** `#f43f5e` — Neon coral-pink accent for primary buttons, active tabs, and main CTAs.
- **Soft Coral (`--soft`):** `#fb7185` — Light rose pink for hover states and focus animations.
- **Deep Coral (`--deep`):** `#be123c` — Elegant burgundy for button gradient transitions and error states.
- **Teal Mint (`--ok`):** `#06b6d4` — Glowing mint-teal for status indicators, active links, and secondary button hover glow.

#### ✍️ Typography Colors
- **Ink (`--ink`):** `#f8fafc` — Soft pure-white for high-contrast headlines and text copy.
- **Body (`--body`):** `#94a3b8` — Slate-grey for standard description paragraphs and settings descriptions.
- **Muted (`--muted`):** `#64748b` — Dim-grey for captions, footprints, and placeholder texts.

#### 💡 Sleek Tech Light Mode Tokens (Inspired by openclaw.ai)
- **Canvas (`--canvas`):** `#f8fafc` — Crisp slate-blue white for background canvas.
- **Surface (`--surface`):** `#ffffff` — Pure white for card frames and sidebars.
- **Surface 2 (`--surface2`):** `#f1f5f9` — Light slate blue for segments and secondary highlights.
- **Hairline / Border (`--hair`):** `#e2e8f0` — Sleek Slate-steel borders.
- **Ink / Text (`--ink`):** `#0f172a` — Deep navy-slate text for high readability.

---

## 🎛️ Typography Hierarchy

The typography structure uses two elegant, highly legible font faces:

1. **Be Vietnam Pro (Sans-serif):** Used for all narrative text, titles, cards, and interactive controls.
2. **JetBrains Mono (Monospace):** Used for command cards, terminal logs, package versions, and system statuses.

| Token / Class | Font Family | Size | Weight | Line Height | Tracking | Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `h1` | Sans-serif | 48px | 700 | 1.0 | -0.055em | Main Page Header |
| `h2` / Section title | Sans-serif | 28px | 750 | 1.2 | -0.04em | Modal & Section Headers |
| `body-lead` | Sans-serif | 18px | 400 | 1.6 | -0.01em | Lead introduction subtexts |
| `body-normal` | Sans-serif | 14px | 400 | 1.55 | 0 | Standard description text |
| `cmd` / Monospace | Monospace | 12px | 500 | 1.5 | 0 | Dynamic terminal commands |
| `eyebrow` | Sans-serif | 12px | 700 | 1.0 | 2.5px | UPPERCASE category headers |

---

## 🧱 Premium Interface Components

### 1. Choice Selector Cards (`.logo-card`)
- **Normal State:** Glassmorphic steel background, thin border, and slight hover lift (`transform: translateY(-2px)`).
- **Active State:** Glowing primary-coral border (`#f43f5e`), deep coral-tinted gradient backing (`rgba(244,63,94,0.14)`), and an interior 1px inset glow.
- **Selection Indicator:** Clean, border-focused selection state. Legacy "red dots" are fully deprecated to maintain modern layout minimalism.

### 2. High-End Terminal Windows Style (`.terminal`)
- **Exterior Frame:** Immersive near-black background (`#020617`) with a 1px solid border and a dedicated top header bar.
- **macOS Window Controls:** A group of three premium, colored status window controls at the top left corner:
  - 🔴 **Red (`#ff5f56`)** — Close
  - 🟡 **Yellow (`#ffbd2e`)** — Minimize
  - 🟢 **Green (`#27c93f`)** — Maximize
- **Telemetry Text:** Soft glowing silver monospace letters (`#cbd5e1`) for log readouts.

### 3. Space-Tech Modals (`.donate-modal`)
- **Background Canvas:** Deep Space Black gradient backing (`linear-gradient(145deg, #090e1a, #030712)`).
- **Outline & Glow:** Wrapped in a thin, elegant Teal Mint glowing border (`rgba(6, 182, 212, 0.22)`) with a deep surrounding backdrop blur.
- **Interactive Elements:** Input boxes utilize dark deep backgrounds (`#020617`) and slate borders that glow teal upon focus.

### 4. Interactive Action Buttons
- **Primary Action (`.primary`):** A striking, high-density coral gradient (`linear-gradient(135deg, var(--primary) 0%, #db2777 100%)`) with an active drop shadow.
- **Secondary Action (`.secondary`):** Transparent glass fill, subtle border (`rgba(255, 255, 255, 0.08)`), glowing teal text and border on hover.

### 5. Layout-Stable Project Cards (`.project-chip`)
- **Visual Stability:** The loading spinner has been moved to the **top-right corner** (`top: 14px; right: 14px;` with `16x16px` size) instead of the bottom to prevent layout shift and screen flickering.
- **Zero-Flicker Partial Re-rendering:** UI leverages selective DOM updates (`DOMParser` comparison) rather than global `innerHTML` wipes to deliver instant-load UX.

### 6. Card Bot Management Actions (`.bot-item-actions`)
- **Default Visibility:** To enhance accessibility on touch devices, action buttons (Edit & Delete) are visible at all times (`opacity: 0.75` statically) instead of only on hover.
- **Micro-Animations on Hover:** Hovering over action buttons triggers an explicit glow (`box-shadow`), fully opaque color (`opacity: 1`), and a neat `1.1x` scaling effect.

---

## ✅ Do's and Don'ts

### Do:
- **Do** respect the primary/secondary visual hierarchy on all screens (e.g., "Create Bot" as glowing primary, "Zalo Login" as clean secondary outline).
- **Do** ensure all dynamic versions (Setup UI, OpenClaw gateway, 9Router) are synced to active repository parameters.
- **Do** wrap terminal outputs in the macOS window frame for professional presentation.
- **Do** use the `'Be Vietnam Pro'` font to guarantee gorgeous Vietnamese layouts.
- **Do** position loading indicators at absolute corner offsets to preserve structural layout stability.

### Don't:
- **Don't** reintroduce legacy red dot indicators on top of active card items.
- **Don't** use flat grey borders for buttons—always leverage subtle glass/hairline styling.
- **Don't** use girly pink fills in Light Mode—always leverage sleek slate-blue tones (`#f8fafc` canvas, `#ffffff` card surfaces) to keep it clean and engineered.
- **Don't** wipe the whole document body during page transitions to prevent screen flashes.

