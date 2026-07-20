import { StyleSheet } from 'react-native';

// Shared by every "center of the table" phase display (BiddingCenter, TrumpWaitingCenter,
// TrumpSuitPicker, TrickCenter) — one file so the 4 call sites can't drift on font size/color.
export const centerPanelStyles = StyleSheet.create({
  // Same cross-subtree reasoning as seatLayoutStyles.middleRow's own zIndex, one level down:
  // outranks the left/right OpponentSeatGroup siblings within middleRow, so a card traveling
  // from either side seat paints above that seat's own remaining cards too.
  centerPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 10,
  },
  centerHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f5f0e6',
    textAlign: 'center',
  },
  centerLine: { fontSize: 14, color: '#f5f0e6', textAlign: 'center' },
  trumpRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  suitRow: { flexDirection: 'row', gap: 12 },
  suitButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
