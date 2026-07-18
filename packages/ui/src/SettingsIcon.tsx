import React from 'react';
import { Image } from 'react-native';

const SETTINGS_ICON_IMAGE = require('../assets/general/in-game-settings.png');

export interface SettingsIconProps {
  // Roughly matches the prior ⚙ glyph's visual size (fontSize: 16) at its default.
  size?: number;
}

function SettingsIconComponent({ size = 18 }: SettingsIconProps) {
  return <Image source={SETTINGS_ICON_IMAGE} style={{ width: size, height: size }} />;
}

export const SettingsIcon = React.memo(SettingsIconComponent);
