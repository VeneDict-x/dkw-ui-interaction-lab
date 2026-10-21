import { ChatModel, clans, type ChatSettings } from './chat-state';
import { editDraft, reconcileDraft } from './chat-text';
import type { InteractionController } from './interaction';
const emojiItems = [
  '😀',
  '😂',
  '😅',
  '😍',
  '🥰',
  '😎',
  '🤔',
  '😭',
  '😡',
  '👍',
  '👎',
  '❤️',
  '🔥',
  '🎉',
  '💪',
  '❄️',
];
export class ClanChat {
  readonly model = new ChatModel();
  private input: HTMLTextAreaElement;
  private picker: HTMLElement;
  private selection = { start: 0, end: 0 };
  private composing = false;
  private compositionBase = '';
  private pickerOpen = false;
  private popupTimer = 0;
  private sizeFrame = 0;
  private historyKey = '';
  private settingsKey = '';
  private outsideRoot: HTMLElement;
  onSettings = (_settings: ChatSettings) => {};
  constructor(
    private root: HTMLElement,
    private diagnostics: HTMLElement,
    controller: InteractionController,
    private isWorld: () => boolean,
  ) {
    root.className = 'clan-chat';
    root.innerHTML = `<div class="chat-heading"><strong>Чат клана</strong><span>Учебная симуляция</span></div><button id="chat-message-area" data-action="chat-message-area" class="chat-message-area" aria-label="Сообщения клана"><span class="chat-empty">Сообщений пока нет</span><span id="chat-messages"></span></button><div class="chat-composer"><button id="emojiPickerToggle" data-action="chat-emoji-toggle" aria-label="Открыть или закрыть эмодзи" aria-expanded="false">😅</button><textarea id="chat-input" rows="1" placeholder="Введите сообщение..." aria-label="Сообщение клану" spellcheck="true"></textarea><button id="chat-send" data-action="chat-send" data-release-policy="geometry" aria-label="Отправить сообщение"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11 12 3l8 8M12 3v18"/></svg></button><div id="emoji-picker" role="group" aria-label="Выбор эмодзи" hidden>${emojiItems.map((e, n) => `<button class="emojiPickerItem" data-action="chat-emoji-${n}" aria-label="Вставить ${e}">${e}</button>`).join('')}</div></div><div id="chat-popup" role="status" aria-live="polite"></div>`;
    diagnostics.innerHTML = `<h3>LAB · Clan Chat</h3><div class="control-strip"><button data-action="chat-live" id="chat-live">Live a clan chat!</button><button data-action="chat-stop" id="chat-stop">Stop discussion</button><button data-action="chat-random" id="chat-random">Random clanmate msg</button><button data-action="chat-double" id="chat-double">Simulate Double Send</button><button data-action="chat-retry" id="chat-retry" hidden>Retry chat save</button></div><output id="chat-save-status" role="status"></output><output id="chat-double-result"></output><pre id="chat-diagnostics"></pre><h4>Chat Message History</h4><pre id="chat-history"></pre>`;
    this.input = root.querySelector('#chat-input')!;
    this.picker = root.querySelector('#emoji-picker')!;
    this.outsideRoot = root.closest('#navigation')!;
    const action = (id: string, run: () => unknown, release = false) =>
      controller.register(id, {
        run: () => {
          void run();
        },
        available: () => this.model.ready,
        instrument: false,
        ...(release ? { releasePolicy: 'geometry' as const } : {}),
      });
    action('chat-message-area', () => this.popup('Чат в разработке'));
    action('chat-emoji-toggle', () => {
      this.pickerOpen = !this.pickerOpen;
      this.renderPicker();
    });
    for (let i = 0; i < emojiItems.length; i++)
      action(`chat-emoji-${i}`, () => this.insert(emojiItems[i]));
    action('chat-send', () => this.send(), true);
    action('chat-live', () => this.model.startLive());
    action('chat-stop', () => this.model.stopLive());
    action('chat-random', () => this.model.fake());
    action('chat-double', () => this.doubleSend());
    controller.register('chat-retry', {
      run: () => {
        void this.model.retry();
      },
      instrument: false,
    });
    // Only controls in this composer preserve existing input focus; no global touch interception.
    root.addEventListener(
      'pointerdown',
      (e) => {
        if ((e.target as Element).closest('#emojiPickerToggle,.emojiPickerItem,#chat-send')) {
          this.rememberSelection();
          e.preventDefault();
        }
      },
      true,
    );
    this.outsideRoot.addEventListener(
      'pointerdown',
      (e) => {
        if (!root.contains(e.target as Node)) this.closePicker(true);
      },
      true,
    );
    for (const event of ['select', 'selectionchange', 'keyup', 'pointerup', 'focus'] as const)
      this.input.addEventListener(event, () => this.rememberSelection(true));
    // Safari can finish native caret/selection-handle movement after pointerup.
    // Observe selection notifications as well, without any touch interception or focus calls.
    document.addEventListener('selectionchange', () => {
      if (document.activeElement === this.input) this.rememberSelection(true);
    });
    this.input.addEventListener('beforeinput', (e) => {
      if (this.composing || e.isComposing || e.inputType.startsWith('delete') || e.data === null)
        return;
      e.preventDefault();
      this.change(
        editDraft(this.input.value, this.input.selectionStart, this.input.selectionEnd, e.data),
      );
    });
    this.input.addEventListener('paste', (e) => {
      if (this.composing) return;
      e.preventDefault();
      const value =
        e.clipboardData?.getData('text/plain') || e.clipboardData?.getData('text/html') || '';
      this.change(
        editDraft(this.input.value, this.input.selectionStart, this.input.selectionEnd, value),
      );
    });
    this.input.addEventListener('compositionstart', () => {
      this.composing = true;
      this.compositionBase = this.model.draft;
    });
    this.input.addEventListener('compositionend', () => {
      this.composing = false;
      this.change(reconcileDraft(this.compositionBase, this.input.value));
    });
    this.input.addEventListener('input', () => {
      if (this.composing) {
        this.size();
        return;
      }
      const nativeCaret = this.input.selectionStart;
      const proposed = this.input.value;
      const next = reconcileDraft(this.model.draft, proposed);
      if (next.text === proposed) next.caret = nativeCaret;
      this.change(next);
    });
    this.model.onChange = () => this.render();
    this.model.onPopup = (text) => this.popup(text);
    document.addEventListener('visibilitychange', () => {
      this.model.pause(document.hidden);
      if (document.hidden) this.closePicker(true);
    });
    window.addEventListener('pagehide', () => {
      this.model.pause(true);
      this.closePicker(true);
    });
    window.addEventListener('pageshow', () => this.model.pause(false));
    window.visualViewport?.addEventListener('resize', () => this.size());
    window.visualViewport?.addEventListener('scroll', () => this.size());
    new ResizeObserver(() => this.size()).observe(root);
    this.render();
  }
  async open() {
    await this.model.restart();
  }
  resetPresentation() {
    clearTimeout(this.popupTimer);
    this.root.querySelector('#chat-popup')!.textContent = '';
    this.root.querySelector('#chat-popup')!.classList.remove('shown');
    this.closePicker(true);
    this.selection = { start: 0, end: 0 };
  }
  suspend() {
    this.closePicker(true);
    this.model.stopLive();
  }
  settings(settings: ChatSettings) {
    this.model.settings(settings);
  }
  private rememberSelection(remeasure = false) {
    const next = { start: this.input.selectionStart, end: this.input.selectionEnd };
    const changed = next.start !== this.selection.start || next.end !== this.selection.end;
    this.selection = next;
    // A picker touchstart only snapshots the range. Relayout here can remove
    // overflow before native pan starts; accepted edits already schedule size().
    if (remeasure && changed) this.size();
  }
  private change(next: { text: string; caret: number }) {
    this.input.value = next.text;
    this.selection = { start: next.caret, end: next.caret };
    this.model.setDraft(next.text, this.isWorld());
    this.input.setSelectionRange(next.caret, next.caret);
    this.size();
  }
  private insert(emoji: string) {
    // The DOM range is authoritative even if its select/selectionchange event is still queued.
    // Reading it also works while blurred; composer controls intentionally preserve input focus.
    this.rememberSelection();
    this.change(editDraft(this.input.value, this.selection.start, this.selection.end, emoji));
  }
  private async send(id?: string) {
    const sent = await this.model.send(id);
    if (sent) this.closePicker(false);
    return sent;
  }
  private async doubleSend() {
    const before = { ...this.model.counters };
    const hasText = !!this.model.draft.trim();
    const id = crypto.randomUUID();
    const [a] = await Promise.all([this.send(id), this.send(id)]);
    const after = this.model.counters;
    const delta = {
      accepted: after.accepted - before.accepted,
      duplicateBlocked: after.duplicateBlocked - before.duplicateBlocked,
      draftClears: after.draftClears - before.draftClears,
      cooldownStarts: after.cooldownStarts - before.cooldownStarts,
    };
    const pass = a && Object.values(delta).every((v) => v === 1);
    this.diagnostics.querySelector('#chat-double-result')!.textContent =
      `${!hasText ? 'EMPTY · no message created' : pass ? 'PASS' : 'NOT ACCEPTED'} · ${JSON.stringify(delta)}`;
  }
  closePicker(blur: boolean) {
    this.pickerOpen = false;
    this.renderPicker();
    if (blur && document.activeElement === this.input) this.input.blur();
  }
  private renderPicker() {
    this.picker.hidden = !this.pickerOpen;
    this.root
      .querySelector('#emojiPickerToggle')!
      .setAttribute('aria-expanded', String(this.pickerOpen));
    this.size();
  }
  private popup(text: string) {
    clearTimeout(this.popupTimer);
    const popup = this.root.querySelector<HTMLElement>('#chat-popup')!;
    popup.textContent = text;
    popup.classList.add('shown');
    this.popupTimer = window.setTimeout(() => {
      popup.classList.remove('shown');
      popup.textContent = '';
    }, 1800);
  }
  private size() {
    if (this.sizeFrame) return;
    this.sizeFrame = requestAnimationFrame(() => {
      this.sizeFrame = 0;
      const previousScroll = this.input.scrollTop;
      const style = getComputedStyle(this.input),
        line = parseFloat(style.lineHeight) || 24;
      const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + 2;
      this.input.scrollTop = previousScroll;
      // Event-driven caret measurement; no polling, markup interpretation, or focus calls.
      const mirror = document.createElement('div');
      Object.assign(mirror.style, {
        position: 'absolute',
        visibility: 'hidden',
        pointerEvents: 'none',
        width: `${this.input.clientWidth}px`,
        boxSizing: 'border-box',
        font: style.font,
        lineHeight: style.lineHeight,
        padding: style.padding,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
      });
      const full = document.createElement('span');
      full.textContent = this.input.value + '\u200b';
      mirror.append(full);
      this.root.append(mirror);
      const needed = Math.ceil(mirror.getBoundingClientRect().height) + 2;
      // A half-visible fourth line deliberately advertises the internal scroll.
      const expanded = 3.5 * line + padding;
      this.input.style.height = `${Math.max(48, Math.min(needed, expanded))}px`;
      this.input.style.overflowY = needed > expanded ? 'auto' : 'hidden';
      mirror.textContent = this.input.value.slice(0, this.input.selectionEnd);
      const marker = document.createElement('span');
      marker.textContent = '\u200b';
      mirror.append(marker);
      const top = marker.getBoundingClientRect().top - mirror.getBoundingClientRect().top;
      mirror.remove();
      if (top < this.input.scrollTop + parseFloat(style.paddingTop))
        this.input.scrollTop = Math.max(0, top - parseFloat(style.paddingTop));
      else if (
        top + line >
        this.input.scrollTop + this.input.clientHeight - parseFloat(style.paddingBottom)
      )
        this.input.scrollTop =
          top + line - this.input.clientHeight + parseFloat(style.paddingBottom);

      const vv = window.visualViewport;
      this.picker.style.maxHeight = `${Math.max(48, Math.min(236, this.input.getBoundingClientRect().top - (vv?.offsetTop || 0) - 8))}px`;
      this.root
        .closest<HTMLElement>('#event-game')
        ?.style.setProperty('--chat-height', `${this.root.offsetHeight}px`);
    });
  }
  private render() {
    if (!this.input) return;
    const m = this.model;
    this.input.disabled = !m.ready;
    if (!this.composing && this.input.value !== m.draft) {
      this.input.value = m.draft;
      this.selection.start = Math.min(this.selection.start, m.draft.length);
      this.selection.end = Math.min(this.selection.end, m.draft.length);
      this.input.setSelectionRange(this.selection.start, this.selection.end);
    }
    const settingsKey = JSON.stringify(m.state.settings);
    if (this.settingsKey !== settingsKey && m.ready) {
      this.settingsKey = settingsKey;
      this.onSettings(m.state.settings);
    }
    const historyKey = JSON.stringify(m.state.messages);
    if (historyKey !== this.historyKey) {
      this.historyKey = historyKey;
      const list = this.root.querySelector('#chat-messages')!;
      list.replaceChildren();
      (list as HTMLElement).hidden = m.state.messages.length === 0;
      for (const message of m.state.messages.slice(-4)) {
        const row = document.createElement('span');
        row.className = `chat-line chat-${message.type}`;
        row.dataset.messageId = message.id;
        row.dataset.authorId = message.authorId;
        const author = clans.find((c) => c.id === message.authorId);
        const badge = document.createElement('span');
        badge.className = 'chat-badge';
        badge.textContent = author?.name || (message.type === 'user' ? 'Вы' : 'Система');
        if (author) badge.style.setProperty('--badge-color', author.color);
        const body = document.createElement('span');
        body.className = 'chat-body';
        body.textContent = message.text;
        row.append(badge, body);
        list.append(row);
      }
      this.root.querySelector<HTMLElement>('.chat-empty')!.hidden = m.state.messages.length > 0;
      this.diagnostics.querySelector('#chat-history')!.textContent =
        m.state.messages
          .map(
            (msg) =>
              `${msg.sequence}. ${msg.id} | ${msg.authorId} | ${new Date(msg.timestamp).toISOString()} | ${msg.type}\n${msg.text}`,
          )
          .join('\n\n') || 'История пуста';
    }
    const send = this.root.querySelector<HTMLElement>('#chat-send')!;
    send.dataset.available = String(Date.now() >= m.state.cooldownUntil);
    send.dataset.availability = Date.now() >= m.state.cooldownUntil ? 'READY' : 'WAITING';
    this.diagnostics.querySelector('#chat-save-status')!.textContent =
      m.saveStatus + (m.error ? ` · ${m.error}` : '');
    this.diagnostics.querySelector<HTMLElement>('#chat-retry')!.hidden =
      m.saveStatus !== 'SAVE_FAILED';
    this.diagnostics.querySelector('#chat-diagnostics')!.textContent = JSON.stringify(
      {
        retained: m.state.messages.length,
        visible: Math.min(4, m.state.messages.length),
        seed: m.state.seed,
        live: m.live,
        cooldownUntil: m.state.cooldownUntil,
        persistedVersion: m.version,
        ...m.counters,
        physicalIPhone: 'PENDING',
      },
      null,
      2,
    );
    this.diagnostics.querySelector<HTMLElement>('#chat-live')!.dataset.live = String(m.live);
    this.size();
  }
}
