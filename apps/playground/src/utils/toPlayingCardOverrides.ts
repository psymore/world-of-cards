import type { PlayingCardBorderSpec, PlayingCardOverlayImage } from '@world-of-cards/ui';
import type { CardTemplate } from '../types';

// Maps playground's own CardTemplate state shape to the real PlayingCard's override props.
// This mapping lives in apps/playground (the consumer), not @world-of-cards/ui (the shared
// package) — the shared package owns its own prop interface and must not depend on any one
// consumer's local types.
export function toPlayingCardOverrides(template: CardTemplate): {
  cardRadius: number;
  borders: PlayingCardBorderSpec[];
  overlayImage: PlayingCardOverlayImage | undefined;
} {
  return {
    cardRadius: template.borderRadius,
    borders: template.borders.map((border) => ({ width: border.width, color: border.color })),
    // `undefined` (not `null`) when no custom image is set: PlayingCard treats undefined as
    // "use the built-in COURT_CARD_ART illustration if one exists for this rank+suit, else the
    // plain suit watermark", whereas null force-suppresses the built-in art entirely. Passing
    // undefined lets the playground preview the real game's shipped A/K/Q/J illustrations.
    overlayImage:
      template.image == null
        ? undefined
        : {
            uri: template.image.uri,
            kind: template.image.kind,
            svgXml: template.image.svgXml,
            scale: template.image.scale,
            offsetX: template.image.offsetX,
            offsetY: template.image.offsetY,
          },
  };
}
