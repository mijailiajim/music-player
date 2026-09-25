import React, {useSyncExternalStore} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {SignalFeed} from '../core/signals/SignalFeed';
import {colors, fonts} from '../theme';

interface Props {
  feed: SignalFeed;
}

/**
 * Línea inferior con las señales que llegan al apretar un botón del control
 * (p. ej. "buffering → ready → playing"). Si no entran, se recorta el
 * principio: lo último que llegó siempre queda a la vista.
 */
export default function SignalBar({feed}: Props) {
  const last = useSyncExternalStore(feed.subscribe, feed.getSnapshot);
  return (
    <View style={styles.bar}>
      <Text style={styles.label}>Señales:</Text>
      <Text
        style={[styles.signals, last == null && styles.waiting]}
        numberOfLines={1}
        ellipsizeMode="head">
        {last?.text ?? 'presiona un botón del control'}
      </Text>
      {last != null && <Text style={styles.time}>{clock(last.at)}</Text>}
    </View>
  );
}

function clock(at: number): string {
  const d = new Date(at);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.panel,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  label: {
    color: colors.dim,
    fontSize: fonts.small,
    fontWeight: '700',
    marginRight: 10,
  },
  signals: {
    flex: 1,
    color: colors.accent,
    fontSize: fonts.medium,
    fontWeight: '800',
  },
  waiting: {
    color: colors.dim,
    fontWeight: '400',
  },
  time: {
    color: colors.dim,
    fontSize: fonts.small,
    marginLeft: 10,
    fontVariant: ['tabular-nums'],
  },
});
