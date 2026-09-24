import {RemoteActions} from './RemoteActions';

/**
 * Patrón Command: cada tecla del control se traduce a un comando que sabe qué
 * operación pedirle a `RemoteActions`. Aísla "qué hace cada botón" en clases
 * pequeñas y bien definidas.
 */
export interface RemoteCommand {
  /** Al apretar el botón (las repeticiones automáticas no llegan acá). */
  execute(actions: RemoteActions): void;
  /** Al soltarlo: solo los botones que hacen algo mientras se mantienen. */
  release?(actions: RemoteActions): void;
  /** Corta lo que esté en curso (p. ej. al cerrar la pantalla). */
  cancel?(): void;
}
