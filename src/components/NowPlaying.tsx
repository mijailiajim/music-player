import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useProgress} from 'react-native-track-player';
import {formatTime, QueueTrack} from '../player';
import {colors, fonts} from '../theme';

interface Props {
  track?: QueueTrack;
  playing: boolean;
  folderTrackCount: number;
  landscape: boolean;
}

export default function NowPlaying({
  track,
  playing,
  folderTrackCount,
  landscape,
}: Props) {
  const {position, duration} = useProgress(500);
  const pct =
    duration > 0 ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0;

  return (
    <View style={styles.container}>
      <Text style={[styles.status, playing ? styles.playing : styles.paused]}>
        {playing ? '▶ REPRODUCIENDO' : '⏸ EN PAUSA'}
      </Text>
      <Text
        style={[styles.title, landscape && styles.titleLandscape]}
        numberOfLines={landscape ? 3 : 4}
        adjustsFontSizeToFit
        minimumFontScale={0.45}>
        {track?.title ?? '—'}
      </Text>
      <Text style={styles.folder} numberOfLines={1}>
        📁 {track?.artist ?? ''}
      </Text>
      {track != null && folderTrackCount > 0 && (
        <Text style={styles.counter}>
          Pista {track.indexInFolder + 1} de {folderTrackCount} de la carpeta
        </Text>
      )}
      <View style={styles.progressRow}>
        <Text style={styles.time}>{formatTime(position)}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, {width: `${pct}%`}]} />
        </View>
        <Text style={styles.time}>{formatTime(duration)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  status: {
    fontSize: fonts.medium,
    fontWeight: '800',
    letterSpacing: 1,
  },
  playing: {
    color: colors.playing,
  },
  paused: {
    color: colors.accent,
  },
  title: {
    color: colors.text,
    fontSize: fonts.giant,
    lineHeight: fonts.giant * 1.12,
    fontWeight: '800',
    marginTop: 6,
  },
  titleLandscape: {
    fontSize: 44,
    lineHeight: 50,
  },
  folder: {
    color: colors.accent,
    fontSize: fonts.medium,
    fontWeight: '700',
    marginTop: 8,
  },
  counter: {
    color: colors.dim,
    fontSize: fonts.small,
    marginTop: 4,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  progressTrack: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.panelSoft,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
  time: {
    color: colors.text,
    fontSize: fonts.small + 2,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
});
