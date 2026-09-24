---
name: Encuentros Fiberlux ISP
description: Operate-mode event-day check-in and stand-scanning tool for Fiberlux's ISP networking event
colors:
  purple:
    light: "#96237a"
    dark: "#c24aa3"
  purple-dark:
    light: "#6e1a5b"
    dark: "#a8348a"
  purple-deep:
    light: "#4a1240"
    dark: "#7a2d66"
  purple-tint-04:
    light: "#fdf3fb"
    dark: "#241a26"
  purple-tint-10:
    light: "#f6e2f1"
    dark: "#33232f"
  purple-tint-20:
    light: "#ecc6e2"
    dark: "#4a2f42"
  ink:
    light: "#1c1522"
    dark: "#f3ecf1"
  gray:
    light: "#5f6368"
    dark: "#b7aebd"
  gray-line:
    light: "#e4e0e6"
    dark: "#3a2f3d"
  page-bg:
    light: "#f7f4f7"
    dark: "#14101a"
  card-bg:
    light: "#ffffff"
    dark: "#201a24"
  btn-secondary-bg:
    light: "#efe9ee"
    dark: "#2b232f"
  text-faint:
    light: "#a89fa5"
    dark: "#8d8492"
  success:
    light: "#1a9a54"
    dark: "#3ecf8e"
  success-tint:
    light: "#e3f9ed"
    dark: "#16302a"
  danger:
    light: "#d5254e"
    dark: "#ef6b8c"
  danger-tint:
    light: "#fde8ec"
    dark: "#3a1c26"
  warning:
    light: "#a65d05"
    dark: "#e8ab54"
  warning-tint:
    light: "#fdf0dc"
    dark: "#3a2c16"
  info:
    light: "#0369a1"
    dark: "#63bdf0"
  info-tint:
    light: "#e0f2fe"
    dark: "#142a38"
typography:
  headline:
    fontFamily: "Poppins, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Poppins, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.25
  stat:
    fontFamily: "Poppins, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1
  body:
    fontFamily: "Poppins, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Poppins, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.02em"
    textTransform: "uppercase"
rounded:
  content: "16px"
  media: "18px"
  banner: "14px"
  input: "12px"
  pill: "999px"
  circle: "50%"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "22px"
components:
  button-primary:
    backgroundColor: "linear-gradient(135deg, {colors.purple}, {colors.purple-dark})"
    textColor: "#ffffff"
    rounded: "29px"
    padding: "0 24px"
    height: "58px"
  button-outline:
    backgroundColor: "{colors.card-bg}"
    textColor: "{colors.purple}"
    rounded: "29px"
    height: "58px"
  button-secondary:
    backgroundColor: "{colors.btn-secondary-bg}"
    textColor: "{colors.ink}"
    rounded: "29px"
    height: "58px"
  button-danger:
    backgroundColor: "{colors.danger-tint}"
    textColor: "{colors.danger}"
    rounded: "29px"
    height: "58px"
  card:
    backgroundColor: "{colors.card-bg}"
    rounded: "{rounded.content}"
    padding: "22px"
  credential-card:
    backgroundColor: "linear-gradient(135deg, {colors.purple-deep}, {colors.purple-dark})"
    textColor: "#ffffff"
    rounded: "{rounded.media}"
    padding: "20px"
---

# Design System: Encuentros Fiberlux ISP

## Overview

**Creative North Star: "The Door-Staffer's Control Panel"**

This is an operate-mode, event-day tool — a rounded-pill, soft-shadow control-panel language ported 1:1 from the user's own externally-commissioned reference (a Lovable.dev prototype), not an original visual invention. Speed and legibility of the next action *are* the polish; nothing decorative is allowed to slow a staffer mid-scan-queue at the door. The system rejects two things explicitly: the flat, solid-border, emoji-as-icon look of the prior build, and any ornament that would compete with the "what do I tap next" moment.

Four roles — attendee, stand rep, MKT staff, first-time visitor — share one visual language across four surfaces (selector, attendee progress, stand scanner, MKT dashboard) so a stand rep and an MKT staffer on a tablet at the control table feel like they're in the same product. White/near-black cards float on a barely-tinted lavender page; the Fiberlux magenta gradient marks headers, hero cards, and primary actions; Lucide-style 2px-stroke line icons replace every chrome emoji (emoji survive only inside toast copy, which is content, not iconography).

