# START HERE — CODEX

Build **Dark Kingdom War — UI Interaction Lab**, a small web test bench for real touch, pen, mouse and trackpad testing.

1. Read every Markdown file in this handoff first. Treat `ADAPTIVE_WINDOW_GEOMETRY_V0_2_1.md` as architecture source of truth.
2. Create root `AGENTS.md` preserving the non-negotiable interaction rules for future Codex sessions.
3. Inspect the repo/environment before choosing tooling. For an empty repo, prefer a small maintainable Node/npm frontend that builds to a static HTTPS-deployable site. No backend unless truly required.
4. Do NOT freeze experimental values for Gesture Slop Ratio/Min/Max, HoldDelay, inertia, overscroll or repeat cadence.
5. Implement the lab, useful automated tests, README, local run/build commands and deployment instructions.
6. Run build/tests before reporting completion.
7. Never commit tokens or secrets. The application needs no OpenAI API key.

This is an interaction laboratory, not the game. Favor instrumentation and fast iteration over decorative fidelity.

## Extension: Component Test Chamber
Also read `COMPONENT_TEST_CHAMBER_SPEC.md` and implement its modular engineering-menu test windows. Keep the original Interaction Lab capabilities. Treat the new specification as part of v1 scope, but implement incrementally and report remaining work clearly.
