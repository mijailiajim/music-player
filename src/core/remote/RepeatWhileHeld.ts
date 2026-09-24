/**
 * Repite un paso mientras se mantiene un botón: lo ejecuta ya y después cada
 * `intervalMs`, hasta que se suelta o el paso avisa que no puede seguir.
 */
export class RepeatWhileHeld {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly intervalMs: number) {}

  /** `step` devuelve false cuando ya no hay adónde ir (y se frena). */
  start(step: () => boolean): void {
    this.stop();
    if (!step()) {
      return;
    }
    this.timer = setInterval(() => {
      if (!step()) {
        this.stop();
      }
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
