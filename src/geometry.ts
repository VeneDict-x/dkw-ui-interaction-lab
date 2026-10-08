import { clamp, type Config } from './config';
export type LayoutClass = 'Mobile' | 'Medium' | 'Expanded' | 'Wide';
export type Geometry = {
  width: number;
  height: number;
  preview: number;
  modules: number;
  layout: LayoutClass;
  side: boolean;
  stage: string;
  contentScale: number;
  pressure: boolean;
};
export function orientationMode(
  w: number,
  h: number,
  previous: 'H' | 'V' | null,
  c: Config,
  orientation?: 'H' | 'V',
): 'H' | 'V' {
  const r = w / Math.max(1, h);
  if (r >= c.ratioEnterH) return 'H';
  if (r <= c.ratioEnterV) return 'V';
  return previous || orientation || 'V';
}
export function layoutClass(w: number, h: number, c: Config, previous?: LayoutClass): LayoutClass {
  const margin = c.hysteresis;
  const bounds = [c.mediumWidth, c.expandedWidth, c.wideWidth];
  const classes: LayoutClass[] = ['Mobile', 'Medium', 'Expanded', 'Wide'];
  let i = previous ? classes.indexOf(previous) : 0;
  if (!previous) i = bounds.filter((b) => w >= b).length;
  else {
    while (i < 3 && w >= bounds[i] + margin) i++;
    while (i > 0 && w < bounds[i - 1] - margin) i--;
  }
  // Height participates in structural classification; narrow/tall is never wide.
  if (h < c.sideMinHeight && i > 1) i = 1;
  return classes[i];
}
export function geometry(
  w: number,
  h: number,
  count: number,
  c: Config,
  previous?: LayoutClass,
): Geometry {
  const width = Math.max(0, Math.min(w, c.windowMaxWidth));
  const maxH = Math.max(0, Math.min(h, c.windowMaxHeight));
  const layout = layoutClass(width, maxH, c, previous);
  const side = (layout === 'Expanded' || layout === 'Wide') && maxH >= c.sideMinHeight;
  const actionsHeight = Math.max(c.actionsHeight, 44 * c.uiScale + 8);
  const chrome = c.headerHeight + actionsHeight + 4;
  const content = Math.max(0, maxH - chrome);
  const contentHeight = count * (Math.max(46, 44 * c.uiScale + 2) + 108) + 16;
  // Under pressure, protect interactive space before allocating preview ornament.
  let m = Math.min(c.modulesMin, content),
    p = Math.min(c.previewMin, Math.max(0, content - m));
  let stage = '1 · minimum';
  const previewW = Math.max(0, (side ? width * 0.36 : width) - 32);
  const usefulMax = Math.min(
    c.previewMax,
    previewW * (180 / 280) * c.previewScaleMax + c.previewBreathing,
  );
  if (side) {
    p = Math.min(usefulMax, content);
    m = Math.min(
      content,
      Math.max(c.modulesMin, Math.min(contentHeight, c.windowMaxHeight - chrome)),
    );
    stage = 'side composition';
  } else {
    let extra = Math.max(0, content - p - m);
    // Stage 2: modules primary growth, with a bounded advance of preview.
    const previewAdvance = Math.min(
      extra * 0.22,
      Math.max(0, Math.min(c.previewPreferred, usefulMax) - p),
    );
    p += previewAdvance;
    extra -= previewAdvance;
    const primary = Math.min(extra, Math.max(0, Math.min(contentHeight, p * c.cr1) - m));
    m += primary;
    extra -= primary;
    if (primary > 0) stage = '2–3 · primary / CR1';
    // Stage 4: width-constrained preview breathing.
    const breathing = Math.min(extra, Math.max(0, usefulMax - p));
    p += breathing;
    extra -= breathing;
    if (breathing > 0) stage = '4 · preview breathing';
    // Stage 5: grow modules to CR2, without stretching a short content list.
    const secondary = Math.min(extra, Math.max(0, Math.min(contentHeight, p * c.cr2) - m));
    m += secondary;
    if (secondary > 0) stage = '5 · CR2';
  }
  const height = Math.min(maxH, chrome + (side ? Math.max(p, m) : p + m));
  if (height >= c.windowMaxHeight - 1) stage = '6 · WindowMax';
  const frameHeight = side ? Math.max(p, m) : p;
  return {
    width,
    height,
    preview: frameHeight,
    modules: m,
    layout,
    side,
    stage,
    contentScale: Math.max(
      0,
      Math.min(previewW / 280, Math.max(0, frameHeight - 24) / 180, c.previewScaleMax),
    ),
    pressure: content < c.previewMin + c.modulesMin,
  };
}
