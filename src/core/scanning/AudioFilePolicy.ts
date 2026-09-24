/**
 * Responsabilidad única: decidir qué archivos son audio reproducible y cómo se
 * obtiene el título a mostrar a partir del nombre de archivo.
 */
const AUDIO_EXTENSIONS = new Set([
  'mp3',
  'm4a',
  'm4b',
  'aac',
  'wav',
  'ogg',
  'oga',
  'opus',
  'flac',
  'amr',
  'mka',
]);

export class AudioFilePolicy {
  isAudio(name: string): boolean {
    const dot = name.lastIndexOf('.');
    if (dot <= 0) {
      return false;
    }
    return AUDIO_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
  }

  title(name: string): string {
    const dot = name.lastIndexOf('.');
    return (dot > 0 ? name.slice(0, dot) : name).trim();
  }
}
