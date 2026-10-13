import {
  DraftEditor,
  DraftRepository,
  combination,
  largeShapes,
  smallShapes,
  numbers,
  variableLatency,
} from './draft';
import { bindCarousel } from './carousel';
import type { InteractionController } from './interaction';
import type { Config } from './config';
import type { Diagnostics } from './diagnostics';
const escape = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function shapeSvg(shape: string, large = true) {
  if (shape === 'None') return '';
  const fill = large ? '#516f86' : '#8ac2ac',
    stroke = large ? '#93b1c4' : '#d0eadf';
  const attr = `fill="${fill}" stroke="${stroke}" stroke-width="3"`;
  if (shape === 'Circle') return `<circle cx="140" cy="100" r="31" ${attr}/>`;
  if (shape === 'Square')
    return large
      ? `<rect x="72" y="32" width="136" height="136" ${attr}/>`
      : `<rect x="109" y="69" width="62" height="62" ${attr}/>`;
  const points =
    shape === 'Triangle'
      ? '140,20 218,165 62,165'
      : shape === 'Diamond'
        ? '140,15 225,100 140,185 55,100'
        : shape === 'Hexagon'
          ? '100,27 180,27 220,100 180,173 100,173 60,100'
          : '107,20 173,20 220,67 220,133 173,180 107,180 60,133 60,67';
  return `<polygon points="${points}" ${!large ? 'transform="translate(140 100) scale(.4) translate(-140 -100)"' : ''} ${attr}/>`;
}
export class DraftLab {
  readonly editor = new DraftEditor(new DraftRepository());
  private ready: Promise<void> | null = null;
  private dialog: HTMLDialogElement;
  private modal = '';
  private busy = false;
  private returnFocus: HTMLElement | null = null;
  constructor(
    private root: HTMLElement,
    private controller: InteractionController,
    private config: () => Config,
    private diag: Diagnostics,
  ) {
    root.innerHTML = `<p class="hint">LOCAL LAB · IndexedDB persistence · simulated save latency · no server or remote sync.</p>
      <div class="draft-window"><div class="draft-preview"><output id="draft-current-label"></output><svg id="draft-composition" viewBox="0 0 280 200" role="img" aria-label="Geometric composition"></svg><output id="draft-persisted-label"></output><output id="draft-save-state" role="status" aria-live="polite"></output><button data-action="draft-retry" id="draft-retry" hidden>Retry save</button></div>
      <div id="draft-editor-view"><div class="gesture-modules draft-modules" aria-label="Draft modules" tabindex="0">${(['large', 'small', 'number'] as const).map((key, i) => `<section class="module-row"><div class="module-title"><strong>${['Large shape', 'Small shape', 'Number'][i]}</strong></div><div class="carousel-shell"><button class="carousel-arrow left" data-action="draft-left-${key}" aria-label="${key} left">❮</button><button class="carousel-arrow right" data-action="draft-right-${key}" aria-label="${key} right">❯</button><div id="draft-carousel-${key}" class="carousel" data-key="${key}"><div class="carousel-track">${(key === 'large' ? largeShapes : key === 'small' ? smallShapes : numbers).map((value) => `<button class="selection-card" data-card="${value}" data-pressed="false" data-dragging="false" data-hovered="false" aria-pressed="false" aria-label="${key}: ${value}"><span class="card-thumbnail">${value === 'None' ? '×' : key === 'number' ? value : `<svg viewBox="0 0 280 200" aria-hidden="true">${shapeSvg(value, true)}</svg>`}</span><span>${value}</span></button>`).join('')}</div></div></div></section>`).join('')}</div>
      <div class="button-row"><button id="draft-apply" data-action="draft-apply" class="primary">Apply</button><button data-action="draft-cancel">Cancel</button></div></div>
      <div id="draft-non-editing" hidden><p>Non-editing lab view. Applied is unchanged by autosave.</p><button data-action="draft-open">Start new edit from Applied</button><button data-action="draft-recover" id="draft-recover" hidden>Recover retained draft</button></div></div>
      <details open class="draft-diagnostics"><summary>Test & Diagnostics</summary><pre id="draft-values"></pre><div class="control-strip"><label>EXPERIMENTAL latency mode<select id="draft-latency"><option value="variable">Variable 1.5–2.5 s</option><option value="1500">Deterministic 1.5 s</option><option value="2500">Deterministic 2.5 s</option><option value="race">Out of order: A 2.5 s / B 1.5 s</option></select></label></div><div class="draft-tests">
      <button data-action="draft-background">Background → foreground (simulated)</button><button data-action="draft-reload">Real page reload</button><button data-action="draft-crash">Simulated crash / rehydrate</button><button data-action="draft-crash-before">Crash before pending save</button><button data-action="draft-crash-after">Save then crash after confirmation</button><button data-action="draft-failure">Inject next save failure</button><button data-action="draft-burst">Rapid edits / out-of-order saves</button><button data-action="draft-apply-flight">Apply during save</button><button data-action="draft-discard-flight">Discard during save (confirm)</button><button data-action="draft-later-flight">Save for later during save (confirm)</button><button data-action="draft-cleanup">Clear module 06 storage (confirm)</button></div><ol id="draft-events"></ol></details>
      <dialog id="draft-dialog" aria-labelledby="draft-dialog-title"><h3 id="draft-dialog-title"></h3><p id="draft-dialog-copy"></p><div class="draft-dialog-actions"><button data-action="draft-discard-confirm">Discard changes</button><button data-action="draft-later-confirm">Save for later</button><button data-action="draft-continue">Continue editing</button><button data-action="draft-modal-retry" hidden>Retry save for later</button><button data-action="draft-recovery-continue">Continue editing</button><button data-action="draft-not-now">Not now</button><button data-action="draft-delete">Delete draft…</button><button data-action="draft-delete-confirm">Delete draft permanently</button><button data-action="draft-clean-confirm">Clear module 06 data</button><button data-action="draft-dismiss">Keep data / go back</button></div><output id="draft-modal-status" role="status"></output></dialog>`;
    this.dialog = this.get('draft-dialog') as HTMLDialogElement;
    const action = (id: string, run: () => unknown, available = () => true) =>
      controller.register(id, {
        run: () => {
          void run();
        },
        available,
      });
    const editing = () => this.editor.editing && !this.busy;
    const apply = () => editing() && this.editor.current.large !== 'None';
    action('draft-open', () => this.editor.start());
    action('draft-recover', () => this.showModal('recovery'));
    action(
      'draft-apply',
      async () => {
        if (await this.editor.apply())
          this.get('draft-non-editing').querySelector<HTMLButtonElement>('button')?.focus();
      },
      apply,
    );
    action('draft-cancel', () => this.showModal('cancel'), editing);
    action('draft-retry', () => this.editor.save(), editing);
    action(
      'draft-discard-confirm',
      () => this.operation(() => this.editor.discard()),
      () => !this.busy,
    );
    action(
      'draft-later-confirm',
      () => this.operation(() => this.editor.later()),
      () => !this.busy,
    );
    action(
      'draft-modal-retry',
      () => this.operation(() => this.editor.later()),
      () => !this.busy,
    );
    action(
      'draft-continue',
      () => {
        this.editor.continueEditing();
        this.hideModal();
      },
      () => !this.busy,
    );
    action(
      'draft-recovery-continue',
      () => this.operation(() => this.editor.start(true)),
      () => !this.busy,
    );
    action('draft-not-now', () => {
      this.editor.notNow();
      this.hideModal();
    });
    action('draft-delete', () => this.showModal('delete'));
    action(
      'draft-delete-confirm',
      () => this.operation(() => this.editor.deleteDraft()),
      () => !this.busy,
    );
    action(
      'draft-clean-confirm',
      () => this.operation(() => this.editor.cleanup()),
      () => !this.busy,
    );
    action(
      'draft-dismiss',
      () => {
        if (this.modal === 'delete') this.showModal('recovery');
        else this.hideModal();
      },
      () => !this.busy,
    );
    action('draft-background', () => this.editor.backgroundReturn());
    action('draft-reload', () => location.reload());
    action('draft-crash', () => this.crash());
    action('draft-crash-before', () => this.crash());
    action(
      'draft-crash-after',
      async () => {
        if (await this.editor.save()) await this.crash();
      },
      editing,
    );
    action(
      'draft-failure',
      () => {
        this.editor.failNext = true;
        void this.editor.save();
      },
      editing,
    );
    action(
      'draft-burst',
      () => {
        this.get<HTMLSelectElement>('draft-latency').value = 'race';
        this.updateLatency();
        this.editor.select('large', 'Square');
        this.editor.select('small', 'Circle');
        this.editor.select('number', '3');
      },
      editing,
    );
    action(
      'draft-apply-flight',
      () => {
        void this.editor.save();
        void this.editor.apply();
      },
      apply,
    );
    action(
      'draft-discard-flight',
      () => {
        void this.editor.save();
        this.showModal('cancel');
      },
      editing,
    );
    action(
      'draft-later-flight',
      () => {
        void this.editor.save();
        this.showModal('cancel');
      },
      editing,
    );
    action('draft-cleanup', () => this.requestCleanup());
    for (const key of ['large', 'small', 'number'] as const) {
      const el = this.get(`draft-carousel-${key}`);
      bindCarousel(
        el,
        root.querySelector(`[data-action="draft-left-${key}"]`)!,
        root.querySelector(`[data-action="draft-right-${key}"]`)!,
        controller,
        config,
      );
      el.addEventListener('card-select', (e) =>
        this.editor.select(key, (e as CustomEvent).detail.value),
      );
      el.addEventListener('click', (e) => {
        const card = (e.target as Element).closest<HTMLElement>('[data-card]');
        if (e.detail === 0 && card) this.editor.select(key, card.dataset.card!);
      });
    }
    this.get('draft-latency').addEventListener('change', () => this.updateLatency());
    this.editor.onChange = () => this.render();
    this.dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      if (this.busy) return;
      if (this.modal === 'cancel') this.editor.continueEditing();
      if (this.modal === 'recovery') this.editor.notNow();
      this.hideModal();
    });
    document.addEventListener('visibilitychange', () => {
      if (this.editor.editing)
        this.diag.log('draft-live-visibility', {
          hidden: document.hidden,
          retainedLiveSession: true,
        });
    });
    this.render();
  }
  private get<T extends HTMLElement = HTMLElement>(id: string) {
    return this.root.querySelector<T>(`#${id}`)!;
  }
  async open() {
    await (this.ready ??= this.editor.initialize());
    if (this.editor.recovery) {
      this.showModal('recovery');
    } else if (!this.editor.editing && this.editor.outcome === '') await this.editor.start();
  }
  private updateLatency() {
    const mode = this.get<HTMLSelectElement>('draft-latency').value;
    this.editor.latencyFor =
      mode === 'variable'
        ? variableLatency()
        : mode === 'race'
          ? (v) => (v % 2 ? 2500 : 1500)
          : () => Number(mode);
  }
  private async crash() {
    this.hideModal();
    await this.editor.crash();
    if (this.editor.recovery) this.showModal('recovery');
    else this.render();
  }
  requestCleanup() {
    this.showModal('cleanup');
  }
  private async operation(run: () => Promise<unknown>) {
    this.busy = true;
    this.render();
    try {
      await run();
      if (this.editor.state !== 'SAVE_FAILED') this.hideModal();
    } finally {
      this.busy = false;
      this.render();
    }
  }
  private showModal(kind: string) {
    if (!this.dialog.open) this.returnFocus = document.activeElement as HTMLElement;
    this.modal = kind;
    const titles: Record<string, string> = {
      cancel: 'Leave the editor?',
      recovery: 'Draft found',
      delete: 'Delete retained draft?',
      cleanup: 'Clear module 06 local data?',
    };
    this.get('draft-dialog-title').textContent = titles[kind];
    this.get('draft-dialog-copy').textContent =
      kind === 'cancel'
        ? 'Discard requires this confirmation. Save for later waits for successful local persistence. Continue keeps editing.'
        : kind === 'recovery'
          ? 'A successfully persisted unfinished draft is available. Applied has not changed.'
          : kind === 'delete'
            ? 'This permanently deletes the retained draft. Applied remains unchanged.'
            : 'This explicitly clears Draft and Applied for this laboratory only. Other modules and Debug settings remain.';
    const ids: Record<string, string[]> = {
      cancel: ['draft-discard-confirm', 'draft-later-confirm', 'draft-continue'],
      recovery: ['draft-recovery-continue', 'draft-not-now', 'draft-delete'],
      delete: ['draft-delete-confirm', 'draft-dismiss'],
      cleanup: ['draft-clean-confirm', 'draft-dismiss'],
    };
    this.dialog
      .querySelectorAll<HTMLButtonElement>('[data-action]')
      .forEach((b) => (b.hidden = !ids[kind].includes(b.dataset.action!)));
    if (!this.dialog.open) this.dialog.showModal();
    const safe =
      kind === 'cancel'
        ? 'draft-continue'
        : kind === 'recovery'
          ? 'draft-not-now'
          : 'draft-dismiss';
    this.dialog.querySelector<HTMLButtonElement>(`[data-action="${safe}"]`)?.focus();
    this.render();
  }
  private hideModal() {
    if (this.dialog.open) this.dialog.close();
    this.modal = '';
    const focus = !this.editor.editing
      ? this.get('draft-non-editing').querySelector<HTMLButtonElement>('button')
      : this.returnFocus?.getClientRects().length
        ? this.returnFocus
        : this.get('draft-editor-view').querySelector<HTMLButtonElement>('button');
    focus?.focus({ preventScroll: true });
  }
  private render() {
    const e = this.editor;
    this.get('draft-current-label').textContent = `Current: ${combination(e.current)}`;
    this.get('draft-persisted-label').textContent = e.draft
      ? `Persisted draft: ${combination(e.draft.selection)} · v${e.draft.version} · ${e.draft.time}`
      : 'Persisted draft: none';
    this.get('draft-composition').innerHTML =
      shapeSvg(e.current.large) +
      shapeSvg(e.current.small, false) +
      (e.current.number === 'None'
        ? ''
        : `<text x="140" y="110" text-anchor="middle" fill="#fff" font-size="32">${e.current.number}</text>`);
    const labels = {
      IDLE: '○ No pending save',
      SAVING: '◷ Saving…',
      DRAFT_SAVED: '✓ Draft saved',
      SAVE_FAILED: '! Save failed',
    };
    this.get('draft-save-state').textContent = labels[e.state] + (e.error ? ` · ${e.error}` : '');
    this.get('draft-save-state').dataset.state = e.state;
    this.get('draft-retry').hidden = e.state !== 'SAVE_FAILED' || !e.editing;
    this.get('draft-editor-view').hidden = !e.editing;
    this.get('draft-non-editing').hidden = e.editing;
    this.get('draft-recover').hidden = !e.draft;
    this.get<HTMLButtonElement>('draft-apply').disabled = e.current.large === 'None' || this.busy;
    for (const key of ['large', 'small', 'number'] as const)
      this.get(`draft-carousel-${key}`)
        .querySelectorAll<HTMLElement>('[data-card]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.card === e.current[key])));
    const values = {
      current: e.current,
      draft: e.draft,
      applied: e.applied,
      editing: e.editing,
      editStatus: e.editStatus,
      saveState: e.state,
      saveVersion: e.version,
      durableVersion: e.draft?.version || 0,
      currentSessionConfirmedVersion: e.savedVersion,
      editingSession: e.session || null,
      latencyMs: e.latency,
      failureReason: e.error || null,
      recovery: e.recovery ? 'DRAFT_FOUND' : 'NONE',
      outcome: e.outcome || 'NONE',
      pendingPhysicalSafari: 'PENDING',
    };
    this.get('draft-values').textContent = JSON.stringify(values, null, 2);
    this.get('draft-events').innerHTML = e.events
      .slice(-15)
      .reverse()
      .map(
        (v) =>
          `<li>${escape(v.time.slice(11, 23))} · ${escape(v.type)} · ${escape(JSON.stringify(v.detail))}</li>`,
      )
      .join('');
    this.dialog.querySelector<HTMLButtonElement>('[data-action="draft-modal-retry"]')!.hidden =
      this.modal !== 'cancel' || e.state !== 'SAVE_FAILED';
    this.get('draft-modal-status').textContent = this.busy
      ? 'Saving / waiting for durable transaction…'
      : e.error;
    this.dialog
      .querySelectorAll<HTMLButtonElement>('button')
      .forEach((b) => (b.disabled = this.busy));
  }
}
