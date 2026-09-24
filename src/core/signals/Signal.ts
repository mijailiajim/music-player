/**
 * Origen de una señal: una tecla física del control, o un evento del sistema
 * de medios (estado del reproductor, comando de la sesión de medios, volumen).
 */
export type SignalOrigin = 'key' | 'media';

/** Una señal recibida al apretar un botón del control. */
export interface Signal {
  /** Texto a mostrar, p. ej. "DPAD_DOWN(20)" o "buffering". */
  readonly label: string;
  readonly origin: SignalOrigin;
  /** Auto-repetición de una tecla mantenida: sigue siendo la misma pulsación. */
  readonly repeat?: boolean;
  /**
   * Dentro de una pulsación, una señal con el mismo `slot` reemplaza a la
   * anterior en vez de sumarse (p. ej. el nivel de volumen al mantener Vol +).
   */
  readonly slot?: string;
}
