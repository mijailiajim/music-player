import React, {useCallback, useEffect, useRef} from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import type {FolderGroup, TrackInfo} from '../library';
import {colors, fonts} from '../theme';

const ITEM_HEIGHT = 72;

interface Props {
  group?: FolderGroup;
  folderNumber: number;
  folderCount: number;
  /** Índice (dentro de la carpeta) resaltado por la navegación del remoto. */
  selectedTrack: number;
  /** Índice del tema sonando si pertenece a esta carpeta; -1 si no. */
  activeTrackIndex: number;
  onSelectTrack: (indexInFolder: number) => void;
}

export default function FolderList({
  group,
  folderNumber,
  folderCount,
  selectedTrack,
  activeTrackIndex,
  onSelectTrack,
}: Props) {
  const listRef = useRef<FlatList<TrackInfo>>(null);

  const focusIndex = selectedTrack >= 0 ? selectedTrack : activeTrackIndex;
  useEffect(() => {
    if (!group || focusIndex < 0 || focusIndex >= group.tracks.length) {
      return;
    }
    const timer = setTimeout(() => {
      try {
        listRef.current?.scrollToIndex({
          index: focusIndex,
          viewPosition: 0.35,
          animated: true,
        });
      } catch {}
    }, 50);
    return () => clearTimeout(timer);
  }, [group, focusIndex]);

  const renderItem = useCallback(
    ({item, index}: {item: TrackInfo; index: number}) => {
      const isActive = index === activeTrackIndex;
      const isSelected = index === selectedTrack;
      const isPast = activeTrackIndex >= 0 && index < activeTrackIndex;
      return (
        <Pressable
          onPress={() => onSelectTrack(index)}
          android_ripple={{color: '#FFFFFF22'}}
          style={[
            styles.item,
            isSelected && styles.itemSelected,
            isActive && styles.itemActive,
          ]}>
          <Text style={[styles.itemNumber, isActive && styles.itemNumberActive]}>
            {isActive ? '▶' : index + 1}
          </Text>
          <Text
            style={[
              styles.itemTitle,
              isActive && styles.itemTitleActive,
              isPast && styles.itemTitlePast,
            ]}
            numberOfLines={1}>
            {item.title}
          </Text>
        </Pressable>
      );
    },
    [activeTrackIndex, selectedTrack, onSelectTrack],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          📁 {group?.name ?? ''}
        </Text>
        <Text style={styles.headerSub}>
          Carpeta {folderNumber} de {folderCount} · A continuación, en orden:
        </Text>
      </View>
      <FlatList
        ref={listRef}
        data={group?.tracks ?? []}
        keyExtractor={item => item.path}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        onScrollToIndexFailed={info => {
          listRef.current?.scrollToOffset({
            offset: info.index * ITEM_HEIGHT,
            animated: false,
          });
        }}
        initialNumToRender={14}
        windowSize={7}
        showsVerticalScrollIndicator
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.panel,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: 18,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelSoft,
  },
  headerTitle: {
    color: colors.accent,
    fontSize: fonts.title - 6,
    fontWeight: '800',
  },
  headerSub: {
    color: colors.dim,
    fontSize: fonts.small,
    marginTop: 2,
  },
  item: {
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  itemSelected: {
    backgroundColor: '#2E2A1B',
    borderColor: colors.accent,
    borderWidth: 2,
    borderRadius: 10,
  },
  itemActive: {
    backgroundColor: '#12351D',
  },
  itemNumber: {
    width: 52,
    color: colors.dim,
    fontSize: fonts.medium,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  itemNumberActive: {
    color: colors.playing,
    fontSize: fonts.big,
  },
  itemTitle: {
    flex: 1,
    color: colors.text,
    fontSize: fonts.big,
    fontWeight: '600',
  },
  itemTitleActive: {
    color: colors.playing,
    fontWeight: '800',
  },
  itemTitlePast: {
    color: colors.dim,
  },
});
