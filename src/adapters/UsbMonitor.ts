import {DeviceEventEmitter} from 'react-native';

/**
 * Vigila la conexión del pendrive: escucha el broadcast nativo de montaje/
 * conexión (con un pequeño debounce, porque el volumen tarda en montarse tras
 * enchufarlo) y además sondea cada cierto tiempo como red de seguridad por si
 * algún broadcast no llega (varía según el fabricante).
 */
export class UsbMonitor {
  constructor(
    private readonly onRefresh: () => void,
    private readonly pollIntervalMs: number,
    private readonly debounceMs: number,
  ) {}

  /** Arranca la vigilancia y devuelve una función para detenerla. */
  start(): () => void {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (debounce) {
        clearTimeout(debounce);
      }
      debounce = setTimeout(() => {
        debounce = null;
        this.onRefresh();
      }, this.debounceMs);
    };

    const subscription = DeviceEventEmitter.addListener(
      'usbStorageChanged',
      scheduleRefresh,
    );
    const poll = setInterval(this.onRefresh, this.pollIntervalMs);

    return () => {
      subscription.remove();
      clearInterval(poll);
      if (debounce) {
        clearTimeout(debounce);
      }
    };
  }
}
