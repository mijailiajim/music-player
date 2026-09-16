import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AppState,
  DeviceEventEmitter,
  PermissionsAndroid,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import TrackPlayer, {
  Event,
  usePlaybackState,
  useTrackPlayerEvents,
} from 'react-native-track-player';
import Controls from './src/components/Controls';
import FolderList from './src/components/FolderList';
import NowPlaying from './src/components/NowPlaying';
import StatusScreen, {StatusKind} from './src/components/StatusScreen';
import {FolderGroup, scanVolume, totalTracks} from './src/library';
import {createRemoteKeyHandler} from './src/remote';
import {pickUsbVolume, UsbAudio} from './src/native/UsbAudio';
import {
  clearQueue,
  isPlayingState,
  loadQueue,
  playTrackAt,
  QueueTrack,
  reportPlayerError,
  seekBy,
  SEEK_STEP_SECONDS,
  setPlayerErrorListener,
  setupPlayerOnce,
  skipToNext,
  skipToPrevious,
  togglePlayPause,
} from './src/player';
import {colors, fonts} from './src/theme';

type UsbStatus = 'esperando-usb' | 'escaneando' | 'reproduciendo' | 'sin-musica';

interface Selection {
  folder: number;
  track: number;
}

const POLL_INTERVAL_MS = 4000;

