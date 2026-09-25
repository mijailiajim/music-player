import {AudioPlayerPort} from './AudioPlayerPort';
import {SCRUB_SECONDS_PER_SECOND} from './constants';

/** Lo que el scrubber necesita del motor (ISP). */
export type ScrubbablePlayer = Pick<
  AudioPlayerPort,
  'pause' | 'play' | 'seekTo' | 'getProgress'
>;

/** Posición que se muestra mientras se adelanta/atrasa. */
export interface ScrubSnapshot {
  /** Segundo al que se llegó. */
  position: number;
  /** +1 adelanta, −1 atrasa. */
  direction: number;
  /** false una vez soltado, mientras el reproductor se pone al día. */
  holding: boolean;
}

/**
 * Mantener ◀ / ▶: pausa la canción y mueve la posición a velocidad fija (20 s
 * por segundo) sin tocar el reproductor; al soltar salta una sola vez a la
 * posición alcanzada y sigue sonando desde ahí. No pasa del principio ni del
 * último segundo de la canción. Es observable para que la pantalla muestre la
 * posición mientras se mueve.
 */
export class PlaybackScrubber {
  private snapshot: ScrubSnapshot | null = null;
  private duration = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private starting: Promise<void> | null = null;
  /** Invalida lo pendiente de un scrub anterior (p. ej. el borrado diferido). */
  private generation = 0;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly player: ScrubbablePlayer,
    private readonly secondsPerSecond = SCRUB_SECONDS_PER_SECOND,
    private readonly tickMs = 250,
    /** Tras soltar, se sigue mostrando la posición hasta que la pantalla la lee del reproductor. */
    private readonly settleMs = 700,
  ) {}

  /** Empieza a mover la posición: `direction` > 0 adelanta, < 0 atrasa. */
  start(direction: number): Promise<void> {
    this.stopTimer();
    const generation = ++this.generation;
    this.starting = (async () => {
      try {
        const {position, duration} = await this.player.getProgress();
        if (duration <= 0 || generation !== this.generation) {
          return; // nada cargado (o ya se soltó y empezó otro)
        }
        await this.player.pause();
        this.duration = duration;
        this.set({
          position: this.clamp(position),
          direction: Math.sign(direction),
          holding: true,
        });
        this.timer = setInterval(() => this.tick(), this.tickMs);
      } catch {}
    })();
    return this.starting;
  }

  /** Al soltar: salta a la posición alcanzada y sigue la reproducción. */
  async finish(): Promise<void> {
    await this.starting;
    this.starting = null;
    this.stopTimer();
    const reached = this.snapshot;
    if (!reached?.holding) {
      return;
    }
    const generation = this.generation;
    this.set({...reached, holding: false});
    try {
      await this.player.seekTo(reached.position);
      await this.player.play();
    } catch {}
    setTimeout(() => {
      if (generation === this.generation) {
        this.set(null);
      }
    }, this.settleMs);
  }

  /** Corta sin tocar la reproducción (p. ej. al cerrar la pantalla). */
  cancel(): void {
    this.generation++;
    this.stopTimer();
    this.starting = null;
    this.set(null);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): ScrubSnapshot | null => this.snapshot;

  private tick(): void {
    const current = this.snapshot;
    if (!current?.holding) {
      return;
    }
    const step = (this.secondsPerSecond * this.tickMs) / 1000;
    const position = this.clamp(current.position + current.direction * step);
    if (position !== current.position) {
      this.set({...current, position});
    }
  }

  /** Entre el principio y el último segundo (no se pasa al tema siguiente). */
  private clamp(position: number): number {
    return Math.max(0, Math.min(Math.max(0, this.duration - 1), position));
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private set(snapshot: ScrubSnapshot | null): void {
    this.snapshot = snapshot;
    this.listeners.forEach(listener => listener());
  }
}
