import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LabeledSlider } from './LabeledSlider';
import { SIMPLE_CARD_WIDTH } from './SimpleCard';

export interface FanConfigControlsProps {
  overlap: number;
  onOverlapChange: (value: number) => void;
  arcDegrees: number;
  onArcDegreesChange: (value: number) => void;
  maxRotationDeg: number;
  onMaxRotationDegChange: (value: number) => void;
  spacingPx: number;
  onSpacingPxChange: (value: number) => void;
  // Omit both to hide the Hand size slider entirely — used by Demo 07, whose hand
  // size is driven by the shared 4-seat deal rather than being a free variable.
  handSize?: number;
  onHandSizeChange?: (value: number) => void;
}

// The same 5 live-tunable sliders Demo01FanLayout.tsx introduced (Hand size,
// Overlap, Arc degrees, Max rotation, Spacing), extracted so every later demo can
// drop the identical control panel at the bottom of its screen instead of
// re-authoring the same LabeledSliders. Demo01FanLayout.tsx keeps its own copy
// rather than switching to this component, since it also layers its own local
// small-hand percentage adjustment on top of these raw values — see that file's
// own comment for why that stays separate and untouched.
//
// Collapsed by default (own isOpen state, not lifted to the caller — no consuming
// demo currently needs to know or control this): these sliders are rarely tuned
// mid-session, but every demo permanently reserved their full height whether open
// or not, competing with the hand/travel area for whatever vertical space the
// screen actually has. On a real device this could push a demo's actual content
// (the fan, and — for demos with an upward travel — the landing point above it)
// out of the visible viewport. Collapsing behind one toggle button gives that
// space back by default, at the cost of an extra tap when a slider is actually
// wanted.
export function FanConfigControls({
  overlap,
  onOverlapChange,
  arcDegrees,
  onArcDegreesChange,
  maxRotationDeg,
  onMaxRotationDegChange,
  spacingPx,
  onSpacingPxChange,
  handSize,
  onHandSizeChange,
}: FanConfigControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <View style={styles.controls}>
      <Pressable
        testID="control-toggle"
        onPress={() => setIsOpen(open => !open)}
        style={styles.toggle}>
        <Text style={styles.toggleText}>{isOpen ? "▾ Hide controls" : "▸ Show controls"}</Text>
      </Pressable>
      {isOpen ? (
        <View style={styles.controlsContent}>
          {handSize !== undefined && onHandSizeChange ? (
            <LabeledSlider
              label="Hand size"
              testID="control-hand-size"
              minimumValue={1}
              maximumValue={13}
              step={1}
              value={handSize}
              onChange={value => onHandSizeChange(Math.round(value))}
            />
          ) : null}
          <LabeledSlider
            label="Overlap"
            testID="control-overlap"
            minimumValue={0}
            maximumValue={0.9}
            step={0.01}
            value={overlap}
            onChange={onOverlapChange}
          />
          <LabeledSlider
            label="Arc degrees"
            testID="control-arc"
            minimumValue={0}
            maximumValue={90}
            step={1}
            value={arcDegrees}
            onChange={onArcDegreesChange}
          />
          <LabeledSlider
            label="Max rotation"
            testID="control-max-rotation"
            minimumValue={0}
            maximumValue={45}
            step={1}
            value={maxRotationDeg}
            onChange={onMaxRotationDegChange}
          />
          <LabeledSlider
            label="Spacing"
            testID="control-spacing"
            minimumValue={SIMPLE_CARD_WIDTH * 0.2}
            maximumValue={SIMPLE_CARD_WIDTH}
            step={1}
            value={spacingPx}
            onChange={onSpacingPxChange}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // alignSelf: 'stretch' so this panel spans full width regardless of whatever
  // alignItems value each consuming demo's own outer container happens to use for
  // centering its hand (several use alignItems: 'center', which would otherwise
  // shrink an unstretched child to its own content width). Natural height (no
  // flex/scrolling of its own) — the demo screens that use this now wrap their
  // WHOLE content (hand + controls) in one outer ScrollView, so this panel just
  // needs to report its real height, not compete for a fixed flex allotment that
  // can squeeze it to invisible when the hand area above it is already tall.
  controls: { alignSelf: 'stretch', backgroundColor: '#00000066' },
  toggle: { paddingVertical: 10, paddingHorizontal: 14 },
  toggleText: { color: '#ffffffcc', fontSize: 13, fontWeight: '600' },
  controlsContent: { paddingHorizontal: 14, paddingBottom: 12 },
});
