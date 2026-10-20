import { openModule04DB } from './module04-db';
import { cleanDraft, plainText } from './chat-text';
export const CHAT_KEY = 'module04-chat-v1';
export const clans = [
  { id: 'kraken', name: 'KrakenFox', color: '#ffc28d' },
  { id: 'moon', name: 'MoonKnight', color: '#d8baff' },
  { id: 'cedar', name: 'CedarWolf', color: '#a3e9b4' },
  { id: 'aurora', name: 'Aurora', color: '#ffb9d1' },
  { id: 'frost', name: 'FrostRaven', color: '#8ce5e5' },
  { id: 'sun', name: 'SunMarten', color: '#ecde92' },
  { id: 'ash', name: 'AshOak', color: '#bed4ff' },
] as const;
export type ChatMessage = {
  id: string;
  authorId: string;
  text: string;
  timestamp: number;
  sequence: number;
  type: 'system' | 'clan' | 'user';
};
export type ChatSettings = {
  scenario: 'both' | 'back';
  boundary: 'hidden' | 'disabled';
  theme: 'Light' | 'Dark' | 'Premium';
};
export type ChatData = {
  settings: ChatSettings;
  draft: string;
  messages: ChatMessage[];
  sequence: number;
  seed: { triggered: boolean; next: number; dueAt: number };
  cooldownUntil: number;
  acceptedIds: string[];
  fakeIndex: number;
};
export type ChatRecord = { epoch: string; lease: string; version: number; data: ChatData };
export const initialChat = (): ChatData => ({
  settings: { scenario: 'both', boundary: 'disabled', theme: 'Light' },
  draft: '',
  messages: [],
  sequence: 0,
  seed: { triggered: false, next: 0, dueAt: 0 },
  cooldownUntil: 0,
  acceptedIds: [],
  fakeIndex: 0,
});
export const freshChatRecord = (): ChatRecord => ({
  epoch: crypto.randomUUID(),
  lease: crypto.randomUUID(),
  version: 0,
  data: initialChat(),
});
export type ChatCommand =
  | { type: 'draft'; text: string; trigger: boolean }
  | { type: 'settings'; settings: ChatSettings }
  | { type: 'trigger' }
  | { type: 'seed'; index: number; delay: number }
  | { type: 'fake'; author: number }
  | { type: 'send'; id: string; text: string };
