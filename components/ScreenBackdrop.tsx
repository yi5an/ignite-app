import React from 'react';
import { StyleSheet } from 'react-native';
import { Svg, Defs, RadialGradient, Stop, Circle, Rect } from 'react-native-svg';
import { colors } from '../constants/theme';
import { useSvgId } from './useSvgId';

type BackdropVariant = 'home' | 'focus' | 'capture' | 'achievements' | 'settings';

interface ScreenBackdropProps {
  variant?: BackdropVariant;
}

const variantAccent: Record<BackdropVariant, string> = {
  home: colors.blue,
  focus: colors.blue,
  capture: colors.purple,
  achievements: colors.amber,
  settings: colors.blue,
};

export default function ScreenBackdrop({ variant = 'home' }: ScreenBackdropProps) {
  const accent = variantAccent[variant];
  const topGlowId = useSvgId('screenBackdropTopGlow');
  const sideGlowId = useSvgId('screenBackdropSideGlow');

  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <RadialGradient id={topGlowId} cx="50%" cy="0%" rx="80%" ry="48%">
          <Stop offset="0%" stopColor={accent} stopOpacity="0.12" />
          <Stop offset="60%" stopColor={accent} stopOpacity="0.035" />
          <Stop offset="100%" stopColor={accent} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={sideGlowId} cx="100%" cy="30%" rx="62%" ry="45%">
          <Stop offset="0%" stopColor={colors.purple} stopOpacity="0.08" />
          <Stop offset="100%" stopColor={colors.purple} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={colors.bg} />
      <Circle cx="50%" cy="-8%" r="72%" fill={`url(#${topGlowId})`} />
      <Circle cx="112%" cy="28%" r="58%" fill={`url(#${sideGlowId})`} />
    </Svg>
  );
}
