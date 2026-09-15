import React from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {colors, fonts} from '../theme';

export type StatusKind =
  | 'sin-permiso'
  | 'esperando-usb'
  | 'escaneando'
  | 'sin-musica'
  | 'no-android';

interface Props {
  kind: StatusKind;
  volumeDescription?: string;
  onRequestPermission?: () => void;
}

const CONTENT: Record<StatusKind, {icon: string; title: string; hint: string}> = {
  'sin-permiso': {
    icon: '🔓',
    title: 'Falta el permiso de archivos',
    hint: 'La app necesita leer el pendrive. Toca el botón y activa el acceso para "Música USB".',
  },
  'esperando-usb': {
    icon: '🔌',
    title: 'Conecta un pendrive',
    hint: 'Enchufa el pendrive al celular con un adaptador OTG. La música empieza sola.',
  },
  escaneando: {
    icon: '🔎',
    title: 'Leyendo el pendrive…',
    hint: 'Buscando música en la raíz y en las carpetas, en orden alfabético.',
  },
  'sin-musica': {
    icon: '🎵',
    title: 'El pendrive no tiene música',
    hint: 'No se encontraron archivos de audio (mp3, m4a, flac, wav, ogg, aac…).',
  },
  'no-android': {
    icon: '📵',
    title: 'Solo disponible en Android',
    hint: 'La lectura de pendrives por USB OTG solo está soportada en Android.',
  },
};

export default function StatusScreen({
  kind,
  volumeDescription,
  onRequestPermission,
}: Props) {
  const content = CONTENT[kind];
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{content.icon}</Text>
      <Text style={styles.title} adjustsFontSizeToFit numberOfLines={3}>
        {content.title}
      </Text>
      {kind === 'escaneando' && (
        <>
          {volumeDescription ? (
            <Text style={styles.volume}>{volumeDescription}</Text>
          ) : null}
          <ActivityIndicator
            size="large"
            color={colors.accent}
            style={styles.spinner}
          />
        </>
      )}
      <Text style={styles.hint}>{content.hint}</Text>
      {kind === 'sin-permiso' && onRequestPermission && (
        <Pressable
          onPress={onRequestPermission}
          android_ripple={{color: '#00000033'}}
          style={({pressed}) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>CONCEDER PERMISO</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  icon: {
    fontSize: 72,
  },
  title: {
    color: colors.text,
    fontSize: fonts.giant - 8,
    lineHeight: (fonts.giant - 8) * 1.15,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 16,
  },
  volume: {
    color: colors.accent,
    fontSize: fonts.medium,
    fontWeight: '700',
    marginTop: 10,
  },
  spinner: {
    marginTop: 16,
  },
  hint: {
    color: colors.dim,
    fontSize: fonts.medium,
    lineHeight: fonts.medium * 1.35,
    textAlign: 'center',
    marginTop: 14,
  },
  button: {
    marginTop: 26,
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 30,
  },
  pressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.accentText,
    fontSize: fonts.big,
    fontWeight: '800',
  },
});
