import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { glowShadow } from '@world-cards/ui';

const heroCardImage = require('../../../assets/hero-card-queen-of-hearts.png');

export const HeroCard = React.memo(function HeroCard() {
  return (
    <View style={styles.glowWrapper}>
      <Image source={heroCardImage} style={styles.card} contentFit="contain" />
    </View>
  );
});

const styles = StyleSheet.create({
  glowWrapper: {
    alignSelf: 'center',
    marginTop: 34,
    transform: [{ rotate: '-4deg' }],
    ...glowShadow('#1f5c3a', 20),
  },
  card: {
    width: 104,
    height: 151,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#f4c542',
  },
});
