# Acceptance Criteria

v1 is ready when it runs locally, production build passes, and it can be opened from a public HTTPS URL on real devices. Nested vertical/horizontal gestures coexist; owner locks; 45° follows spec; taps cannot resurrect after drag/scroll. Release Button and Hold Session contracts are observable. Hold survives movement outside after recognition and ends on PointerUp anywhere/PointerCancel. Interaction and Availability are separately visible. Debug Panel exposes but does not freeze experimental parameters. Gesture Visualizer exposes slop crossing and owner selection. Config can reset/export. No secrets are committed.

Not required: custom domain, GitHub, backend/database/auth, production art, or final calibrated interaction constants.

## Component Test Chamber extension
- Independent Actions, Button Gallery, Navigation and Window Resize test windows are accessible from the Lab index.
- Press visuals are adjustable; leaving/re-entering a button before release is observable.
- Plus/minus, generic repeat, and standalone carousel arrows are testable.
- Five-page mini-window supports Back/Forward, Close/Reopen and clickable faction-colored active dots.
- Resize demo exposes live geometry, backdrop blur/dim, live/settled state and experimental hysteresis.
- Results distinguish PASS, FAIL, NOT RUN, INCONCLUSIVE and EXPERIMENTAL tuning.
- JSON diagnostics export includes environment, parameters and performed checks.
