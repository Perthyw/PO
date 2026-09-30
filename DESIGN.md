---
version: beta
name: PO The Grands
description: Thai purchase-order tracking workspace inspired by the clarity of parcel tracking.
colors:
  primary: '#2878c7'
  primaryHover: '#1c5f9f'
  background: '#f3f9ff'
  panel: '#ffffff'
  text: '#18324a'
  muted: '#60758a'
  border: '#cfe2f3'
  accent: '#76b8ee'
  success: '#2576a8'
  danger: '#930400'
  status: '#930400'
  cream: '#fff7e6'
typography:
  sans:
    fontFamily: 'Tahoma, Leelawadee UI, sans-serif'
  mono:
    fontFamily: 'Consolas, monospace'
rounded:
  DEFAULT: '14px'
  control: '9px'
spacing:
  section-gap: '22px'
  page-max: '1320px'
components:
  button: {}
  field: {}
  tracker: {}
  dialog: {}
---

# PO The Grands Design System

## Overview

North Star: a purchase document with the immediate readability of parcel tracking. Thai office staff request; owner decides; both follow the same four-circle route. Product/admin register, Thai-language work on desktop and phone per the user's brief. No Japanese market scope. New independent identity, not an extension of Grandhouse.

Signature: a compact, repeated four-stop tracking line with an explicit stage label on every PO. The visual identity uses wine red, milk cream, and airy blue from the approved reference: red marks the current state and urgent action, blue marks completed progress, and cream creates a calm document surface. No hero, stock photography, decorative charts, or fabricated business data outside labelled demo mode.

Runtime token owner: `dist/style.css :root` (Model B). This document mirrors primary→--brand, primaryHover→--brand-hover, background→--paper, panel→--panel, text→--ink, muted→--muted, border→--line, accent→--accent, success→--success, danger→--danger. Shared helpers in app.js consume CSS classes.

## Colors

Blue for primary actions and completed workflow progress, a slightly deeper pale blue for the application surface, Imperial Blue `#001D51` for persistent navigation, wine red for the page-heading binding edge, current/waiting status, rejection, and destructive actions, and milk cream for authentication. Employee page headings use the same compact document panel. Pages without a header action show a blue document icon; access management shows a person icon and department settings show a blue map pin. The owner list starts directly with status metrics to distinguish its approval workspace. Summary cards use a quiet blue-white surface. Every status has text; no color-only state. Focus is a dark-blue outline; forced colors uses system values.

## Typography

Local Thai-capable Tahoma/Leelawadee UI, 16px base and 1.65 line height. Supporting text stays at least 12–14px depending on viewport, while headings remain 25–30px. PO identifiers use Consolas; monetary values tabular. No remote font dependency or swap. Thai dates use Buddhist calendar and Asia/Bangkok; ISO timestamps in storage.

## Layout

238px desktop navigation, max content 1320px, 42px content inset. The signed-in role and account switch sit under the product name in the desktop sidebar; the top bar keeps the breadcrumb and notification bell. At 1100px reduce navigation/inset, wrap the sidebar wordmark within its rail, show dashboard metrics in two columns, and stack each order tracker; at 700px compact horizontal navigation and two-column summary tiles, one-column forms. Document owns vertical scrolling; tables own horizontal overflow. Mobile inset 16px. Forms grow naturally.

## Elevation & Depth

Use borders for panels. Only modal overlays have a substantial shadow. Avoid nested shadow cards.

## Shapes

Panels 14px, order documents 11px, controls 9px. All fields use the same 48px minimum height, 12px inset, and blue-gray border. Circles are reserved for progress and identity; badges use compact corners.

## Components

Shared field(), tracker(), badge(), itemsTable(), summary(), openModal(), notify() and withPending() in dist/app.js. Native labelled inputs and checkbox; native dialog provides focus containment, Escape and inert background. No select/date picker required: date/time are server-generated. Buttons distinguish primary, neutral, danger; hover, focus, active, disabled and aria-busy provided. Native dialog starts on cancel for consequential action. Loading uses fixed minimum space and meaningful text. Errors preserve form values, associate field feedback and focus first invalid input. One global live status. Common action labels imported from domain.js.

The brand mark is a compact archive box holding layered blue, blush, grey, and teal folders on a cream tile. It reflects the product's job of organizing purchase documents and remains legible in the sidebar, login screen, and browser tab. Other icons are supplementary text symbols, never the sole action name. Motion is minimal, reduced-motion respected. Thai labels and THB two-decimal figures. Status tracker always has text equivalent.

## Do's and Don'ts

- Do show that demo records stay only in this browser and are not connected to a shared database.
- Do keep amount, status, and next action easy to scan.
- Use the stated 7% VAT-inclusive calculation and never skip invoice confirmation for NON VAT.
- Don't use browser role selection as production authorization.

