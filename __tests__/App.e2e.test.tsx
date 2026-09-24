/**
 * Tests e2e / de integración: renderizan el App REAL con los módulos nativos
 * simulados y verifican el COMPORTAMIENTO ACTUAL (tal cual es hoy) del control
 * remoto y del autoplay. Son tests de "caracterización": fijan lo que la app
 * hace ahora mismo, incluyendo detalles que el usuario reportó desde el
 * dispositivo real.
 *
 * Notas sobre el control del usuario:
 *  - El botón OK redondo manda ENTER(66). Android convertía esa tecla en un
 *    clic sobre el botón enfocado de la pantalla (⏮) antes de que la app la
 *    viera; ahora MainActivity la captura primero (prevent default) y la app
 *    reproduce la canción SELECCIONADA (OkButtonCommand).
 *  - La lista es un navegador de carpetas: Re Pág sube un nivel y Av Pág entra
 *    a la carpeta resaltada. Se ven TODAS las carpetas (tengan o no música) y
 *    adentro solo las canciones reproducibles.
 *  - ▲/▼ mueven el cursor y ◀/▶ reproducen la canción anterior/siguiente; en
 *    los extremos no dan la vuelta. Mantenidas: ▲/▼ recorren la lista a 3 por
 *    segundo y ◀/▶ pausan y atrasan/adelantan la canción 20 s por segundo.
 *  - OK sobre la canción que ya suena alterna pausa/play. Home/retorno (BACK)
 *    sube un nivel, como Re Pág.
 */
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {DeviceEventEmitter, Platform} from 'react-native';
import AutoOpenBanner from '../src/components/AutoOpenBanner';
import {
  OkButtonCommand,
  PageDownCommand,
  PageUpCommand,
} from '../src/core/remote/commands';
import {HOLD_THRESHOLD_MS} from '../src/core/remote/timing';
import {KeyCodes} from '../src/keymap';
import {ROOT_FOLDER_NAME} from '../src/library';

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
    canAutoOpen: () => Promise.resolve(mockCanAutoOpen),
    requestAutoOpen: jest.fn(),
    volumeUp: jest.fn(),
    volumeDown: jest.fn(),
  },
  pickUsbVolume: (vols: Array<{path: string}>) => vols[0],
}));
/** ¿Ya tiene el permiso para abrirse sola al conectar el pendrive? */
let mockCanAutoOpen = true;

