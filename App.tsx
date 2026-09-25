/**
 * Capa de presentación y orquestación (React). No contiene reglas de negocio:
 * compone las clases del núcleo (`src/core`) y los adaptadores
 * (`src/adapters`), guarda el estado de la UI y conecta eventos (teclas del
 * control, pistas activas, montaje del pendrive) con esas clases.
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AppState,
  DeviceEventEmitter,
  PermissionsAndroid,
  Platform,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {
  Event,
  usePlaybackState,
  useTrackPlayerEvents,
} from 'react-native-track-player';
import {UsbMonitor} from './src/adapters/UsbMonitor';
import AutoOpenBanner from './src/components/AutoOpenBanner';
import Controls from './src/components/Controls';
import FolderList from './src/components/FolderList';
import NowPlaying from './src/components/NowPlaying';
import StatusScreen, {StatusKind} from './src/components/StatusScreen';
import {BrowseState, FolderBrowser} from './src/core/browser/FolderBrowser';
import {MusicLibrary} from './src/core/library/MusicLibrary';
import {RemoteActions} from './src/core/remote/RemoteActions';
import {RemoteControlRouter} from './src/core/remote/RemoteControlRouter';
import {RemovableVolumeSelector} from './src/core/usb/RemovableVolumeSelector';
import {RemoteKeyEvent} from './src/keymap';
import {FolderGroup, scanLibrary, totalTracks, TrackInfo} from './src/library';
import {UsbAudio} from './src/native/UsbAudio';
import {
  clearQueue,
  isPlayingState,
  loadQueue,
  pause,
  play,
  playbackScrubber,
  playTrackAt,
  QueueTrack,
  seekBy,
  SEEK_STEP_SECONDS,
  setupPlayerOnce,
  skipToNext,
  skipToPrevious,
  togglePlayPause,
} from './src/player';
import {colors} from './src/theme';

type UsbStatus =
  | 'esperando-usb'
  | 'escaneando'
  | 'reproduciendo'
  | 'sin-musica';

/** El navegador vuelve a mostrar el tema sonando tras esta pausa sin navegar. */
const NAV_IDLE_MS = 15000;
const POLL_INTERVAL_MS = 4000;
/** El montaje del volumen tarda unos segundos tras enchufar el pendrive. */
const USB_DEBOUNCE_MS = 900;

