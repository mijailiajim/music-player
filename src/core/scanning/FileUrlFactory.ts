/**
 * Responsabilidad única: construir la URL `file://` de una ruta, con cada
 * segmento percent-encodeado (espacios, `#`, `?`, …) preservando las barras.
 */
export class FileUrlFactory {
  from(path: string): string {
    return 'file://' + path.split('/').map(encodeURIComponent).join('/');
  }
}