const mockUsb = jest.requireMock('../src/native/UsbAudio').UsbAudio as {
  requestAutoOpen: jest.Mock;
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

/** Apretar una tecla (`repeatCount` > 0: repetición de Android al mantenerla). */
function keyDown(keyCode: number, repeatCount = 0) {
  act(() => {
    DeviceEventEmitter.emit('remoteKey', {
      keyCode,
      repeatCount,
      action: 'down',
    });
  });
}

function keyUp(keyCode: number) {
  act(() => {
    DeviceEventEmitter.emit('remoteKey', {
      keyCode,
      repeatCount: 0,
      action: 'up',
    });
  });
}

/** Un toque: apretar y soltar. */
function emitKey(keyCode: number) {
  keyDown(keyCode);
  keyUp(keyCode);
}

/** Reloj simulado para los botones mantenidos (`flush` sigue con el real). */
function useFakeClock() {
  jest.useFakeTimers({
    doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'],
  });
}

function advance(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
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

/** Lo que muestra la lista: "📁 carpeta" o el título de la canción. */
function listed(): string[] {
  return mockCaptured.folderList.items.map((item: any) =>
    item.kind === 'folder' ? `📁 ${item.folder.name}` : item.track.title,
  );
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
  jest.useRealTimers();
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
    // muestra y la lista abre su carpeta ("Musica") con ella resaltada.
    act(() => {
      tpMock.__emitTp({type: 'PlaybackActiveTrackChanged', track: added[0]});
    });
    await flush();
    expect(mockCaptured.nowPlaying.track.title).toBe('01 Cancion');
    const list = mockCaptured.folderList;
    expect(list.title).toBe('Musica');
    expect(list.items).toHaveLength(36);
    expect(listed()[0]).toBe('01 Cancion');
    expect(list.selectedIndex).toBe(0);
    expect(list.activeTrackPath).toBe(added[0].id);
    expect(list.canGoUp).toBe(true);
  });

  it('BOTÓN OK redondo (ENTER): reproduce la canción SELECCIONADA', async () => {
    const okSpy = jest.spyOn(OkButtonCommand.prototype, 'execute');
    try {
      await mountAndLoad();
      const added = mockPlayer.add.mock.calls[0][0]; // 36 pistas en orden
      // Suena la 3ª (índice 2): la lista la sigue. El cursor baja a la 8ª.
      act(() => {
        tpMock.__emitTp({type: 'PlaybackActiveTrackChanged', track: added[2]});
      });
      await flush();
      expect(mockCaptured.folderList.selectedIndex).toBe(2);
      for (let i = 0; i < 5; i++) {
        emitKey(KeyCodes.DPAD_DOWN);
      }
      await flush();
      expect(mockCaptured.folderList.selectedIndex).toBe(7);

      // OK (ENTER): reproduce la seleccionada (la 8ª, índice 7), no la anterior.
      clearPlayerCalls();
      emitKey(KeyCodes.ENTER);
      await flush();
      expect(okSpy).toHaveBeenCalledTimes(1);
      expect(mockPlayer.skip).toHaveBeenCalledWith(7);
      expect(mockPlayer.play).toHaveBeenCalled();
      expect(mockPlayer.skipToPrevious).not.toHaveBeenCalled();
    } finally {
      okSpy.mockRestore();
    }
  });

  it('BOTÓN OK sobre una carpeta no hace nada', async () => {
    await mountAndLoad();
    emitKey(KeyCodes.PAGE_UP); // la raíz: solo carpetas
    await flush();
    clearPlayerCalls();
    emitKey(KeyCodes.ENTER);
    await flush();
    expectNoPlayerCalls();
    expect(mockCaptured.folderList.title).toBe(ROOT_FOLDER_NAME);
  });

  it('PAGE ▲ sube de nivel y PAGE ▼ entra: se ven TODAS las carpetas y adentro solo la música', async () => {
    const upSpy = jest.spyOn(PageUpCommand.prototype, 'execute');
    const downSpy = jest.spyOn(PageDownCommand.prototype, 'execute');
    try {
      await mountAndLoad();
      expect(mockCaptured.folderList.title).toBe('Musica');
      clearPlayerCalls();

      // ▲ Pág: sube a la raíz. Están las 3 carpetas, tengan o no música, con el
      // cursor en la carpeta de la que se salió.
      emitKey(KeyCodes.PAGE_UP);
      await flush();
      expect(upSpy).toHaveBeenCalledTimes(1);
      const list = mockCaptured.folderList;
      expect(list.title).toBe(ROOT_FOLDER_NAME);
      expect(listed()).toEqual(['📁 Fotos', '📁 Musica', '📁 Videos']);
      expect(list.items.map((item: any) => item.folder.trackCount)).toEqual([
        0, 36, 0,
      ]);
      expect(list.selectedIndex).toBe(1);
      expect(list.canGoUp).toBe(false);

      // En la raíz, ▲ Pág ya no sube más.
      emitKey(KeyCodes.PAGE_UP);
      await flush();
      expect(mockCaptured.folderList.title).toBe(ROOT_FOLDER_NAME);

      // ▼ Pág: entra a la carpeta resaltada ("Musica").
      emitKey(KeyCodes.PAGE_DOWN);
      await flush();
      expect(downSpy).toHaveBeenCalledTimes(1);
      expect(mockCaptured.folderList.title).toBe('Musica');
      expect(mockCaptured.folderList.items).toHaveLength(36);
      expect(mockCaptured.folderList.selectedIndex).toBe(0);

      // Dentro de "Fotos" solo se muestra música reproducible: nada (la foto no).
      emitKey(KeyCodes.PAGE_UP);
      emitKey(KeyCodes.DPAD_UP);
      emitKey(KeyCodes.PAGE_DOWN);
      await flush();
      expect(mockCaptured.folderList.title).toBe('Fotos');
      expect(mockCaptured.folderList.items).toEqual([]);

      // Navegar no toca la reproducción.
      expectNoPlayerCalls();
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

  it('las flechas ▲/▼ mueven el cursor, sin dar la vuelta en los extremos', async () => {
    await mountAndLoad();
    // Arriba de todo, ▲ no salta al final.
    emitKey(KeyCodes.DPAD_UP);
    await flush();
    expect(mockCaptured.folderList.selectedIndex).toBe(0);

    // Bajar 3: el cursor queda en la 4ª (índice 3). Subir 1: la 3ª.
    emitKey(KeyCodes.DPAD_DOWN);
    emitKey(KeyCodes.DPAD_DOWN);
    emitKey(KeyCodes.DPAD_DOWN);
    await flush();
    expect(mockCaptured.folderList.selectedIndex).toBe(3);
    emitKey(KeyCodes.DPAD_UP);
    await flush();
    expect(mockCaptured.folderList.selectedIndex).toBe(2);

    // Abajo de todo, ▼ no vuelve al principio.
    for (let i = 0; i < 40; i++) {
      emitKey(KeyCodes.DPAD_DOWN);
    }
    await flush();
    expect(mockCaptured.folderList.selectedIndex).toBe(35);
  });

  it('OK sobre la canción que ya suena alterna pausa / play', async () => {
    await mountAndLoad();
    const added = mockPlayer.add.mock.calls[0][0];
    act(() => {
      tpMock.__emitTp({type: 'PlaybackActiveTrackChanged', track: added[0]});
    });
    await flush();
    expect(mockCaptured.folderList.selectedIndex).toBe(0); // la que suena
    clearPlayerCalls();

    mockPlayer.getPlaybackState.mockResolvedValueOnce({state: 'playing'});
    emitKey(KeyCodes.ENTER);
    await flush();
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);

    mockPlayer.getPlaybackState.mockResolvedValueOnce({state: 'paused'});
    emitKey(KeyCodes.ENTER);
    await flush();
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    // No la vuelve a cargar.
    expect(mockPlayer.skip).not.toHaveBeenCalled();
  });

  it('mantener OK apretado no repite la acción', async () => {
    await mountAndLoad();
    emitKey(KeyCodes.DPAD_DOWN); // otra canción, no la que suena
    clearPlayerCalls();
    keyDown(KeyCodes.ENTER);
    for (let repeat = 1; repeat <= 5; repeat++) {
      keyDown(KeyCodes.ENTER, repeat);
    }
    keyUp(KeyCodes.ENTER);
    await flush();
    expect(mockPlayer.skip).toHaveBeenCalledTimes(1);
    expect(mockPlayer.skip).toHaveBeenCalledWith(1);
  });

  it('▼ mantenida baja 3 canciones por segundo; al soltar se queda ahí', async () => {
    useFakeClock();
    await mountAndLoad();
    keyDown(KeyCodes.DPAD_DOWN);
    expect(mockCaptured.folderList.selectedIndex).toBe(1);
    // Las repeticiones automáticas de Android no aceleran nada.
    keyDown(KeyCodes.DPAD_DOWN, 1);
    keyDown(KeyCodes.DPAD_DOWN, 2);
    expect(mockCaptured.folderList.selectedIndex).toBe(1);

    advance(1000);
    expect(mockCaptured.folderList.selectedIndex).toBe(4);
    advance(1000);
    expect(mockCaptured.folderList.selectedIndex).toBe(7);

    keyUp(KeyCodes.DPAD_DOWN);
    advance(3000);
    expect(mockCaptured.folderList.selectedIndex).toBe(7);
  });

  it('▲ mantenida sube 3 por segundo y se detiene en la primera', async () => {
    useFakeClock();
    await mountAndLoad();
    for (let i = 0; i < 5; i++) {
      emitKey(KeyCodes.DPAD_DOWN);
    }
    expect(mockCaptured.folderList.selectedIndex).toBe(5);

    keyDown(KeyCodes.DPAD_UP);
    advance(1000);
    expect(mockCaptured.folderList.selectedIndex).toBe(1);
    advance(5000);
    expect(mockCaptured.folderList.selectedIndex).toBe(0);
    keyUp(KeyCodes.DPAD_UP);
  });

  it('▶ mantenida pausa y adelanta 20 s por segundo; al soltar sigue desde ahí', async () => {
    useFakeClock();
    await mountAndLoad();
    const added = mockPlayer.add.mock.calls[0][0];
    act(() => {
      tpMock.__emitTp({type: 'PlaybackActiveTrackChanged', track: added[0]});
    });
    await flush();
    clearPlayerCalls();
    mockPlayer.getProgress.mockResolvedValueOnce({position: 30, duration: 200});

    keyDown(KeyCodes.DPAD_RIGHT);
    advance(HOLD_THRESHOLD_MS);
    await flush();
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    const scrubber = mockCaptured.nowPlaying.scrubber;
    expect(scrubber.getSnapshot()).toMatchObject({position: 30, holding: true});

    advance(1000);
    expect(scrubber.getSnapshot().position).toBe(50);
    advance(1000);
    expect(scrubber.getSnapshot().position).toBe(70);

    keyUp(KeyCodes.DPAD_RIGHT);
    await flush();
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(70);
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    // Mantener no es un toque: no pasa a la canción siguiente.
    expect(mockPlayer.skip).not.toHaveBeenCalled();
  });

  it('◀ mantenida atrasa 20 s por segundo sin bajar del principio', async () => {
    useFakeClock();
    await mountAndLoad();
    const added = mockPlayer.add.mock.calls[0][0];
    act(() => {
      tpMock.__emitTp({type: 'PlaybackActiveTrackChanged', track: added[0]});
    });
    await flush();
    clearPlayerCalls();
    mockPlayer.getProgress.mockResolvedValueOnce({position: 30, duration: 200});

    keyDown(KeyCodes.DPAD_LEFT);
    advance(HOLD_THRESHOLD_MS);
    await flush();
    advance(1000);
    expect(mockCaptured.nowPlaying.scrubber.getSnapshot().position).toBe(10);
    advance(2000);
    expect(mockCaptured.nowPlaying.scrubber.getSnapshot().position).toBe(0);

    keyUp(KeyCodes.DPAD_LEFT);
    await flush();
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
  });

  it('Home/retorno (BACK) sube un nivel y en la raíz no hace nada (no cierra la app)', async () => {
    await mountAndLoad();
    clearPlayerCalls();
    emitKey(KeyCodes.BACK);
    await flush();
    expect(mockCaptured.folderList.title).toBe(ROOT_FOLDER_NAME);
    expect(mockCaptured.folderList.selectedIndex).toBe(1); // "Musica"

    emitKey(KeyCodes.BACK);
    await flush();
    expect(mockCaptured.folderList.title).toBe(ROOT_FOLDER_NAME);
    expectNoPlayerCalls();
  });

  it('si falta el permiso para abrirse sola, avisa y PERMITIR abre el ajuste', async () => {
    mockCanAutoOpen = false;
    try {
      await mountAndLoad();
      await flush();
      const banner = root!.root.findByType(AutoOpenBanner);
      act(() => banner.props.onAllow());
      expect(mockUsb.requestAutoOpen).toHaveBeenCalledTimes(1);
    } finally {
      mockCanAutoOpen = true;
    }
  });

  it('con el permiso para abrirse sola no se muestra el aviso', async () => {
    await mountAndLoad();
    await flush();
    expect(root!.root.findAllByType(AutoOpenBanner)).toHaveLength(0);
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

  it('las flechas ◀/▶ seleccionan y reproducen la canción anterior/siguiente; en los extremos no hacen nada', async () => {
    await mountAndLoad();
    // Se ve "A-Rock" (a1, a2) con a1 resaltada. Cola: a1 a2 b1 b2 c1 c2.
    expect(mockCaptured.folderList.title).toBe('A-Rock');
    expect(mockCaptured.folderList.selectedIndex).toBe(0);
    clearPlayerCalls();

    // ◀ en la primera: nada (no salta al final).
    emitKey(KeyCodes.DPAD_LEFT);
    await flush();
    expectNoPlayerCalls();
    expect(mockCaptured.folderList.selectedIndex).toBe(0);

    // ▶: selecciona a2 y la reproduce (índice 1 de la cola).
    emitKey(KeyCodes.DPAD_RIGHT);
    await flush();
    expect(mockCaptured.folderList.selectedIndex).toBe(1);
    expect(mockPlayer.skip).toHaveBeenCalledWith(1);
    expect(mockPlayer.play).toHaveBeenCalled();

    // ▶ en la última: nada (ni vuelve al principio ni pasa a otra carpeta).
    clearPlayerCalls();
    emitKey(KeyCodes.DPAD_RIGHT);
    await flush();
    expectNoPlayerCalls();
    expect(mockCaptured.folderList.title).toBe('A-Rock');
    expect(mockCaptured.folderList.selectedIndex).toBe(1);

    // ◀: vuelve a a1 y la reproduce.
    emitKey(KeyCodes.DPAD_LEFT);
    await flush();
    expect(mockCaptured.folderList.selectedIndex).toBe(0);
    expect(mockPlayer.skip).toHaveBeenCalledWith(0);
  });

  it('en pantalla: «Subir» sube, tocar una carpeta la abre y tocar una canción la reproduce', async () => {
    await mountAndLoad();
    act(() => mockCaptured.folderList.onGoUp());
    await flush();
    expect(listed()).toEqual(['📁 A-Rock', '📁 B-Pop', '📁 C-Jazz']);

    act(() => mockCaptured.folderList.onPressItem(1)); // abre B-Pop
    await flush();
    expect(mockCaptured.folderList.title).toBe('B-Pop');
    expect(listed()).toEqual(['b1', 'b2']);

    clearPlayerCalls();
    act(() => mockCaptured.folderList.onPressItem(1)); // toca b2
    await flush();
    expect(mockPlayer.skip).toHaveBeenCalledWith(3);
    expect(mockCaptured.folderList.selectedIndex).toBe(1);
  });
});
