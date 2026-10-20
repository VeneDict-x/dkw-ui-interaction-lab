# Dark Kingdom War — UI Interaction Lab
## Codex Cloud implementation specification: Module 04 chat, state, gesture fixes

**Status:** approved for implementation. **Repository:** `VeneDict-x/dkw-ui-interaction-lab`. **Deployment:** https://venedict-x.github.io/dkw-ui-interaction-lab/.

### Working agreement

Inspect the existing repository, tests, and component conventions before modifying code. Implement this as an isolated, regression-safe extension. Do not replace existing Module 04 guide logic, Module 03 button semantics, or Module 01 carousel behavior. Keep the current architecture and avoid global touch-event interception. Run existing automated tests and add targeted tests; report results and any manual iOS-only verification still needed. UI labels are Russian unless existing diagnostic controls conventionally use English.

### A. Module 04 navigation, persistence and reset

- A browser reload or app restart always opens **Module 04 on the world map**, even if the user previously viewed the winter event or the five-page guide. This does not erase guide acknowledgements or other persisted data.
- Persist Scenario, Boundary and Theme selections through reload and **Reset Event State**.
- **Reset Event State** clears only event/guide progression; it does not clear settings, chat, chat draft, or unrelated modules.
- Add **Reset 04 Module** to reset all Module 04-owned state: settings, event/guide progress, first-run flags, seeded-message schedule, chat history, draft, live-chat state, cooldown, and Module 04 diagnostics. Return to initial world map. Do not reset other modules or global diagnostics outside Module 04.
- Preserve existing first-visit five-page guide gating: acknowledgement unlocks subsequent pages; cannot navigate back to world while required guide is open; completed guide can be reopened for reference.

### B. Shared compact clan chat

- One **shared** chat UI and state appears at the bottom of both world and winter-event scenes. It is not a separate app/module or a real online chat.
- Visually show **four latest messages**, newest at bottom, with no message-list scrolling. Persist **up to six latest messages**; evict oldest when exceeded. Store original, full message text, stable ID, author ID, timestamp/sequence and type. Preserve chronological interleaving.
- Each displayed message occupies **one visual line maximum** with ellipsis when too long, adapting to screen width/orientation. Do **not** truncate the underlying stored message. This applies to system, fictional clanmates and the user's own messages.
- Module 04 diagnostics section **Chat Message History** shows the full, untruncated content of all six retained messages, with author, ID and chronological order, including emoji. Long fake messages must be part of testing.
- Tapping the compact message-display area shows `Чат в разработке` popup; do not accidentally intercept chat input controls.
- Chat panel uses an **opaque dark blue/graphite** background with contrast and a distinct opaque message surface. Do not use translucent backgrounds. Ensure readability in world/event scenes, with winter snow effects behind—not above—text and controls.
- Maximum **seven stable fictional clanmate identities**, plus user as eighth participant and system as a separate sender. Give each clanmate a consistent individual colored name badge based on stable author ID (not array position). Clanmate body text remains neutral/light. User has a blue badge and distinct pale-blue body text. System has no badge/outline; both its sender name and full displayed body are **yellow and semibold**. Keep contrast accessible.

### C. Initial messages and simulation

- Chat is empty on first entry into Module 04. Trigger the one-time seed sequence at the **earliest** of: first world→winter-event transition, or first **nonempty character/text input** in the world-map chat field. Merely focusing the input does not trigger it; first pasted text counts.
- First seeded message appears approximately **2 seconds after trigger**, then next two at approximately **1–2-second intervals**. Example messages: System `Событие началось! Приятной игры 🎉`; KrakenFox `Cool! 🔥`; MoonKnight `Привет всем!`.
- User messages may interleave with seeds by actual arrival order. Seeds are scheduled exactly once until full Module 04 reset. Reload midway must never replay an already-inserted seed or create duplicates; persist seed progress/IDs and safely resume remaining sequence, or document a robust equivalent.
- **Live a clan chat!** starts fictional clanmate messages at randomized **4–7-second** intervals; **Stop discussion** stops this generation. **Random clanmate msg** inserts exactly one immediately per press, including during Live. Vary sender and message length (short, medium, longer than one visual line). User can send while Live runs.
- Reload restores history but does **not** automatically restart Live mode or timers. The independent initial seed sequence may still complete. All message producers honor the six-message history limit.

