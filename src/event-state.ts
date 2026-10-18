export const EVENT_OCCURRENCE = 'winter-lab-2026-01';
export type EventState = {
  eventInstanceId: string;
  eventEntered: boolean;
  currentScreen: 'world' | 'event';
  guideOpen: boolean;
  lastPage: number;
  acknowledgedPages: number[];
  guideCompleted: boolean;
  guideMode: 'reading' | 'completed' | 'reference';
};
export type EventRecord = { epoch: string; lease: string; version: number; state: EventState };
export type EventCommand =
  { type: 'enter' | 'leave' | 'open' | 'close' } | { type: 'navigate' | 'ack'; page: number };
export const initialEvent = (id = EVENT_OCCURRENCE): EventState => ({
  eventInstanceId: id,
  eventEntered: false,
  currentScreen: 'world',
  guideOpen: false,
  lastPage: 1,
  acknowledgedPages: [],
  guideCompleted: false,
  guideMode: 'reading',
});
export const pageAccessible = (s: EventState, page: number) =>
  Number.isInteger(page) &&
  page >= 1 &&
  page <= 5 &&
  (s.guideCompleted || page <= s.acknowledgedPages.length + 1);
export function eventTransition(state: EventState, command: EventCommand): EventState {
  const s = structuredClone(state);
  switch (command.type) {
    case 'enter':
      s.currentScreen = 'event';
      s.guideOpen = !s.eventEntered;
      if (!s.eventEntered) s.lastPage = 1;
      s.eventEntered = true;
      break;
    case 'leave':
      s.currentScreen = 'world';
      s.guideOpen = false;
      if (s.guideCompleted) s.guideMode = 'reference';
      break;
    case 'open':
      if (s.currentScreen === 'event') s.guideOpen = true;
      break;
    case 'close':
      s.guideOpen = false;
      if (s.guideCompleted) s.guideMode = 'reference';
      break;
    case 'navigate':
      if (s.guideOpen && pageAccessible(s, command.page)) s.lastPage = command.page;
      break;
    case 'ack':
      if (
        !s.guideOpen ||
        s.guideCompleted ||
        command.page !== s.lastPage ||
        command.page !== s.acknowledgedPages.length + 1
      )
        break;
      s.acknowledgedPages.push(command.page);
      if (command.page === 5) {
        s.guideCompleted = true;
        s.guideMode = 'completed';
      } else s.lastPage = command.page + 1;
  }
  return s;
}
export interface EventStore {
  acquire(): Promise<EventRecord>;
  write(epoch: string, lease: string, command: EventCommand): Promise<EventRecord | null>;
  reset(): Promise<EventRecord>;
}
export class EventRepository implements EventStore {
  private database: Promise<IDBDatabase> | null = null;
  constructor(private occurrence = EVENT_OCCURRENCE) {}
  private open() {
    return (this.database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const q = indexedDB.open('dkw-event-guide-v1', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('events');
      q.onerror = () => reject(q.error || Error('Event storage unavailable'));
      q.onblocked = () => reject(Error('Event storage upgrade blocked'));
      q.onsuccess = () => {
        const db = q.result;
        db.onversionchange = () => {
          db.close();
          this.database = null;
        };
        resolve(db);
      };
    }).catch((e) => {
      this.database = null;
      throw e;
    }));
  }
  private async transaction<T>(
    change: (record: EventRecord) => { record: EventRecord; result: T },
  ) {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction('events', 'readwrite'),
        store = tx.objectStore('events'),
        q = store.get(this.occurrence);
      let result: T;
      q.onsuccess = () => {
        try {
          const old: EventRecord = q.result || {
            epoch: crypto.randomUUID(),
            lease: '',
            version: 0,
            state: initialEvent(this.occurrence),
          };
          this.validate(old);
          const value = change(old);
          result = value.result;
          store.put(value.record, this.occurrence);
        } catch (e) {
          tx.abort();
          reject(e);
        }
      };
      tx.oncomplete = () => resolve(result!);
      tx.onerror = tx.onabort = () => reject(tx.error || Error('Event storage transaction failed'));
    });
  }
  private validate(r: EventRecord) {
    const s = r.state;
    if (
      !s ||
      s.eventInstanceId !== this.occurrence ||
      !Number.isInteger(r.version) ||
      typeof r.epoch !== 'string' ||
      typeof r.lease !== 'string' ||
      !['world', 'event'].includes(s.currentScreen) ||
      !['reading', 'completed', 'reference'].includes(s.guideMode) ||
      !Array.isArray(s.acknowledgedPages) ||
      s.acknowledgedPages.length > 5 ||
      s.acknowledgedPages.some((p, i) => p !== i + 1) ||
      !Number.isInteger(s.lastPage) ||
      s.lastPage < 1 ||
      s.lastPage > 5 ||
      !['eventEntered', 'guideOpen', 'guideCompleted'].every(
        (k) => typeof s[k as keyof EventState] === 'boolean',
      ) ||
      s.guideCompleted !== (s.acknowledgedPages.length === 5) ||
      !pageAccessible(s, s.lastPage)
    )
      throw Error('Invalid persisted event state; use explicit Reset Event State to recover');
  }
  acquire() {
    return this.transaction((r) => {
      r.lease = crypto.randomUUID();
      return { record: r, result: r };
    });
  }
  write(epoch: string, lease: string, command: EventCommand) {
    return this.transaction<EventRecord | null>((r) => {
      if (r.epoch !== epoch || r.lease !== lease) return { record: r, result: null };
      r.state = eventTransition(r.state, command);
      r.version++;
      return { record: r, result: r };
    });
  }
  reset() {
    // Explicit reset is allowed even if stored data is malformed: replace without decoding it.
    return this.open().then(
      (db) =>
        new Promise<EventRecord>((resolve, reject) => {
          const tx = db.transaction('events', 'readwrite'),
            store = tx.objectStore('events'),
            q = store.get(this.occurrence);
          let record: EventRecord;
          q.onsuccess = () => {
            record = {
              epoch: crypto.randomUUID(),
              lease: crypto.randomUUID(),
              version: (Number.isSafeInteger(q.result?.version) ? q.result.version : 0) + 1,
              state: initialEvent(this.occurrence),
            };
            store.put(record, this.occurrence);
          };
          tx.oncomplete = () => resolve(record);
          tx.onerror = tx.onabort = () => reject(tx.error || Error('Event reset failed'));
        }),
    );
  }
}
export class EventModel {
  state = initialEvent();
  version = 0;
  saveStatus: 'LOADING' | 'SAVING' | 'SAVED' | 'SAVE_FAILED' = 'LOADING';
  error = '';
  ready = false;
  onChange = () => {};
  private record: EventRecord | null = null;
  private token = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private pending = 0;
  private retryCommand: EventCommand | null = null;
  private retryReset = false;
  constructor(private store: EventStore = new EventRepository()) {}
  private publish(r: EventRecord) {
    this.record = r;
    this.state = structuredClone(r.state);
    this.version = r.version;
    this.ready = true;
  }
  async restart() {
    this.retryReset = false;
    const token = ++this.token;
    this.record = null;
    this.state = initialEvent();
    this.version = 0;
    this.ready = false;
    this.pending = 0;
    this.queue = Promise.resolve();
    this.retryCommand = null;
    this.saveStatus = 'LOADING';
    this.error = '';
    this.onChange();
    try {
      const r = await this.store.acquire();
      if (token !== this.token) return;
      this.publish(r);
      this.saveStatus = 'SAVED';
    } catch (e) {
      if (token !== this.token) return;
      this.saveStatus = 'SAVE_FAILED';
      this.error = String(e);
    }
    this.onChange();
  }
  command(command: EventCommand): Promise<boolean> {
    if (!this.ready || !this.record) return Promise.resolve(false);
    const token = this.token,
      { epoch, lease } = this.record;
    this.pending++;
    this.saveStatus = 'SAVING';
    this.error = '';
    this.onChange();
    const task = this.queue.then(async () => {
      if (token !== this.token) return false;
      try {
        const r = await this.store.write(epoch, lease, command);
        if (token !== this.token) return false;
        if (!r)
          throw Error('Event write rejected: state was reset or another session took ownership');
        this.publish(r);
        this.retryCommand = null;
        return true;
      } catch (e) {
        if (token === this.token) {
          this.error = String(e);
          this.retryCommand = command;
        }
        return false;
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
  async reset() {
    this.retryReset = true;
    const token = ++this.token;
    this.ready = false;
    this.record = null;
    this.pending = 0;
    this.queue = Promise.resolve();
    this.saveStatus = 'SAVING';
    this.error = '';
    this.retryCommand = null;
    this.onChange();
    try {
      const r = await this.store.reset();
      if (token !== this.token) return;
      this.publish(r);
      this.saveStatus = 'SAVED';
      this.retryReset = false;
    } catch (e) {
      if (token !== this.token) return;
      this.saveStatus = 'SAVE_FAILED';
      this.error = String(e);
    }
    this.onChange();
  }
  retry() {
    if (this.retryReset) return this.reset();
    if (this.retryCommand) return this.command(this.retryCommand);
    return this.restart();
  }
}
