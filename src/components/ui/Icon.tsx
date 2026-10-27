import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

import { color } from '@/theme/tokens';

/** Semantic icon names mapped to SF Symbols (iOS) and Material Symbols (Android, web). */
const ICONS = {
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  chat: { ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' },
  letters: { ios: 'envelope.fill', android: 'mail', web: 'mail' },
  habits: { ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' },
  profile: { ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  send: { ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' },
  lock: { ios: 'lock.fill', android: 'lock', web: 'lock' },
  flame: { ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' },
  timer: { ios: 'timer', android: 'timer', web: 'timer' },
  gavel: { ios: 'building.columns.fill', android: 'gavel', web: 'gavel' },
  trophy: { ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' },
  share: { ios: 'square.and.arrow.up', android: 'share', web: 'share' },
  bell: { ios: 'bell.fill', android: 'notifications', web: 'notifications' },
  globe: { ios: 'globe', android: 'language', web: 'language' },
  clock: { ios: 'clock.fill', android: 'schedule', web: 'schedule' },
  shield: { ios: 'hand.raised.fill', android: 'shield', web: 'shield' },
  download: { ios: 'square.and.arrow.down', android: 'download', web: 'download' },
  trash: { ios: 'trash', android: 'delete', web: 'delete' },
  sparkle: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  refresh: { ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' },
  play: { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' },
  pause: { ios: 'pause.fill', android: 'pause', web: 'pause' },
  key: { ios: 'person.badge.key.fill', android: 'login', web: 'login' },
  info: { ios: 'info.circle', android: 'info', web: 'info' },
} satisfies Record<string, Extract<SymbolViewProps['name'], object>>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 20,
  tint = color.text,
  style,
}: {
  name: IconName;
  size?: number;
  tint?: ColorValue;
  style?: StyleProp<ViewStyle>;
}) {
  return <SymbolView name={ICONS[name]} size={size} tintColor={tint} style={style} />;
}
