/**
 * Tests e2e del servicio de reproducción (la sesión de medios / MediaSession).
 *
 * Documentan los MANEJADORES que registra el servicio (RemotePlay, RemotePause,
 * RemoteStop, RemoteNext, RemotePrevious, RemoteSeek, PlaybackError). El servicio
 * corre en el runtime de react-native-track-player (registrado en index.js). Acá
 * se registra el servicio, se capturan los manejadores y se invocan como lo haría
 * la sesión de medios.
 *
 * Sobre el botón OK redondo del control del usuario: su efecto observado es
 * "reproducir la pista anterior", y coincide con el manejador RemotePrevious de
 * abajo. OJO: en el dispositivo real ese botón NO se ve como un evento remoto,
 * solo como 3 señales de estado (buffering→ready→playing) — track-player lo
 * resuelve de forma nativa. Por eso el comportamiento observable del botón OK se
 * caracteriza con esas 3 señales en `App.e2e.test.tsx`; acá solo se fija qué hace
 * el manejador RemotePrevious cuando se dispara.
 */

jest.mock('react-native-track-player', () => {
  const handlers: Record<string, (event?: any) => unknown> = {};
  const p = {
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    skipToNext: jest.fn().mockResolvedValue(undefined),
    skipToPrevious: jest.fn().mockResolvedValue(undefined),
    seekTo: jest.fn().mockResolvedValue(undefined),
    getProgress: jest.fn().mockResolvedValue({position: 30, duration: 200}),
    getPlaybackState: jest.fn().mockResolvedValue({state: 'paused'}),
    addEventListener: jest.fn((event: string, cb: (e?: any) => unknown) => {
      handlers[event] = cb;
    }),
  };
  return {
    __esModule: true,
    default: p,
    // Los valores son los que usa la app internamente; alcanzan para el test.
    Event: {
      RemotePlay: 'remote-play',
      RemotePause: 'remote-pause',
      RemoteStop: 'remote-stop',
      RemoteNext: 'remote-next',
      RemotePrevious: 'remote-previous',
      RemoteSeek: 'remote-seek',
      RemoteJumpForward: 'remote-jump-forward',
      RemoteJumpBackward: 'remote-jump-backward',
      RemoteDuck: 'remote-duck',
      PlaybackState: 'playback-state',
      PlaybackError: 'playback-error',
    },
    State: {
      Playing: 'playing',
      Paused: 'paused',
      Buffering: 'buffering',
      Loading: 'loading',
    },
    // player.ts importa estos en el tope; no se usan en estas rutas, pero se
    // exponen para que el import no rompa.
    Capability: {
      Play: 0, Pause: 1, SkipToNext: 2, SkipToPrevious: 3, SeekTo: 4,
      JumpForward: 5, JumpBackward: 6, Stop: 7,
    },
    RepeatMode: {Off: 0, Track: 1, Queue: 2},
    AppKilledPlaybackBehavior: {StopPlaybackAndRemoveNotification: 'stop'},
    __handlers: handlers,
  };
});

import playbackService from '../src/service';

const tp = jest.requireMock('react-native-track-player');
const mockTP = tp.default as {[k: string]: jest.Mock};
const handlers = tp.__handlers as Record<string, (event?: any) => unknown>;

beforeEach(async () => {
  jest.clearAllMocks();
  for (const key of Object.keys(handlers)) {
    delete handlers[key];
  }
  // Registra los manejadores de la sesión de medios.
  await playbackService();
});

describe('sesión de medios (MediaSession) — comportamiento actual', () => {
  it('RemotePrevious reproduce la PISTA ANTERIOR (coincide con el efecto del botón OK), no la seleccionada', async () => {
    expect(typeof handlers['remote-previous']).toBe('function');
    await handlers['remote-previous']();
    expect(mockTP.skipToPrevious).toHaveBeenCalledTimes(1);
    expect(mockTP.play).toHaveBeenCalled(); // reanuda tras retroceder
    // No reproduce "lo seleccionado": no usa skip() por índice.
    expect((mockTP as any).skip).toBeUndefined();
  });

  it('RemotePlay reanuda y RemotePause/RemoteStop pausan', async () => {
    await handlers['remote-play']();
    expect(mockTP.play).toHaveBeenCalledTimes(1);

    await handlers['remote-pause']();
    await handlers['remote-stop']();
    expect(mockTP.pause).toHaveBeenCalledTimes(2);
  });

  it('RemoteNext salta a la siguiente pista', async () => {
    await handlers['remote-next']();
    expect(mockTP.skipToNext).toHaveBeenCalledTimes(1);
    expect(mockTP.play).toHaveBeenCalled();
  });

  it('RemoteSeek salta a la posición pedida', async () => {
    await handlers['remote-seek']({position: 42});
    expect(mockTP.seekTo).toHaveBeenCalledWith(42);
  });

  it('un archivo ilegible (PlaybackError) salta solo a la siguiente pista', async () => {
    await handlers['playback-error']();
    expect(mockTP.skipToNext).toHaveBeenCalledTimes(1);
    expect(mockTP.play).toHaveBeenCalled();
  });
});
