/**
 * Línea de señales: cómo se agrupan las señales de cada pulsación y cómo se
 * nombran (para saber qué manda cada botón del control).
 */
import {KeyNameResolver} from '../src/core/signals/KeyNameResolver';
import {SignalFactory} from '../src/core/signals/SignalFactory';
import {SignalGrouper} from '../src/core/signals/SignalGrouper';

const f = new SignalFactory(new KeyNameResolver());

describe('SignalGrouper: las señales de una misma pulsación van juntas', () => {
  it('sin tecla, solo estados del reproductor: buffering → ready → playing', () => {
    const g = new SignalGrouper();
    g.record(f.key(20), 0);
    expect(g.record(f.playbackState('buffering'), 5000)).toBe('buffering');
    g.record(f.playbackState('ready'), 5150);
    expect(g.record(f.playbackState('playing'), 5300)).toBe(
      'buffering → ready → playing',
    );
  });

  it('la consecuencia de una tecla se suma a ella', () => {
    const g = new SignalGrouper();
    g.record(f.key(85, 0, 'KEYCODE_MEDIA_PLAY_PAUSE'), 0);
    expect(g.record(f.playbackState('paused'), 90)).toBe(
      'MEDIA_PLAY_PAUSE(85) → paused',
    );
  });

  it('la misma tecla repetida se cuenta ×N; otra tecla empieza de nuevo', () => {
    const g = new SignalGrouper();
    expect(g.record(f.key(20), 0)).toBe('DPAD_DOWN(20)');
    expect(g.record(f.key(20), 400)).toBe('DPAD_DOWN(20) ×2');
    expect(g.record(f.key(20, 1), 450)).toBe('DPAD_DOWN(20) ×3'); // mantenida
    expect(g.record(f.key(19), 900)).toBe('DPAD_UP(19)');
  });

  it('un botón y otro rápido no se mezclan con lo que sigue después', () => {
    const g = new SignalGrouper();
    g.record(f.key(20), 0);
    expect(g.record(f.playbackState('buffering'), 1000)).toBe('buffering');
  });

  it('una cadena larga recorta el principio con …', () => {
    const g = new SignalGrouper();
    let text = '';
    for (let i = 0; i < 12; i++) {
      text = g.record(
        f.playbackState(i % 2 ? 'playing' : 'buffering'),
        i * 100,
      );
    }
    expect(text.startsWith('… → ')).toBe(true);
    expect(text.split(' → ')).toHaveLength(9);
  });

  it('si el micrófono abre el asistente, se ve que la app pierde el foco', () => {
    const g = new SignalGrouper();
    expect(g.record(f.app('blur'), 0)).toBe('app sin foco');
    expect(g.record(f.app('focus'), 10000)).toBe('app con foco');
    expect(g.record(f.app('background'), 20000)).toBe('app en segundo plano');
  });

  it('el clic del puntero (modo cursor) se ve como CLIC(mouse)', () => {
    const g = new SignalGrouper();
    expect(g.record(f.pointerClick(), 0)).toBe('CLIC(mouse)');
  });
});

describe('KeyNameResolver: nombre y código de cada tecla', () => {
  const names = new KeyNameResolver();

  it('prefiere el nombre que manda Android', () => {
    expect(names.label(231, 'KEYCODE_VOICE_ASSIST')).toBe('VOICE_ASSIST(231)');
    expect(names.label(178, 'KEYCODE_TV_INPUT')).toBe('TV_INPUT(178)');
  });

  it('sin nombre de Android usa su tabla', () => {
    expect(names.label(4)).toBe('BACK(4)');
    expect(names.label(26)).toBe('POWER(26)');
    expect(names.label(84)).toBe('SEARCH(84)');
    expect(names.label(67)).toBe('DEL(67)');
    expect(names.label(85)).toBe('MEDIA_PLAY_PAUSE(85)');
  });

  it('una tecla desconocida se muestra con su código', () => {
    expect(names.label(999, '999')).toBe('tecla 999');
    expect(names.label(999)).toBe('tecla 999');
  });
});
