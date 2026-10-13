export const largeShapes = ['None', 'Square', 'Triangle', 'Diamond', 'Hexagon', 'Octagon'] as const;
export const smallShapes = ['None', 'Circle', 'Square', 'Diamond'] as const;
export const numbers = ['None', '1', '2', '3', '4'] as const;
export type Selection = {
  large: (typeof largeShapes)[number];
  small: (typeof smallShapes)[number];
  number: (typeof numbers)[number];
};
export const emptySelection = (): Selection => ({ large: 'None', small: 'None', number: 'None' });
export const combination = (s: Selection) => `${s.large} → ${s.small} → ${s.number}`;
export type Draft = { selection: Selection; session: string; version: number; time: string };
export type Stored = { applied: Selection; draft: Draft | null; activeSession: string | null };
const initial = (): Stored => ({ applied: emptySelection(), draft: null, activeSession: null });
export interface Repository {
  read(): Promise<Stored>;
  begin(session: string): Promise<Stored>;
  save(session: string, version: number, selection: Selection): Promise<Draft | null>;
  finish(session: string, applied?: Selection): Promise<Stored>;
  invalidate(): Promise<Stored>;
  deleteDraft(): Promise<Stored>;
  clear(): Promise<Stored>;
}
export class DraftRepository implements Repository {
  private db: Promise<IDBDatabase> | null = null;
  private open() {
    return (this.db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('dkw-drafts-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('lab');
      request.onerror = () => {
        this.db = null;
        reject(request.error || Error('IndexedDB open failed'));
      };
      request.onblocked = () => {
        this.db = null;
        reject(Error('IndexedDB upgrade blocked by another tab'));
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          this.db = null;
        };
        resolve(db);
      };
    }).catch((error) => {
      this.db = null;
      throw error;
    }));
  }
  private async transaction<T>(edit: (value: Stored) => { value: Stored; result: T }): Promise<T> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('lab', 'readwrite');
      const store = tx.objectStore('lab'),
        read = store.get('state');
      let result: T;
      read.onsuccess = () => {
        try {
          const change = edit(read.result || initial());
          result = change.result;
          store.put(change.value, 'state');
        } catch (error) {
          tx.abort();
          reject(error);
        }
      };
      tx.oncomplete = () => resolve(result!); // Durable transaction completion, not request.onsuccess.
      tx.onabort = tx.onerror = () => reject(tx.error || Error('IndexedDB transaction failed'));
    });
  }
  read() {
    return this.transaction((value) => ({ value, result: value }));
  }
  begin(session: string) {
    return this.transaction((value) => {
      value.activeSession = session;
      return { value, result: value };
    });
  }
  save(session: string, version: number, selection: Selection) {
    return this.transaction((value) => {
      if (
        value.activeSession !== session ||
        (value.draft?.session === session && value.draft.version >= version)
      )
        return { value, result: null };
      const draft: Draft = {
        session,
        version,
        selection: { ...selection },
        time: new Date().toISOString(),
      };
      value.draft = draft;
      return { value, result: draft };
    });
  }
  finish(session: string, applied?: Selection) {
    return this.transaction((value) => {
      if (value.activeSession !== session) throw Error('Editing session superseded');
      if (applied) value.applied = { ...applied };
      value.draft = null;
      value.activeSession = null;
      return { value, result: value };
    });
  }
  invalidate() {
    return this.transaction((value) => {
      value.activeSession = null;
      return { value, result: value };
    });
  }
  deleteDraft() {
    return this.transaction((value) => {
      value.activeSession = null;
      value.draft = null;
      return { value, result: value };
    });
  }
  clear() {
    return this.transaction(() => {
      const value = initial();
      return { value, result: value };
    });
  }
}
export function variableLatency() {
  let previous = -1;
  return () => {
    let next = 1500 + Math.floor(Math.random() * 1001);
    if (next === previous) next = 1500 + ((next - 1500 + 1) % 1001);
    previous = next;
    return next;
  };
}
export type SaveState = 'IDLE' | 'SAVING' | 'DRAFT_SAVED' | 'SAVE_FAILED';
export class DraftEditor {
  current = emptySelection();
  applied = emptySelection();
  draft: Draft | null = null;
  editing = false;
  session = '';
  version = 0;
  state: SaveState = 'IDLE';
  outcome = '';
  recovery = false;
  error = '';
  latency = 0;
  savedVersion = 0;
  background = false;
  events: { type: string; time: string; detail: unknown }[] = [];
  onChange = () => {};
  latencyFor: (version: number) => number = variableLatency();
  failNext = false;
  private epoch = 0;
  private jobs = new Map<
    number,
    { timer: ReturnType<typeof setTimeout>; resolve: (value: boolean) => void }
  >();
  constructor(private repo: Repository) {}
  private emit(type: string, detail: unknown = {}) {
    this.events.push({ type, time: new Date().toISOString(), detail });
    if (this.events.length > 80) this.events.shift();
    this.onChange();
  }
  get editStatus() {
    return combination(this.current) === combination(this.applied)
      ? 'CLEAN'
      : this.draft && combination(this.draft.selection) === combination(this.current)
        ? 'DRAFT_SAVED'
        : 'DIRTY';
  }
  async initialize() {
    this.abandonVolatile();
    try {
      const value = await this.repo.invalidate();
      this.applied = { ...value.applied };
      this.current = { ...value.applied };
      this.draft = value.draft;
      this.recovery = !!value.draft;
      this.state = value.draft ? 'DRAFT_SAVED' : 'IDLE';
      this.savedVersion = value.draft?.version || 0;
      this.error = '';
      this.emit('rehydrated', { draftFound: this.recovery });
    } catch (e) {
      this.state = 'SAVE_FAILED';
      this.error = String(e);
      this.emit('storage-failed', this.error);
    }
  }
  async start(recover = false) {
    try {
      const session = crypto.randomUUID(),
        value = await this.repo.begin(session);
      this.abandonVolatile();
      this.session = session;
      this.editing = true;
      this.applied = { ...value.applied };
      this.current = { ...(recover && value.draft ? value.draft.selection : value.applied) };
      this.draft = value.draft;
      this.version = 0;
      this.savedVersion = 0;
      this.recovery = false;
      this.state = 'IDLE';
      this.error = '';
      this.outcome = '';
      this.emit(recover ? 'draft-recovered' : 'edit-opened');
    } catch (e) {
      this.state = 'SAVE_FAILED';
      this.error = String(e);
      this.emit('storage-failed', this.error);
    }
  }
  select(key: keyof Selection, value: string) {
    if (!this.editing) return;
    const options = key === 'large' ? largeShapes : key === 'small' ? smallShapes : numbers;
    if (!(options as readonly string[]).includes(value)) return;
    this.current = { ...this.current, [key]: value };
    this.emit('current-changed', { ...this.current });
    void this.save();
  }
  save(): Promise<boolean> {
    if (!this.editing) return Promise.resolve(false);
    const selection = { ...this.current },
      session = this.session,
      version = ++this.version,
      epoch = this.epoch;
    const latency = Math.max(1500, Math.min(2500, this.latencyFor(version))),
      fail = this.failNext;
    this.failNext = false;
    this.latency = latency;
    this.state = 'SAVING';
    this.error = '';
    this.emit('save-started', { session, version, latency, selection });
    return new Promise((resolve) => {
      const timer = setTimeout(async () => {
        this.jobs.delete(version);
        if (epoch !== this.epoch || session !== this.session) {
          resolve(false);
          return;
        }
        try {
          if (fail) throw Error('Injected local save failure');
          const saved = await this.repo.save(session, version, selection);
          if (epoch !== this.epoch || session !== this.session) {
            resolve(false);
            return;
          }
          if (saved && version > this.savedVersion) {
            this.draft = saved;
            this.savedVersion = version;
          }
          if (version === this.version) {
            if (!saved && this.savedVersion < version)
              throw Error('Save rejected: editing ownership changed');
            this.state = 'DRAFT_SAVED';
          }
          this.emit(saved ? 'save-durable' : 'stale-save-rejected', { version });
          resolve(!!saved);
        } catch (e) {
          if (epoch === this.epoch && session === this.session && version === this.version) {
            this.error = String(e);
            this.state = 'SAVE_FAILED';
            this.emit('save-failed', { version, error: this.error });
          }
          resolve(false);
        }
      }, latency);
      this.jobs.set(version, { timer, resolve });
    });
  }
  async apply() {
    if (!this.editing || this.current.large === 'None') return false;
    const current = { ...this.current },
      session = this.session;
    try {
      const value = await this.repo.finish(session, current);
      this.abandonVolatile();
      this.applied = { ...value.applied };
      this.current = { ...value.applied };
      this.draft = null;
      this.state = 'IDLE';
      this.outcome = 'APPLIED';
      this.emit('applied', current);
      return true;
    } catch (e) {
      this.error = String(e);
      this.state = 'SAVE_FAILED';
      this.emit('apply-failed', this.error);
      return false;
    }
  }
  async discard() {
    if (!this.editing) return;
    try {
      const value = await this.repo.finish(this.session);
      this.abandonVolatile();
      this.applied = { ...value.applied };
      this.current = { ...value.applied };
      this.draft = null;
      this.state = 'IDLE';
      this.outcome = 'CANCELLED';
      this.emit('discarded');
    } catch (e) {
      this.error = String(e);
      this.state = 'SAVE_FAILED';
      this.emit('discard-failed', this.error);
    }
  }
  async later() {
    const session = this.session,
      epoch = this.epoch;
    const ok = await this.save();
    if (!ok || epoch !== this.epoch || session !== this.session) return false;
    // Newest Current must equal the confirmed saved version; edits are blocked by modal meanwhile.
    if (
      this.savedVersion !== this.version ||
      combination(this.draft!.selection) !== combination(this.current)
    )
      return false;
    try {
      await this.repo.invalidate();
    } catch (e) {
      this.error = String(e);
      this.state = 'SAVE_FAILED';
      this.emit('save-for-later-failed', this.error);
      return false;
    }
    this.abandonVolatile();
    this.state = 'DRAFT_SAVED';
    this.outcome = 'SAVED_FOR_LATER';
    this.emit('saved-for-later');
    return true;
  }
  continueEditing() {
    this.outcome = 'CONTINUED_EDITING';
    this.emit('continued-editing');
  }
  notNow() {
    this.recovery = false;
    this.emit('recovery-dismissed');
  }
  async deleteDraft() {
    try {
      const v = await this.repo.deleteDraft();
      this.draft = v.draft;
      this.recovery = false;
      this.state = 'IDLE';
      this.emit('draft-deleted');
    } catch (e) {
      this.error = String(e);
      this.state = 'SAVE_FAILED';
      this.emit('delete-failed', this.error);
    }
  }
  private abandonVolatile() {
    ++this.epoch;
    for (const job of this.jobs.values()) {
      clearTimeout(job.timer);
      job.resolve(false);
    }
    this.jobs.clear();
    this.session = '';
    this.version = 0;
    this.savedVersion = 0;
    this.editing = false;
    this.background = false;
  }
  async crash() {
    this.current = emptySelection();
    this.applied = emptySelection();
    this.draft = null;
    this.state = 'IDLE';
    this.outcome = '';
    this.error = '';
    this.recovery = false;
    this.events = [];
    await this.initialize();
    this.emit('simulated-crash-rehydrated');
  }
  async cleanup() {
    this.abandonVolatile();
    try {
      await this.repo.clear();
      await this.initialize();
      this.emit('explicit-lab-storage-cleanup');
    } catch (e) {
      this.error = String(e);
      this.state = 'SAVE_FAILED';
      this.emit('cleanup-failed', this.error);
    }
  }
  backgroundReturn() {
    this.background = true;
    this.emit('simulated-background');
    this.background = false;
    this.emit('simulated-foreground-live-session', { editing: this.editing, recovery: false });
  }
}
