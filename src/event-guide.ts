import { EventModel, pageAccessible, type EventState } from './event-state';
import { articleMarkup, guideArticles } from './event-articles';
import { GuideGesture } from './guide-gesture';
import type { Config } from './config';
import type { InteractionController } from './interaction';
import type { Diagnostics } from './diagnostics';
const popupText = 'Следующая часть откроется после прочтения текущей';
export class EventGuide {
  readonly model = new EventModel();
  private gesture: GuideGesture;
  private ready: Promise<void> | null = null;
  private previous: EventState | null = null;
  private popupTimer = 0;
  private popupClear = 0;
  private lastError = '';
  constructor(
    private root: HTMLElement,
    controller: InteractionController,
    private config: () => Config,
    private diag: Diagnostics,
    private changed: (page: number) => void,
  ) {
    root.innerHTML = `<div class="control-strip event-settings"><label>Scenario<select id="nav-scenario"><option value="both">Back + Next</option><option value="back">Back only</option></select></label><label>Boundary<select id="nav-boundary"><option value="disabled">Disabled</option><option value="hidden">Hidden</option></select></label><label>Theme<select id="nav-faction"><option>Light</option><option>Dark</option><option>Premium</option></select></label></div>
      <div id="event-game" class="event-game" data-theme="Light" aria-label="Учебный игровой экран">
        <section id="event-world" class="game-scene world-scene"><div class="world-resources"><span>🌾 240</span><span>🪵 160</span><span>🪨 90</span></div><button id="event-enter" data-action="event-enter" class="event-entry">☃️ Событие</button><div class="terrain" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i style="--tile:${i}"></i>`).join('')}</div><div class="world-castle" aria-hidden="true">🏰</div><div class="world-avatar" aria-hidden="true">🧙</div><div class="world-caption"><strong>Долина королевства</strong><span>Учебная сцена · условные ресурсы</span></div></section>
        <section id="winter-event" class="game-scene winter-scene" hidden><header class="event-scene-header"><button data-action="event-world" id="event-back">← Мир</button><strong>Зимнее знакомство</strong><button id="reopen" data-action="mini-reopen" aria-label="Открыть памятку">❓</button></header><div class="snowflakes" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<span style="left:${(i * 37 + 9) % 94}%;top:${(i * 19 + 12) % 85}%">❄</span>`).join('')}</div><div class="event-snowman" aria-hidden="true">☃️</div><div class="winter-caption">Тёплые встречи в снежной долине</div></section>
        <section id="mini-window" class="event-guide mini-window" role="dialog" aria-label="Памятка зимнего события" hidden><header><div><span class="guide-kicker">ПАМЯТКА СОБЫТИЯ</span><h3 id="page-title">Page 1 / 5</h3></div><button data-action="mini-close" aria-label="Закрыть памятку">×</button></header>
        <div id="guide-pages" class="guide-pages" tabindex="0" aria-label="Статьи памятки"><div id="guide-track" class="guide-track">${guideArticles.map((_, i) => `<section class="guide-page" data-page="${i + 1}"><article class="guide-article-body">${articleMarkup(i + 1)}<div class="guide-ack-row"><button data-guide-ack="${i + 1}" class="primary">Понятно</button></div></article><div class="guide-lock-preview" hidden><span aria-hidden="true">🔒</span><p>Сначала прочитайте текущую часть</p></div></section>`).join('')}</div></div>
        <footer class="guide-footer"><div class="guide-steps"><button id="page-back" data-action="page-back">← Back</button><button id="page-next" data-action="page-next">Next →</button></div><nav id="dots" class="dots" aria-label="Страницы памятки">${[1, 2, 3, 4, 5].map((n) => `<button data-action="page-${n}" aria-label="Страница ${n}" class="dot"><span>${n}</span><i class="guide-dot-overlay" aria-hidden="true"></i></button>`).join('')}</nav><output id="page-state"></output></footer><div id="guide-popup" class="guide-popup" role="status" aria-live="polite" aria-atomic="true"></div></section>
      </div>
      <section class="event-qa" aria-label="Лабораторные инструменты события"><h3>LAB · Event State</h3><p class="hint">Инструменты проверки вне игровой сцены. Данные хранятся только в этом браузере.</p><div class="control-strip"><button data-action="event-reset" id="event-reset">Reset Event State</button><button data-action="event-restart" id="event-restart">Simulate App Restart</button><button data-action="event-reload" id="event-reload">Reload Page</button><button data-action="event-retry" id="event-retry" hidden>Retry save</button></div><output id="event-save-status" role="status"></output><pre id="event-diagnostics"></pre></section>`;
    root.insertAdjacentHTML(
      'beforeend',
      `<dialog id="event-reset-dialog" aria-labelledby="event-reset-title"><h3 id="event-reset-title">Сбросить событие?</h3><p>Прогресс чтения и сохранённый экран события будут удалены. Другие модули сохранят своё состояние.</p><div class="control-strip"><button data-action="event-reset-cancel" autofocus>Сохранить прогресс</button><button data-action="event-reset-confirm">Сбросить событие</button></div></dialog>`,
    );
    const action = (id: string, run: () => unknown) =>
      controller.register(id, {
        run: () => {
          void run();
        },
        available: () =>
          this.model.ready ||
          id === 'event-reset' ||
          id.startsWith('event-reset-') ||
          id === 'event-retry' ||
          id === 'event-restart' ||
          id === 'event-reload',
        instrument: false,
      });
    action('event-enter', () => this.command({ type: 'enter' }));
    action('event-world', () => this.command({ type: 'leave' }));
    action('mini-reopen', () => this.command({ type: 'open' }));
    action('mini-close', () => this.command({ type: 'close' }));
    action('page-back', () => this.navigate(this.model.state.lastPage - 1));
    action('page-next', () => this.navigate(this.model.state.lastPage + 1));
    for (let n = 1; n <= 5; n++) action(`page-${n}`, () => this.navigate(n));
    action('event-reset', () => this.reset());
    action('event-reset-cancel', () => this.get<HTMLDialogElement>('event-reset-dialog').close());
    action('event-reset-confirm', () => {
      this.get<HTMLDialogElement>('event-reset-dialog').close();
      return this.resetConfirmed();
    });
    action('event-restart', () => this.restart());
    action('event-reload', () => location.reload());
    action('event-retry', () => this.model.retry());
    this.gesture = new GuideGesture(
      this.get('guide-pages'),
      this.get('guide-track'),
      config,
      () => this.model.state.lastPage,
      (n) => pageAccessible(this.model.state, n),
      (n) => this.navigate(n, true),
      (n) => this.ack(n),
      () => this.popup(),
    );
    this.model.onChange = () => this.render();
    for (const id of ['nav-scenario', 'nav-boundary', 'nav-faction'])
      this.get(id).addEventListener('change', () => {
        this.render();
        this.diag.log('navigation-setting', {
          scenario: this.get<HTMLSelectElement>('nav-scenario').value,
          boundary: this.get<HTMLSelectElement>('nav-boundary').value,
          faction: this.get<HTMLSelectElement>('nav-faction').value,
        });
      });
    this.get('mini-window').addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        void this.command({ type: 'close' });
      }
      if (e.key === 'Tab') {
        const buttons = [
          ...this.get('mini-window').querySelectorAll<HTMLElement>(
            'button:not(:disabled),[tabindex="0"]',
          ),
        ].filter((b) => b.getClientRects().length && !b.closest('[inert]'));
        const first = buttons[0],
          last = buttons.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    });
    root.addEventListener(
      'pointerdown',
      (e) => {
        for (const [id, page] of [
          ['page-back', 1],
          ['page-next', 5],
        ] as const) {
          const b = this.get<HTMLButtonElement>(id),
            r = b.getBoundingClientRect();
          if (
            !b.hidden &&
            b.disabled &&
            this.model.state.lastPage === page &&
            e.clientX >= r.left &&
            e.clientX <= r.right &&
            e.clientY >= r.top &&
            e.clientY <= r.bottom
          )
            this.diag.check('NAV-BOUND', true, 'boundary remains unchanged', {
              page,
              disabled: true,
            });
        }
      },
      true,
    );
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.suspend();
      else if (this.model.state.guideOpen)
        this.root.querySelector<HTMLElement>(
          '.guide-page[data-page="' + this.model.state.lastPage + '"]',
        )!.scrollTop = 0;
    });
    this.render();
  }
  private get<T extends HTMLElement = HTMLElement>(id: string) {
    return this.root.querySelector<T>(`#${id}`)!;
  }
  async open() {
    await (this.ready ??= this.model.restart());
  }
  suspend() {
    this.gesture.cancel(false);
    this.clearPopup();
  }
  async restart() {
    this.suspend();
    await this.model.restart();
  }
  reset() {
    this.suspend();
    const dialog = this.get<HTMLDialogElement>('event-reset-dialog');
    if (!dialog.open) dialog.showModal();
  }
  private async resetConfirmed() {
    this.suspend();
    await this.model.reset();
    this.diag.log('event-reset', { scope: '04 only' });
  }
  private async command(command: Parameters<EventModel['command']>[0], preserveDrag = false) {
    const pageBefore = this.model.state.lastPage;
    if (!preserveDrag) this.gesture.sync();
    const ok = await this.model.command(command);
    if (ok) {
      this.diag.log('event-state', {
        command,
        version: this.model.version,
        screen: this.model.state.currentScreen,
      });
      if (command.type === 'open')
        this.diag.check(
          'NAV-CLOSE',
          this.model.state.lastPage === pageBefore &&
            this.model.state.guideOpen &&
            !this.root.hidden,
          'same page after reopen',
          {
            page: this.model.state.lastPage,
            labOpen: !this.root.hidden,
          },
        );
    }
    if (!ok) this.gesture.sync();
    return ok;
  }
  navigate(n: number, fromSwipe = false) {
    const s = this.model.state;
    if (!s.guideOpen || n < 1 || n > 5) return;
    if (!pageAccessible(s, n)) {
      this.popup();
      return;
    }
    void this.command({ type: 'navigate', page: n }, fromSwipe).then((ok) => {
      if (ok)
        this.diag.check(
          'NAV-PAGE',
          this.model.state.lastPage === n &&
            this.get('page-title').textContent === `Page ${n} / 5` &&
            this.root.querySelector(`[data-action="page-${n}"]`)?.getAttribute('aria-current') ===
              'page',
          `page ${n} active`,
          {
            page: this.model.state.lastPage,
          },
        );
    });
  }
  private ack(n: number) {
    if (
      this.model.saveStatus === 'SAVING' ||
      this.model.state.acknowledgedPages.includes(n) ||
      this.model.state.guideCompleted
    )
      return;
    void this.command({ type: 'ack', page: n });
  }
  private clearPopup() {
    clearTimeout(this.popupTimer);
    clearTimeout(this.popupClear);
    this.get('guide-popup').classList.remove('shown');
    this.get('guide-popup').textContent = '';
  }
  private popup() {
    this.clearPopup();
    const popup = this.get('guide-popup'),
      c = this.config();
    popup.textContent = popupText;
    popup.classList.add('shown');
    popup.style.setProperty('--popup-in', `${c.guidePopupIn}ms`);
    popup.style.setProperty('--popup-out', `${c.guidePopupOut}ms`);
    this.popupTimer = window.setTimeout(() => {
      popup.classList.remove('shown');
      this.popupClear = window.setTimeout(
        () => {
          popup.textContent = '';
        },
        matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : c.guidePopupOut,
      );
    }, c.guidePopupIn + c.guidePopupVisible);
    this.diag.log('guide-locked-attempt', { page: this.model.state.lastPage });
  }
  private render() {
    const s = this.model.state,
      old = this.previous;
    this.changed(s.lastPage);
    this.get('event-world').hidden = s.currentScreen !== 'world';
    this.get('winter-event').hidden = s.currentScreen !== 'event';
    this.get('mini-window').hidden = !s.guideOpen;
    this.get('winter-event').inert = s.guideOpen;
    this.get('event-game').dataset.theme = this.get<HTMLSelectElement>('nav-faction').value;
    this.get('page-title').textContent = `Page ${s.lastPage} / 5`;
    this.get('page-state').textContent =
      `Selected page ${s.lastPage} · page count 5 · ${s.guideMode.toUpperCase()}`;
    const hidden = this.get<HTMLSelectElement>('nav-boundary').value === 'hidden',
      backOnly = this.get<HTMLSelectElement>('nav-scenario').value === 'back';
    for (const [id, bound] of [
      ['page-back', s.lastPage === 1],
      ['page-next', s.lastPage === 5],
    ] as const) {
      const b = this.get<HTMLButtonElement>(id);
      b.disabled = bound || !this.model.ready;
      b.hidden = (hidden && bound) || (id === 'page-next' && backOnly);
    }
    for (let n = 1; n <= 5; n++) {
      const dot = this.root.querySelector<HTMLElement>(`[data-action="page-${n}"]`)!,
        locked = !pageAccessible(s, n),
        check = s.guideMode !== 'reference' && s.acknowledgedPages.includes(n);
      dot.dataset.faction = this.get<HTMLSelectElement>('nav-faction').value;
      dot.dataset.locked = String(locked);
      dot.dataset.acknowledged = String(check);
      dot.setAttribute('aria-current', n === s.lastPage ? 'page' : 'false');
      dot.setAttribute(
        'aria-label',
        `Страница ${n}: ${guideArticles[n - 1].title}${locked ? ', закрыта' : check ? ', прочитано' : ''}`,
      );
      dot.querySelector('.guide-dot-overlay')!.innerHTML = check
        ? '<svg viewBox="0 0 16 16"><path d="m2 8 4 4 8-9" fill="none" stroke="#68d69f" stroke-width="1.6"/></svg>'
        : locked
          ? '<svg viewBox="0 0 16 16"><path d="M5 7V5a3 3 0 0 1 6 0v2"/><rect x="3" y="7" width="10" height="7" rx="2"/></svg>'
          : '';
      const article = this.root.querySelector<HTMLElement>(`.guide-page[data-page="${n}"]`)!;
      article.inert = n !== s.lastPage;
      article.setAttribute('aria-hidden', String(n !== s.lastPage));
      article.querySelector<HTMLElement>('.guide-article-body')!.hidden = locked;
      article.querySelector<HTMLElement>('.guide-lock-preview')!.hidden = !locked;
      const ack = article.querySelector<HTMLButtonElement>('[data-guide-ack]')!;
      ack.hidden = s.guideCompleted || s.acknowledgedPages.includes(n) || locked;
      ack.disabled = !this.model.ready || this.model.saveStatus === 'SAVING';
    }
    if (!old || old.lastPage !== s.lastPage || old.guideOpen !== s.guideOpen) {
      this.gesture?.sync();
      this.root.querySelector<HTMLElement>(`.guide-page[data-page="${s.lastPage}"]`)!.scrollTop = 0;
      if (s.guideOpen && !old?.guideOpen)
        requestAnimationFrame(() => {
          if (this.model.state.guideOpen)
            this.root
              .querySelector<HTMLButtonElement>('[data-action="mini-close"]')
              ?.focus({ preventScroll: true });
        });
      else if (old?.guideOpen && !s.guideOpen && s.currentScreen === 'event')
        this.get('reopen').focus({ preventScroll: true });
    }
    this.previous = structuredClone(s);
    this.get('event-save-status').textContent =
      `${this.model.saveStatus}${this.model.error ? ' · ' + this.model.error : ''}`;
    this.get('event-retry').hidden = this.model.saveStatus !== 'SAVE_FAILED';
    this.get('event-diagnostics').textContent = JSON.stringify(
      {
        ...s,
        saveStatus: this.model.saveStatus,
        persistedVersion: this.model.version,
        error: this.model.error || null,
        physicalSafari: 'PENDING',
      },
      null,
      2,
    );
    if (this.model.error && this.model.error !== this.lastError)
      this.diag.log('event-save-failed', { reason: this.model.error });
    this.lastError = this.model.error;
  }
}
