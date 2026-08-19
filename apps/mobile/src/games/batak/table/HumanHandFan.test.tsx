import React from 'react';
import { render } from '@testing-library/react-native';
import { HumanHandFan } from './HumanHandFan';
import type { HandSlot } from './HumanHandFan';
import type { Card } from '@world-of-cards/engine';

const CARD: Card = { id: 'c1', suit: 'hearts', rank: '7' };

const SLOTS: HandSlot[] = [{ card: CARD, row: 'top', indexInRow: 0, rowCount: 1 }];

describe('HumanHandFan', () => {
  it('renders without an infinite update-depth loop from its dev-tuning store reads', async () => {
    await render(
      <HumanHandFan
        slots={SLOTS}
        legalCardIds={new Set(['c1'])}
        isHumanInteractive={false}
        selectedCardId={null}
        selectCard={() => {}}
        playEntrance={false}
        registerHandMotion={() => {}}
        handFanRef={{ current: null }}
        onHandFanLayout={() => {}}
      />,
    );
  });
});
