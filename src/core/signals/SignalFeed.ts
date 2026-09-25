import {Signal} from './Signal';
import {SignalGrouper} from './SignalGrouper';

export interface SignalSnapshot {
  /** Señales de la última pulsación, p. ej. "buffering → ready → playing". */
  readonly text: string;
  /** Momento (ms) en que llegó la última. */
  readonly at: number;
}

/**
 * Fuente observable de la línea de señales: agrupa lo que llega por pulsación
 * (con `SignalGrouper`) y avisa a quien la escuche. Así, cada señal redibuja
 * solo la línea y no toda la pantalla. Métodos ya enlazados: se pueden pasar
 * sueltos a listeners y a `useSyncExternalStore`.
 */
export class SignalFeed {
  private snapshot: SignalSnapshot | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly grouper: SignalGrouper = new SignalGrouper(),
    private readonly now: () => number = Date.now,
  ) {}

  record = (signal: Signal): void => {
    const at = this.now();
    this.snapshot = {text: this.grouper.record(signal, at), at};
    this.listeners.forEach(listener => listener());
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): SignalSnapshot | null => this.snapshot;
}
