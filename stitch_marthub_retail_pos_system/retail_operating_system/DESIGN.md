---
name: Retail Operating System
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#5a4138'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#8e7166'
  outline-variant: '#e2bfb2'
  surface-tint: '#a73a00'
  primary: '#a33900'
  on-primary: '#ffffff'
  primary-container: '#cc4900'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb599'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#4f5d72'
  on-tertiary: '#ffffff'
  tertiary-container: '#67758c'
  on-tertiary-container: '#fdfcff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbce'
  primary-fixed-dim: '#ffb599'
  on-primary-fixed: '#370e00'
  on-primary-fixed-variant: '#7f2b00'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#d5e3fd'
  tertiary-fixed-dim: '#b9c7e0'
  on-tertiary-fixed: '#0d1c2f'
  on-tertiary-fixed-variant: '#3a485c'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  numeric-pos:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system powers a high-velocity, high-throughput retail operations and Point-of-Sale (POS) platform tailored for Indian retail enterprises, multi-store franchises, supermarkets, and specialty merchants. The product environment demands rapid barcode scanning, instantaneous checkout workflows, inventory accuracy, GST compliance, and real-time cash drawer accountability.

The visual style is **Corporate / Modern High-Density Utility**. It deliberately rejects decorative glassmorphism, floating micro-interactions, and generic purple gradients in favor of sharp visual hierarchies, predictable 1px boundary rules, high-contrast typography, and tactile key controls. The interface creates an atmosphere of precision, operational speed, and unshakeable enterprise reliability under peak billing pressure.

## Colors

The palette is engineered for rapid visual parsing under harsh counter lighting and variable POS display hardware:

- **Primary Brand Accent (`#EA580C` / `#F97316`):** Direct from the energetic shopping cart mark. Reserved strictly for primary operational triggers (e.g., "Complete Sale [F12]", "Add Customer", active scan highlights, key promotional flags).
- **Secondary Authority Slate (`#0F172A`):** Deep navy used for structural navigation, terminal headers, master totals, and high-emphasis textual readouts.
- **Tertiary Steel Slate (`#334155`):** Secondary controls, table headers, inactive tabs, and supporting structural metadata.
- **Neutral Canvas (`#F8FAFC`) & Containers (`#FFFFFF`):** Cool, clinical background canvas contrasting against bright white operational cards, billing tables, and checkout panes. Crisp `#E2E8F0` hairline borders frame every functional surface.
- **Operational Signals:**
  - **Success (`#16A34A`):** Paid invoices, synced registers, matched reconciliations, and healthy stock levels.
  - **Warning / Low Stock (`#D97706`):** Approaching reorder points, pending approvals, and offline sync queues.
  - **Error / Depletion (`#DC2626`):** Out-of-stock SKUs, voided bills, cash discrepancies, and failed payment gateways.

## Typography

The design system uses **Inter** across all roles to achieve tight horizontal packing, tabular number alignment (`tnum`), and unambiguous glyph differentiation under continuous cashier usage.

- **Tabular Figures:** All financial figures, quantities, discounts, HSN codes, and barcode readouts must render with `font-feature-settings: "tnum" 1` to ensure strict vertical column alignment across billing tables.
- **Currency Standards:** The Indian Rupee symbol (`₹`) is rendered alongside figures without space (e.g., `₹1,45,290.00`) adhering to the Indian numbering system format (`2,2,3` grouping).
- **Scale Compactness:** Line heights and body sizes are calibrated 1–2px tighter than consumer web platforms to maximize on-screen SKU count without causing optical fatigue.

## Layout & Spacing

Layouts prioritize high operational density, split-screen billing configurations, and keyboard-centric terminal efficiency.

