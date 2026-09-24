/**
 * Tests e2e / de integración: renderizan el App REAL con los módulos nativos
 * simulados y verifican el COMPORTAMIENTO ACTUAL (tal cual es hoy) del control
 * remoto y del autoplay. Son tests de "caracterización": fijan lo que la app
 * hace ahora mismo, incluyendo detalles que el usuario reportó desde el
 * dispositivo real.
 *
 * Nota sobre el botón OK REDONDO y Re Pág/Av Pág: están ANULADOS. El OK manda
 * una tecla de confirmación (DPAD_CENTER/ENTER…) que Android convertía en un
 * clic sobre el botón enfocado de la pantalla (⏮) antes de que la app la viera:
 * por eso sonaba la pista anterior y solo se veían las señales `buffering →
 * ready → playing`. Ahora MainActivity captura esas teclas antes que la
 * interfaz (prevent default) y las reenvía; la app las manda a su clase
 * (OkButtonCommand, PageUpCommand, PageDownCommand), cuya función está vacía:
 * no hacen nada. Dónde quedó el cursor se comprueba en la lista (FolderList).
 */
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {DeviceEventEmitter, Platform, Text} from 'react-native';
import SignalBar from '../src/components/SignalBar';
import {
  OkButtonCommand,
  PageDownCommand,
  PageUpCommand,
} from '../src/core/remote/commands';
import {KeyCodes} from '../src/keymap';

// La app trata a iOS como "no soportado"; para el test se comporta como Android.
(Platform as {OS: string}).OS = 'android';
(Platform as {Version: number}).Version = 30;

// Pendrive simulado (mutable: cada bloque define su estructura).
type Entry = {name: string; path: string; isDirectory: boolean};
let mockFs: Record<string, Entry[]> = {};

// Pendrive REAL del usuario: 3 carpetas, solo "Musica" con 36 canciones.
function fsUnaCarpetaConMusica(): Record<string, Entry[]> {
  const canciones: Entry[] = Array.from({length: 36}, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return {
      name: `${n} Cancion.mp3`,
      path: `/usb/Musica/${n} Cancion.mp3`,
      isDirectory: false,
    };
  });
  return {
    '/usb': [
      {name: 'Fotos', path: '/usb/Fotos', isDirectory: true},
      {name: 'Musica', path: '/usb/Musica', isDirectory: true},
      {name: 'Videos', path: '/usb/Videos', isDirectory: true},
    ],
    '/usb/Fotos': [
      {name: 'foto.jpg', path: '/usb/Fotos/foto.jpg', isDirectory: false},
    ],
    '/usb/Musica': canciones,
    '/usb/Videos': [],
  };
}

// Pendrive con VARIAS carpetas con música (para navegar entre carpetas).
function fsVariasCarpetas(): Record<string, Entry[]> {
  const mk = (dir: string, names: string[]): Entry[] =>
    names.map(n => ({name: n, path: `${dir}/${n}`, isDirectory: false}));
  return {
    '/usb': [
      {name: 'A-Rock', path: '/usb/A-Rock', isDirectory: true},
      {name: 'B-Pop', path: '/usb/B-Pop', isDirectory: true},
      {name: 'C-Jazz', path: '/usb/C-Jazz', isDirectory: true},
    ],
    '/usb/A-Rock': mk('/usb/A-Rock', ['a1.mp3', 'a2.mp3']),
    '/usb/B-Pop': mk('/usb/B-Pop', ['b1.mp3', 'b2.mp3']),
    '/usb/C-Jazz': mk('/usb/C-Jazz', ['c1.mp3', 'c2.mp3']),
  };
}

