import {KeyCodes} from '../../keymap';

/**
 * Teclas que la app no usa pero que conviene reconocer al mostrarlas (Back,
 * Menú, volumen…). Nombres de android.view.KeyEvent sin el prefijo KEYCODE_.
 */
const OTHER_KEYS: Record<string, number> = {
  HOME: 3,
  BACK: 4,
  VOLUME_UP: 24,
  VOLUME_DOWN: 25,
  POWER: 26,
  MENU: 82,
  SEARCH: 84,
  ESCAPE: 111,
  VOLUME_MUTE: 164,
  INFO: 165,
  GUIDE: 172,
  SETTINGS: 176,
};

/**
 * Responsabilidad única: el nombre visible de una tecla, p. ej.
 * "DPAD_DOWN(20)". Prefiere el nombre que manda Android
 * (`KeyEvent.keyCodeToString`, que conoce todas las teclas) y si no lo hay usa
 * la tabla propia; una tecla desconocida se muestra con su código.
 */
export class KeyNameResolver {
  private readonly names = new Map<number, string>(
    [...Object.entries(KeyCodes), ...Object.entries(OTHER_KEYS)].map(
      ([name, code]) => [code, name] as [number, string],
    ),
  );

  label(keyCode: number, nativeName?: string): string {
    const name = this.fromNative(nativeName) ?? this.names.get(keyCode);
    return name != null ? `${name}(${keyCode})` : `tecla ${keyCode}`;
  }

  private fromNative(nativeName?: string): string | undefined {
    const name = nativeName?.replace(/^KEYCODE_/, '');
    // Para un código que no conoce, Android devuelve solo el número.
    return name && !/^\d+$/.test(name) ? name : undefined;
  }
}