**Key Characteristics:**
- Rounded-pill primary actions (58px tall, 29px radius) with a soft primary-tinted shadow, not a flat drop shadow
- Gradient hero cards (deep-to-mid purple) mark every screen's top-of-stack identity block
- Two-tier corner radius: 16px for ordinary content cards, 18px for media/scanner surfaces
- Eyebrow-label-above-heading and a circular progress ring, both direct ports of the pinned reference (see Do's and Don'ts)
- Line icons (Lucide, 2px stroke) everywhere in UI chrome; emoji confined to toast message text

## Colors

A single-hue system: one purple family carries brand identity and every interactive/accent role, set against near-white (light) or near-black (dark) neutrals, with four semantic status colors (success/danger/warning/info) each paired with its own soft tint background. Both light and dark values are established, confirmed brand assets — not derived automatically — see the `colors` frontmatter for the paired light/dark hex per token.

### Primary
- **Fiberlux Magenta** (`purple`, `#96237a` light / `#c24aa3` dark): the interactive accent — active icons, links, eyebrow labels, focus rings, badge-live text, progress-ring fill, rank-bar fill.
- **Magenta Dark** (`purple-dark`, `#6e1a5b` light / `#a8348a` dark): gradient partner for primary buttons and hero cards; also the darker leg of `btn-main`'s gradient.
- **Magenta Deep** (`purple-deep`, `#4a1240` light / `#7a2d66` dark): the deepest step — hero-card headline color, `btn-dark`, gradient anchor for credential cards and every screen's top identity block.

### Neutral
- **Ink** (`#1c1522` light / `#f3ecf1` dark): primary body text and default heading color.
- **Gray** (`#5f6368` light / `#b7aebd` dark): secondary/help text (`.helptext`), captions under KPI numbers.
- **Gray Line** (`#e4e0e6` light / `#3a2f3d` dark): all hairline borders and dividers (`check-row`, `stand-tile`, inputs).
- **Page** (`page-bg`, `#f7f4f7` light / `#14101a` dark): the app background, under a faint radial magenta-tint wash from the top-left.
- **Card** (`card-bg`, `#ffffff` light / `#201a24` dark): the surface color for every `.card`, modal, and input.
- **Text Faint** (`#a89fa5` light / `#8d8492` dark): pending-state text (unchecked checklist rows).

### Named Rules
**The One-Hue Rule.** Every interactive and brand accent — buttons, links, active icons, progress fill, badges — draws from the single `purple` family (three steps: `purple` / `purple-dark` / `purple-deep`) plus its four tints. There is no secondary or tertiary brand hue; status colors (success/danger/warning/info) are the only non-purple accents, and they're reserved strictly for state, never decoration.

**The Tint-Pairs-With-Ink Rule.** Every status/semantic color ships as a `{color}` + `{color}-tint` pair (e.g. `success` / `success-tint`): the saturated value is text/icon color, the tint is its own background — never mixed across pairs (no `danger` text on `warning-tint`).

## Typography

**Display/Body Font:** Poppins (with `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` fallback) — the only typeface in the system, loaded at weights 400/600/700.

**Character:** A single geometric sans carrying every role via weight and size alone — no serif or mono counterpart. Headings lean heavily on 700 weight rather than size to read as "in-charge" fast, since staffers are scanning the screen, not reading it.

### Hierarchy
- **Headline** (700, 22px, 1.2): screen-level card titles at the top of the selector screen ("Módulo de Asistencia").
- **Title** (700, 17–19px, 1.25): sub-screen headers inside hero/gradient cards ("Acceso Marcas Aliadas", stand name on the scanner screen).
- **Stat** (700, 32–34px, 1): the one number that matters on a given screen — KPI counts on the MKT dashboard, the X/16 count inside the progress ring. Always paired with an 11–12px uppercase label directly beneath it.
- **Body** (400, 14px, 1.55): `.helptext` and default paragraph copy.
- **Label** (600, 11–12px, uppercase, 0.02–0.05em tracking): eyebrows, badge-pill text, check-row status text, KPI captions.

### Named Rules
**The Weight-Over-Size Rule.** Hierarchy is carried mostly by font-weight (400 body / 600 label / 700 heading) rather than a wide size range — most UI text sits between 12px and 20px; only the credential/KPI stat numbers break past 30px.

## Layout

Mobile-first, single-column `.app-container` capped at 480px and centered, used by every screen except the MKT dashboard. Body padding is 16px; cards stack with a consistent 16px bottom margin.