jest.mock('react-native-track-player', () => {
  const p = {
    reset: jest.fn().mockResolvedValue(undefined),
    add: jest.fn().mockResolvedValue(undefined),
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    skip: jest.fn().mockResolvedValue(undefined),
    skipToNext: jest.fn().mockResolvedValue(undefined),
    skipToPrevious: jest.fn().mockResolvedValue(undefined),
    seekTo: jest.fn().mockResolvedValue(undefined),
    getQueue: jest.fn().mockResolvedValue([]),
    setupPlayer: jest.fn().mockResolvedValue(undefined),
    updateOptions: jest.fn().mockResolvedValue(undefined),
    setRepeatMode: jest.fn().mockResolvedValue(undefined),
    getPlaybackState: jest.fn().mockResolvedValue({state: 'paused'}),
    getProgress: jest.fn().mockResolvedValue({position: 0, duration: 0}),
    getActiveTrackIndex: jest.fn().mockResolvedValue(0),
  };
  let tpHandler: ((e: {type: string}) => void) | null = null;
  return {
    __esModule: true,
    default: p,
    Event: {
      PlaybackActiveTrackChanged: 'PlaybackActiveTrackChanged',
      PlaybackError: 'PlaybackError',
    },
    State: {
      Playing: 'playing',
      Paused: 'paused',
      Buffering: 'buffering',
      Loading: 'loading',
    },
    Capability: {
      Play: 0, Pause: 1, SkipToNext: 2, SkipToPrevious: 3, SeekTo: 4,
      JumpForward: 5, JumpBackward: 6, Stop: 7,
    },
    RepeatMode: {Off: 0, Track: 1, Queue: 2},
    AppKilledPlaybackBehavior: {StopPlaybackAndRemoveNotification: 'stop'},
    usePlaybackState: () => ({state: 'playing'}),
    useTrackPlayerEvents: (
      _events: string[],
      handler: (e: {type: string}) => void,
    ) => {
      tpHandler = handler;
    },
    useProgress: () => ({position: 0, duration: 0}),
    __emitTp: (event: {type: string}) => {
      if (tpHandler) {
        tpHandler(event);
      }
    },
  };
});

const tpMock = jest.requireMock('react-native-track-player');
const mockPlayer = tpMock.default as {[k: string]: jest.Mock};

jest.mock('../src/native/UsbAudio', () => ({
  UsbAudio: {
    isAvailable: true,
    getVolumes: () =>
      Promise.resolve([
        {
          path: '/usb',
          description: 'USB',
          removable: true,
          primary: false,
          state: 'mounted',
        },
      ]),
    listDir: (p: string) => Promise.resolve(mockFs[p] ?? []),
    hasStorageAccess: () => Promise.resolve(true),
    requestStorageAccess: () => Promise.resolve(true),
    volumeUp: jest.fn(),
    volumeDown: jest.fn(),
  },
  pickUsbVolume: (vols: Array<{path: string}>) => vols[0],
}));

const mockUsb = jest.requireMock('../src/native/UsbAudio').UsbAudio as {
  volumeUp: jest.Mock;
  volumeDown: jest.Mock;
};

jest.mock('react-native-safe-area-context', () => {
  const R = require('react');
  return {
    __esModule: true,
    SafeAreaProvider: ({children}: {children: React.ReactNode}) =>
      R.createElement(R.Fragment, null, children),
    SafeAreaView: ({children}: {children: React.ReactNode}) =>
      R.createElement(R.Fragment, null, children),
  };
});

// Mocks que CAPTURAN las props para poder afirmar sobre lo que se muestra y
// sobre los handlers de los botones en pantalla (p. ej. volumen).
const mockCaptured: {
  folderList?: any;
  nowPlaying?: any;
  controls?: any;
} = {};
jest.mock('../src/components/FolderList', () => ({
  __esModule: true,
  default: (props: any) => {
    mockCaptured.folderList = props;
    return null;
  },
}));
jest.mock('../src/components/NowPlaying', () => ({
  __esModule: true,
  default: (props: any) => {
    mockCaptured.nowPlaying = props;
    return null;
  },
}));
jest.mock('../src/components/Controls', () => ({
  __esModule: true,
  default: (props: any) => {
    mockCaptured.controls = props;
    return null;
  },
}));
jest.mock('../src/components/StatusScreen', () => ({
  __esModule: true,
  default: () => null,
}));

import App from '../App';

const realSetTimeout = globalThis.setTimeout;
const tick = () => new Promise<void>(resolve => realSetTimeout(() => resolve(), 0));
async function flush() {
  await act(async () => {
    await tick();
    await tick();
  });
}

function emitKey(keyCode: number) {
  act(() => {
    DeviceEventEmitter.emit('remoteKey', {keyCode, repeatCount: 0});
  });
}

// Todo lo que puede hacer el reproductor ante un botón.
const PLAYER_ACTIONS = [
  'reset',
  'add',
  'play',
  'pause',
  'skip',
  'skipToNext',
  'skipToPrevious',
  'seekTo',
];
function clearPlayerCalls() {
  PLAYER_ACTIONS.forEach(name => mockPlayer[name].mockClear());
}
function expectNoPlayerCalls() {
  PLAYER_ACTIONS.forEach(name =>
    expect(mockPlayer[name]).not.toHaveBeenCalled(),
  );
}

