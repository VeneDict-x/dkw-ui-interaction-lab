import { slop, type Config } from './config';
import { rubberBand } from './carousel';
type Press = {
  id: number;
  type: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  scroll: number;
  owner: '' | 'X' | 'Y';
  button: HTMLElement | null;
  valid: boolean;
};
export class GuideGesture {
  private press: Press | null = null;
  private timer = 0;
  private animation = 0;
  constructor(
    private viewport: HTMLElement,
    private track: HTMLElement,
    private config: () => Config,
    private page: () => number,
    private allowed: (n: number) => boolean,
    private navigate: (n: number) => void,
    private ack: (n: number) => void,
    private popup: () => void,
  ) {
    viewport.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (this.press || this.timer || !e.isPrimary || e.button !== 0) return;
      this.press = {
        id: e.pointerId,
        type: e.pointerType,
        x: e.clientX,
        y: e.clientY,
        dx: 0,
        dy: 0,
        scroll: this.article()?.scrollTop || 0,
        owner: '',
        button: (e.target as Element).closest<HTMLElement>('[data-guide-ack]'),
        valid: true,
      };
      if (this.press.button) this.press.button.dataset.pressed = 'true';
      viewport.setPointerCapture(e.pointerId);
      viewport.dataset.gestureOwner = 'CANDIDATE';
    });
    viewport.addEventListener('pointermove', this.move, { passive: false });
    viewport.addEventListener('pointerup', (e) => {
      const p = this.press;
      if (!p || e.pointerId !== p.id) return;
      e.stopPropagation();
      this.move(e);
      const current = this.page(),
        target = current + (p.dx < 0 ? 1 : -1),
        direction = p.dx < 0 ? -1 : 1;
      const horizontal = p.owner === 'X',
        tap = p.valid && p.button && this.inside(p.button, e.clientX, e.clientY);
      this.clearPress();
      if (horizontal) {
        const valid = this.allowed(target),
          commit =
            valid && Math.abs(p.dx) >= this.viewport.clientWidth * this.config().guideSwipeFraction;
        if (!valid && target >= 1 && target <= 5) this.popup();
        this.animate(
          commit ? direction * this.viewport.clientWidth : 0,
          () => {
            if (commit) this.navigate(target);
          },
          commit,
        );
      } else if (tap) this.ack(current);
    });
    for (const type of ['pointercancel', 'lostpointercapture'] as const)
      viewport.addEventListener(type, (e) => {
        if (this.press?.id === e.pointerId) this.cancel();
      });
    viewport.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const b = (e.target as Element).closest<HTMLButtonElement>('[data-guide-ack]');
      if (e.detail === 0 && !this.press && b && !b.disabled) this.ack(this.page());
    });
    viewport.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.cancel();
    });
    window.addEventListener('blur', () => this.cancel());
    window.addEventListener('pagehide', () => this.cancel(false));
    viewport.addEventListener('touchcancel', () => {
      if (this.press?.type === 'touch') this.cancel();
    });
    viewport.addEventListener('touchend', (e) => {
      if (this.press?.type === 'touch' && !e.touches.length) this.cancel();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.cancel();
    });
    new ResizeObserver(() => this.cancel(false)).observe(viewport);
  }
  private article() {
    return this.viewport.querySelector<HTMLElement>(`.guide-page[data-page="${this.page()}"]`);
  }
  private inside(b: HTMLElement, x: number, y: number) {
    const r = b.getBoundingClientRect(),
      transform = getComputedStyle(b).transform,
      m = transform === 'none' ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(transform);
    return (
      x >= r.left - m.m41 && x <= r.right - m.m41 && y >= r.top - m.m42 && y <= r.bottom - m.m42
    );
  }
  private move = (e: PointerEvent) => {
    const p = this.press;
    if (!p || p.id !== e.pointerId) return;
    e.stopPropagation();
    p.dx = e.clientX - p.x;
    p.dy = e.clientY - p.y;
    if (p.button && !this.inside(p.button, e.clientX, e.clientY)) p.valid = false;
    if (!p.owner && Math.hypot(p.dx, p.dy) > slop(this.config(), p.type)) {
      p.owner = Math.abs(p.dx) >= Math.abs(p.dy) * this.config().guideAxisRatio ? 'X' : 'Y';
      p.valid = false;
      this.viewport.dataset.gestureOwner = p.owner === 'X' ? 'HORIZONTAL' : 'VERTICAL';
      const target = this.page() + (p.dx < 0 ? 1 : -1);
      if (p.owner === 'X' && target !== this.page()) {
        const neighbor = this.viewport.querySelector<HTMLElement>(`[data-page="${target}"]`);
        if (neighbor) neighbor.scrollTop = 0;
      }
    }
    if (p.button) p.button.dataset.pressed = String(p.valid && !p.owner);
    if (p.owner === 'X') {
      e.preventDefault();
      const target = this.page() + (p.dx < 0 ? 1 : -1);
      this.offset(
        this.allowed(target)
          ? Math.sign(p.dx) * Math.min(Math.abs(p.dx), this.viewport.clientWidth)
          : rubberBand(p.dx, this.config().guideResistance),
      );
    } else if (p.owner === 'Y' && p.type !== 'touch') {
      e.preventDefault();
      const article = this.article();
      if (article) article.scrollTop = p.scroll - p.dy;
    }
  };
  private offset(dx: number) {
    this.track.style.transition = 'none';
    this.track.style.transform = `translateX(calc(${-(this.page() - 1) * 100}% + ${dx}px))`;
    this.viewport.dataset.offset = String(dx);
  }
  private clearPress() {
    const p = this.press;
    this.press = null;
    if (p?.button) p.button.dataset.pressed = 'false';
    if (p && this.viewport.hasPointerCapture(p.id)) this.viewport.releasePointerCapture(p.id);
    this.viewport.dataset.gestureOwner = 'NONE';
  }
  private animate(dx: number, done: () => void, hold = false) {
    const token = ++this.animation,
      ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : this.config().guideSpringMs;
    this.track.style.transition = `transform ${ms}ms ease-out`;
    this.track.style.transform = `translateX(calc(${-(this.page() - 1) * 100}% + ${dx}px))`;
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      if (token !== this.animation) return;
      done();
      if (!hold) this.offset(0);
    }, ms);
  }
  cancel(smooth = true) {
    this.clearPress();
    clearTimeout(this.timer);
    this.timer = 0;
    ++this.animation;
    if (smooth) this.animate(0, () => {});
    else this.offset(0);
  }
  sync() {
    this.cancel(false);
  }
}
