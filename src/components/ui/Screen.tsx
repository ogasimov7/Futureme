import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, maxContentWidth, space } from '@/theme/tokens';

type ScreenProps = {
  children: ReactNode;
  /** Set false for screens that manage their own scrolling (e.g. chat). */
  scroll?: boolean;
  /** Top safe-area padding. Off for screens shown under a native header. */
  insetTop?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({ children, scroll = true, insetTop = true, onRefresh, refreshing = false, contentStyle }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const padTop = insetTop ? insets.top + space.lg : space.lg;

  if (!scroll) {
    return <View style={[styles.root, { paddingTop: padTop }, contentStyle]}>{children}</View>;
  }
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: padTop }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.accent} /> : undefined
      }>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  content: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xxxl * 2,
    gap: space.xl,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
});
