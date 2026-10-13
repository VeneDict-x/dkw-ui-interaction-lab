import { type Config } from './config';
import type { InteractionController } from './interaction';
// Count independent N + configurable Peek; real card width is derived only from viewport/UI scale.
export function cardGeometry(viewport: number, preferred = 108, gap = 10, inset = 4, peek = 0.5) {
  const usable = Math.max(0, viewport - 2 * inset);
  const capacity = Math.max(1, Math.floor((usable + gap) / (preferred + gap) - peek)) + peek;
  return { width: Math.max(44, (usable - (capacity - 1) * gap) / capacity), gap, inset, capacity };
}
export function rubberBand(distance: number, scale: number) {
  if (scale <= 0 || distance === 0) return 0;
  const absolute = Math.abs(distance),
    ratio = absolute / scale;
  const resistance = Number.isFinite(ratio)
    ? Math.log1p(ratio)
    : Math.log(absolute) - Math.log(scale);
  return Math.sign(distance) * scale * resistance;
}
export function bindCarousel(
  el: HTMLElement,
  left: HTMLButtonElement,
  right: HTMLButtonElement,
  controller: InteractionController,
  config: () => Config,
) {
  const update = () => {
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    left.hidden = max < 1 || el.scrollLeft <= 0.5;
    right.hidden = max < 1 || el.scrollLeft >= max - 0.5;
    left.setAttribute('aria-disabled', String(left.hidden));
    right.setAttribute('aria-disabled', String(right.hidden));
  };
  let frame = 0;
  const resize = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!el.clientWidth) return;
      const c = config();
      const g = cardGeometry(
        el.clientWidth,
        c.cardPreferred * c.uiScale,
        c.carouselGap,
        c.carouselInset,
        c.carouselPeek,
      );
      el.style.setProperty('--card-gap', g.gap + 'px');
      el.style.setProperty('--edge-inset', g.inset + 'px');
      el.style.setProperty('--card-width', `${g.width}px`);
      update();
    });
  };
  controller.register(left.dataset.action!, {
    run: () => {
      el.scrollLeft -= el.clientWidth * 0.7;
      update();
    },
    available: () => !left.hidden,
  });
  controller.register(right.dataset.action!, {
    run: () => {
      el.scrollLeft += el.clientWidth * 0.7;
      update();
    },
    available: () => !right.hidden,
  });
  el.addEventListener('scroll', update, { passive: true });
  el.addEventListener(
    'wheel',
    (e) => {
      const modules = el.closest<HTMLElement>('.gesture-modules');
      e.preventDefault();
      const scale =
        e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? modules?.clientHeight || el.clientHeight : 1;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) el.scrollLeft += e.deltaX * scale;
      else if (modules) modules.scrollTop += e.deltaY * scale;
      update();
    },
    { passive: false },
  );
  window.addEventListener('dkw-config-change', resize);
  const observer = new ResizeObserver(resize);
  observer.observe(el);
  resize();
  update();
  return () => {
    window.removeEventListener('dkw-config-change', resize);
    observer.disconnect();
    cancelAnimationFrame(frame);
  };
}
