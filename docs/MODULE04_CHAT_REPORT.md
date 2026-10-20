# Module 04 — Clan Chat, State & Gesture Fixes

2026-10-20. Approved specification: [MODULE04_CHAT_SPEC.md](MODULE04_CHAT_SPEC.md).
Base main: `52d105ff21140bd80188df36d5b7a82beb942e07` (owner merged PR #2).
Branch: `feature/module04-chat`. Deliver through PR; no automatic merge/deployment.
Physical Safari / Chrome iOS acceptance: **PENDING**.

## Approved contract changes

The new specification A supersedes Task 04's world/event/guide restoration:
**every app start, real reload and simulated Module 04 restart opens Module 04 on
world**, retaining guide acknowledgments, last page, completion and all chat data.
Opening Event afterward does not repeat first-entry automatic guide opening.
Help still opens the saved guide page at its top; completed guides use reference
mode after restart/closure. The five-page guide, locking, valid releases and
Back/Next/Hidden/Disabled remain implemented by the existing components.

Scenario, Boundary and Theme are durable. Reset Event State confirms and resets
only event progression, returning to world. Settings, chat, draft and independent
seed schedule remain. **Reset 04 Module** has its own confirmation wording and
resets settings, progress, flags, seed schedule, history, draft, cooldown and
Module 04 diagnostic state. Other modules and their global diagnostic evidence
remain untouched. Resetting the app's global experimental profile is separate.

## Implementation

| File | Responsibility |
|---|---|
| src/chat-text.ts | Plain-text tag filtering, Intl.Segmenter graphemes, selection-aware editing and native/IME reconciliation |
| src/chat-state.ts | Bounded message state, durable settings/draft, seed ledger, simulation, send claim and transaction IDs |
| src/chat-ui.ts | One shared scene chat, 16 emoji controls, focus/caret, composer measurement, safe message rendering and QA |
| src/chat.css | Opaque chat surfaces, sender styles, responsive composer, picker scrolling, falling snow, scoped overscroll containment |
| src/module04-db.ts | Shared Module 04 database connection, separate from Module 06 |
| src/event-state.ts | Existing event guards retained; optional world-on-restart and atomic full-module reset transaction |
| src/event-guide.ts | Integrates shared chat, settings and both reset scopes without replacing guide mechanics |
| src/main.ts | World-first startup and distinct home/index horizontal module strip |
| src/diagnostics.ts | Scoped result/event cleanup that preserves unrelated observations |
| tests/browser/chat.spec.ts | Focused browser regression including actual IndexedDB aborts, delayed writes and CDP touch |
| tests/core.test.ts | Pure Unicode/state tests plus async send claim, retry and draft preservation |

Existing InteractionController, carousel geometry/arbitration, staged allocation,
Module 03 button implementations and Module 06 persistence are unchanged. CSS
containment is scoped to the Module 01 window and Module 04 scenes; no global
`touchmove` preventDefault or document scrolling lock was added.

The home/index now has an explicit horizontal 01–06 navigation surface, separate
from the existing `.index nav` used with the test windows. Both use the already
accepted local native-scrolling Pointer binding. Taps activate only on valid
release; scrolling/cancel cannot accidentally activate a module.

## Messages, schedule and durability

One chat DOM/state instance is shared by world and event; it is not re-created
when those screens switch. It renders the newest **four** messages in chronological
order, newest at bottom, as single-line ellipsis rows. Storage retains **six**
complete sanitized messages with stable ID, author ID, sequence, timestamp and
sender type. `Chat Message History` displays their full contents and metadata via
textContent, including long fixtures and multi-code-point emoji.

Seven fixed clanmate identities map stable author IDs to individual badge colors;
user is a separate eighth participant, system a separate sender. Body colors do
not depend on author array position: neutral clan body, pale-blue user body,
yellow semibold system sender and body without a badge border.

The record `module04-chat-v1` shares Module 04's `dkw-event-guide-v1`/`events`
object store; it never touches Module 06's DB. Per-record epoch/lease/version and
serialized commands guard both the durable record and UI callbacks. Last acquired
tab owns the record; a stale tab reports failure and can restart to rehydrate.

The first actual nonempty world input (including paste/emoji) or first successful
Event transition claims the initial schedule exactly once. Focus alone is inert.
Seed IDs use epoch + seed index; next index/deadline is durable. First delay is
2000 ms; subsequent delays are randomly 1000–2000 ms after preceding insertion.
Reload resumes unfinished seeds without replay. A missed past deadline produces
one next seed, then schedules the next interval; it does not replay a burst of
missed old messages. Producers are serialized by their actual accepted arrival
order, not original trigger order.

Live uses a single guarded timeout at random 4000–7000 ms intervals. Manual Random
inserts exactly one without starting/restarting Live. User sends coexist with both.
Live is volatile and stops on Stop, module suspension, hidden/pagehide, restart or
full reset; reload never resumes it. Initial seeds are independent and may resume
when visible. OS background timer throttling is not treated as a timing failure.

Full reset clears and replaces both Module 04 records **in one readwrite
transaction**. The new epochs fence delayed writers. It is reported complete only
after transaction completion. An injected abort rolls back settings/chat/event
changes together; Retry keeps the same reset scope. Module 04 diagnostic cleanup
happens only after successful reset, leaving other observed PASS/FAIL intact.

## Sending

Send reuses the approved geometric ReleaseButton policy: press inside, unpress
outside, rearm on any return; Up inside sends once, outside/cancel sends zero.
Cooldown is independent of pointer state and does not disable composing. Empty,
whitespace-only or tag-only attempts are silent. The literal placeholder text is
an ordinary valid message if entered by the user.

Stage 1 synchronously claims a send before any render/persistence callback. A
second immediate handler is silently blocked. Stage 2 assigns a stable transaction
ID and deduplicates it in the durable transaction ledger; this metadata contains
IDs, not old message text beyond the six-message history limit. Successful commit
clears only the draft revision that was sent, preserving newer composing input,
and starts one 2500 ms cooldown. Failure keeps the draft and starts no cooldown;
Retry reuses the transaction ID. A new nonempty attempt during cooldown displays
the friendly approved popup. Simulate Double Send calls the real pipeline twice
with one ID and reports deltas for accepted/duplicateBlocked/draftClears/cooldownStarts.
Empty diagnostics create no fabricated message and do not assert a send PASS.

## Text, IME, selection and security

Text remains untrusted plain text throughout. Complete tag-like sequences are
removed before the 500-grapheme cap at editing, paste, restore, producer insertion
and send boundaries. `<color=...>`, `<url=...>`, scripts and arbitrary tags confer
no styling/navigation/execution. Contents between tags remain text. Encoded entities
are not decoded; URL-looking text is not linkified. Ordinary spaced comparisons
such as `2 < 3` remain intact. This is a plain-text policy, not an HTML parser.

Input uses genuine placeholder and no maxlength based on UTF-16. Intl.Segmenter
preserves family emoji, modifiers, flags and combining marks. Selection replacement
keeps untouched suffix/prefix and clips only excess new graphemes; selection
boundaries cannot split an existing grapheme. IME preedit stays native until
compositionend, then is reconciled through the same filter/cap. Stored text never
contains an unvalidated preedit value. These paths are covered synthetically;
actual iOS keyboard/IME behavior remains a physical-device check.

Messages and history use createElement/textContent, never user-data innerHTML.
The only HTML templates contain static UI, fixed emoji controls and existing
trusted guide fixtures. Tests include typing, plain/HTML paste, tag-only values,
encoded tags, script/event-handler payloads, recovered draft and simulated/system
record text, and inert URL-looking strings.

## Composer, picker and visual decisions

The composer uses logical inset/grid spacing ready for future mirroring; no RTL
or localization system was introduced. Controls are icon-only 48×48 and bottom
aligned. Textarea grows through three 24 px lines, then scrolls its own contents.
ResizeObserver/visualViewport events and input changes coalesce into RAF;
caret measurement uses a hidden plain-text mirror without focus or polling.

The left 😅 toggles the picker and inserts nothing. The identical picker item is
separate and inserts at saved caret/selection, keeping the picker open. Sixteen
items form a 4×4 grid on an opaque surface. Constrained height scrolls the picker
itself, including swipes starting on emoji items. Pointer controls preserve an
already-focused textarea and do not focus it for emoji-only composing. Outside
Module 04 interaction closes the picker/removes input focus without swallowing
the intended game or guide event.

World/event/chat backgrounds are opaque behind text. Lightweight snow has no
pointer hit area, lies behind the controls and stops under reduced motion.
The guide stays above its own article area; chat and QA stay distinct. Scrolling
and keyboard safe areas, bounce and focus on physical iPhone require confirmation.

## Tests and evidence

**Final: 242 PASS / 0 FAIL / 0 SKIPPED.**

| Command | PASS | FAIL | Result |
|---|---:|---:|---|
| npm run check | — | — | TypeScript clean |
| npm test | 49 | 0 | Pure/model invariants and async pipeline |
| npm run test:e2e | 177 | 0 | Complete Chromium suite, retries=0, flaky=0 |
| npm run build | — | — | Production dist successful |
| npm run test:static | 16 | 0 | Production dist under /lab/ |

Node 24.19.0; Chromium 151.0.7922.173. [Machine summary](testing/chat-summary.json)
and [production results](testing/chat-static-results.json). Counts describe the
last complete run, not totals across repeat attempts. Historical baseline:
37 model + 141 Chromium + 13 production checks = 191 PASS / 0 FAIL.
Added: 12 model + 36 browser + 3 production = 51 performed checks.
Formatting and git diff --check pass. No test was skipped or marked flaky.

No old tests were removed. Task 04 reload/restart expectations were updated only
where the new approved section A changes that contract: world first, retained
progress, manual Event/Help reopening. Legacy index-input fixtures explicitly
return to the index before testing it. All other expectations remain intact.

Early iterations exposed test-clock setup problems (wall time advanced while
clicking, and async IndexedDB completion needed separate clock steps). Another
fixture issue was Vite hot module instances differing from test-imported module
URLs after source edits; complete runs use a fresh server. Expectations and timing
contracts were preserved. Real storage failure/ordering tests use actual IDB
transactions with test-only failure/delay injection, not fake success.

A further performed regression exposed stale full-reset intent after an aborted
full reset: a later event-only reset could incorrectly clear chat, both directly
and after simulated restart. The reset scope is now cleared on restart or explicitly
replaced (with chat rehydration) when confirming a new event-only reset. Both cases
were reproduced FAIL before the fix and PASS after it; see
[chat-reset-before.json](testing/chat-reset-before.json). The full final suite
includes both cases. Expected preservation was never changed.

Production smoke initially assumed the restored caret was at the end. It was at
the start, and the picker correctly inserted there. The smoke now explicitly sets
its intended caret before checking insertion; the insertion expectation is intact.

Reviewed Chromium screenshots: [world](testing/chat-world-mobile.png),
[picker](testing/chat-picker-mobile.png), [guide](testing/chat-guide-mobile.png).
No page runtime errors were observed during this capture. These are desktop
Chromium viewport captures, not native-keyboard or physical-iPhone observations.

A direct height-transition check found an actual presentation defect even though
final dimensions passed: resetting textarea height to auto for measurement caused
instant jumps and zero height animations. Full text is now measured in the hidden
plain-text mirror; the visible textarea receives only numeric heights. A new
performed check requires a real transition and monotonic intermediate height.
It failed before the fix and passes after it; see [chat-height-before.json](testing/chat-height-before.json).
Reduced motion still removes the transition. This is not physical-iOS animation QA.

Machine results and screenshots live in docs/testing with the chat prefix.
[Physical iPhone checklist](IPHONE_CHECKLIST.md) is separate; no desktop/CDP result
is a physical Safari/Chrome iOS PASS.

## Limitations

- Local IndexedDB belongs to the browser/origin. Clearing/evicting site data loses
  history, settings and progress. Pending writes are not guaranteed durable at a
  sudden crash; SAVED means completed IDB transaction, not power-loss immunity.
- Multiple tabs use ownership leases, not a multiwriter merge protocol. There is
  no server, auth, real clan network, analytics, external art or added dependency.
- Input requires a modern browser with Intl.Segmenter; real iOS IME, keyboard
  animation/viewport, address bars, rotation, pinch/bounce and accessibility need QA.
- Native iOS rubber-band suppression cannot be certified from computed CSS or
  Chromium. Intended logarithmic carousel track resistance remains unchanged.
- This branch does not deploy or merge itself. Existing main-only Pages workflow
  is preserved; the live URL changes only after an approved merge/deployment.
