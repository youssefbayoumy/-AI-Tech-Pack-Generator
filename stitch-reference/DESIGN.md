---
name: Atelier Logic
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
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#515f74'
  on-secondary: '#ffffff'
  secondary-container: '#d5e3fd'
  on-secondary-container: '#57657b'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#2a1700'
  on-tertiary-container: '#b87500'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#d5e3fd'
  secondary-fixed-dim: '#b9c7e0'
  on-secondary-fixed: '#0d1c2f'
  on-secondary-fixed-variant: '#3a485c'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-sm:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  spec-code:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1.5'
    letterSpacing: -0.01em
  label-caps:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin: 32px
  container-max: 1440px
---

## Brand & Style

This design system establishes a high-precision interface for fashion technology and product lifecycle management. It merges the sophisticated, high-contrast aesthetic of a luxury fashion editorial with the rigorous, data-driven layout of architectural blueprints. 

The visual language is rooted in **Minimalism** and **Modern Corporate** styles, emphasizing clarity over decoration. It avoids common "AI" tropes (glows, gradients) in favor of a "Drafting Table" metaphor: clean surfaces, razor-sharp alignment, and intentional whitespace that allows complex technical data to breathe. The emotional response is one of absolute control, reliability, and professional authority.

## Colors

The palette is restrained and functional, designed to remain neutral so that garment imagery and technical sketches remain the focal point.

- **Primary (Slate 900):** Used for primary typography and structural headers.
- **Secondary (Slate 700):** Used for secondary text and non-critical UI icons.
- **Utility Blue:** Reserved for active states, primary actions, and system confirmations.
- **Safety Amber (Tertiary):** Used sparingly for alerts, warnings, or "In Review" statuses within the tech pack workflow.
- **Neutral Surface:** A range of soft whites (Slate 50) and crisp whites (#FFFFFF) to create subtle separation between work areas.
- **Borders:** A consistent light gray (Slate 200) is used for the "Weighted Rule" layout system.

## Typography

The system utilizes a dual-font approach to distinguish between UI narrative and technical data.

- **Geist (Sans-Serif):** Used for all interface elements, navigation, and titles. It provides a clean, modern, and neutral foundation that feels contemporary yet professional.
- **JetBrains Mono (Monospaced):** Specifically used for technical specifications, measurements, fabric compositions, and SKU codes. This distinction helps users immediately identify data-heavy information versus instructional UI.
- **Hierarchy:** Use "Label Caps" for section headers in sidebars and tech pack attributes. Use "Spec Code" for all numerical input and output fields.

## Layout & Spacing

The layout is governed by a **Fixed Grid** system that mimics the structured nature of a technical drawing. 

- **Grid Model:** A 12-column grid for desktop, transitioning to a single-column stack for mobile technical reviews.
- **Weighted Rules:** Use 1px solid borders (Slate 200) instead of shadows to define zones.
- **Information Density:** High. Margins are consistent at 32px to provide an editorial feel, but internal component spacing is tight (8px or 16px) to allow for the display of large amounts of data.
- **Desktop:** Sidebar navigation (240px) is fixed to the left, with the primary "Tech Pack Canvas" occupying the center.
- **Mobile:** Elements reflow into a vertical list; horizontal scrolling is permitted only for large measurement tables.

## Elevation & Depth

This design system rejects deep shadows and blurs. Depth is achieved through **Tonal Layers** and **Low-Contrast Outlines**.

- **Surfaces:** All surfaces are flat. Backgrounds use Slate 50, while active workspace "cards" or "panels" use pure white (#FFFFFF).
- **Z-Index:** Hierarchy is communicated by "stacking" panels with 1px borders. A modal or pop-over should not have a heavy shadow; instead, use a 1px border with a slightly darker stroke (Slate 300) and a dim, 20% opacity neutral overlay behind it.
- **Interaction:** Hover states are indicated by subtle background color shifts (e.g., White to Slate 50) rather than vertical movement or shadow growth.

## Shapes

The shape language is "Soft-Technical." Elements use a very small 4px (0.25rem) radius to prevent the interface from feeling "sharp" or aggressive while maintaining a professional, blueprint-like structure.

- **Inputs & Buttons:** 4px radius.
- **Status Tags:** 2px radius (near-sharp) to differentiate from interactive buttons.
- **Large Containers:** 4px radius to maintain consistency across the system.

## Components

- **Buttons:** Primary buttons are solid Slate 900 with White text. Secondary buttons are outlined (1px Slate 200). Text is always centered and uses Geist Semi-bold.
- **Input Fields:** Rectangular with a 1px Slate 200 border. On focus, the border changes to Utility Blue. Use JetBrains Mono for the input text.
- **Data Tables (The "Spec Sheet"):** Rows have a 1px bottom border. Header cells use "Label Caps" with a light Slate 50 background. 
- **Chips/Status:** Small, rectangular tags. Use light background tints of Blue or Amber with high-contrast text for status indicators like "DRAFT," "SAMPLED," or "APPROVED."
- **Cards:** No shadows. Cards are defined by a 1px Slate 200 border. Content should have generous 24px internal padding to maintain the editorial aesthetic.
- **Measurement Inputs:** Specialized components that include a numerical field (Monospace) and a unit dropdown (e.g., CM, IN) in a single joined-border group.