The MKT dashboard is the one surface built to also hold up on a laptop/tablet at the control table: past an 860px breakpoint, `.app-container.wide-mkt` widens to 760px, the KPI row (`.mkt-kpi-row`) becomes a 4-column grid instead of a flex row, and the tools/ranking sections (`.mkt-cols`) split into a 1.1fr/1fr two-column layout. No other screen gets a wide-viewport treatment — they stay phone-shaped because they always run on a phone.

Spacing rhythm is tight and consistent: 6–10px between closely related elements (icon-to-label gaps, eyebrow-to-heading), 16px between cards and major blocks, 22px card internal padding.

## Elevation & Depth

Flat-leaning with soft ambient shadows used sparingly and specifically — not a shadow-per-surface system. Two shadow tokens cover the whole app: a subtle resting shadow for cards and floating round buttons, and a deeper "float" shadow for toasts. Primary buttons get their own colored glow instead of the card shadow, tying elevation to brand color rather than generic gray.

### Shadow Vocabulary
- **Card** (`--shadow-card`: `0 2px 4px rgba(74,18,64,0.05), 0 8px 20px rgba(74,18,64,0.07)` light / `0 2px 4px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.4)` dark): resting elevation for `.card`, the ad carousel, theme toggle, and floating footer button.
- **Float** (`--shadow-float`: `0 10px 30px rgba(74,18,64,0.18)` light / `0 10px 30px rgba(0,0,0,0.55)` dark): toast notifications only — the one element that needs to read as "above everything."
- **Primary-button glow** (`0 8px 20px -8px rgba(150,35,122,0.5)`): `.btn-main` only; a tinted, not neutral, shadow — reinforces the button's magenta identity rather than generic depth.

### Named Rules
**The Tinted-Shadow Rule.** Shadow color is never neutral gray/black-only at full strength — card and float shadows are magenta-tinted (`rgba(74,18,64,...)` in light mode), and the primary button's shadow is fully brand-colored. Depth reads as "part of this product," not generic Material elevation.

## Shapes

**The Two-Tier Radius Rule.** Confirmed by consistent, repeated use across the build: ordinary content cards (`.card`, the ad carousel) use 16px radius; media/scanner surfaces that hold imagery or a camera feed (`.credential-card`, `.viewfinder`) use 18px, one step rounder, marking them as a distinct "framed content" tier rather than a plain container. This is a real, load-bearing two-step system, not an inconsistency — every occurrence of 18px radius in the build is one of these two classes, and no other component uses it.

Beyond that content/media pair, the rest of the shape vocabulary: pill buttons at 29px radius (approaching full-round at their 58px height), fully circular avatars/toggles/status-dots (`border-radius: 50%`), true pills for badges (`999px`), and a mid-tier 12–14px radius for inputs, alert banners, toasts, and stand-tiles — visually one step sharper than cards, marking them as "smaller, denser" UI rather than primary containers.

## Components

### Buttons
- **Shape:** full pill, 58px tall, 29px radius — the tallest, roundest interactive element in the system, sized for a thumb mid-scan-queue.
- **Primary (`btn-main`):** white text on the `purple`→`purple-dark` diagonal gradient, plus the brand-tinted glow shadow described above. Reserved for the one primary action per screen (start scan, save, log in).
- **Outline (`btn-outline`):** transparent/card-colored fill, 2px `purple` border, `purple` text — the "secondary but still branded" action (Control de Stands on the selector, tool buttons on MKT).
- **Secondary (`btn-secondary`):** flat `btn-secondary-bg` fill, `ink` text, no border — back/cancel actions.
- **Dark (`btn-dark`):** solid `purple-deep` fill — a heavier, low-frequency alternative used for a single refresh action in the manual-registration modal.
- **Danger (`btn-danger`):** `danger-tint` fill, `danger` text — session-ending / destructive actions (close scanner session).
- **State:** `:active` scales to 0.97 with 0.92 opacity (a tap-press, not a hover — this is a touch-first product); `:disabled` drops to 0.55 opacity with no transform.

