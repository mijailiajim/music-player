import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import type {BrowserItem} from '../core/browser/FolderBrowser';
import {colors, fonts} from '../theme';

const ITEM_HEIGHT = 72;

interface Props {
  /** Carpeta abierta ("Raíz del pendrive", "Musica", "A / A-sub"…). */
  title: string;
  /** Subcarpetas (todas) y canciones reproducibles de la carpeta abierta. */
  items: BrowserItem[];
  /** Ítem resaltado por la navegación del control. */
  selectedIndex: number;
  /** Ruta de la canción que está sonando (se marca con ▶). */
  activeTrackPath?: string;
  /** Hay una carpeta arriba: se muestra el botón para subir. */
  canGoUp: boolean;
  /** Tocar un ítem: una carpeta se abre, una canción se reproduce. */
  onPressItem: (index: number) => void;
  onGoUp: () => void;
}

function keyOf(item: BrowserItem): string {
  return item.kind === 'folder' ? item.folder.path : item.track.path;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export default function FolderList({
  title,
  items,
  selectedIndex,
  activeTrackPath,
  canGoUp,
  onPressItem,
  onGoUp,
}: Props) {
  const listRef = useRef<FlatList<BrowserItem>>(null);

  const folderCount = useMemo(
    () => items.filter(item => item.kind === 'folder').length,
    [items],
  );
  const trackCount = items.length - folderCount;
  const activeIndex = useMemo(
    () =>
      items.findIndex(
        item => item.kind === 'track' && item.track.path === activeTrackPath,
      ),
    [items, activeTrackPath],
  );

  const focusIndex = selectedIndex >= 0 ? selectedIndex : activeIndex;
  useEffect(() => {
    if (focusIndex < 0 || focusIndex >= items.length) {
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
  }, [items, focusIndex]);

  const renderItem = useCallback(
    ({item, index}: {item: BrowserItem; index: number}) => {
      const isSelected = index === selectedIndex;
      if (item.kind === 'folder') {
        const songs = item.folder.trackCount;
        return (
          <Pressable
            onPress={() => onPressItem(index)}
            android_ripple={{color: '#FFFFFF22'}}
            style={[styles.item, isSelected && styles.itemSelected]}>
            <Text style={styles.itemIcon}>📁</Text>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {item.folder.name}
            </Text>
            <Text style={[styles.itemCount, songs === 0 && styles.itemEmpty]}>
              {songs > 0 ? `${songs} ♪` : 'sin música'}
            </Text>
          </Pressable>
        );
      }
      const isActive = index === activeIndex;
      const isPast = activeIndex >= 0 && index < activeIndex;
      return (
        <Pressable
          onPress={() => onPressItem(index)}
          android_ripple={{color: '#FFFFFF22'}}
          style={[
            styles.item,
            isSelected && styles.itemSelected,
            isActive && styles.itemActive,
          ]}>
          <Text
            style={[styles.itemNumber, isActive && styles.itemNumberActive]}>
            {isActive ? '▶' : index - folderCount + 1}
          </Text>
          <Text
            style={[
              styles.itemTitle,
              isActive && styles.itemTitleActive,
              isPast && styles.itemTitlePast,
            ]}
            numberOfLines={1}>
            {item.track.title}
          </Text>
        </Pressable>
      );
    },
    [activeIndex, folderCount, selectedIndex, onPressItem],
  );

  const summary = [
    folderCount > 0 ? plural(folderCount, 'carpeta', 'carpetas') : null,
    trackCount > 0 ? plural(trackCount, 'canción', 'canciones') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            📁 {title}
          </Text>
          {canGoUp && (
            <Pressable
              onPress={onGoUp}
              android_ripple={{color: '#FFFFFF22'}}
              style={({pressed}) => [
                styles.upButton,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.upButtonText}>⬆ Subir</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.headerSub} numberOfLines={1}>
          {summary || 'Sin música'} · Av Pág entra · Re Pág sube
        </Text>
      </View>
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={keyOf}
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
        ListEmptyComponent={
          <Text style={styles.empty}>Esta carpeta no tiene música.</Text>
        }
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    color: colors.accent,
    fontSize: fonts.title - 6,
    fontWeight: '800',
  },
  headerSub: {
    color: colors.dim,
    fontSize: fonts.small,
    marginTop: 2,
  },
  upButton: {
    marginLeft: 10,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  upButtonText: {
    color: colors.accent,
    fontSize: fonts.small + 2,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.6,
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
  itemIcon: {
    width: 52,
    fontSize: fonts.big,
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
  itemCount: {
    marginLeft: 10,
    color: colors.playing,
    fontSize: fonts.medium,
    fontWeight: '700',
  },
  itemEmpty: {
    color: colors.dim,
    fontWeight: '400',
  },
  empty: {
    color: colors.dim,
    fontSize: fonts.medium,
    textAlign: 'center',
    padding: 24,
  },
});
