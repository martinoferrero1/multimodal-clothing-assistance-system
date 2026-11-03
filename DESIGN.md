---
name: Lookeate
description: An expressive, intuitive styling workspace.
colors:
  accent: "#d0bcff"
  accent-soft: "rgba(208, 188, 255, 0.16)"
  background: "#131313"
  surface-lowest: "#0e0e0e"
  surface-low: "#1c1b1b"
  surface: "#201f1f"
  surface-high: "#2a2a2a"
  surface-highest: "#353534"
  text: "#e5e2e1"
  muted: "#b8b0b1"
  muted-soft: "#8f8788"
  line: "rgba(255, 255, 255, 0.1)"
  line-strong: "rgba(255, 255, 255, 0.18)"
  accent-ink: "#1b1b1b"
  danger: "#ffb4ab"
  danger-surface: "rgba(147, 0, 10, 0.24)"
  danger-line: "rgba(255, 180, 171, 0.28)"
typography:
  display:
    fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Garamond, Georgia, serif'
  body:
    fontFamily: '"Avenir Next", "Segoe UI", "Helvetica Neue", Helvetica, sans-serif'
  label:
    fontFamily: '"Avenir Next", "Segoe UI", "Helvetica Neue", Helvetica, sans-serif'
    fontSize: "0.75rem"
    letterSpacing: "0.28em"
rounded:
  control: "0.5rem"
  card: "1rem"
  large-card: "1.5rem"
  pill: "9999px"
spacing:
  compact: "0.5rem"
  small: "1rem"
  medium: "1.5rem"
  large: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.text}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.control}"
    padding: "1rem 1.25rem"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "1rem 1.25rem"
  chip-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.pill}"
    padding: "0.5rem 1rem"
  card:
    backgroundColor: "{colors.surface-low}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "1.5rem"
---

# Design System: Lookeate

## Overview

**Creative North Star: "The Styling Atelier"**

Lookeate is expressive and creative without overwhelming the user. Its modern
workspace combines editorial serif headings with practical sans-serif controls,
dark layered surfaces and Soft Lavender accents. The intent is intuitive,
uncluttered interaction, with creative and tactile controls.

**Key Characteristics:**
- Dark, layered surfaces with restrained lavender highlights.
- Editorial headings paired with functional interface typography.
- Rounded controls, light borders and subtle ambient depth.
- Clear hierarchy with room for content and interaction.

## Colors

### Primary

- **Soft Lavender** (`accent`): selection, focus, icons and emphasis. Its
  translucent companion marks selected controls and accents larger areas.

### Neutral

- **Charcoal surfaces** (`background`, `surface-lowest` through
  `surface-highest`): establish the dark canvas and distinguish layers.
- **Warm light text** (`text`), **muted grey** (`muted`) and **soft grey**
  (`muted-soft`): establish readable hierarchy.
- **Translucent hairlines** (`line`, `line-strong`): separate panels and
  controls without heavy outlines.
- **Dark ink** (`accent-ink`): text on light primary actions.
- **Soft coral** (`danger`) and its surface and line companions: error states.

The recommendation side panel is a deliberate light exception: it locally
overrides surfaces, text and borders with translucent whites and dark ink, using
a lavender-tinted gradient. It is not a general light theme.

## Typography

The serif stack provides editorial headings and branding; the sans-serif stack
supports body copy, controls and labels. Font availability depends on the user's
system, so the fallback stacks are part of the design.

- **Display and titles:** serif, with examples at 1.5rem–2.25rem and tight
  leading; larger headings vary by surface.
- **Body and controls:** sans-serif, commonly 0.875rem with comfortable leading.
- **Labels:** small sans-serif, frequently uppercase and widely tracked; the
  authentication labels use the frontmatter label values.

## Layout

The application uses a flexible workspace shell. On desktop the assistant
sidebar can collapse; below the `lg` breakpoint it becomes a drawer and the
header presents a menu control. Content padding commonly steps from 1rem on
small screens to 1.5rem at `sm`. Grids adapt column counts to available width;
catalog product cards use a portrait image ratio. Modals can align to the bottom
on small screens and center on larger screens.

## Elevation & Depth

Depth is subtle and ambient: tonal surface changes, translucent hairlines and
blurred glass distinguish layers, with shadows supporting floating surfaces.
The shared soft shadow is `0 16px 48px rgba(0, 0, 0, 0.22)` and the floating
shadow is `0 8px 24px rgba(0, 0, 0, 0.18)`. Glass surfaces use 24px or 28px
backdrop blur; the light recommendation surface uses 34px blur and saturation.

## Shapes

Controls commonly use 0.5rem corners; cards use 1rem to 1.5rem, with larger
dialogs around 1.75rem. Pills and circular icon controls use fully rounded
ends. Hairline borders define edges, while product imagery is clipped to rounded
card boundaries.

## Components

### Buttons

Authentication primary buttons use a light fill with dark ink, 0.5rem corners,
and 1rem by 1.25rem padding. They lift slightly and fade on hover; disabled
actions reduce opacity. Other product actions commonly use pill shapes, white
fills or subtle outlined treatments, with lavender on hover.

### Inputs and filters

Authentication fields use a dark surface, hairline border and 0.5rem corners;
focus changes the border to Soft Lavender. Search fields may use a glass surface
and larger corners. Filter chips are pill-shaped; selected chips combine a
lavender border, translucent fill and lavender text.

### Cards and dialogs

Cards use dark or glass surfaces, rounded corners, fine borders and typically
1rem–1.5rem padding. Product cards pair prominent portrait imagery with an
editorial title and compact metadata. Dialogs use a dark modal shell, stronger
hairline and floating shadow.

### Navigation

The assistant's sidebar is a dark, translucent surface with a subtle inset edge.
Desktop supports collapsing it; smaller screens use a drawer. Icon controls
often use circular or softly rounded containers.

## Do's and Don'ts

### Do:
- **Do** use the existing surface and text tokens to preserve hierarchy.
- **Do** use Soft Lavender for interaction emphasis and selected states.
- **Do** keep depth ambient and controls creative and tactile.
- **Do** keep interfaces intuitive and free of unnecessary clutter.

### Don't:
- **Don't** overwhelm the user with excessive text or unnecessary elements.
- **Don't** treat the light recommendation panel as a global light theme.
