import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {colors, fonts} from '../theme';

interface Props {
  onAllow: () => void;
}

/**
 * Aviso para dar, una sola vez, el permiso que deja que la app se abra sola al
 * conectar el pendrive (sin que Android pregunte "¿Abrir con…?").
 */
export default function AutoOpenBanner({onAllow}: Props) {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        🔌 Para que la app se abra sola al conectar el pendrive, permite
        «Mostrar sobre otras apps».
      </Text>
      <Pressable
        onPress={onAllow}
        android_ripple={{color: '#00000033'}}
        style={({pressed}) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>PERMITIR</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.panelSoft,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  text: {
    flex: 1,
    color: colors.text,
    fontSize: fonts.small,
  },
  button: {
    marginLeft: 12,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.accentText,
    fontSize: fonts.small,
    fontWeight: '800',
  },
});
