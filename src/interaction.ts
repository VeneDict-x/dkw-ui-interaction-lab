import { clamp, slop, repeatInterval, type Config } from './config';
import { rubberBand } from './carousel';
import type { Diagnostics } from './diagnostics';
type Owner = 'NONE' | 'CAROUSEL' | 'MODULES' | 'DRAG' | 'HOLD_SESSION';
export type PointerState = {
  pointerType: string;
  id: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  distance: number;
  owner: Owner;
  phase: string;
  valid: boolean;
  path: [number, number][];
  slop: number;
};
export type Action = {
  run: () => void;
  available?: () => boolean;
  hold?: boolean;
  repeatDelay?: boolean;
  instrument?: boolean;
  releasePolicy?: 'geometry';
};
type Session = {
  view: PointerState;
  target: HTMLElement;
  button: HTMLElement | null;
  card: HTMLElement | null;
  carousel: HTMLElement | null;
  modules: HTMLElement | null;
  action?: Action;
  inside: boolean;
  left: boolean;
  returned: boolean;
  holding: boolean;
  startTime: number;
  holdStart: number;
  startScrollX: number;
  startScrollY: number;
  lastX: number;
  lastTime: number;
  velocity: number;
  countBefore: number;
  ticks: number;
  pauseAt: number;
  pauseTicks: number;
  resumed: boolean;
  threshold: number;
  lockedOwner: Owner;
  cardCountBefore: number;
};
export class InteractionController {
  actions = new Map<string, Action>();
  counts = new Map<string, number>();
  current: PointerState | null = null;
  active: Session | null = null;
  onChange = () => {};
  private holdTimer = 0;
  private repeatTimer = 0;
  private inertiaFrame = 0;
  private cardActivations = 0;
  private pointers = new Map<number, { x: number; y: number }>();
  private abort = new AbortController();
  private observer: MutationObserver;
  private disposed = false;
  private hoveredCard: HTMLElement | null = null;
  constructor(
    private root: HTMLElement,
    private config: () => Config,
    private diag: Diagnostics,
  ) {
    root.addEventListener('pointerdown', this.down, { signal: this.abort.signal });
    // Actual mouse movement owns hover; capture changes and sticky native :hover do not.
    root.addEventListener('pointermove', this.hover, { signal: this.abort.signal });
    root.addEventListener(
      'pointerout',
      (e) => {
        if (!(e.relatedTarget instanceof Node && this.hoveredCard?.contains(e.relatedTarget)))
          this.clearHover();
      },
      { signal: this.abort.signal },
    );
    window.addEventListener('pointermove', this.move, {
      passive: false,
      signal: this.abort.signal,
    });
    window.addEventListener('pointerup', this.up, { signal: this.abort.signal });
    window.addEventListener('pointercancel', this.cancelEvent, { signal: this.abort.signal });
    root.addEventListener(
      'lostpointercapture',
      (e) => {
        if (this.pointers.has(e.pointerId)) this.terminal(e, true);
      },
      { signal: this.abort.signal },
    );
    window.addEventListener('blur', () => this.end(true, 'window blur'), {
      signal: this.abort.signal,
    });
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) this.end(true, 'document hidden');
      },
      { signal: this.abort.signal },
    );
    root.addEventListener(
      'click',
      (e) => {
        const b = (e.target as Element).closest<HTMLElement>('[data-action]');
        if (!b) return;
        e.preventDefault();
        // detail=0 is keyboard/assistive activation, never the pointer click path.
        if (e.detail === 0 && !this.active) {
          const a = this.actions.get(b.dataset.action!);
          if (a && this.available(a) && b.getAttribute('aria-disabled') !== 'true')
            this.perform(b, a, 'keyboard / assistive');
        }
      },
      { signal: this.abort.signal },
    );
    const terminate = () => this.end(true, 'page lifecycle interruption');
    window.addEventListener('pagehide', terminate, { signal: this.abort.signal });
    root.addEventListener(
      'contextmenu',
      (e) => {
        if ((e.target as Element).closest('[data-action],.selection-card')) {
          e.preventDefault();
          this.end(true, 'native context interruption');
        }
      },
      { signal: this.abort.signal },
    );
    const touchEnd = (e: TouchEvent) => {
      if (this.active?.view.pointerType === 'touch' && e.touches.length === 0)
        this.end(true, 'terminal native touch fallback');
    };
    window.addEventListener('touchend', touchEnd, { signal: this.abort.signal });
    window.addEventListener(
      'touchcancel',
      () => {
        if (this.active?.view.pointerType === 'touch') this.end(true, 'native touchcancel');
      },
      { signal: this.abort.signal },
    );
    this.observer = new MutationObserver(() => {
      if (!root.isConnected) this.destroy();
      else if (this.active && !this.active.target.isConnected) this.end(true, 'target unmounted');
    });
    this.observer.observe(document, { childList: true, subtree: true });
  }
  register(id: string, action: Action) {
    this.actions.set(id, action);
  }
  private available(a: Action) {
    return a.available?.() ?? true;
  }
  private count(b: HTMLElement) {
    return this.counts.get(b.dataset.action!) || 0;
  }
  private perform(b: HTMLElement, a: Action, reason: string) {
    const k = b.dataset.action!;
    this.counts.set(k, this.count(b) + 1);
    a.run();
    this.diag.log('action', {
      target: k,
      reason,
      count: this.count(b),
      pointerType: this.active?.view.pointerType || 'keyboard',
    });
  }
  private pressed(s: Session, yes: boolean) {
    const target = s.button || s.card;
    if (target) target.dataset.pressed = String(yes);
    this.onChange();
  }
  private clearHover() {
    if (this.hoveredCard) this.hoveredCard.dataset.hovered = 'false';
    this.hoveredCard = null;
  }
  private hover = (e: PointerEvent) => {
    const card =
      e.pointerType === 'mouse' && !this.active
        ? (e.target as Element).closest<HTMLElement>('.selection-card')
        : null;
    if (card === this.hoveredCard) return;
    this.clearHover();
    if (card) {
      card.dataset.hovered = 'true';
      this.hoveredCard = card;
    }
  };
  private inside(b: HTMLElement, x: number, y: number, functional = false) {
    const r = b.getBoundingClientRect();
    const transform = functional ? getComputedStyle(b).transform : 'none';
    const offset = transform === 'none' ? null : new DOMMatrixReadOnly(transform);
    const tx = offset?.m41 || 0,
      ty = offset?.m42 || 0;
    return x >= r.left - tx && x <= r.right - tx && y >= r.top - ty && y <= r.bottom - ty;
  }
  private down = (e: PointerEvent) => {
    if (this.disposed || e.button !== 0) return;
    if (this.active) {
      const s = this.active;
      if (
        s.carousel &&
        s.view.pointerType === 'touch' &&
        e.pointerType === 'touch' &&
        (e.target as Element).closest('.carousel') === s.carousel
      ) {
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        s.view.valid = false;
        this.pressed(s, false);
        try {
          s.target.setPointerCapture(e.pointerId);
        } catch {
          /* synthetic */
        }
        e.preventDefault();
      }
      return;
    }
    if (!e.isPrimary) return;
    const target = e.target as HTMLElement;
    const button = target.closest<HTMLElement>('[data-action]');
    const carousel = button ? null : target.closest<HTMLElement>('.carousel');
    const modules = target.closest<HTMLElement>('.gesture-modules');
    if (!button && !carousel && !modules) return;
    if (!button && !carousel && target.closest('input,select,textarea,a,button')) return;
    const action = button ? this.actions.get(button.dataset.action!) : undefined;
    if (
      button &&
      (!action ||
        button.getAttribute('aria-disabled') === 'true' ||
        (button as HTMLButtonElement).disabled)
    )
      return;
    e.preventDefault();
    this.clearHover();
    cancelAnimationFrame(this.inertiaFrame);
    document.querySelectorAll<HTMLElement>('.carousel-track').forEach((t) => {
      t.style.transition = 'none';
      t.style.transform = '';
    });
    const capture = button || carousel || modules!;
    const threshold = slop(this.config(), e.pointerType);
    const card = carousel ? target.closest<HTMLElement>('[data-card]') : null;
    const view: PointerState = {
      pointerType: e.pointerType,
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      dx: 0,
      dy: 0,
      distance: 0,
      owner: modules && !carousel && !button ? 'MODULES' : 'NONE',
      phase:
        action?.releasePolicy === 'geometry' && !action.hold
          ? 'RELEASE_CANDIDATE'
          : 'TAP_CANDIDATE',
      valid: true,
      path: [[e.clientX, e.clientY]],
      slop: threshold,
    };
    this.current = view;
    const s: Session = {
      view,
      target: capture,
      button,
      card,
      carousel,
      modules,
      action,
      inside: true,
      left: false,
      returned: false,
      holding: false,
      startTime: performance.now(),
      holdStart: 0,
      startScrollX: carousel?.scrollLeft || 0,
      startScrollY: modules?.scrollTop || 0,
      lastX: e.clientX,
      lastTime: performance.now(),
      velocity: 0,
      countBefore: button ? this.count(button) : 0,
      ticks: 0,
      pauseAt: 0,
      pauseTicks: 0,
      resumed: false,
      threshold,
      lockedOwner: 'NONE',
      cardCountBefore: this.cardActivations,
    };
    this.active = s;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (card) card.dataset.dragging = 'false';
    try {
      capture.setPointerCapture(e.pointerId);
    } catch {
      /* Synthetic events may not support capture. */
    }
    this.pressed(s, true);
    this.diag.log('pointerdown', {
      target: button?.dataset.action || carousel?.id || 'modules',
      pointerType: e.pointerType,
      pointerId: e.pointerId,
      source: e.isTrusted ? 'browser-delivered Pointer Event' : 'synthetic Pointer Event',
      viewport: [innerWidth, innerHeight],
      parameters: { ...this.config() },
      start: [e.clientX, e.clientY],
    });
    if (button && action?.instrument !== false) {
      this.diag.check(
        'BTN-DOWN',
        this.count(button) === s.countBefore && button.dataset.pressed === 'true',
        'pressed, no activation',
        { count: this.count(button), pressed: button.dataset.pressed },
      );
    }
    if (action?.hold) this.armHold(s);
    this.onChange();
  };
  private armHold(s: Session) {
    clearTimeout(this.holdTimer);
    this.holdTimer = window.setTimeout(() => {
      this.holdTimer = 0;
      if (this.active !== s || !s.inside || !s.view.valid) return;
      s.holding = true;
      s.holdStart = performance.now();
      s.view.owner = 'HOLD_SESSION';
      s.view.phase = 'HOLD_SESSION';
      s.view.valid = false;
      this.pressed(s, true);
      this.diag.log('hold-recognized', {
        target: s.button?.dataset.action,
        pointerType: s.view.pointerType,
      });
      this.tick(s, true);
    }, this.config().holdDelay);
  }
  private tick(s: Session, first = false) {
    if (this.active !== s || !s.holding || this.disposed) return;
    if (!s.target.isConnected || document.hidden) {
      this.end(true, 'hold target unavailable');
      return;
    }
    const now = performance.now(),
      a = s.action!;
    const interval = repeatInterval(now - s.holdStart, this.config());
    if (this.available(a)) {
      if (s.pauseAt) {
        this.diag.check('HOLD-PAUSE', s.ticks === s.pauseTicks, 'no ticks while unavailable', {
          ticksBefore: s.pauseTicks,
          ticksAfter: s.ticks,
          pausedMs: now - s.pauseAt,
        });
        s.pauseAt = 0;
        s.resumed = true;
      }
      this.perform(s.button!, a, 'hold tick');
      s.ticks++;
      if (s.resumed) {
        this.diag.check('HOLD-RESUME', true, 'one resumed tick, no queued backlog', {
          scheduledInterval: interval,
          ticks: s.ticks,
        });
        s.resumed = false;
      }
      this.diag.check(
        'HOLD-RATE',
        1000 / interval <= this.config().maxRate + 1e-6,
        `rate <= ${this.config().maxRate} Hz`,
        1000 / interval,
      );
    } else if (!s.pauseAt) {
      s.pauseAt = now;
      s.pauseTicks = s.ticks;
      this.diag.log('hold-paused', { ticks: s.ticks });
    }
    this.onChange();
    // run() can synchronously unmount/navigate/end; never re-arm an ended session.
    if (this.active !== s || !s.holding || this.disposed) return;
    const delay =
      first && s.action?.repeatDelay
        ? (this.config().repeatMs * this.config().repeatDelayTenths) / 10
        : interval;
    this.repeatTimer = window.setTimeout(() => {
      this.repeatTimer = 0;
      this.tick(s);
    }, Math.ceil(delay));
  }
  private move = (e: PointerEvent) => {
    const s = this.active;
    if (!s || !this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (s.view.id !== e.pointerId) return;
    e.preventDefault();
    const v = s.view;
    v.x = e.clientX;
    v.y = e.clientY;
    v.dx = v.x - v.startX;
    v.dy = v.y - v.startY;
    v.distance = Math.hypot(v.dx, v.dy);
    v.path.push([v.x, v.y]);
    if (v.path.length > 180) v.path.splice(1, 1);
    if (s.button) {
      if (s.action?.releasePolicy === 'geometry' && !s.action.hold) {
        // Pointer capture retargets events; coordinates and functional bounds remain authoritative.
        s.inside = this.inside(s.button, v.x, v.y, true);
        v.phase = s.inside ? 'RELEASE_CANDIDATE' : 'RELEASE_OUTSIDE';
        this.pressed(s, s.inside);
        if (!s.inside) s.left = true;
        else if (s.left) {
          s.returned = true;
          s.left = false;
          this.diag.check(
            'BTN-RETURN',
            s.button.dataset.pressed === 'true',
            'geometry release: unpress then repress, independent of Slop',
            { returned: true, pressed: s.button.dataset.pressed, distance: v.distance },
          );
        }
        return;
      }
      s.inside = this.inside(s.button, v.x, v.y, true);
      if (s.holding) {
        this.pressed(s, true);
        if (!s.inside)
          this.diag.check(
            'HOLD-OUT',
            s.button.dataset.pressed === 'true' && s.holding,
            'HOLDING + pressed outside',
            { holding: s.holding, pressed: s.button.dataset.pressed },
          );
        return;
      }
      if (!s.action?.hold) {
        if (!s.inside) {
          s.left = true;
          v.valid = false;
        }
        v.phase = v.valid ? 'STRICT_TAP' : 'STRICT_CANCELLED';
        this.pressed(s, v.valid && s.inside);
        return;
      }
      if (!s.inside) {
        s.left = true;
        clearTimeout(this.holdTimer);
      } else if (s.left && v.valid && v.distance <= s.threshold) {
        s.returned = true;
        this.pressed(s, true);
        this.diag.check(
          'BTN-RETURN',
          s.button.dataset.pressed === 'true',
          'unpress, then repress before slop',
          { returned: true, pressed: s.button.dataset.pressed },
        );
        if (s.action?.hold) this.armHold(s);
        s.left = false;
      }
    }
    if (s.card && v.phase === 'TAP_CANDIDATE') this.pressed(s, this.inside(s.card, v.x, v.y, true));
    if (v.phase === 'TAP_CANDIDATE' && v.distance > s.threshold) {
      v.valid = false;
      v.phase = 'SLOP_CROSSED';
      v.owner = s.carousel
        ? Math.abs(v.dx) >= Math.abs(v.dy)
          ? 'CAROUSEL'
          : 'MODULES'
        : s.modules
          ? 'MODULES'
          : 'DRAG';
      s.lockedOwner = v.owner;
      clearTimeout(this.holdTimer);
      this.pressed(s, false);
      if (s.card) s.card.dataset.dragging = 'true';
      if (s.carousel && Math.abs(v.dx) === Math.abs(v.dy))
        this.diag.check('GEST-45', v.owner === 'CAROUSEL', 'CAROUSEL at exact 45°', v.owner);
      this.diag.log('slop-crossed', {
        dx: v.dx,
        dy: v.dy,
        owner: v.owner,
        slop: s.threshold,
        pointerType: v.pointerType,
      });
    } else if (v.phase === 'SLOP_CROSSED' && s.carousel) {
      const alternative = Math.abs(v.dx) >= Math.abs(v.dy) ? 'CAROUSEL' : 'MODULES';
      if (alternative !== v.owner)
        this.diag.check(
          'GEST-LOCK',
          v.owner === s.lockedOwner,
          'owner unchanged after changed intent',
          { initial: s.lockedOwner, current: v.owner },
        );
    }
    if (v.phase === 'SLOP_CROSSED') {
      if (v.owner === 'CAROUSEL' && s.carousel) {
        const max = s.carousel.scrollWidth - s.carousel.clientWidth;
        const wanted = s.startScrollX - v.dx;
        s.carousel.scrollLeft = clamp(wanted, 0, max);
        const track = s.carousel.querySelector<HTMLElement>('.carousel-track')!;
        const elastic =
          max > 0 ? rubberBand(clamp(wanted, 0, max) - wanted, this.config().overscroll) : 0;
        track.style.transform = `translateX(${elastic}px)`;
        if (max === 0)
          this.diag.check(
            'GEST-NOFLOW',
            s.carousel.scrollLeft === 0 && elastic === 0,
            'no scroll / elasticity without overflow',
            { scroll: s.carousel.scrollLeft, elastic },
          );
        if (s.carousel.scrollLeft !== s.startScrollX)
          this.diag.check(
            'GEST-X',
            !s.modules || s.modules.scrollTop === s.startScrollY,
            'X changes, Modules Y unchanged',
            { x: s.carousel.scrollLeft, y: s.modules?.scrollTop },
          );
        const now = performance.now();
        s.velocity = (s.lastX - v.x) / Math.max(1, now - s.lastTime);
        s.lastX = v.x;
        s.lastTime = now;
      } else if (v.owner === 'MODULES' && s.modules) {
        s.modules.scrollTop = s.startScrollY - v.dy;
        if (s.modules.scrollTop !== s.startScrollY)
          this.diag.check(
            'GEST-Y',
            !s.carousel || s.carousel.scrollLeft === s.startScrollX,
            'Y changes, Carousel X unchanged',
            { x: s.carousel?.scrollLeft, y: s.modules.scrollTop },
          );
      }
    }
    if (s.button) this.pressed(s, v.valid && s.inside);
    this.onChange();
  };
  private terminal(e: PointerEvent, cancelled: boolean) {
    const s = this.active;
    if (!s || !this.pointers.has(e.pointerId)) return;
    if (!cancelled && s.view.id === e.pointerId) this.move(e);
    this.pointers.delete(e.pointerId);
    if (s.carousel && s.view.pointerType === 'touch' && this.pointers.size) {
      if (s.view.id === e.pointerId) {
        const [id, p] = this.pointers.entries().next().value!;
        // Keep owner and cumulative displacement, rebase new finger without a jump.
        s.view.id = id;
        s.view.startX = p.x - s.view.dx;
        s.view.startY = p.y - s.view.dy;
        s.view.x = p.x;
        s.view.y = p.y;
        s.lastX = p.x;
        s.lastTime = performance.now();
        s.velocity = 0;
        s.view.valid = false;
      }
      return;
    }
    this.end(cancelled, cancelled ? (e.isTrusted ? e.type : `simulated ${e.type}`) : 'pointerup');
  }
  private up = (e: PointerEvent) => this.terminal(e, false);
  private cancelEvent = (e: PointerEvent) => this.terminal(e, true);
  end(cancelled: boolean, reason: string) {
    const s = this.active;
    clearTimeout(this.holdTimer);
    clearTimeout(this.repeatTimer);
    this.holdTimer = this.repeatTimer = 0;
    if (cancelled) cancelAnimationFrame(this.inertiaFrame);
    if (!s) return;
    clearTimeout(this.repeatTimer);
    const v = s.view,
      wasValid = v.valid;
    this.active = null;
    const capturedIds = [...this.pointers.keys(), v.id];
    this.pointers.clear();
    if (s.button) {
      const before = this.count(s.button);
      if (!cancelled && !s.holding && wasValid && s.inside && s.action && this.available(s.action))
        this.perform(s.button, s.action, 'valid pointer release');
      const after = this.count(s.button);
      this.pressed(s, false);
      if (s.action?.instrument === false) {
        /* utility action diagnostics are separate */
      } else if (cancelled)
        this.diag.check(
          'BTN-CANCEL',
          after === before && s.button.dataset.pressed === 'false',
          'no activation, released',
          { before, after, pressed: s.button.dataset.pressed },
        );
      else if (s.holding) {
        this.diag.check('HOLD-NOCLICK', before === after, 'no extra release activation', {
          before,
          after,
        });
      } else if (!s.inside)
        this.diag.check('BTN-OUT', before === after, 'no activation outside', { before, after });
      else if (!wasValid)
        this.diag.check(
          'BTN-DRAG',
          before === after && s.button.dataset.pressed === 'false',
          'no resurrected tap',
          { before, after, pressed: s.button.dataset.pressed },
        );
      else if (this.available(s.action!))
        this.diag.check('BTN-UP', after === before + 1, 'exactly one action', { before, after });
      if (s.holding) {
        this.diag.check(
          'HOLD-END',
          this.active === null && s.button.dataset.pressed === 'false',
          'hold ended and released',
          { reason, pressed: s.button.dataset.pressed },
        );
        if (s.pauseAt)
          this.diag.check('HOLD-PAUSE', s.ticks === s.pauseTicks, 'no unavailable ticks', {
            before: s.pauseTicks,
            after: s.ticks,
          });
      }
    } else if (s.carousel) {
      this.pressed(s, false);
      if (s.card) s.card.dataset.dragging = 'false';
      this.clearHover();
      if (!cancelled && wasValid) {
        const card = document.elementFromPoint(v.x, v.y)?.closest<HTMLElement>('[data-card]');
        if (card && card === s.card && s.carousel.contains(card)) {
          this.cardActivations++;
          card.dispatchEvent(
            new CustomEvent('card-select', { bubbles: true, detail: { value: card.dataset.card } }),
          );
        }
      } else if (!wasValid)
        this.diag.check(
          'GEST-TAP',
          this.cardActivations === s.cardCountBefore,
          'no card activation after drag',
          {
            before: s.cardCountBefore,
            after: this.cardActivations,
            valid: wasValid,
            owner: v.owner,
          },
        );
      const track = s.carousel.querySelector<HTMLElement>('.carousel-track')!;
      const overscrolled =
        track.style.transform && new DOMMatrix(getComputedStyle(track).transform).m41 !== 0;
      track.style.transition = `transform ${this.config().spring}ms ease-out`;
      track.style.transform = 'translateX(0px)';
      if (!cancelled && !overscrolled && v.owner === 'CAROUSEL') this.glide(s);
    }
    v.phase = cancelled ? 'CANCELLED' : 'ENDED';
    v.valid = false;
    try {
      for (const id of capturedIds)
        if (s.target.hasPointerCapture(id)) s.target.releasePointerCapture(id);
    } catch {
      /* unsupported capture */
    }
    this.diag.log(reason, {
      pointerType: v.pointerType,
      pointerId: v.id,
      owner: v.owner,
      dx: v.dx,
      dy: v.dy,
      ticks: s.ticks,
    });
    this.onChange();
  }
  private glide(s: Session) {
    if (
      !s.carousel ||
      s.carousel.scrollWidth <= s.carousel.clientWidth ||
      this.config().inertia === 0 ||
      performance.now() - s.lastTime > 100
    )
      return;
    let speed = s.velocity,
      last = performance.now();
    const el = s.carousel;
    const step = (now: number) => {
      const dt = Math.min(32, now - last);
      last = now;
      speed *= Math.pow(this.config().inertia, dt / 16.7);
      el.scrollLeft += speed * dt;
      this.onChange();
      if (Math.abs(speed) > 0.015) this.inertiaFrame = requestAnimationFrame(step);
    };
    this.inertiaFrame = requestAnimationFrame(step);
  }
  lifecycle() {
    return {
      active: !!this.active,
      pendingTimers: Number(!!this.holdTimer) + Number(!!this.repeatTimer),
      disposed: this.disposed,
    };
  }
  destroy() {
    if (this.disposed) return;
    this.end(true, 'controller unmounted');
    this.disposed = true;
    this.abort.abort();
    this.observer.disconnect();
    cancelAnimationFrame(this.inertiaFrame);
    this.clearHover();
  }
  status(id: string) {
    const s = this.active;
    return s?.button?.dataset.action === id
      ? {
          interaction: s.holding
            ? 'HOLDING'
            : s.view.valid && s.inside
              ? 'PRESSED'
              : s.action?.releasePolicy === 'geometry' && !s.action.hold
                ? 'RELEASED'
                : 'IDLE',
          availability: this.available(s.action!) ? 'READY' : 'WAITING',
          ticks: s.ticks,
          duration: s.holding ? performance.now() - s.holdStart : 0,
        }
      : {
          interaction: 'IDLE',
          availability:
            this.actions.get(id) && this.available(this.actions.get(id)!) ? 'READY' : 'WAITING',
          ticks: 0,
          duration: 0,
        };
  }
}
