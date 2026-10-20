export const cases: Record<string, string> = {
  'BTN-DOWN': 'Down: визуальное нажатие, без действия',
  'BTN-UP': 'Валидный Up: ровно одно действие',
  'BTN-RETURN': 'Уход и возврат: unpress / repress по политике кнопки',
  'BTN-OUT': 'Up вне границ: без действия',
  'BTN-DRAG': 'Strict Tap: выход отменяет tap; Hold/card: Slop; ReleaseButton: геометрия',
  'BTN-CANCEL': 'Cancel: без действия, визуальный сброс',
  'HOLD-OUT': 'Распознанный Hold сохраняется вне кнопки',
  'HOLD-END': 'Hold Up вне / Cancel завершает сессию',
  'HOLD-NOCLICK': 'После Hold нет дополнительного release click',
  'HOLD-PAUSE': 'Недоступность приостанавливает ticks',
  'HOLD-RESUME': 'Доступность возобновляет ticks без backlog',
  'HOLD-RATE': 'Повторы ограничены max rate',
  'GEST-45': 'Точный 45° принадлежит Carousel',
  'GEST-LOCK': 'Смена направления не меняет владельца',
  'GEST-X': 'Carousel меняет X, сохраняет Modules Y',
  'GEST-Y': 'Modules меняет Y, сохраняет Carousel X',
  'GEST-TAP': 'После прокрутки card tap отменён',
  'GEST-NOFLOW': 'Без overflow нет горизонтального смещения',
  'NAV-PAGE': 'Индикатор переключает выбранную страницу',
  'NAV-BOUND': 'Граница Back / Next защищена',
  'NAV-CLOSE': 'Close / Reopen сохраняет страницу',
  'RESIZE-STATE': 'Resize сохраняет selections / draft / scroll',
  'RESIZE-LIVE': 'Геометрия обновляется во время resize',
  'RESIZE-SETTLE': 'Settled: границы и размеры валидны',
  'RESIZE-HYST': 'H/V сохраняется внутри hysteresis band',
  BACKDROP: 'Применены наблюдаемые blur / dim',
};
export type Status = 'PASS' | 'FAIL' | 'NOT RUN' | 'INCONCLUSIVE' | 'EXPERIMENTAL';
export type Result = {
  id: string;
  status: Status;
  description: string;
  source: string;
  expected?: unknown;
  observed?: unknown;
  time?: string;
};
export class Diagnostics {
  results: Record<string, Result> = {};
  events: Record<string, unknown>[] = [];
  onChange = () => {};
  constructor(
    private environment: () => unknown,
    private parameters: () => unknown,
  ) {
    this.reset();
  }
  reset() {
    this.events = [];
    this.results = Object.fromEntries(
      Object.entries(cases).map(([id, description]) => [
        id,
        { id, description, status: 'NOT RUN', source: 'not performed' },
      ]),
    );
    this.onChange();
  }
  clearScope(ids: string[], belongs: (event: Record<string, unknown>) => boolean) {
    for (const id of ids)
      this.results[id] = { id, description: cases[id], status: 'NOT RUN', source: 'not performed' };
    this.events = this.events.filter((event) => !belongs(event));
    this.onChange();
  }
  log(type: string, details: Record<string, unknown> = {}) {
    this.events.push({ time: new Date().toISOString(), type, ...details });
    if (this.events.length > 150) this.events.shift();
    this.onChange();
  }
  check(
    id: string,
    condition: boolean,
    expected: unknown,
    observed: unknown,
    source = 'runtime observation',
  ) {
    // Preserve a failure until Reset so later success cannot hide a broken contract.
    if (this.results[id]?.status === 'FAIL' && condition) return;
    const status = condition ? 'PASS' : 'FAIL';
    this.results[id] = {
      id,
      description: cases[id],
      status,
      expected,
      observed,
      time: new Date().toISOString(),
      source,
    };
    this.onChange();
  }
  inconclusive(id: string, reason: string, source = 'manual limitation report') {
    if (this.results[id]?.status === 'PASS' || this.results[id]?.status === 'FAIL') return false;
    this.results[id] = {
      id,
      description: cases[id],
      status: 'INCONCLUSIVE',
      observed: reason,
      source,
      time: new Date().toISOString(),
    };
    this.log('inconclusive', { id, reason, source });
    return true;
  }
  report() {
    return {
      schema: 'dkw-lab-diagnostics/1',
      time: new Date().toISOString(),
      environment: this.environment(),
      parameters: this.parameters(),
      results: Object.values(this.results),
      events: this.events,
      experimental: {
        status: 'EXPERIMENTAL',
        note: 'All calibration and visual parameters remain provisional.',
      },
      physicalDeviceTests: 'NOT RUN unless explicitly recorded in a separate manual report',
    };
  }
}
export function download(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