### D. Composer and sending

- Layout: **48×48 emoji toggle `😅` | expanding message input | 48×48 icon-only send**. Buttons are equally sized and bottom-aligned with the **last visible line** of input. No visible `Send` word. Accessible names for both buttons. Color of send control follows active faction/theme. Layout is ready for eventual RTL mirroring, but **do not implement localization/RTL now**.
- Use a genuine empty-value placeholder `Введите сообщение...`; do not treat that phrase as a reserved string. A user who types it may send it. Trim whitespace only for checking whether the message is empty; no popup for empty/whitespace-only send attempts.
- Input auto-grows from **one to two to three visible text lines**. At a fourth line and beyond, hold height at three lines and scroll the **input's own content** to keep the caret visible; earlier lines can move out of view but are not deleted. As input grows, the chat/message area shifts upward smoothly without bouncing or overlaying other UI. Both side buttons stay aligned with the bottom of the input, never rising with its top edge.
- **500 Unicode user-perceived characters (grapheme clusters)** maximum. Reject additional typed or emoji-picker characters after the limit, without clearing existing text. Paste, IME/composition, selections/replacements, emoji sequences and mobile input must not bypass the cap or split multi-code-point emoji. If the user replaces selected text, allow replacement within the cap. Do not show a counter unless existing UI conventions call for one.
- Draft persists across world/event transitions, guide open/close, theme changes and reload. Clear only after a successful send or **Reset 04 Module**. Preserve actual text including emoji.
- Send button obeys **ReleaseButton** interaction: pressed inside, released outside cancels, re-enter re-arms, release inside commits exactly once. Successful send starts a **2.5-second cooldown**. Users may continue composing during cooldown; trying to send a new nonempty message during cooldown shows a friendly popup, e.g. `Чуть-чуть подождём! 😊 Следующее сообщение можно отправить через пару секунд.`; do not send. A technical duplicate is blocked silently.
- **Two-stage duplicate protection:** synchronously lock/claim the send transaction on first acceptance, before any state render or cooldown display; assign a stable message/transaction ID and deduplicate repeated processing of that ID. Avoid two sends from double taps or near-simultaneous handlers. Add **Simulate Double Send** diagnostic button that drives the *real send pipeline* with two immediate attempts (not two independent fake messages). Assert exactly one accepted message, one draft clear, one cooldown start and a blocked duplicate; diagnostic counts such as `accepted: 1`, `duplicateBlocked: 1`. Ensure this test does not turn an empty draft into a message.

### D1. Chat input security: reject markup and directives

- Treat **all** user, seed, and simulated message content as **untrusted plain text**, never as HTML, rich text, executable code, styling directives, or instructions.
- **Ignore/remove tag-like sequences** in the composer, including `<color=red>`, `</color>`, `<url=...>`, `</url>`, `<b>`, `<script>` and arbitrary `<...>` markup. Do not show those tags in chat. Preserve surrounding legitimate text and emoji. Apply filtering to typing, paste, recovered drafts, and at the send boundary, not just keyboard handlers.
- Never execute, interpret, style with, or navigate from submitted tags/directives. Render remaining content through safe text-only APIs (`textContent`/React text nodes), never `innerHTML` or `dangerouslySetInnerHTML`. URL-looking text is inert plain text, not an actionable link.
- Encoded or obfuscated markup must stay inert; do not decode it into active HTML. Avoid corrupting ordinary prose or comparison symbols where possible.
- Filter **before** enforcing the 500-grapheme cap. Tag-only input is empty: no send, cooldown or popup.
- Test typing, paste, persistence, fake/system messages, HTML/rich-text/script injection, safe text rendering, preservation of surrounding text and emoji, and caret behavior.

### E. Emoji picker and keyboard/focus

