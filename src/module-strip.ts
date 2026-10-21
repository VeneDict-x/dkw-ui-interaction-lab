import { slop, type Config } from './config';
// Local navigation surfaces (strips or index grid): native touch pan cancels the
// press via pointercancel; mouse drag supplements horizontal overflow only.
// Keep these controls out of the custom game gesture controller.
export function bindModuleStrip(
  strip: HTMLElement,
  config: () => Config,
  open: (id: string) => void,
) {
  let press: {
    id: number;
    type: string;
    x: number;
    y: number;
    scroll: number;
    button: HTMLElement | null;
    valid: boolean;
    owner: '' | 'X' | 'Y';
  } | null = null;
  const inside = (el: HTMLElement, x: number, y: number) => {
    const r = el.getBoundingClientRect(),
      transform = getComputedStyle(el).transform;
    const matrix = transform === 'none' ? null : new DOMMatrixReadOnly(transform);
    const tx = matrix?.m41 || 0,
      ty = matrix?.m42 || 0;
    return x >= r.left - tx && x <= r.right - tx && y >= r.top - ty && y <= r.bottom - ty;
  };
  const end = () => {
    if (press?.button) press.button.dataset.pressed = 'false';
    const id = press?.id;
    press = null;
    if (id !== undefined && strip.hasPointerCapture(id)) strip.releasePointerCapture(id);
  };
  strip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (press || !e.isPrimary || e.button !== 0) return;
    const button = (e.target as Element).closest<HTMLElement>('[data-open]');
    press = {
      id: e.pointerId,
      type: e.pointerType,
      x: e.clientX,
      y: e.clientY,
      scroll: strip.scrollLeft,
      button,
      valid: !!button,
      owner: '',
    };
    if (button) button.dataset.pressed = 'true';
    if (e.pointerType === 'mouse') {
      e.preventDefault();
      strip.setPointerCapture(e.pointerId);
    }
  });
  strip.addEventListener(
    'pointermove',
    (e) => {
      const p = press;
      if (!p || p.id !== e.pointerId) return;
      e.stopPropagation();
      const dx = e.clientX - p.x,
        dy = e.clientY - p.y;
      if (p.button && !inside(p.button, e.clientX, e.clientY)) p.valid = false;
      if (
        !p.owner &&
        strip.scrollWidth > strip.clientWidth + 1 &&
        Math.hypot(dx, dy) > slop(config(), p.type)
      ) {
        p.owner = Math.abs(dx) >= Math.abs(dy) ? 'X' : 'Y';
        p.valid = false;
      }
      if (p.owner === 'X' && p.type === 'mouse') {
        e.preventDefault();
        strip.scrollLeft = p.scroll - dx;
      }
      if (p.button) p.button.dataset.pressed = String(p.valid);
    },
    { passive: false },
  );
  strip.addEventListener('pointerup', (e) => {
    const p = press;
    if (!p || p.id !== e.pointerId) return;
    e.stopPropagation();
    const valid = p.valid && p.button && inside(p.button, e.clientX, e.clientY) && !p.owner;
    const id = p.button?.dataset.open;
    end();
    if (valid && id) open(id);
  });
  for (const type of ['pointercancel', 'lostpointercapture'] as const)
    strip.addEventListener(type, (e) => {
      if (press?.id === e.pointerId) end();
    });
  strip.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.detail === 0 && !press) {
      const b = (e.target as Element).closest<HTMLElement>('[data-open]');
      if (b) open(b.dataset.open!);
    }
  });
  strip.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    end();
  });
  window.addEventListener('blur', end);
  window.addEventListener('pagehide', end);
  strip.addEventListener('touchcancel', end);
  strip.addEventListener('touchend', (e) => {
    if (press?.type === 'touch' && !e.touches.length) end();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) end();
  });
  new ResizeObserver(end).observe(strip);
}
