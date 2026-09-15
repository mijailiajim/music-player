import React, {useCallback, useEffect, useRef, useState} from 'react';
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
import TrackPlayer, {
  Event,
  usePlaybackState,
  useTrackPlayerEvents,
} from 'react-native-track-player';
import Controls from './src/components/Controls';
import FolderList from './src/components/FolderList';
import NowPlaying from './src/components/NowPlaying';
import StatusScreen, {StatusKind} from './src/components/StatusScreen';
import {KeyCodes, RemoteKeyEvent} from './src/keymap';
import {FolderGroup, scanVolume, totalTracks} from './src/library';
import {pickUsbVolume, UsbAudio} from './src/native/UsbAudio';
import {
  clearQueue,
  isPlayingState,
  loadQueue,
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

type UsbStatus = 'esperando-usb' | 'escaneando' | 'reproduciendo' | 'sin-musica';

interface Selection {
  folder: number;
  track: number;
}

/** La selección vuelve a seguir al tema sonando tras esta pausa sin navegar. */
const NAV_IDLE_MS = 15000;
const POLL_INTERVAL_MS = 4000;

export default function App() {
  const [hasPermission, setHasPermission] = useState(false);
  const [status, setStatus] = useState<UsbStatus>('esperando-usb');
  const [groups, setGroups] = useState<FolderGroup[]>([]);
  const [volumeDesc, setVolumeDesc] = useState('');
  const [selection, setSelection] = useState<Selection>({folder: 0, track: 0});
  const [activeTrack, setActiveTrack] = useState<QueueTrack | undefined>();

  // Refs espejo para leer el estado vigente desde listeners estables.
  const groupsRef = useRef<FolderGroup[]>([]);
  const selectionRef = useRef<Selection>({folder: 0, track: 0});
  const activeTrackRef = useRef<QueueTrack | undefined>(undefined);
  const hasPermissionRef = useRef(false);
  const rootRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const lastNavRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateSelection = useCallback((next: Selection) => {
    lastNavRef.current = Date.now();
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

  const playFolderOffset = useCallback((delta: number) => {
    const gs = groupsRef.current;
    if (gs.length === 0) {
      return;
    }
    const current =
      activeTrackRef.current?.folderIndex ?? selectionRef.current.folder;
    const target = (current + delta + gs.length) % gs.length;
    playTrackAt(gs[target].startIndex);
  }, []);

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

  const onRemoteKey = useCallback(
    (event: RemoteKeyEvent) => {
      switch (event.keyCode) {
        case KeyCodes.DPAD_UP:
          moveSelection(-1);
          break;
        case KeyCodes.DPAD_DOWN:
          moveSelection(1);
          break;
        case KeyCodes.DPAD_LEFT:
          moveSelectionFolder(-1);
          break;
        case KeyCodes.DPAD_RIGHT:
          moveSelectionFolder(1);
          break;
        case KeyCodes.DPAD_CENTER:
        case KeyCodes.ENTER:
        case KeyCodes.NUMPAD_ENTER:
        case KeyCodes.BUTTON_SELECT:
        case KeyCodes.BUTTON_A:
          playSelection();
          break;
        case KeyCodes.MEDIA_PLAY_PAUSE:
        case KeyCodes.HEADSETHOOK:
          togglePlayPause();
          break;
        case KeyCodes.MEDIA_PLAY:
          TrackPlayer.play();
          break;
        case KeyCodes.MEDIA_PAUSE:
        case KeyCodes.MEDIA_STOP:
          TrackPlayer.pause();
          break;
        case KeyCodes.MEDIA_NEXT:
          skipToNext();
          break;
        case KeyCodes.MEDIA_PREVIOUS:
          skipToPrevious();
          break;
        case KeyCodes.MEDIA_FAST_FORWARD:
          seekBy(SEEK_STEP_SECONDS);
          break;
        case KeyCodes.MEDIA_REWIND:
          seekBy(-SEEK_STEP_SECONDS);
          break;
        case KeyCodes.CHANNEL_UP:
        case KeyCodes.PAGE_DOWN:
          playFolderOffset(1);
          break;
        case KeyCodes.CHANNEL_DOWN:
        case KeyCodes.PAGE_UP:
          playFolderOffset(-1);
          break;
      }
    },
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
        await loadQueue(found, true);
      }
    } catch {
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

  useTrackPlayerEvents([Event.PlaybackActiveTrackChanged], event => {
    if (event.type !== Event.PlaybackActiveTrackChanged) {
      return;
    }
    const track = event.track as QueueTrack | undefined;
    activeTrackRef.current = track;
    setActiveTrack(track);
    if (track != null && Date.now() - lastNavRef.current > NAV_IDLE_MS) {
      const next = {
        folder: track.folderIndex ?? 0,
        track: track.indexInFolder ?? 0,
      };
      selectionRef.current = next;
      setSelection(next);
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
