# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Three roles, all staff/attendees at a single live corporate event (not the general public):
- **Asistentes** (event attendees): scan their own credential QR on their phone browser to check progress toward the stand-visit raffle. No login.
- **Marcas aliadas / stand reps**: staff at each of 16 sponsor stands, on a shared phone/tablet at the stand, unlock scanning with a 6-digit PIN Fiberlux's marketing team gave them. No account, just a PIN per stand.
- **Equipo MKT (Fiberlux marketing/ops staff)**: run door check-in, manual registration with thermal-label printing, and watch live metrics. Logged in via a single shared Supabase Auth account. Used on phones at the door **and** on a laptop/tablet at a control table during the event — the MKT dashboard specifically needs to hold up on a wider screen, not just mobile.

## Product Purpose

Digitizes attendance tracking and stand-visit gamification for "Encuentros Fiberlux ISP" (Fiberlux's ISP industry networking event, 2026 edition). Replaces paper/Excel check-in. Attendees who visit all 16 sponsor stands qualify for a raffle; the app tracks that live and gives Fiberlux's marketing team a real-time dashboard (traffic per stand, total check-ins, raffle-eligible count) to report ROI to sponsor brands afterward.

## Operating Context

- Runs live, in-person, at the event venue — phones and shared stand tablets on venue WiFi/cellular, which can be crowded/unreliable.
- Door check-in and manual registration end with a physical thermal label printed on a Brother QL-820NWB (fixed 62×30mm label, QR + name + company) — this print flow and its exact label dimensions are a hard constraint, not a visual choice.
- Stand reps scan attendee QR codes with the phone/tablet camera, back camera, continuously (not one-shot) — feedback must not block the next scan.
- MKT staff need both quick mobile access (door) and a comfortable wider-screen view (control table) in the same build.
- No native app — this is a single static HTML file (no build step) deployed as-is to Netlify; "vibe coding" pace, one person maintaining it.

## Capabilities and Constraints

- Backend is Supabase (Postgres + Edge Functions + Auth), migrated this same project from a prior Google Apps Script + Sheets backend — see `PLAN_MIGRACION_SUPABASE.md`.
- This redesign is **visual only**: preserve all existing JS behavior, data flow, and function names in `index.html` exactly. No functional changes.
- Single-file constraint: everything (HTML/CSS/JS) lives in `index.html`, no bundler/build step, no framework. External libs already in use via CDN: `qrcodejs`, `html5-qrcode`, `@supabase/supabase-js`.
- 16 sponsor stands, fetched live from Supabase (`stands_publico`) — count is not hardcoded.
- Font is Poppins (already loaded, already matches the new reference — no change needed).
- Icon system: replacing all emoji in UI chrome (buttons, headers, status indicators) with real icon glyphs, to match the reference. Emoji may remain only inside toast message text (✅/❌/⚠️), which is copy, not UI iconography.

## Brand Commitments

- Fiberlux ISP brand purple (`#96237a` family) and the existing light/dark theme pairing are established and confirmed — not up for revision. (The user's own design reference happens to reuse this exact palette, so this is a non-conflict.)
- Fiberlux logo (`Logo-Encuentros-07.png`) and "Encuentros Fiberlux ISP" event naming are fixed.
- Existing light/dark mode toggle (persisted via localStorage) is a confirmed feature to preserve.
- **Eyebrow-label-above-heading pattern is user-confirmed, pinned.** The Lovable reference uses it structurally on nearly every screen ("CREDENCIAL VERIFICADA" / name, "STAND ASIGNADO" / stand name, "Panel interno" / dashboard title). The impeccable skill's craft-floor treats this as an absolute ban with no brief exception ("no brief earns it back") — flagged explicitly to the user, who confirmed keeping it because it's a direct reproduction of their externally-commissioned, approved reference, not a habitual choice. Do not strip this pattern in future polish passes without asking again.
- Circular progress ring (stand-visit count) is likewise a direct match to the reference's own progress screen — same reasoning as above; not a "sparkline standing in for content" per the craft-floor's general concern, since it displays the real, load-bearing metric (X/16 stands) with the number shown, not decoration in place of data.

## Evidence on Hand

- A polished visual reference the user commissioned externally (Lovable.dev prototype) for this exact app's screens: selector, attendee progress, stand scanner, MKT dashboard. Treated as the target visual world for this redesign — colors extracted directly from its computed styles (see redesign work log).
- Real production data already live in Supabase: 148 real attendees, 16 real stands with real PINs.

## Product Principles

1. Scanning and check-in are the critical path — never let visual polish add friction, block a rapid-fire scan queue, or hide the "next action" behind decoration.
2. One shared visual language across all four surfaces (selector, attendee, stand, MKT) — a stand rep and an MKT staffer should feel like they're in the same product.
3. Preserve exact function — this is a UI reskin of a working, freshly-migrated backend integration; behavior parity is non-negotiable.
4. Mobile-first, but the MKT dashboard must also read well on a laptop/tablet at the control table without a separate build.
