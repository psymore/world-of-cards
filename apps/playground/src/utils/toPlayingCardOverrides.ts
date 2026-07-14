import type { PlayingCardBorderSpec, PlayingCardOverlayImage } from '@world-cards/ui';
import type { CardTemplate } from '../types';

// Maps playground's own CardTemplate state shape to the real PlayingCard's override props.
// This mapping lives in apps/playground (the consumer), not @world-cards/ui (the shared
// package) — the shared package owns its own prop interface and must not depend on any one
// consumer's local types.
export function toPlayingCardOverrides(template: CardTemplate): {
  cardRadius: number;
  borders: PlayingCardBorderSpec[];
  overlayImage: PlayingCardOverlayImage | null;
} {
  return {
    cardRadius: template.borderRadius,
    borders: template.borders.map((border) => ({ width: border.width, color: border.color })),
    overlayImage:
      template.image == null
        ? null
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
