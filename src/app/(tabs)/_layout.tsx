import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Platform, StyleSheet } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useData } from '@/data/store';
import { color, font } from '@/theme/tokens';

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Əsas', icon: 'home' },
  { name: 'chat', title: 'Gələcək Sən', icon: 'chat' },
  { name: 'letters', title: 'Məktublar', icon: 'letters' },
  { name: 'habits', title: 'Vərdişlər', icon: 'habits' },
  { name: 'profile', title: 'Profil', icon: 'profile' },
];

export default function TabLayout() {
  const { data } = useData();
  if (!data.preferences.onboarded) return <Redirect href="/onboarding" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.accent,
        tabBarInactiveTintColor: color.textFaint,
        tabBarHideOnKeyboard: Platform.OS === 'android',
        tabBarStyle: styles.bar,
        tabBarLabelStyle: styles.label,
        sceneStyle: { backgroundColor: color.bg },
      }}>
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color: tint, size }) => <Icon name={t.icon} size={size - 2} tint={tint} />,
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: color.bg,
    borderTopColor: color.line,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  label: { fontFamily: font.bodyMedium, fontSize: 12 },
});
