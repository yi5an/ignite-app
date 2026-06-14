import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Svg, Path } from 'react-native-svg';
import { colors, fonts } from '../constants/theme';

type ModeNavKey = 'today' | 'all' | 'focus' | 'achievements' | 'settings' | 'new';

interface ModeNavBarProps {
  active: ModeNavKey;
}

const ICON_PATHS: Record<ModeNavKey, string> = {
  today: 'M3 5v12a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2zm4 0V3m6 2V3m-9 5h12',
  all: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm6 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm6 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z',
  focus: 'M12 2a5 5 0 015 5c0 5-5 11-5 11S7 12 7 7a5 5 0 015-5zm0 7a2 2 0 100-4 2 2 0 000 4z',
  achievements: 'M8 2l1.5 3.5L13 7l-3.5 1.5L8 12l-1.5-3.5L3 7l3.5-1.5L8 2zM3 17h14M5 17v-1a4 4 0 018 0v1',
  settings: 'M12 11a3 3 0 100-6 3 3 0 000 6zm-6 7a6 6 0 0112 0H6z',
  new: 'M12 5v14M5 12h14',
};

function NavIcon({ name, active }: { name: ModeNavKey; active: boolean }) {
  return (
    <View style={[styles.iconBox, active && styles.iconBoxActive]}>
      <Svg
        width={12}
        height={12}
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? '#FFFFFF' : colors.text3}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d={ICON_PATHS[name]} />
      </Svg>
    </View>
  );
}

export default function ModeNavBar({ active }: ModeNavBarProps) {
  const router = useRouter();
  const items: { key: ModeNavKey; label: string; href?: string }[] =
    active === 'new'
      ? [
          { key: 'today', label: '今天', href: '/' },
          { key: 'focus', label: '专注', href: '/focus' },
          { key: 'achievements', label: '成就', href: '/achievements' },
          { key: 'new', label: '新建' },
        ]
      : [
          { key: 'today', label: '今天', href: '/' },
          { key: 'focus', label: '专注' },
          { key: 'achievements', label: '成就', href: '/achievements' },
          { key: 'settings', label: '我的', href: '/settings' },
        ];

  return (
    <View style={styles.container}>
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <Pressable
            key={item.key}
            style={styles.item}
            onPress={() => {
              if (item.href && !isActive) router.push(item.href as never);
            }}
          >
            <NavIcon name={item.key} active={isActive} />
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    paddingBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  item: {
    alignItems: 'center',
    gap: 4,
    minWidth: 44,
  },
  iconBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxActive: {
    backgroundColor: colors.blue,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.text3,
    lineHeight: 12,
  },
  labelActive: {
    color: colors.blue,
  },
});
