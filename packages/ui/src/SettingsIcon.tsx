import React from 'react';
import { Image } from 'react-native';

const SETTINGS_ICON_IMAGE = require('../assets/general/in-game-settings.png');

export interface SettingsIconProps {
  // 1.5x the original default (18) — see docs/superpowers/specs/2026-08-07-batak-dev-tuning-panel-and-press-feedback-design.md §6.
  size?: number;
}

function SettingsIconComponent({ size = 27 }: SettingsIconProps) {
  return <Image source={SETTINGS_ICON_IMAGE} style={{ width: size, height: size }} />;
}

export const SettingsIcon = React.memo(SettingsIconComponent);
