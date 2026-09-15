import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {colors, fonts} from '../theme';

interface Props {
  playing: boolean;
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

function Button({
  label,
  onPress,
  primary,
  small,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  small?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{color: '#FFFFFF33'}}
      style={({pressed}) => [
        styles.button,
        primary && styles.primary,
        pressed && styles.pressed,
      ]}>
      <Text
        style={[
          styles.buttonText,
          primary && styles.primaryText,
          small && styles.buttonTextSmall,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit>
        {label}
      </Text>
    </Pressable>
  );
}

export default function Controls({
  playing,
  onPlayPause,
  onPrevTrack,
  onNextTrack,
  onSeekBack,
  onSeekForward,
  onPrevFolder,
  onNextFolder,
  onVolumeDown,
  onVolumeUp,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Button label="⏮" onPress={onPrevTrack} />
        <Button label="«10s" onPress={onSeekBack} small />
        <Button label={playing ? '⏸' : '▶'} onPress={onPlayPause} primary />
        <Button label="10s»" onPress={onSeekForward} small />
        <Button label="⏭" onPress={onNextTrack} />
      </View>
      <View style={styles.row}>
        <Button label="◀ Carpeta" onPress={onPrevFolder} small />
        <Button label="Carpeta ▶" onPress={onNextFolder} small />
        <Button label="Vol −" onPress={onVolumeDown} small />
        <Button label="Vol +" onPress={onVolumeUp} small />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 4,
  },
  row: {
    flexDirection: 'row',
    marginTop: 8,
  },
  button: {
    flex: 1,
    minHeight: 62,
    marginHorizontal: 4,
    borderRadius: 14,
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    flex: 1.4,
  },
  pressed: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.text,
    fontSize: fonts.big,
    fontWeight: '800',
  },
  buttonTextSmall: {
    fontSize: fonts.medium,
  },
  primaryText: {
    color: colors.accentText,
  },
});
