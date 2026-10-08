# Dark Kingdom War — UI Interaction Lab

Read all six files in `docs/handoff`, beginning with START_HERE_CODEX.md. Adaptive
Window Geometry v0.2.1 is the architecture source of truth.

Non-negotiable contracts:
- Pointer Events are the primary input; keyboard activation is an additional accessible path.
- Ordinary actions activate on valid release, never PointerDown.
- Slop crossing permanently cancels the current tap. In carousel cards,
  abs(dx) >= abs(dy) selects CAROUSEL (including exact 45 degrees); otherwise
  MODULES. Ownership locks until up/cancel. Background belongs to MODULES.
- Before recognition, leaving/re-entering can unpress/repress a valid candidate.
  Recognized hold survives movement anywhere; up anywhere/cancel terminates.
- Interaction and availability are independent. Unavailable hold pauses without
  backlog; availability can resume repeat. No extra click on hold release.
- Screen -> safe area -> window -> functional bounds. Preserve state on resize;
  observe events, coalesce with requestAnimationFrame, never poll geometry.
  Live resize simplifies effects, not geometry. Content preserves aspect ratio.
  Protect target sizes, stop at WindowMax, constrain preview by width, allow scroll.
- Experimental values remain runtime editable and visibly EXPERIMENTAL.
- No invented game assets, backend/auth/database, analytics, API keys or secrets.
- PASS must follow a performed check. Separate synthetic/browser automation,
  user observation and physical-device checks. Never alter expectations to pass.

Run `npm run check`, `npm test`, `npm run test:e2e`, `npm run build` for relevant
changes. Read README.md and docs/IMPLEMENTATION.md for current implementation.
Do not publish, create external resources or connect GitHub without permission.