- The **left composer button labeled `😅`** is `emojiPickerToggle`: tapping it opens the emoji picker; tapping **that same left composer button again** closes it. This toggle does **not** insert an emoji.
- The `😅` **item inside the 4×4 picker** is a different control (`emojiPickerItem`): tapping it inserts `😅` in the draft, just like any other emoji, and **never toggles or closes** the picker. This distinction is crucial.
- Exactly **16 emoji items in a 4×4 grid** (suggested: 😀 😂 😅 😍 / 🥰 😎 🤔 😭 / 😡 👍 👎 ❤️ / 🔥 🎉 💪 ❄️). Picker has an **opaque** background. Selecting any item inserts at the current caret/selection, replacing selected text if present, and keeps the picker open for repeated selections. Preserve selection/caret after insertion. The panel closes only on toggle, successful send, or outside interaction (including world, event or guide).
- **Native keyboard and emoji picker are independent.** Emoji-only composing/sending must not open the native keyboard. Opening/closing picker must not itself dismiss an already-open keyboard; selecting picker items while typing must preserve focus and caret without iOS blur/focus flicker. Only focusing the actual text input opens the native keyboard. Outside tap removes input focus/caret and closes picker (and normally dismisses keyboard).
- Position picker above composer. On small viewports, orientation changes or keyboard-visible layouts, prevent clipping/overlap. If space is constrained, scroll the **picker itself**, not the game scene. Preserve normal intended game-field gesture behavior on outside tap where safe; do not globally swallow touch events.

### F. Other visual and gesture fixes

- Add lightweight decorative falling snow on winter event, behind controls, pointer-events disabled, and honor `prefers-reduced-motion`.
- Remove unintended rubber-band/bounce within Module 04 world/event test scene **and** Module 01 adaptive preview/carousel test window, while preserving intended gestures and iOS document scrolling. Do not use global `touchmove preventDefault`.
- Fix horizontal finger-swipe scrolling of the **home/index module navigation strip (01–06)** on iPhone portrait; it is distinct from the already-fixed tab strip within test windows. Preserve tab taps and Module 01 carousel behavior.

### G. Automated and physical acceptance checks

1. Initial chat empty; first event transition or first actual world-map input triggers seeds once, after delay, in chronological order; focus alone does not trigger. Reload mid-sequence does not duplicate seeds.
2. Fake Live 4–7 seconds; stop; one-shot manual fake insert; mixed fake/user messages; varied text lengths; only four visible and six retained.
3. One-line ellipsis for all senders including user; responsive landscape/portrait; diagnostics show complete original message and metadata.
4. Composer grows 1→2→3 rows, then internal scroll; caret remains visible, both 48px buttons remain bottom aligned; no scene bounce or overlap.
5. 500-grapheme cap with typing, paste, emoji, selection replacement, composition and multi-code-point emoji; no data loss or broken emoji.
5a. Prohibited markup is ignored at input and send, never displayed or executed; all restored and simulated content renders as inert plain text.
6. Emoji-only send with keyboard never appearing; keyboard remains when picker used during text entry; insertion at caret, repeated picks; left `😅` toggle differs from `😅` picker item; outside tap dismisses picker and focus.
7. Strict ReleaseButton send, cooldown warning only for new nonempty attempted send, empty silent; double-send diagnostic exactly one accepted message and no duplicate.
8. Reload always world map; retains selections, guide progress, chat and draft; Reset Event State retains selections/chat; Reset 04 Module clears only 04-owned data and diagnostics.
9. World/event chat visual readability; yellow bold system, stable colored clanmates, distinct user color; snow reduced-motion and nonblocking.
10. Real iPhone Chrome/Safari: home strip 01–06 swipe, Module 01 preview bounce, Module 04 bounce, native keyboard/caret/picker interactions, rotation, and guide navigation regression.
11. Existing automated suite passes; no regressions to Module 03 buttons, Module 04 guide and nested carousel gestures.

### Deliverable

Implement code and focused tests in a reviewable PR. Provide concise implementation notes, test commands/results, screenshots if helpful, and a separate checklist for any behaviors requiring **manual real-iPhone verification**. Do not claim physical-device PASS from automated or desktop tests alone.