export default function App() {
  const [hasPermission, setHasPermission] = useState(false);
  /** La app puede abrirse sola al conectar el pendrive (null: sin saber). */
  const [canAutoOpen, setCanAutoOpen] = useState<boolean | null>(null);
  const [status, setStatus] = useState<UsbStatus>('esperando-usb');
  const [groups, setGroups] = useState<FolderGroup[]>([]);
  const [volumeDesc, setVolumeDesc] = useState('');
  // Navegador de carpetas del pendrive y qué se está mirando en él.
  const [browser, setBrowser] = useState<FolderBrowser | null>(null);
  const [browse, setBrowse] = useState<BrowseState>({dir: '', cursor: 0});
  const [activeTrack, setActiveTrack] = useState<QueueTrack | undefined>();

  // Colaboradores del núcleo (sin estado propio: seguros de compartir).
  const volumeSelector = useMemo(() => new RemovableVolumeSelector(), []);

  // Refs espejo para leer el estado vigente desde listeners estables.
  const groupsRef = useRef<FolderGroup[]>([]);
  const browserRef = useRef<FolderBrowser | null>(null);
  const browseRef = useRef<BrowseState>({dir: '', cursor: 0});
  const activeTrackRef = useRef<QueueTrack | undefined>(undefined);
  const hasPermissionRef = useRef(false);
  const rootRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const lastNavRef = useRef(0);

  /** Muestra otra carpeta/ítem sin contar como navegación (seguir al tema). */
  const showBrowse = useCallback((next: BrowseState) => {
    browseRef.current = next;
    setBrowse(next);
  }, []);

  /** Navegación del usuario: pausa el seguimiento del tema que suena. */
  const updateBrowse = useCallback(
    (next: BrowseState) => {
      lastNavRef.current = Date.now();
      showBrowse(next);
    },
    [showBrowse],
  );

  /** Reproduce una canción del pendrive (por su posición en la cola). */
  const playTrack = useCallback((track: TrackInfo) => {
    playTrackAt(new MusicLibrary(groupsRef.current).queueIndexOf(track));
  }, []);

  /** Implementación concreta de lo que puede pedir el control remoto. */
  const remoteActions = useMemo<RemoteActions>(
    () => ({
      moveCursor: delta => {
        const b = browserRef.current;
        if (!b) {
          return false;
        }
        const before = browseRef.current;
        const next = b.moveCursor(before, delta);
        updateBrowse(next);
        return next !== before;
      },
      playAdjacent: delta => {
        const next = browserRef.current?.adjacentTrack(
          browseRef.current,
          delta,
        );
        if (next) {
          updateBrowse(next.state);
          playTrack(next.track);
        }
      },
      activateSelection: () => {
        const b = browserRef.current;
        const item = b?.selected(browseRef.current);
        if (!b || !item) {
          return;
        }
        if (item.kind === 'folder') {
          updateBrowse(b.enter(browseRef.current));
        } else if (item.track.path === activeTrackRef.current?.id) {
          togglePlayPause(); // es la que ya suena: pausa / play
        } else {
          playTrack(item.track);
        }
      },
      startScrub: direction => {
        if (activeTrackRef.current) {
          playbackScrubber.start(direction);
        }
      },
      finishScrub: () => {
        playbackScrubber.finish();
      },
      goUp: () => {
        const b = browserRef.current;
        if (b) {
          updateBrowse(b.up(browseRef.current));
        }
      },
      enterFolder: () => {
        const b = browserRef.current;
        if (b) {
          updateBrowse(b.enter(browseRef.current));
        }
      },
      playFolderOffset: delta => {
        const gs = groupsRef.current;
        if (gs.length > 0) {
          const from = activeTrackRef.current?.folderIndex ?? 0;
          playTrackAt(new MusicLibrary(gs).folderOffsetStartIndex(from, delta));
        }
      },
      togglePlayPause: () => {
        togglePlayPause();
      },
      play: () => {
        play();
      },
      pause: () => {
        pause();
      },
      nextTrack: () => {
        skipToNext();
      },
      previousTrack: () => {
        skipToPrevious();
      },
      seekBy: seconds => {
        seekBy(seconds);
      },
    }),
    [playTrack, updateBrowse],
  );

  const remoteRouter = useMemo(
    () => new RemoteControlRouter(remoteActions),
    [remoteActions],
  );

  /** Tocar un ítem en pantalla: una carpeta se abre; una canción se reproduce. */
  const pressItem = useCallback(
    (index: number) => {
      const b = browserRef.current;
      if (!b) {
        return;
      }
      const touched = {dir: browseRef.current.dir, cursor: index};
      const item = b.selected(touched);
      if (item?.kind === 'folder') {
        updateBrowse(b.enter(touched));
      } else if (item?.kind === 'track') {
        updateBrowse(touched);
        playTrack(item.track);
      }
    },
    [playTrack, updateBrowse],
  );

  const goUp = useCallback(() => remoteActions.goUp(), [remoteActions]);

  const playFolderOffset = useCallback(
    (delta: number) => remoteActions.playFolderOffset(delta),
    [remoteActions],
  );

  const refreshVolumes = useCallback(async () => {
    if (busyRef.current || !hasPermissionRef.current || !UsbAudio.isAvailable) {
      return;
    }
    busyRef.current = true;
    try {
      const volumes = await UsbAudio.getVolumes();
      const usb = volumeSelector.pick(volumes);
      if (!usb) {
        if (rootRef.current != null) {
          rootRef.current = null;
          groupsRef.current = [];
          setGroups([]);
          browserRef.current = null;
          setBrowser(null);
          activeTrackRef.current = undefined;
          setActiveTrack(undefined);
          setStatus('esperando-usb');
          await clearQueue();
        }
        return;
      }
      if (usb.path === rootRef.current) {
        return;
      }
      rootRef.current = usb.path;
      setVolumeDesc(usb.description || 'Pendrive USB');
      setStatus('escaneando');
      const {tree, groups: found} = await scanLibrary(
        usb.path,
        UsbAudio.listDir,
      );
      if (rootRef.current !== usb.path) {
        return; // lo desconectaron durante el escaneo
      }
      groupsRef.current = found;
      setGroups(found);
      const nextBrowser = new FolderBrowser(tree);
      browserRef.current = nextBrowser;
      setBrowser(nextBrowser);
      if (totalTracks(found) === 0) {
        setStatus('sin-musica');
        await clearQueue();
      } else {
        // Se muestra la carpeta del primer tema, que es el que arranca solo.
        showBrowse(
          nextBrowser.reveal(found[0].tracks[0].path) ?? nextBrowser.start(),
        );
        setStatus('reproduciendo');
        await loadQueue(found, true);
      }
    } catch {
    } finally {
      busyRef.current = false;
    }
  }, [showBrowse, volumeSelector]);

  const recheckPermission = useCallback(async () => {
    const granted = await UsbAudio.hasStorageAccess();
    hasPermissionRef.current = granted;
    setHasPermission(granted);
    if (granted) {
      refreshVolumes();
    }
    try {
      setCanAutoOpen(await UsbAudio.canAutoOpen());
    } catch {}
  }, [refreshVolumes]);

  const requestPermission = useCallback(async () => {
    const granted = await UsbAudio.requestStorageAccess();
    if (granted) {
      hasPermissionRef.current = true;
      setHasPermission(true);
      refreshVolumes();
    }
    // En Android 11+ se abre Ajustes y el permiso se re-verifica al volver.
  }, [refreshVolumes]);

  useTrackPlayerEvents([Event.PlaybackActiveTrackChanged], event => {
    if (event.type !== Event.PlaybackActiveTrackChanged) {
      return;
    }
    const track = event.track as QueueTrack | undefined;
    activeTrackRef.current = track;
    setActiveTrack(track);
    if (
      typeof track?.id === 'string' &&
      Date.now() - lastNavRef.current > NAV_IDLE_MS
    ) {
      const next = browserRef.current?.reveal(track.id);
      if (next) {
        showBrowse(next);
      }
    }
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await setupPlayerOnce();
      } catch {}
      if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
        try {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );
        } catch {}
      }
      if (!cancelled) {
        await recheckPermission();
      }
    })();

    const stopUsbMonitor = new UsbMonitor(
      refreshVolumes,
      POLL_INTERVAL_MS,
      USB_DEBOUNCE_MS,
    ).start();
    const keySub = DeviceEventEmitter.addListener(
      'remoteKey',
      (event: RemoteKeyEvent) => {
        if (event.action === 'up') {
          remoteRouter.release(event.keyCode);
        } else if (!event.repeatCount) {
          // Mantener apretado lo resuelve cada botón con sus tiempos; las
          // repeticiones automáticas de Android no repiten la acción.
          remoteRouter.press(event.keyCode);
        }
      },
    );
    const appSub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        recheckPermission();
      }
    });

    return () => {
      cancelled = true;
      stopUsbMonitor();
      remoteRouter.cancelAll();
      playbackScrubber.cancel();
      keySub.remove();
      appSub.remove();
    };
  }, [recheckPermission, refreshVolumes, remoteRouter]);

  const statusKind: StatusKind | null =
    Platform.OS !== 'android'
      ? 'no-android'
      : !hasPermission
      ? 'sin-permiso'
      : status !== 'reproduciendo'
      ? status
      : null;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
        {hasPermission && canAutoOpen === false && (
          <AutoOpenBanner onAllow={UsbAudio.requestAutoOpen} />
        )}
        {statusKind != null ? (
          <StatusScreen
            kind={statusKind}
            volumeDescription={volumeDesc}
            onRequestPermission={requestPermission}
          />
        ) : (
          <PlayerScreen
            groups={groups}
            browser={browser}
            browse={browse}
            activeTrack={activeTrack}
            onPressItem={pressItem}
            onGoUp={goUp}
            onPlayPause={togglePlayPause}
            onPrevTrack={skipToPrevious}
            onNextTrack={skipToNext}
            onSeekBack={() => seekBy(-SEEK_STEP_SECONDS)}
            onSeekForward={() => seekBy(SEEK_STEP_SECONDS)}
            onPrevFolder={() => playFolderOffset(-1)}
            onNextFolder={() => playFolderOffset(1)}
            onVolumeDown={UsbAudio.volumeDown}
            onVolumeUp={UsbAudio.volumeUp}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

interface PlayerScreenProps {
  groups: FolderGroup[];
  browser: FolderBrowser | null;
  browse: BrowseState;
  activeTrack?: QueueTrack;
  onPressItem: (index: number) => void;
  onGoUp: () => void;
  onPlayPause: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onSeekBack: () => void;
  onSeekForward: () => void;
  onPrevFolder: () => void;
  onNextFolder: () => void;
  onVolumeDown: () => void;
  onVolumeUp: () => void;
}

function PlayerScreen({
  groups,
  browser,
  browse,
  activeTrack,
  onPressItem,
  onGoUp,
  ...controls
}: PlayerScreenProps) {
  const {width, height} = useWindowDimensions();
  const landscape = width > height;
  const playback = usePlaybackState();
  const playing = isPlayingState(playback.state);

  const items = useMemo(
    () => (browser ? browser.items(browse) : []),
    [browser, browse],
  );
  const folderTrackCount =
    activeTrack != null
      ? groups[activeTrack.folderIndex]?.tracks.length ?? 0
      : 0;

  const nowPlaying = (
    <NowPlaying
      track={activeTrack}
      playing={playing}
      folderTrackCount={folderTrackCount}
      landscape={landscape}
      scrubber={playbackScrubber}
    />
  );
  const controlButtons = (
    <Controls
      playing={playing}
      onPlayPause={controls.onPlayPause}
      onPrevTrack={controls.onPrevTrack}
      onNextTrack={controls.onNextTrack}
      onSeekBack={controls.onSeekBack}
      onSeekForward={controls.onSeekForward}
      onPrevFolder={controls.onPrevFolder}
      onNextFolder={controls.onNextFolder}
      onVolumeDown={controls.onVolumeDown}
      onVolumeUp={controls.onVolumeUp}
    />
  );
  const list = (
    <FolderList
      title={browser?.folderOf(browse).label ?? ''}
      items={items}
      selectedIndex={browse.cursor}
      activeTrackPath={
        typeof activeTrack?.id === 'string' ? activeTrack.id : undefined
      }
      canGoUp={browser?.canGoUp(browse) ?? false}
      onPressItem={onPressItem}
      onGoUp={onGoUp}
    />
  );

  if (landscape) {
    return (
      <View style={styles.rowLayout}>
        <View style={styles.leftPane}>
          {nowPlaying}
          <View style={styles.spacer} />
          {controlButtons}
        </View>
        <View style={styles.rightPane}>{list}</View>
      </View>
    );
  }
  return (
    <View style={styles.colLayout}>
      {nowPlaying}
      {controlButtons}
      <View style={styles.listPane}>{list}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  colLayout: {
    flex: 1,
  },
  rowLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPane: {
    flex: 1.1,
    justifyContent: 'flex-start',
  },
  rightPane: {
    flex: 1,
  },
  listPane: {
    flex: 1,
  },
  spacer: {
    flex: 1,
  },
});
