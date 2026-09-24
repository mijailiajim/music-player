import {RemoteActions} from './RemoteActions';

/**
 * Patrón Command: cada tecla del control se traduce a un comando que sabe qué
 * operación pedirle a `RemoteActions`. Aísla "qué hace cada botón" en clases
 * pequeñas y bien definidas.
 */
export interface RemoteCommand {
  execute(actions: RemoteActions): void;
}
