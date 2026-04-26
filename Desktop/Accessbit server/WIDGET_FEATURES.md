# AccessBit Widget — Feature Overview

This document lists capabilities implemented in the embedded accessibility widget (source: `test.js`). Descriptions follow the in-widget copy and behavior.

---

## Shell & experience

| Feature | Description |
|--------|-------------|
| **Floating trigger** | Fixed-position control that opens the accessibility panel; loads appearance from server config. |
| **Accessibility panel** | Modal-style UI (teal header, scrollable list of options) with close control. |
| **Shadow DOM** | Widget UI is isolated from host page styles where used. |
| **Remote configuration** | Loads site settings from the worker (`/api/accessibility/config` using `siteId` / `siteToken` from the script URL). |
| **Persistence** | User choices (e.g. language, toggles) are stored in `localStorage` across visits. |
| **Multi-language UI** | Panel strings and controls update for: English, Deutsch, Français, עברית, Русский, العربية, Español, Português, Italiano, 繁體中文. |
| **Reset settings** | One control restores default widget/page adjustments and announces reset to screen readers. |
| **Accessibility statement** | Opens/links to the site’s accessibility statement (driven by customization data). |
| **Hide interface** | Lets users hide the widget UI (with confirmation); supports recovery flow. |
| **Keyboard & screen reader support** | Focus management, ARIA labels, and live announcements for assistive technologies. |

---

## Merchant customization (from the app / API)

These tune how the widget appears on the site; they do not replace the accessibility tools below.

| Area | What it controls |
|------|-------------------|
| **Trigger color** | Accent / button color (`triggerButtonColor`). |
| **Trigger shape & size** | Button geometry (`triggerButtonShape`, `triggerButtonSize`). |
| **Desktop position** | Corner / edge placement and pixel offsets (`triggerHorizontalPosition`, `triggerVerticalPosition`, offsets). |
| **Icon** | Which accessibility icon is shown (`selectedIcon` / `triggerIcon`, plus optional name fields). |
| **Default interface language** | Initial language when no user choice is saved (`interfaceLanguage`). |
| **Mobile** | Show or hide on small screens, and separate mobile positioning (`showOnMobile`, `mobileTrigger*` fields). |
| **Hide trigger** | Option to not show the floating button (`hideTriggerButton`). |
| **Profile visibility** | Which accessibility profiles/features are enabled for the site (`accessibilityProfiles`), when provided. |

---

## Accessibility profiles (one-click bundles)

| Profile | Description |
|---------|-------------|
| **Seizure Safe Profile** | Reduces flashing and strong color motion cues. |
| **Reduce Motion** | Disables animations, transitions, and common flash triggers. |
| **Vision Impaired Profile** | Improves overall text readability and visual clarity. |
| **ADHD Friendly Profile** | Reduces distractions and supports focus. |
| **Cognitive Disability Profile** | Simplifies reading and focusing on content. |
| **Keyboard Navigation (Motor)** | Optimizes for keyboard-only use; works together with screen reader mode. |
| **Blind Users (Screen Reader)** | Tunes the page for compatibility with common screen readers; pairs with keyboard navigation. |

---

## Content & typography tools

| Feature | Description |
|---------|-------------|
| **Content Scaling** | Scales page content in steps (e.g. ±2%) with visible percentage. |
| **Readable Font** | Applies a high-legibility / dyslexia-friendly font treatment. |
| **Highlight Titles** | Outlines or emphasizes heading elements (`h1`–`h6`). |
| **Highlight Links** | Visually emphasizes links. |
| **Text Magnifier** | Floating magnifier for hovering over text. |
| **Adjust Font Sizing** | Stepwise font-size adjustment (e.g. ±5%) with percentage display. |
| **Text alignment** | Center, left, or right alignment for text content. |
| **Adjust Line Height** | Stepwise line-height adjustment (e.g. ±10%). |
| **Adjust Letter Spacing** | Stepwise letter-spacing adjustment (e.g. ±10%). |

---

## Color, contrast & display

| Feature | Description |
|---------|-------------|
| **Dark Contrast** | Dark background with light text. |
| **Light Contrast** | Light background with dark text. |
| **High Contrast** | Strong foreground/background separation. |
| **High Saturation** | Increases color intensity. |
| **Low Saturation** | Reduces color intensity. |
| **Monochrome** | Grayscale (black, white, grays). |
| **Adjust Text Colors** | User-controlled text color adjustments. |
| **Adjust Title Colors** | Color customization focused on headings. |
| **Adjust Background Colors** | Background color customization. |

---

## Media, motion & reading aids

| Feature | Description |
|---------|-------------|
| **Mute Sounds** | Suppresses audio playback on the page. |
| **Hide Images** | Hides images for a text-focused view. |
| **Read Mode** | Strips or de-emphasizes chrome (e.g. nav) for reading. |
| **Reading Guide** | Movable horizontal highlight bar to track reading position. |
| **Stop Animations** | Pauses CSS-driven animations. |
| **Reading Mask** | Dimmed overlay with a clear “window” to focus on one region. |
| **Highlight Hover** | Stronger visual feedback when hovering elements. |
| **Highlight Focus** | Clear, high-visibility focus indicators. |
| **Big Black Cursor** / **Big White Cursor** | Larger pointer for visibility on light or dark backgrounds. |

---

## Useful links

| Feature | Description |
|---------|-------------|
| **Useful Links** | Dropdown of curated links (e.g. help, feedback, legal) — labels and options are translated with the rest of the UI. |

---

## Implementation note

The deployed `widget.js` should stay aligned with this codebase; feature names and behavior are defined in `test.js` (profile list around the `createPanelElements` / `profiles` configuration and related handlers).