### Cards / Containers
- **Corner Style:** 16px (see Shapes' Two-Tier Radius Rule).
- **Background:** `card-bg` by default; gradient (`purple-deep`→`purple-dark`, white text) for the hero/identity card at the top of nearly every screen; `purple-tint-04` flat variant (`card-flat`, no shadow, hairline border) for a de-emphasized operations panel.
- **Shadow Strategy:** `--shadow-card` at rest (see Elevation & Depth); gradient hero cards keep the same shadow token.
- **Internal Padding:** 22px.

### Inputs / Fields
- **Style:** 56px tall, 1.5px `gray-line` border, 12px radius, `card-bg` background.
- **Focus:** border color shifts to `purple`; no glow/ring — a simple, fast-to-notice color change.
- **Checkboxes:** 18px square, 4px radius, `purple` accent-color (native control, not custom-drawn).

### Navigation
No persistent nav bar — the app is a single-page state machine (`irA()` swaps `.screen.active`), so "navigation" is entirely button-driven: a fixed circular theme toggle (top-right, 44px, `card-bg` on `gray-line` border) and a fixed circular "MKT" footer entry point (bottom-right, 52px, same treatment) are the only persistently-visible chrome. Screen transitions use a 0.22s fade-and-rise (`screen-in` keyframe), not a slide — reinforcing "state change," not "moved to a new place."

### Credential Card (signature component)
The attendee's identity block on the progress screen: a gradient (`purple-deep`→`purple-dark`) card at 18px radius (media tier, not content tier) with a soft decorative circle bleeding off the top-right corner, an eyebrow ("Credencial verificada") with a checkmark icon, the attendee's name at 20px/700, and their company beneath at reduced opacity. This is the system's most ornamented single component and is used nowhere else — it's the credential, not a generic hero card.

### Viewfinder (signature component)
The camera-scanner frame: a near-black box at 18px radius (media tier) with four independent 34px corner brackets (3px `purple` stroke, only two sides each) standing in for a full border — a direct camera-viewfinder metaphor rather than a plain bordered box. Used identically for the attendee's self-scan, stand-rep scanning, and the MKT team's general check-in scanner, so all three feel like the same physical action.

### Progress Ring (signature component)
A circular SVG progress indicator (168px, 11px stroke, rounded cap) showing stands visited out of 16, with the literal `X/16` count layered in the center at 32px/700. Always paired with real data, never used as ambient decoration.

### Check Row / Stand Tile / Badges (secondary components)
- **Check row:** a checklist line (stand name + done/pending icon + status label), 22px circular status icon (`success-tint`/`success` when done, `btn-secondary-bg`/`text-faint` when pending), hairline divider between rows except the last.
- **Stand tile:** a 14px-radius, hairline-bordered selection row (stand login, MKT "support a stand" list); selected state swaps the border to `purple` and the fill to `purple-tint-04`.
- **Badge pill:** 999px-radius status chip, 11px uppercase bold text — `badge-success` (green), `badge-live` (purple tint, with an animated pulse dot for "en línea").
- **Rank avatar:** 28px circular numbered badge (`purple-tint-10` fill, `purple-dark` text) prefixing each row of the stand-traffic ranking, paired with a `rank-bar` fill animated via `transform: scaleX()` (not `width`, to stay off the layout thread during live dashboard refreshes).

## Do's and Don'ts

### Do:
- **Do** keep every interactive/brand accent inside the single `purple` family (Primary section) — no second brand hue.
- **Do** use the 58px/29px pill shape for every primary and secondary button; it's the system's single most repeated silhouette.
- **Do** pair every stat number (KPI, progress count) with an uppercase 11–12px label directly beneath it — a number alone is not a component here.
- **Do** use the tinted, not neutral, shadow formula (Elevation & Depth) for any new floating or primary element.
- **Do** keep screen transitions to the existing fade-and-rise; don't introduce a slide/push transition for a single-page state machine.

### Don't:
- **Don't** introduce a second border-radius tier beyond the documented content(16px)/media(18px) pair without evidence it's load-bearing, not incidental — see Shapes.
- **Don't** put emoji in UI chrome (buttons, headers, status badges, icons). Emoji are copy-only, confined to toast message text.
- **Don't** add a shadow that isn't the tinted card/float/button-glow vocabulary already documented — no plain neutral `box-shadow: 0 2px 4px rgba(0,0,0,.1)` style additions.
- **Don't** treat the eyebrow-label-above-heading pattern or the circular progress ring as generic, always-available house style for a *different*, future surface. Both are confirmed here only because they directly reproduce the user's own externally-commissioned, pinned Lovable.dev reference (see PRODUCT.md, "Brand Commitments") and were explicitly kept after being flagged as normally-banned patterns. A new surface that wants either pattern needs its own pinned-reference justification, not a citation of this file.
