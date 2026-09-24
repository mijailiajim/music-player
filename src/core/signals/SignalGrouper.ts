import {Signal, SignalOrigin} from './Signal';

/** Tiempos (ms) que deciden si una señal pertenece a la misma pulsación. */
export interface SignalTiming {
  /** Dos teclas distintas casi a la vez: las manda el mismo botón. */
  simultaneousMs: number;
  /** Evento de medios tras una tecla: es su consecuencia (Pausa → paused). */
  keyFollowUpMs: number;
  /** Eventos de medios encadenados (buffering → ready → playing). */
  chainMs: number;
  /** La misma tecla sola otra vez: se cuenta "×N" en vez de empezar de nuevo. */
  repeatWindowMs: number;
}

export const DEFAULT_SIGNAL_TIMING: SignalTiming = {
  simultaneousMs: 120,
  keyFollowUpMs: 700,
  chainMs: 1500,
  repeatWindowMs: 2000,
};

interface Entry {
  label: string;
  count: number;
  slot?: string;
}

/**
 * Agrupa las señales en "pulsaciones" y arma el texto de la pulsación en curso:
 * sus señales en orden de llegada, unidas con " → ". Un botón puede mandar
 * varias (el OK redondo manda `buffering → ready → playing`).
 *
 *  - Una tecla empieza una pulsación nueva, salvo que llegue casi a la vez que
 *    la señal anterior (el mismo botón manda dos) o sea auto-repetición.
 *  - Un evento de medios se suma a la pulsación en curso si llega enseguida
 *    (es su consecuencia); si no, empieza una nueva: hay botones que no mandan
 *    tecla y solo cambian el estado del reproductor.
 *  - Las repeticiones de una misma señal se cuentan con "×N".
 */
export class SignalGrouper {
  private entries: Entry[] = [];
  private truncated = false;
  private lastAt = Number.NEGATIVE_INFINITY;
  private lastOrigin: SignalOrigin | null = null;

  constructor(
    private readonly timing: SignalTiming = DEFAULT_SIGNAL_TIMING,
    private readonly maxEntries = 8,
  ) {}

  /** Registra una señal recibida en `at` (ms) y devuelve el texto de su pulsación. */
  record(signal: Signal, at: number): string {
    if (!this.continuesPress(signal, at - this.lastAt)) {
      this.entries = [];
      this.truncated = false;
    }
    this.add(signal);
    this.lastAt = at;
    this.lastOrigin = signal.origin;
    return this.text();
  }

  private continuesPress(signal: Signal, gap: number): boolean {
    if (this.entries.length === 0) {
      return false;
    }
    if (signal.origin === 'key') {
      return (
        signal.repeat === true ||
        gap <= this.timing.simultaneousMs ||
        (gap <= this.timing.repeatWindowMs && this.isOnly(signal.label))
      );
    }
    const window =
      this.lastOrigin === 'key'
        ? this.timing.keyFollowUpMs
        : this.timing.chainMs;
    return gap <= window;
  }

  private isOnly(label: string): boolean {
    return this.entries.length === 1 && this.entries[0].label === label;
  }

  private add(signal: Signal): void {
    if (signal.slot != null) {
      const sameSlot = this.entries.find(e => e.slot === signal.slot);
      if (sameSlot) {
        sameSlot.label = signal.label;
        return;
      }
    }
    const last = this.entries[this.entries.length - 1];
    const repeated =
      (signal.repeat
        ? this.entries.find(e => e.label === signal.label)
        : undefined) ?? (last?.label === signal.label ? last : undefined);
    if (repeated) {
      repeated.count += 1;
      return;
    }
    this.entries.push({label: signal.label, count: 1, slot: signal.slot});
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
      this.truncated = true;
    }
  }

  private text(): string {
    const parts = this.entries.map(e =>
      e.count > 1 ? `${e.label} ×${e.count}` : e.label,
    );
    return (this.truncated ? ['…', ...parts] : parts).join(' → ');
  }
}
