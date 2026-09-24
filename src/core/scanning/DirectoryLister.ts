import {DirEntry} from '../model';

/**
 * Abstracción (DIP) para listar un directorio. La fuente concreta —el módulo
 * nativo del pendrive— se inyecta desde un adaptador, así el escáner no depende
 * de React Native y se puede testear con un listado simulado.
 */
export interface DirectoryLister {
  list(path: string): Promise<DirEntry[]>;
}
