/** Cómo terminó una pulsación. */
export type PressResult = 'tap' | 'hold' | 'none';

/**
 * Distingue un toque de mantener apretado: si pasa `thresholdMs` sin soltar,
 * llama a `onHold`. Al soltar dice si fue un toque o se mantuvo.
 */
export class HoldDetector {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pressed = false;
  private held = false;

  constructor(private readonly thresholdMs: number) {}

  press(onHold: () => void): void {
    this.reset();
    this.pressed = true;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.held = true;
      onHold();
    }, this.thresholdMs);
  }

  /** 'none' si no había una pulsación en curso. */
  release(): PressResult {
    const result = this.held ? 'hold' : this.pressed ? 'tap' : 'none';
    this.reset();
    return result;
  }

  reset(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pressed = false;
    this.held = false;
  }
}