export type ChatResult = {
  record: ChatRecord;
  outcome: 'APPLIED' | 'DUPLICATE' | 'COOLDOWN' | 'EMPTY';
};
const fixtures = [
  'Cool! 🔥',
  'Собираемся у замка после сбора урожая ❄️',
  'Друзья, сегодня наша экспедиция отправляется по заснеженной долине к старой башне. Возьмите припасы, помогите новичкам и оставьте немного места для праздничных находок! 🏰 🥰 👨‍👩‍👧‍👦',
];
export function chatTransition(
  data: ChatData,
  command: ChatCommand,
  epoch: string,
  now: number,
): { data: ChatData; outcome: ChatResult['outcome'] } {
  const d = structuredClone(data);
  let outcome: ChatResult['outcome'] = 'APPLIED';
  const trigger = () => {
    if (!d.seed.triggered) d.seed = { triggered: true, next: 0, dueAt: now + 2000 };
  };
  const append = (id: string, authorId: string, text: string, type: ChatMessage['type']) => {
    if (d.messages.some((m) => m.id === id)) return;
    d.messages.push({
      id,
      authorId,
      text: plainText(text),
      type,
      timestamp: now,
      sequence: ++d.sequence,
    });
    d.messages = d.messages.slice(-6);
  };
  switch (command.type) {
    case 'draft':
      d.draft = cleanDraft(command.text);
      if (command.trigger && d.draft.length) trigger();
      break;
    case 'settings':
      d.settings = structuredClone(command.settings);
      break;
    case 'trigger':
      trigger();
      break;
    case 'seed':
      if (
        d.seed.triggered &&
        command.index === d.seed.next &&
        d.seed.next < 3 &&
        now >= d.seed.dueAt
      ) {
        const n = d.seed.next;
        append(
          `${epoch}:seed:${n}`,
          ['system', 'kraken', 'moon'][n],
          ['Событие началось! Приятной игры 🎉', 'Cool! 🔥', 'Привет всем!'][n],
          n === 0 ? 'system' : 'clan',
        );
        d.seed.next++;
        d.seed.dueAt = d.seed.next < 3 ? now + command.delay : 0;
      }
      break;
    case 'fake':
      append(
        crypto.randomUUID(),
        clans[command.author % clans.length].id,
        fixtures[d.fakeIndex++ % fixtures.length],
        'clan',
      );
      break;
    case 'send': {
      const text = cleanDraft(command.text);
      if (d.acceptedIds.includes(command.id)) outcome = 'DUPLICATE';
      else if (!text.trim()) outcome = 'EMPTY';
      else if (now < d.cooldownUntil) outcome = 'COOLDOWN';
      else {
        d.acceptedIds.push(command.id);
        append(command.id, 'user', text, 'user');
        d.draft = '';
        d.cooldownUntil = now + 2500;
      }
    }
  }
  return { data: d, outcome };
}
export interface ChatStore {
  acquire(): Promise<ChatRecord>;
  write(epoch: string, lease: string, command: ChatCommand): Promise<ChatResult | null>;
}
export class ChatRepository implements ChatStore {
  private async transaction(change: (r: ChatRecord) => ChatResult) {
    const db = await openModule04DB();
    return new Promise<ChatResult>((resolve, reject) => {
      const tx = db.transaction('events', 'readwrite'),
        store = tx.objectStore('events'),
        q = store.get(CHAT_KEY);
      let result: ChatResult;
      q.onsuccess = () => {
        try {
          const r: ChatRecord = q.result || freshChatRecord();
          if (
            !r.data ||
            !Array.isArray(r.data.messages) ||
            !Array.isArray(r.data.acceptedIds) ||
            !r.epoch ||
            !r.lease
          )
            throw Error('Invalid Module 04 chat storage; use confirmed Reset 04 Module');
          const d = r.data;
          if (
            typeof d.draft !== 'string' ||
            !d.settings ||
            !['both', 'back'].includes(d.settings.scenario) ||
            !['hidden', 'disabled'].includes(d.settings.boundary) ||
            !['Light', 'Dark', 'Premium'].includes(d.settings.theme) ||
            !d.seed ||
            typeof d.seed.triggered !== 'boolean' ||
            !Number.isInteger(d.seed.next) ||
            d.seed.next < 0 ||
            d.seed.next > 3 ||
            !Number.isFinite(d.seed.dueAt) ||
            !Number.isFinite(d.cooldownUntil) ||
            !Number.isSafeInteger(d.sequence) ||
            !Number.isInteger(d.fakeIndex) ||
            d.acceptedIds.some((id) => typeof id !== 'string') ||
            d.messages.some(
              (m) =>
                !m ||
                typeof m.id !== 'string' ||
                typeof m.text !== 'string' ||
                !['system', 'clan', 'user'].includes(m.type) ||
                !['system', 'user', ...clans.map((c) => c.id)].includes(m.authorId) ||
                !Number.isFinite(m.timestamp) ||
                !Number.isSafeInteger(m.sequence),
            )
          )
            throw Error('Invalid chat data; use confirmed Reset 04 Module');
          r.data.draft = cleanDraft(r.data.draft);
          r.data.messages = r.data.messages
            .slice(-6)
            .map((m) => ({ ...m, text: plainText(m.text) }));
          result = change(r);
          store.put(result.record, CHAT_KEY);
        } catch (e) {
          tx.abort();
          reject(e);
        }
      };
      tx.oncomplete = () => resolve(result!);
      tx.onabort = tx.onerror = () => reject(tx.error || Error('Chat transaction failed'));
    });
  }
  async acquire() {
    return (
      await this.transaction((r) => {
        r.lease = crypto.randomUUID();
        return { record: r, outcome: 'APPLIED' };
      })
    ).record;
  }
  async write(epoch: string, lease: string, command: ChatCommand) {
    let stale = false;
    const result = await this.transaction((r) => {
      if (epoch !== r.epoch || lease !== r.lease) {
        stale = true;
        return { record: r, outcome: 'DUPLICATE' };
      }
      const next = chatTransition(r.data, command, r.epoch, Date.now());
      r.data = next.data;
      r.version++;
      return { record: r, outcome: next.outcome };
    });
    return stale ? null : result;
  }
}
export class ChatModel {
  state = initialChat();
  draft = '';
  ready = false;
  saveStatus = 'LOADING';
  error = '';
  live = false;
  counters = { accepted: 0, duplicateBlocked: 0, draftClears: 0, cooldownStarts: 0 };
  onChange = () => {};
  onPopup = (_text: string) => {};
  private record: ChatRecord | null = null;
  private token = 0;
  private revision = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private claim: string | null = null;
  private retryCommand: ChatCommand | null = null;
  private seedTimer: ReturnType<typeof setTimeout> | undefined;
  private liveTimer: ReturnType<typeof setTimeout> | undefined;
  private cooldownTimer: ReturnType<typeof setTimeout> | undefined;
  private pending = 0;
  private paused = false;
  constructor(
    private store: ChatStore = new ChatRepository(),
    private random = Math.random,
  ) {}
  get version() {
    return this.record?.version || 0;
  }
  private publish(r: ChatRecord) {
    this.record = r;
    this.state = structuredClone(r.data);
    this.ready = true;
  }
  invalidate() {
    ++this.token;
    this.stopLive();
    clearTimeout(this.seedTimer);
    clearTimeout(this.cooldownTimer);
    this.queue = Promise.resolve();
    this.pending = 0;
    this.claim = null;
    this.record = null;
    this.ready = false;
    this.onChange();
  }
  async restart() {
    this.invalidate();
    const token = this.token;
    this.state = initialChat();
    this.draft = '';
    this.saveStatus = 'LOADING';
    this.error = '';
    this.onChange();
    try {
      const r = await this.store.acquire();
      if (token !== this.token) return;
      this.publish(r);
      this.draft = r.data.draft;
      this.saveStatus = 'SAVED';
      this.arm();
    } catch (e) {
      if (token !== this.token) return;
      this.error = String(e);
      this.saveStatus = 'SAVE_FAILED';
    }
    this.onChange();
  }
  adoptReset(r: ChatRecord) {
    this.publish(r);
    this.draft = '';
    this.revision++;
    this.counters = { accepted: 0, duplicateBlocked: 0, draftClears: 0, cooldownStarts: 0 };
    this.error = '';
    this.saveStatus = 'SAVED';
    this.retryCommand = null;
    this.onChange();
  }
  private command(command: ChatCommand) {
    const r = this.record,
      token = this.token;
    if (!this.ready || !r) return Promise.resolve<ChatResult | null>(null);
    this.pending++;
    this.saveStatus = 'SAVING';
    this.error = '';
    this.onChange();
    const task = this.queue.then(async () => {
      if (token !== this.token) return null;
      try {
        const result = await this.store.write(r.epoch, r.lease, command);
        if (token !== this.token) return null;
        if (!result) throw Error('Chat session changed; restart to reload durable state');
        this.publish(result.record);
        this.retryCommand = null;
        this.arm();
        return result;
      } catch (e) {
        if (token === this.token) {
          this.error = String(e);
          this.retryCommand = command;
        }
        return null;
      } finally {
        if (token === this.token) {
          this.pending--;
          this.saveStatus = this.error ? 'SAVE_FAILED' : this.pending ? 'SAVING' : 'SAVED';
          this.onChange();
        }
      }
    });
    this.queue = task;
    return task;
  }
  setDraft(text: string, world: boolean) {
    this.draft = cleanDraft(text);
    this.revision++;
    void this.command({ type: 'draft', text: this.draft, trigger: world });
  }
  settings(settings: ChatSettings) {
    void this.command({ type: 'settings', settings });
  }
  trigger() {
    return this.command({ type: 'trigger' });
  }
  fake() {
    return this.command({ type: 'fake', author: Math.floor(this.random() * clans.length) });
  }
  private arm() {
    clearTimeout(this.seedTimer);
    clearTimeout(this.cooldownTimer);
    if (!this.ready || this.paused) return;
    const token = this.token,
      seed = this.state.seed;
    if (seed.triggered && seed.next < 3)
      this.seedTimer = setTimeout(
        () => {
          if (token === this.token && !this.paused)
            void this.command({
              type: 'seed',
              index: seed.next,
              delay: 1000 + Math.floor(this.random() * 1001),
            });
        },
        Math.max(0, seed.dueAt - Date.now()),
      );
    if (this.state.cooldownUntil > Date.now())
      this.cooldownTimer = setTimeout(() => {
        if (token === this.token) this.onChange();
      }, this.state.cooldownUntil - Date.now());
  }
  startLive() {
    if (!this.ready || this.live) return;
    this.live = true;
    this.scheduleLive();
    this.onChange();
  }
  private scheduleLive() {
    const token = this.token;
    this.liveTimer = setTimeout(
      async () => {
        if (token !== this.token || !this.live) return;
        await this.fake();
        if (token === this.token && this.live) this.scheduleLive();
      },
      4000 + Math.floor(this.random() * 3001),
    );
  }
  stopLive() {
    this.live = false;
    clearTimeout(this.liveTimer);
    this.onChange();
  }
  pause(hidden: boolean) {
    this.paused = hidden;
    if (hidden) {
      this.stopLive();
      clearTimeout(this.seedTimer);
      clearTimeout(this.cooldownTimer);
    } else this.arm();
  }
  async send(id?: string) {
    if (this.claim || (id && this.state.acceptedIds.includes(id))) {
      this.counters.duplicateBlocked++;
      this.onChange();
      return false;
    }
    const text = cleanDraft(this.draft);
    if (!this.ready || !text.trim()) return false;
    if (Date.now() < this.state.cooldownUntil) {
      this.onPopup('Чуть-чуть подождём! 😊 Следующее сообщение можно отправить через пару секунд.');
      return false;
    }
    const transaction = id || crypto.randomUUID(),
      revision = this.revision,
      token = this.token;
    this.claim = transaction; // Synchronous claim precedes ANY render and queued persistence.
    const result = await this.command({ type: 'send', id: transaction, text });
    if (token !== this.token) return false;
    this.claim = null;
    if (result?.outcome === 'APPLIED') {
      this.counters.accepted++;
      this.counters.cooldownStarts++;
      if (revision === this.revision) {
        this.draft = '';
        this.revision++;
        this.counters.draftClears++;
      }
      this.onChange();
      return true;
    }
    if (result?.outcome === 'DUPLICATE') this.counters.duplicateBlocked++;
    if (result?.outcome === 'COOLDOWN')
      this.onPopup('Чуть-чуть подождём! 😊 Следующее сообщение можно отправить через пару секунд.');
    this.onChange();
    return false;
  }
  retry() {
    const c = this.retryCommand;
    return c?.type === 'send' ? this.send(c.id) : c ? this.command(c) : this.restart();
  }
}
