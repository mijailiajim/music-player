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
import {TrackPlayerSignalTranslator} from './src/adapters/TrackPlayerSignalTranslator';
import {UsbMonitor} from './src/adapters/UsbMonitor';
import Controls from './src/components/Controls';
import FolderList from './src/components/FolderList';
import NowPlaying from './src/components/NowPlaying';
import SignalBar from './src/components/SignalBar';
import StatusScreen, {StatusKind} from './src/components/StatusScreen';
import {Selection} from './src/core/model';
import {RemoteActions} from './src/core/remote/RemoteActions';
import {RemoteControlRouter} from './src/core/remote/RemoteControlRouter';
import {SelectionModel} from './src/core/selection/SelectionModel';
import {KeyNameResolver} from './src/core/signals/KeyNameResolver';
import {SignalFactory} from './src/core/signals/SignalFactory';
import {SignalFeed} from './src/core/signals/SignalFeed';
import {RemovableVolumeSelector} from './src/core/usb/RemovableVolumeSelector';
import {RemoteKeyEvent} from './src/keymap';
import {FolderGroup, scanVolume, totalTracks} from './src/library';
import {MusicVolumeEvent, UsbAudio} from './src/native/UsbAudio';
import {
  clearQueue,
  isPlayingState,
  loadQueue,
  pause,
  play,
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

/** La selección vuelve a seguir al tema sonando tras esta pausa sin navegar. */
const NAV_IDLE_MS = 15000;
const POLL_INTERVAL_MS = 4000;
/** El montaje del volumen tarda unos segundos tras enchufar el pendrive. */
const USB_DEBOUNCE_MS = 900;

export default function App() {
  const [hasPermission, setHasPermission] = useState(false);
  const [status, setStatus] = useState<UsbStatus>('esperando-usb');
  const [groups, setGroups] = useState<FolderGroup[]>([]);
  const [volumeDesc, setVolumeDesc] = useState('');
  const [selection, setSelection] = useState<Selection>({
    folder: 0,
    track: 0,
  });
  const [activeTrack, setActiveTrack] = useState<QueueTrack | undefined>();

  // Colaboradores del núcleo (sin estado propio: seguros de compartir).
  const selectionModel = useMemo(() => new SelectionModel(), []);
  const volumeSelector = useMemo(() => new RemovableVolumeSelector(), []);

  // Línea de señales: lo que llega al apretar cada botón del control. Solo se
  // muestra; no cambia lo que hace la app.
  const signalFeed = useMemo(() => new SignalFeed(), []);
  const signalFactory = useMemo(
    () => new SignalFactory(new KeyNameResolver()),
    [],
  );
  const playerSignals = useMemo(
    () => new TrackPlayerSignalTranslator(signalFactory),
    [signalFactory],
  );

  // Refs espejo para leer el estado vigente desde listeners estables.
  const groupsRef = useRef<FolderGroup[]>([]);
  const selectionRef = useRef<Selection>({folder: 0, track: 0});
  const activeTrackRef = useRef<QueueTrack | undefined>(undefined);
  const hasPermissionRef = useRef(false);
  const rootRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const lastNavRef = useRef(0);

  const updateSelection = useCallback((next: Selection) => {
    lastNavRef.current = Date.now();
    selectionRef.current = next;
    setSelection(next);
  }, []);

  /** Implementación concreta de lo que puede pedir el control remoto. */
  const remoteActions = useMemo<RemoteActions>(
    () => ({
      moveCursor: delta => {
        const gs = groupsRef.current;
        if (gs.length > 0) {
          updateSelection(
            selectionModel.moveTrack(selectionRef.current, delta, gs),
          );
        }
      },
      moveFolder: delta => {
        const gs = groupsRef.current;
        if (gs.length > 0) {
          updateSelection(
            selectionModel.moveFolder(selectionRef.current, delta, gs),
          );
        }
      },
      playFolderOffset: delta => {
        const gs = groupsRef.current;
        if (gs.length > 0) {
          const from =
            activeTrackRef.current?.folderIndex ?? selectionRef.current.folder;
          playTrackAt(selectionModel.folderOffsetStartIndex(from, delta, gs));
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
    [selectionModel, updateSelection],
  );

  const remoteRouter = useMemo(
    () => new RemoteControlRouter(remoteActions),
    [remoteActions],
  );

  /** Tocar una pista en pantalla: la selecciona y la reproduce. */
  const selectTrackInFolder = useCallback(
    (folder: number, indexInFolder: number) => {
      const gs = groupsRef.current;
      if (gs.length === 0) {
        return;
      }
      const next = {folder, track: indexInFolder};
      updateSelection(next);
      playTrackAt(selectionModel.globalIndexOf(next, gs));
    },
    [selectionModel, updateSelection],
  );

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
      const found = await scanVolume(usb.path, UsbAudio.listDir);
      if (rootRef.current !== usb.path) {
        return; // lo desconectaron durante el escaneo
      }
      groupsRef.current = found;
      setGroups(found);
      if (totalTracks(found) === 0) {
        setStatus('sin-musica');
        await clearQueue();
      } else {
        selectionRef.current = {folder: 0, track: 0};
        setSelection({folder: 0, track: 0});
        setStatus('reproduciendo');
        await loadQueue(found, true);
      }
    } catch {
    } finally {
      busyRef.current = false;
    }
  }, [volumeSelector]);

  const recheckPermission = useCallback(async () => {
    const granted = await UsbAudio.hasStorageAccess();
    hasPermissionRef.current = granted;
    setHasPermission(granted);
    if (granted) {
      refreshVolumes();
    }
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

  useTrackPlayerEvents(
    [Event.PlaybackActiveTrackChanged, ...playerSignals.events],
    event => {
      // Estado del reproductor y comandos de la sesión de medios: solo se
      // muestran en la línea de señales.
      const signal = playerSignals.translate(event);
      if (signal != null) {
        signalFeed.record(signal);
        return;
      }
      if (event.type !== Event.PlaybackActiveTrackChanged) {
        return;
      }
      const track = event.track as QueueTrack | undefined;
      activeTrackRef.current = track;
      setActiveTrack(track);
      if (track != null && Date.now() - lastNavRef.current > NAV_IDLE_MS) {
        const next = selectionModel.fromActiveTrack(
          track.folderIndex ?? 0,
          track.indexInFolder ?? 0,
        );
        selectionRef.current = next;
        setSelection(next);
      }
    },
  );

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
        signalFeed.record(
          signalFactory.key(event.keyCode, event.repeatCount, event.keyName),
        );
        remoteRouter.handle(event.keyCode);
      },
    );
    const volumeSub = DeviceEventEmitter.addListener(
      'musicVolumeChanged',
      (event: MusicVolumeEvent) =>
        signalFeed.record(signalFactory.volume(event.volume, event.max)),
    );
    const appSub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        recheckPermission();
      }
    });

    return () => {
      cancelled = true;
      stopUsbMonitor();
      keySub.remove();
      volumeSub.remove();
      appSub.remove();
    };
  }, [
    recheckPermission,
    refreshVolumes,
    remoteRouter,
    signalFactory,
    signalFeed,
  ]);

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
        {statusKind != null ? (
          <StatusScreen
            kind={statusKind}
            volumeDescription={volumeDesc}
            onRequestPermission={requestPermission}
          />
        ) : (
          <PlayerScreen
            groups={groups}
            selection={selection}
            activeTrack={activeTrack}
            onSelectTrack={selectTrackInFolder}
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
        <SignalBar feed={signalFeed} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

interface PlayerScreenProps {
  groups: FolderGroup[];
  selection: Selection;
  activeTrack?: QueueTrack;
  onSelectTrack: (folder: number, indexInFolder: number) => void;
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
  selection,
  activeTrack,
  onSelectTrack,
  ...controls
}: PlayerScreenProps) {
  const {width, height} = useWindowDimensions();
  const landscape = width > height;
  const playback = usePlaybackState();
  const playing = isPlayingState(playback.state);

  const folderIndex = Math.min(selection.folder, groups.length - 1);
  const group = groups[folderIndex];
  const activeTrackIndex =
    activeTrack != null && activeTrack.folderIndex === folderIndex
      ? activeTrack.indexInFolder
      : -1;
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
      group={group}
      folderNumber={folderIndex + 1}
      folderCount={groups.length}
      selectedTrack={selection.track}
      activeTrackIndex={activeTrackIndex}
      onSelectTrack={index => onSelectTrack(folderIndex, index)}
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