- **POS Counter Layout:** Standardized 65/35 split view on desktop screens: 65% width assigned to the live itemized billing grid and dynamic product lookup; 35% fixed right-hand sidebar allocated to customer loyalty profile, tax summary, split-tender payment actions, and receipt controls.
- **Back-Office Layout:** 12-column adaptive fluid grid with a fixed 240px slate-navy sidebar, 48px sticky header, and 12px (`0.75rem`) internal component gaps.
- **Rhythm Rules:** Vertical padding within operational table rows is fixed to 6px or 8px. Outer module margins never exceed 16px (`1rem`), ensuring cashiers view up to 14 active basket items above the fold on standard 1080p touch monitors.

## Elevation & Depth

Visual hierarchy is established primarily through **structured 1px borders (`#E2E8F0`)** and subtle, tight slate shadows rather than heavy blurs or multi-layer depth stacks.

- **Level 0 (Base Canvas):** Background `#F8FAFC`. Completely flat with zero elevation.
- **Level 1 (Card & Table Surfaces):** Pure `#FFFFFF` fill with a crisp `1px solid #E2E8F0` border and `box-shadow: 0 1px 2px 0 rgba(15, 23, 42, 0.05)`.
- **Level 2 (Active Dropdowns, Modals, Tender Overlays):** `#FFFFFF` fill with `1px solid #CBD5E1` and a focused shadow: `box-shadow: 0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -4px rgba(15, 23, 42, 0.08)`.
- **Focus States:** High-visibility double ring for keyboard navigation: `outline: 2px solid #EA580C; outline-offset: 1px`.

## Shapes

The system relies on compact, measured curves that preserve industrial utility and screen real estate:

- Base radius is **4px (`0.25rem`)** for all inputs, action buttons, table cells, tags, and barcode badges.
- Card containers and floating payment drawers utilize **8px (`0.5rem`)**.
- Fully circular shapes (`9999px`) are strictly limited to cashier avatars and keyboard shortcut key-caps. Pill-shaped buttons are prohibited.

## Components

### Buttons & Quick Keys
- **Primary Operational (`#EA580C`):** High-contrast white text, solid orange background, subtle darken on hover (`#C2410C`), inset 1px active press state. Keyboard shortcut tags (e.g., `[F12]`, `[Enter]`) are embedded inline on the right in 10px semi-bold white with 20% slate opacity.
- **Secondary Utility (`#0F172A`):** White text on deep slate navy for administrative actions ("Hold Cart", "Apply Coupon", "Manager Override").
- **Ghost & Outline (`#FFFFFF`):** Bordered with `#E2E8F0`, slate `#334155` text, background tinting to `#F1F5F9` on hover.

### Input Fields & Barcode Scanners
- Standard 36px height (compact POS mode: 32px).
- Inactive: `#FFFFFF` background with `1px solid #CBD5E1` border.
- Active / Scanning state: Bold `1px solid #EA580C` border with subtle `0 0 0 3px rgba(234, 88, 12, 0.12)` halo.
- Left-adorned with dedicated hardware scan icons, right-adorned with clear triggers and currency indicators (`₹`).

### Tables & POS Billing Grid
- Compact 36px row height with hairline dividers (`#F1F5F9`).
- Dark slate header strip (`#F8FAFC`) with uppercase 11px steel labels (`#64748B`).
- Right-aligned numeric columns for QTY, Unit Price, Discount (%), GST (%), and Line Total.
- Highlighted currently active row with 50% opacity orange tint (`#FFF7ED`) and 2px left accent bar in `#EA580C`.

### Status Badges & Chips
- Dense 20px height, 6px horizontal padding, 4px corner radius.
- **Paid / Completed:** `#DCFCE7` background with `#15803D` text.
- **Low Stock:** `#FEF3C7` background with `#B45309` text.
- **Depleted / Void:** `#FEE2E2` background with `#B91C1C` text.
- **Admin / Cashier Roles:** `#E2E8F0` background with `#334155` text.

### Cards & Metrics
- Information-dense metric tiles with large 24px bold numeric totals, trend pills (+12.4%), and immediate 11px subtext comparing against previous shift or target.