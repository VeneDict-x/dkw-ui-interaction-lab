export const fields = {
  uiScale: [1, 0.8, 1.5, 0.05, 'UI scale'],
  referenceUnit: [48, 44, 100, 1, 'Interaction reference unit · px'],
  slopRatio: [0.16, 0.01, 1, 0.01, 'Gesture Slop Ratio'],
  touchSlopMultiplier: [1.25, 0.5, 3, 0.05, 'Touch Slop multiplier'],
  slopMin: [4, 1, 50, 1, 'Slop Min · px'],
  slopMax: [18, 1, 100, 1, 'Slop Max · px'],
  holdDelay: [450, 80, 2000, 10, 'HoldDelay · ms'],
  repeatDelayTenths: [10, 10, 25, 1, 'Initial Repeat delay · tenths (EXPERIMENTAL)'],
  repeatMs: [240, 40, 1500, 10, 'Initial cadence · ms'],
  acceleration: [0.35, 0, 3, 0.05, 'Acceleration · rate/second'],
  maxRate: [12, 1, 30, 0.5, 'Maximum repeat rate · Hz'],
  cardPreferred: [108, 88, 200, 1, 'Carousel target card width · px'],
  carouselPeek: [0.5, 0.2, 0.8, 0.05, 'Carousel Peek fraction'],
  carouselGap: [10, 4, 24, 1, 'Carousel card gap · px'],
  carouselInset: [4, 0, 16, 1, 'Symmetric carousel inset · px'],
  inertia: [0.88, 0, 0.98, 0.01, 'Inertia retention / 16.7 ms'],
  overscroll: [32, 0, 100, 1, 'Logarithmic resistance scale · px'],
  spring: [180, 0, 600, 10, 'Spring return · ms'],
  pressDepth: [2, 0, 8, 0.5, 'Pressed depth · px'],
  darkening: [0.2, 0, 0.6, 0.05, 'Pressed darkening'],
  pressDuration: [70, 0, 300, 10, 'Press transition · ms'],
  shadow: [1, 0, 1, 1, 'Pressed shadow response'],
  headerHeight: [48, 48, 100, 1, 'Header height · px'],
  actionsHeight: [52, 48, 100, 1, 'Actions height · px'],
  previewMin: [88, 48, 200, 1, 'Preview minimum · px'],
  previewPreferred: [160, 80, 360, 1, 'Preview preferred · px'],
  previewMax: [260, 100, 480, 1, 'Preview maximum · px'],
  previewBreathing: [48, 0, 160, 1, 'Preview breathing budget · px'],
  previewScaleMax: [1.5, 0.5, 3, 0.1, 'Preview content scale max'],
  modulesMin: [144, 88, 300, 1, 'Modules minimum · px'],
  cr1: [1.8, 0.5, 4, 0.1, 'CR1 · Modules / Preview'],
  cr2: [2.4, 1, 5, 0.1, 'CR2 · Modules / Preview'],
  windowMaxHeight: [780, 320, 1400, 10, 'WindowMax height · px'],
  windowMaxWidth: [1120, 320, 1800, 10, 'WindowMax width · px'],
  mediumWidth: [600, 440, 1000, 10, 'Medium breakpoint · px'],
  expandedWidth: [760, 600, 1200, 10, 'Expanded breakpoint · px'],
  wideWidth: [1100, 800, 1800, 10, 'Wide breakpoint · px'],
  sideMinHeight: [330, 220, 700, 10, 'Side composition minimum height'],
  hysteresis: [24, 0, 100, 1, 'Structural hysteresis · px'],
  ratioEnterV: [0.9, 0.5, 0.99, 0.01, 'Enter vertical W/H'],
  ratioEnterH: [1.11, 1.01, 2, 0.01, 'Enter horizontal W/H'],
  settleMs: [160, 50, 600, 10, 'Resize settle fallback · ms'],
  decorationBudget: [16, 0, 48, 1, 'Decoration budget · px'],
  blur: [8, 0, 24, 1, 'Backdrop blur · px'],
  dim: [0.35, 0, 0.85, 0.05, 'Backdrop dim'],
} as const;
export type Key = keyof typeof fields;
export type Config = Record<Key, number> & { visualizer: boolean; snapshot: boolean };
export const defaults = (): Config =>
  ({
    ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v[0]])),
    visualizer: true,
    snapshot: true,
  }) as Config;
export function sanitize(input: unknown): Config {
  const c = defaults();
  if (!input || typeof input !== 'object') return c;
  for (const [key, [, min, max]] of Object.entries(fields)) {
    const v = (input as Record<string, unknown>)[key];
    if (typeof v === 'number' && Number.isFinite(v)) c[key as Key] = clamp(v, min, max);
  }
  for (const k of ['visualizer', 'snapshot'] as const)
    if (typeof (input as Config)[k] === 'boolean') c[k] = (input as Config)[k];
  c.repeatDelayTenths = Math.round(c.repeatDelayTenths);
  c.slopMax = Math.max(c.slopMax, c.slopMin);
  c.previewPreferred = Math.max(c.previewPreferred, c.previewMin);
  c.previewMax = Math.max(c.previewMax, c.previewPreferred);
  c.cr2 = Math.max(c.cr2, c.cr1);
  c.expandedWidth = Math.max(c.expandedWidth, c.mediumWidth);
  c.wideWidth = Math.max(c.wideWidth, c.expandedWidth);
  return c;
}
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const slop = (c: Config, pointerType = 'mouse') =>
  clamp(
    c.referenceUnit *
      c.uiScale *
      c.slopRatio *
      (pointerType === 'touch' ? c.touchSlopMultiplier : 1),
    c.slopMin,
    c.slopMax,
  );
export function loadConfig(): Config {
  try {
    return sanitize(JSON.parse(localStorage.getItem('dkw-lab-v1') || 'null'));
  } catch {
    return defaults();
  }
}
export const repeatInterval = (elapsed: number, c: Config) =>
  Math.max(1000 / c.maxRate, c.repeatMs / (1 + (c.acceleration * elapsed) / 1000));
