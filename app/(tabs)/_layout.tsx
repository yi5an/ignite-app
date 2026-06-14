import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Svg, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Tab Config ──────────────────────────────────────────────────
const TABS = [
  {
    name: 'index' as const,
    label: '今天',
    // Sun/calendar icon (方形色块风格)
    iconPath: 'M3 5v12a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2zm4 0V3m6 2V3m-9 5h12',
  },
  {
    name: 'focus' as const,
    label: '专注',
    // Pin/focus icon
    iconPath: 'M12 2a5 5 0 015 5c0 5-5 11-5 11S7 12 7 7a5 5 0 015-5zm0 7a2 2 0 100-4 2 2 0 000 4z',
  },
  {
    name: 'achievements' as const,
    label: '成就',
    // Trophy/star icon
    iconPath: 'M8 2l1.5 3.5L13 7l-3.5 1.5L8 12l-1.5-3.5L3 7l3.5-1.5L8 2zM3 17h14M5 17v-1a4 4 0 018 0v1',
  },
  {
    name: 'settings' as const,
    label: '我的',
    // User/gear icon
    iconPath: 'M12 11a3 3 0 100-6 3 3 0 000 6zm-6 7a6 6 0 0112 0H6z',
  },
];

// ─── Nav Icon Component ─────────────────────────────────────────
function NavIcon({ d, isActive }: { d: string; isActive: boolean }) {
  return (
    <View style={[styles.navIcon, isActive && styles.navIconActive]}>
      <Svg
        width={12}
        height={12}
        viewBox="0 0 20 20"
        fill="none"
        stroke={isActive ? '#FFFFFF' : '#55556A'}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d={d} />
      </Svg>
    </View>
  );
}

// ─── Tab Layout ──────────────────────────────────────────────────
export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: [
          styles.tabBar,
          { paddingBottom: insets.bottom || (Platform.OS === 'android' ? 16 : 0) },
        ],
        tabBarBackground: () => null,
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            tabBarIcon: ({ focused }) => (
              <View style={styles.navItem} pointerEvents="none">
                <NavIcon d={tab.iconPath} isActive={focused} />
                <Text
                  style={[
                    styles.navLabel,
                    focused && styles.navLabelActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </View>
            ),
          }}
        />
      ))}
      <Tabs.Screen name="all" options={{ href: null }} />
    </Tabs>
  );
}

// ─── Styles (matching prototype .phone-nav exactly) ─────────────
const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#0A0A0F',
    borderTopColor: '#2A2A38',
    borderTopWidth: 1,
    paddingTop: 12,
    paddingBottom: 0,
    height: 68,
    position: 'absolute' as const,
  },
  navItem: {
    alignItems: 'center',
    gap: 4,
  },
  navIcon: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: '#2A2A38',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconActive: {
    backgroundColor: '#4F8EF7',
  },
  navLabel: {
    fontFamily: 'DM Mono',
    fontSize: 9,
    color: '#55556A',
    lineHeight: 12,
  },
  navLabelActive: {
    color: '#4F8EF7',
  },
});
