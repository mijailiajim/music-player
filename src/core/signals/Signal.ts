/**
 * Origen de una señal: un botón del control (tecla o clic del puntero), o un
 * evento del sistema (estado del reproductor, comando de la sesión de medios,
 * la app pierde o recupera el foco).
 */
export type SignalOrigin = 'key' | 'media';

/** Una señal recibida al apretar un botón del control. */
export interface Signal {
  /** Texto a mostrar, p. ej. "DPAD_DOWN(20)" o "buffering". */
  readonly label: string;
  readonly origin: SignalOrigin;
  /** Auto-repetición de una tecla mantenida: sigue siendo la misma pulsación. */
  readonly repeat?: boolean;
}