let root: TestRenderer.ReactTestRenderer | null = null;

/** Texto de la línea de señales (abajo de todo). */
function signalText(): string {
  return root!.root
    .findByType(SignalBar)
    .findAllByType(Text)
    .map(t => ([] as unknown[]).concat(t.props.children).join(''))
    .join(' ');
}

async function mountAndLoad() {
  await act(async () => {
    root = TestRenderer.create(React.createElement(App));
  });
  // Espera a que el autoplay cargue la cola (cadena async completa).
  for (let i = 0; i < 40 && mockPlayer.add.mock.calls.length === 0; i++) {
    await flush();
  }
  expect(mockPlayer.add.mock.calls.length).toBeGreaterThan(0);
}

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
    root = null;
  }
});

describe('Pendrive real del usuario (3 carpetas, solo "Musica" con 36 temas)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFs = fsUnaCarpetaConMusica();
  });

  it('AUTOPLAY: al conectar reproduce la 1ª canción y la muestra en la lista correcta', async () => {
    await mountAndLoad();
    // La cola cargada son las 36 canciones en orden; arranca la 1ª.
    const added = mockPlayer.add.mock.calls[0][0];
    expect(added).toHaveLength(36);
    expect(added[0].title).toBe('01 Cancion');
    expect(mockPlayer.play).toHaveBeenCalled();

    // Cuando la pista activa llega (evento de la sesión de medios), la app la
    // muestra y resalta en la carpeta correcta ("Musica").
    act(() => {
      tpMock.__emitTp({type: 'PlaybackActiveTrackChanged', track: added[0]});
    });
    await flush();
    expect(mockCaptured.nowPlaying.track.title).toBe('01 Cancion');
    expect(mockCaptured.folderList.group.name).toBe('Musica');
    expect(mockCaptured.folderList.folderCount).toBe(1);
    expect(mockCaptured.folderList.group.tracks).toHaveLength(36);
    expect(mockCaptured.folderList.activeTrackIndex).toBe(0);
  });

  it('BOTÓN OK redondo: se captura y no hace nada (su función está vacía)', async () => {
    const okSpy = jest.spyOn(OkButtonCommand.prototype, 'execute');
    try {
      await mountAndLoad();
      const added = mockPlayer.add.mock.calls[0][0]; // 36 pistas en orden
      // Está sonando la 3ª (índice 2) y el cursor queda en la 8ª (índice 7).
      act(() => {
        tpMock.__emitTp({type: 'PlaybackActiveTrackChanged', track: added[2]});
      });
      for (let i = 0; i < 5; i++) {
        emitKey(KeyCodes.DPAD_DOWN);
      }
      await flush();
      expect(mockCaptured.nowPlaying.track.title).toBe('03 Cancion');
      expect(mockCaptured.folderList.selectedTrack).toBe(7);

      // Se aprieta OK: la pulsación se captura (se ve en la línea de señales)
      // y llega a OkButtonCommand, que no hace nada.
      clearPlayerCalls();
      emitKey(KeyCodes.DPAD_CENTER);
      await flush();
      expect(okSpy).toHaveBeenCalledTimes(1);
      expect(signalText()).toContain('DPAD_CENTER(23)');

      // Igual con cualquier otra tecla de confirmación que pueda mandar el OK.
      const otherOkKeys = [
        KeyCodes.ENTER,
        KeyCodes.NUMPAD_ENTER,
        KeyCodes.SPACE,
        KeyCodes.BUTTON_SELECT,
        KeyCodes.BUTTON_A,
      ];
      otherOkKeys.forEach(emitKey);
      await flush();
      expect(okSpy).toHaveBeenCalledTimes(1 + otherOkKeys.length);

      // Nada cambió: ni el reproductor, ni lo que suena, ni el cursor.
      expectNoPlayerCalls();
      expect(mockCaptured.nowPlaying.track.title).toBe('03 Cancion');
      expect(mockCaptured.folderList.selectedTrack).toBe(7);
    } finally {
      okSpy.mockRestore();
    }
  });

  it('PAGE ▲/▼ se capturan y no hacen nada (sus funciones están vacías)', async () => {
    const upSpy = jest.spyOn(PageUpCommand.prototype, 'execute');
    const downSpy = jest.spyOn(PageDownCommand.prototype, 'execute');
    try {
      await mountAndLoad();
      const selectedBefore = mockCaptured.folderList.selectedTrack;
      clearPlayerCalls();

      emitKey(KeyCodes.PAGE_DOWN);
      await flush();
      expect(downSpy).toHaveBeenCalledTimes(1);
      expect(signalText()).toContain('PAGE_DOWN(93)');

      emitKey(KeyCodes.PAGE_UP);
      await flush();
      expect(upSpy).toHaveBeenCalledTimes(1);
      expect(signalText()).toContain('PAGE_UP(92)');

      expectNoPlayerCalls();
      expect(mockCaptured.folderList.selectedTrack).toBe(selectedBefore);
    } finally {
      upSpy.mockRestore();
      downSpy.mockRestore();
    }
  });

  it('el botón MENÚ (3 líneas, keycode 82) no hace nada', async () => {
    await mountAndLoad();
    mockPlayer.skip.mockClear();
    mockPlayer.play.mockClear();
    mockPlayer.pause.mockClear();
    mockPlayer.skipToNext.mockClear();
    mockPlayer.skipToPrevious.mockClear();
    emitKey(82); // KEYCODE_MENU: ni está en KeyCodes ni tiene caso en el switch
    await flush();
    expect(mockPlayer.skip).not.toHaveBeenCalled();
    expect(mockPlayer.play).not.toHaveBeenCalled();
    expect(mockPlayer.pause).not.toHaveBeenCalled();
    expect(mockPlayer.skipToNext).not.toHaveBeenCalled();
    expect(mockPlayer.skipToPrevious).not.toHaveBeenCalled();
  });

  it('la tecla play/pausa (MEDIA_PLAY_PAUSE) alterna reproducción según el estado', async () => {
    await mountAndLoad();
    mockPlayer.play.mockClear();
    mockPlayer.pause.mockClear();
    // Estaba en pausa → reanuda.
    mockPlayer.getPlaybackState.mockResolvedValueOnce({state: 'paused'});
    emitKey(KeyCodes.MEDIA_PLAY_PAUSE);
    await flush();
    expect(mockPlayer.play).toHaveBeenCalled();
    // Estaba sonando → pausa.
    mockPlayer.play.mockClear();
    mockPlayer.getPlaybackState.mockResolvedValueOnce({state: 'playing'});
    emitKey(KeyCodes.MEDIA_PLAY_PAUSE);
    await flush();
    expect(mockPlayer.pause).toHaveBeenCalled();
  });

  it('las flechas ▲/▼ mueven el cursor', async () => {
    await mountAndLoad();
    // Bajar 3: el cursor queda en la 4ª (índice 3).
    emitKey(KeyCodes.DPAD_DOWN);
    emitKey(KeyCodes.DPAD_DOWN);
    emitKey(KeyCodes.DPAD_DOWN);
    await flush();
    expect(mockCaptured.folderList.selectedTrack).toBe(3);

    // Subir 1 → la 3ª (índice 2).
    emitKey(KeyCodes.DPAD_UP);
    await flush();
    expect(mockCaptured.folderList.selectedTrack).toBe(2);
  });

  it('los botones de volumen en pantalla ajustan el volumen del sistema', async () => {
    await mountAndLoad();
    mockUsb.volumeUp.mockClear();
    mockUsb.volumeDown.mockClear();
    act(() => mockCaptured.controls.onVolumeUp());
    act(() => mockCaptured.controls.onVolumeDown());
    expect(mockUsb.volumeUp).toHaveBeenCalledTimes(1);
    expect(mockUsb.volumeDown).toHaveBeenCalledTimes(1);
  });
});

describe('Pendrive con varias carpetas (navegación entre carpetas)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFs = fsVariasCarpetas();
  });

  it('las flechas ◀/▶ se mueven entre carpetas', async () => {
    await mountAndLoad();
    // Grupos ordenados: A-Rock, B-Pop, C-Jazz.
    expect(mockCaptured.folderList.folderCount).toBe(3);
    expect(mockCaptured.folderList.group.name).toBe('A-Rock');

    emitKey(KeyCodes.DPAD_RIGHT); // carpeta 1 → 2 (B-Pop)
    await flush();
    expect(mockCaptured.folderList.group.name).toBe('B-Pop');
    expect(mockCaptured.folderList.folderNumber).toBe(2);

    emitKey(KeyCodes.DPAD_LEFT); // carpeta 2 → 1 (A-Rock)
    await flush();
    expect(mockCaptured.folderList.group.name).toBe('A-Rock');
    expect(mockCaptured.folderList.folderNumber).toBe(1);
  });
});
