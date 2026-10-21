# Dark Kingdom War — UI Interaction Lab

Read all six files in `docs/handoff`, beginning with START_HERE_CODEX.md. Adaptive
Window Geometry v0.2.1 is the architecture source of truth.
Read docs/BUGFIX_TASK_02.md for the owner's approved ReleaseButton exception and
the experimental touch-only Slop adjustment; it supersedes the original release
policy for explicitly declared ReleaseButtons only. Read docs/BUGFIX_TASK_03.md
for the approved Strict Tap, lifecycle, carousel and Draft & Recovery contracts.
Read docs/BUGFIX_TASK_04.md for native module-strip scrolling and Module 04 Event Guide,
sequential reading, local swipe arbitration and independent durable progress.
Read docs/MODULE04_CHAT_SPEC.md and docs/MODULE04_CHAT_REPORT.md for the approved
world-first startup/reload policy, durable shared chat, safe text and scoped resets.
Read docs/FINAL_QA_01_06_SPEC.md and docs/FINAL_QA_01_06_REPORT.md for the later
approved index-first Lab startup, native index-card scrolling and unfinished-guide
auto-resume policy. These supersede the earlier startup/first-entry-only rules.

Non-negotiable contracts:

- Pointer Events are the primary input; keyboard activation is an additional accessible path.
- Ordinary actions activate on valid release, never PointerDown.
- Declared ReleaseButtons track untransformed functional bounds under pointer
  capture: inside -> PRESSED, outside -> RELEASED, any return -> PRESSED.
  Up inside activates once, Up outside/cancel never activates; Slop cannot cancel
  this candidate. Keep the button in place; press-depth feedback is independent.
- Ordinary controls use Strict Tap: any movement wholly inside remains valid;
  the first exit permanently cancels the candidate even after reentry.
- Hold candidates and card taps remain permanently cancelled after Slop crossing.
  In carousel cards,
  abs(dx) >= abs(dy) selects CAROUSEL (including exact 45 degrees); otherwise
  MODULES. Ownership locks until up/cancel. Background belongs to MODULES.
- Card selection, temporary press/drag, mouse hover and keyboard focus are separate.
  End/cancel/interrupt clears temporary states, never the real selection. Native
  sticky :hover must not highlight touch cards.
- Before recognition, leaving/re-entering can unpress/repress a valid candidate.
  Recognized hold survives movement anywhere; up anywhere/cancel terminates.
- Interaction and availability are independent. Unavailable hold pauses without
  backlog; availability can resume repeat. No extra click on hold release.
- Screen -> safe area -> window -> functional bounds. Preserve state on resize;
  observe events, coalesce with requestAnimationFrame, never poll geometry.
  Live resize simplifies effects, not geometry. Content preserves aspect ratio.
  Protect target sizes, stop at WindowMax, constrain preview by width, allow scroll.
- Repeat instances have independent Availability. End/cancel/blur/hidden/unmount
  clears timers and listeners; stale callbacks cannot re-arm. Initial Repeat delay
  multipliers never change Hold recognition or Bounded Steps acceleration.
- Carousel extents use real content, symmetric insets, count-independent N + Peek.
  Logarithmic resistance has no hard clamp; continuing touch handoff keeps owner.
- Current, durable Draft, Applied and action outcome stay separate. IndexedDB
  transaction completion earns saved status; session/version guards protect the
  storage itself. Apply/confirmed Discard invalidate obsolete writes.
- Destructive draft/delete/cleanup choices require explicit in-lab confirmation.
  Simulated crash resets volatile state and rehydrates actual durable storage.
- Module-strip touch scrolling must start on buttons; scroll never activates a tab.
- Lab cold startup/reload shows the six-module index, never auto-opens a module.
  Index cards retain native document pan, Strict Tap and keyboard activation.
- Guide buttons/dots/swipes share page accessibility. Only durable acknowledgment
  unlocks the next article; completed-open checks differ from reopened reference mode.
  Guide vertical touch scroll stays native; axis owner locks and one swipe changes
  at most one page. Reset requires confirmation and fences stale writes in storage.
- Module 04 always starts/reloads/restarts at world without erasing guide progress.
  Every real World -> Event entry auto-opens incomplete reading at the first
  durably unacknowledged page. Completed guides open only on Help. Same-visit Help
  preserves last viewed page; all newly shown articles start at top.
  Event reset preserves settings/chat; full Module 04 reset atomically clears only
  Module 04 records and diagnostics after explicit confirmation.
- Chat input/producers/restore/send treat content as plain text, strip tag-like
  markup before the 500-grapheme cap and render only through text APIs.
  Emoji toggle never inserts; emoji items never close the picker or force focus.
  Send synchronously claims once, deduplicates stable IDs and starts cooldown only
  on durable acceptance. Seeds resume once; Live never resumes after reload.
  Emoji inserts at the live textarea selection even before queued selection events;
  never force focus. Expanded composer deliberately reveals ~3.5 lines before scroll.
- Experimental values remain runtime editable and visibly EXPERIMENTAL.
- No invented game assets, backend/auth/database, analytics, API keys or secrets.
- PASS must follow a performed check. Separate synthetic/browser automation,
  user observation and physical-device checks. Never alter expectations to pass.

Run `npm run check`, `npm test`, `npm run test:e2e`, `npm run build` for relevant
changes. Read README.md and docs/IMPLEMENTATION.md for current implementation.
Do not publish, create external resources or connect GitHub without permission.
