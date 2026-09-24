/**
 * Responsabilidad única: decidir qué carpetas del sistema se ignoran al
 * escanear (no contienen música del usuario).
 */
const SKIPPED_FOLDERS = new Set([
  'android',
  'lost.dir',
  'system volume information',
  '$recycle.bin',
  'recycler',
  '.trashes',
  '.spotlight-v100',
]);

export class SystemFolderFilter {
  isSystem(name: string): boolean {
    return SKIPPED_FOLDERS.has(name.toLowerCase());
  }
}
