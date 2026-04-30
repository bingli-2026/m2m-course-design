---
name: Technical Precision
colors:
  surface: '#faf8ff'
  surface-dim: '#d8d9e6'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#ecedfa'
  surface-container-high: '#e6e7f4'
  surface-container-highest: '#e1e2ee'
  on-surface: '#191b24'
  on-surface-variant: '#424656'
  inverse-surface: '#2e303a'
  inverse-on-surface: '#eff0fd'
  outline: '#727687'
  outline-variant: '#c2c6d8'
  surface-tint: '#0054d6'
  primary: '#0050cb'
  on-primary: '#ffffff'
  primary-container: '#0066ff'
  on-primary-container: '#f8f7ff'
  inverse-primary: '#b3c5ff'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#a33200'
  on-tertiary: '#ffffff'
  tertiary-container: '#cc4204'
  on-tertiary-container: '#fff6f4'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae1ff'
  primary-fixed-dim: '#b3c5ff'
  on-primary-fixed: '#001849'
  on-primary-fixed-variant: '#003fa4'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#ffdbd0'
  tertiary-fixed-dim: '#ffb59d'
  on-tertiary-fixed: '#390c00'
  on-tertiary-fixed-variant: '#832600'
  background: '#faf8ff'
  on-background: '#191b24'
  surface-variant: '#e1e2ee'
typography:
  display-data:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  status-label:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 20px
  margin: 24px
---

## Brand & Style
The design system is engineered for machine-to-machine (M2M) monitoring and control environments where data density and operational clarity are paramount. The brand personality is utilitarian, high-fidelity, and authoritative, designed to evoke a sense of absolute control and real-time reliability.

The design style follows a **Corporate / Modern** aesthetic with subtle influences of **Minimalism**. It prioritizes high legibility and rapid cognitive processing. The UI avoids decorative elements in favor of functional indicators, utilizing a "data-first" hierarchy where status and telemetry are the primary visual drivers.

## Colors
The color palette is strictly functional. The **Primary Tech Blue** serves as the interactive anchor, used for primary actions and active states. The semantic palette (Success Green, Warning Orange, Critical Red) is reserved exclusively for status indications and threshold alerts to prevent visual fatigue.

Backgrounds utilize a two-tier system: **White (#FFFFFF)** for interactive cards and foreground containers, and **Very Light Gray (#F8FAFC)** for the application canvas to provide subtle contrast. Grays are slightly blued (Slate) to maintain a technical, "cool" temperature across the interface.

## Typography
This design system utilizes **Inter** for its systematic, neutral qualities in all UI and body text, ensuring readability at small scales. For telemetry and critical data points, **Space Grotesk** is introduced to provide a distinct, technical character that differentiates raw data from interface labels.

Numerical data should always use tabular lining figures to ensure vertical alignment in monitoring tables. Use `label-caps` for metadata and section headers to create a clear structural anchor without requiring large font sizes.

## Layout & Spacing
The layout employs a **Fluid Grid** system with a 12-column structure for dashboard views. It follows a strict 4px baseline grid to maintain alignment across dense data tables and instrument panels.

Spacing is tight but intentional, allowing for high information density without clutter. Containers use `lg` (24px) padding for primary dashboard widgets and `md` (16px) for nested data sets. Use horizontal gutters of 20px to provide clear separation between monitoring cards while maximizing screen real estate.

## Elevation & Depth
Depth is communicated through **Tonal Layers** and **Low-Contrast Outlines** rather than heavy shadows. This maintains the professional, clean aesthetic required for technical software.

- **Level 0 (Canvas):** #F8FAFC. The base layer for all content.
- **Level 1 (Cards):** #FFFFFF with a 1px border of #E2E8F0. No shadow in default state.
- **Level 2 (Hover/Active):** Subtle ambient shadow (0px 4px 12px rgba(0, 0, 0, 0.05)) to indicate interactivity.
- **Level 3 (Modals/Overlays):** Medium diffused shadow with a 1px border to separate control panels from the background data.

## Shapes
The shape language is **Soft** (roundedness: 1), utilizing a 4px (0.25rem) base radius. This creates a modern feel that remains crisp and professional. Large containers like primary dashboard cards may scale up to 8px (0.5rem) to provide a softer visual framing for complex charts, but inner components like buttons, input fields, and status chips must remain at 4px to preserve the technical "grid" feel.

## Components
- **Control Buttons:** Use solid Primary Tech Blue for destructive or high-priority actions. Secondary actions use an outlined style with #E2E8F0 borders. Text is always centered and semi-bold.
- **Status Indicators:** Represented as "Pills" with a light background tint (10% opacity) of the status color and a solid 6px dot of the status color to the left of the label.
- **Monitoring Cards:** White background, 1px border, with a header section containing a `label-caps` title and an optional action icon.
- **Real-time Line Charts:** Use a 2px stroke width for data lines. Use the primary blue for the main metric, with a subtle 5% blue vertical gradient fill (area chart) below the line for better visual tracking.
- **Input Fields:** Flat, white background with a 1px #E2E8F0 border. On focus, the border shifts to Primary Blue with a 2px soft outer glow (ring).
- **Data Grids:** Zebra-striping is discouraged; use subtle 1px horizontal dividers (#F1F5F9). Column headers should be `label-caps` for maximum distinction from the data.