export default function App() {
  const [hasPermission, setHasPermission] = useState(false);
  const [status, setStatus] = useState<UsbStatus>('esperando-usb');
  const [groups, setGroups] = useState<FolderGroup[]>([]);
  const [volumeDesc, setVolumeDesc] = useState('');
  const [selection, setSelection] = useState<Selection>({folder: 0, track: 0});
  const [activeTrack, setActiveTrack] = useState<QueueTrack | undefined>();
  const [playerError, setPlayerError] = useState<string | null>(null);

  // Refs espejo para leer el estado vigente desde listeners estables.
  const groupsRef = useRef<FolderGroup[]>([]);
  const selectionRef = useRef<Selection>({folder: 0, track: 0});
  const activeTrackRef = useRef<QueueTrack | undefined>(undefined);
  const hasPermissionRef = useRef(false);
  const rootRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateSelection = useCallback((next: Selection) => {
    selectionRef.current = next;
    setSelection(next);
  }, []);

  const moveSelection = useCallback(
    (delta: number) => {
      const gs = groupsRef.current;
      if (gs.length === 0) {
        return;
      }
      let {folder, track} = selectionRef.current;
      track += delta;
      if (track < 0) {
        folder = (folder - 1 + gs.length) % gs.length;
        track = gs[folder].tracks.length - 1;
      } else if (track >= gs[folder].tracks.length) {
        folder = (folder + 1) % gs.length;
        track = 0;
      }
      updateSelection({folder, track});
    },
    [updateSelection],
  );

  const moveSelectionFolder = useCallback(
    (delta: number) => {
      const gs = groupsRef.current;
      if (gs.length === 0) {
        return;
      }
      const folder =
        (selectionRef.current.folder + delta + gs.length) % gs.length;
      updateSelection({folder, track: 0});
    },
    [updateSelection],
  );

  const playSelection = useCallback(() => {
    const gs = groupsRef.current;
    if (gs.length === 0) {
      return;
    }
    const sel = selectionRef.current;
    const group = gs[Math.min(sel.folder, gs.length - 1)];
    const track = Math.max(0, Math.min(sel.track, group.tracks.length - 1));
    playTrackAt(group.startIndex + track);
  }, []);

  const playFolderOffset = useCallback(
    (delta: number) => {
      const gs = groupsRef.current;
      if (gs.length === 0) {
        return;
      }
      const current =
        activeTrackRef.current?.folderIndex ?? selectionRef.current.folder;
      const target = (current + delta + gs.length) % gs.length;
      updateSelection({folder: target, track: 0});
      playTrackAt(gs[target].startIndex);
    },
    [updateSelection],
  );

  const selectTrackInFolder = useCallback(
    (folder: number, indexInFolder: number) => {
      const gs = groupsRef.current;
      if (gs.length === 0) {
        return;
      }
      const group = gs[Math.min(folder, gs.length - 1)];
      updateSelection({folder, track: indexInFolder});
      playTrackAt(group.startIndex + indexInFolder);
    },
    [updateSelection],
  );

  const onRemoteKey = useMemo(
    () =>
      createRemoteKeyHandler(
        {
          moveSelection,
          moveFolder: moveSelectionFolder,
          playSelection,
          togglePlayPause: () => {
            togglePlayPause();
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
          playFolderOffset,
          play: () => {
            TrackPlayer.play();
          },
          pause: () => {
            TrackPlayer.pause();
          },
        },
        SEEK_STEP_SECONDS,
      ),
    [moveSelection, moveSelectionFolder, playSelection, playFolderOffset],
  );

  const refreshVolumes = useCallback(async () => {
    if (busyRef.current || !hasPermissionRef.current || !UsbAudio.isAvailable) {
      return;
    }
    busyRef.current = true;
    try {
      const volumes = await UsbAudio.getVolumes();
      const usb = pickUsbVolume(volumes);
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
        try {
          await loadQueue(found, true);
          setPlayerError(null);
        } catch (error) {
          reportPlayerError('No pude cargar la música en el reproductor', error);
        }
      }
    } catch (error) {
      reportPlayerError('Lectura del pendrive', error);
    } finally {
      busyRef.current = false;
    }
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    // El montaje del volumen tarda unos segundos tras enchufar el pendrive.
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      refreshVolumes();
    }, 900);
  }, [refreshVolumes]);

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

  const retryPlayback = useCallback(async () => {
    setPlayerError(null);
    const gs = groupsRef.current;
    if (gs.length === 0) {
      refreshVolumes();
      return;
    }
    try {
      await loadQueue(gs, true);
    } catch (error) {
      reportPlayerError('El reintento también falló', error);
    }
  }, [refreshVolumes]);

  useTrackPlayerEvents(
    [Event.PlaybackActiveTrackChanged, Event.PlaybackError],
    event => {
      if (event.type === Event.PlaybackError) {
        setPlayerError(
          `Error de reproducción (${event.code ?? 'sin código'}): ${
            event.message ?? 'desconocido'
          }`,
        );
        return;
      }
      if (event.type !== Event.PlaybackActiveTrackChanged) {
        return;
      }
      const track = event.track as QueueTrack | undefined;
      const previous = event.lastTrack as QueueTrack | undefined;
      activeTrackRef.current = track;
      setActiveTrack(track);
      // La selección solo acompaña a la reproducción cuando ya estaba sobre
      // la pista que sonaba (o sobre la nueva). Si el usuario la movió a otro
      // lado, se queda quieta: OK siempre reproduce lo que se ve resaltado.
      if (track != null) {
        const sel = selectionRef.current;
        const followedPrevious =
          previous == null ||
          (sel.folder === previous.folderIndex &&
            sel.track === previous.indexInFolder);
        const alreadyOnNew =
          sel.folder === track.folderIndex &&
          sel.track === track.indexInFolder;
        if (followedPrevious || alreadyOnNew) {
          const next = {
            folder: track.folderIndex ?? 0,
            track: track.indexInFolder ?? 0,
          };
          selectionRef.current = next;
          setSelection(next);
        }
      }
    },
  );

  useEffect(() => {
    let cancelled = false;
    setPlayerErrorListener(message => setPlayerError(message));
    (async () => {
      try {
        await setupPlayerOnce();
      } catch (error) {
        reportPlayerError('Inicio del reproductor', error);
      }
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

    const usbSub = DeviceEventEmitter.addListener(
      'usbStorageChanged',
      scheduleRefresh,
    );
    const keySub = DeviceEventEmitter.addListener('remoteKey', onRemoteKey);
    const appSub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        recheckPermission();
      }
    });
    // Red de seguridad por si algún broadcast no llega (varía según OEM).
    const poll = setInterval(refreshVolumes, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      setPlayerErrorListener(null);
      usbSub.remove();
      keySub.remove();
      appSub.remove();
      clearInterval(poll);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [onRemoteKey, recheckPermission, refreshVolumes, scheduleRefresh]);

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
        {playerError != null && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText} numberOfLines={5}>
              ⚠️ {playerError}
            </Text>
            <View style={styles.errorActions}>
              <Pressable
                onPress={retryPlayback}
                style={({pressed}) => [
                  styles.errorButton,
                  pressed && styles.errorButtonPressed,
                ]}>
                <Text style={styles.errorButtonText}>REINTENTAR</Text>
              </Pressable>
              <Pressable
                onPress={() => setPlayerError(null)}
                style={({pressed}) => [
                  styles.errorButton,
                  pressed && styles.errorButtonPressed,
                ]}>
                <Text style={styles.errorButtonText}>CERRAR</Text>
              </Pressable>
            </View>
          </View>
        )}
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

  const trackCount = groups.reduce((sum, g) => sum + g.tracks.length, 0);
  const diagnostics = (
    <Text style={styles.diagText} numberOfLines={1}>
      v1.1 · estado: {String(playback.state ?? 'sin iniciar')} · {trackCount}{' '}
      pistas · carpeta {folderIndex + 1}/{groups.length}
    </Text>
  );

  if (landscape) {
    return (
      <View style={styles.playerRoot}>
        <View style={styles.rowLayout}>
          <View style={styles.leftPane}>
            {nowPlaying}
            <View style={styles.spacer} />
            {controlButtons}
          </View>
          <View style={styles.rightPane}>{list}</View>
        </View>
        {diagnostics}
      </View>
    );
  }
  return (
    <View style={styles.playerRoot}>
      <View style={styles.colLayout}>
        {nowPlaying}
        {controlButtons}
        <View style={styles.listPane}>{list}</View>
      </View>
      {diagnostics}
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
  playerRoot: {
    flex: 1,
  },
  diagText: {
    color: colors.dim,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 3,
    backgroundColor: colors.bg,
  },
  errorBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 30,
    backgroundColor: '#4A1010',
    borderColor: '#FF6B6B',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    zIndex: 10,
    elevation: 8,
  },
  errorText: {
    color: '#FFD9D9',
    fontSize: fonts.small + 2,
    lineHeight: (fonts.small + 2) * 1.35,
    fontWeight: '600',
  },
  errorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  errorButton: {
    borderColor: '#FF6B6B',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginLeft: 10,
  },
  errorButtonPressed: {
    opacity: 0.6,
  },
  errorButtonText: {
    color: '#FFB4B4',
    fontSize: fonts.small,
    fontWeight: '800',
  },
});
