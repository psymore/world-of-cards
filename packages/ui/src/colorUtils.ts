function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (value: number) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// amount in [-1, 1]: negative shades toward black, positive shades toward white.
// Used to derive a light/dark gradient pair from a single base color (e.g. TableWoodCorners'
// woodColor override), so the existing two-tone look is preserved under any base hue.
export function shadeColor(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const target = amount < 0 ? 0 : 255;
  const factor = Math.abs(clamp(amount, -1, 1));
  return rgbToHex(r + (target - r) * factor, g + (target - g) * factor, b + (target - b) * factor);
}
