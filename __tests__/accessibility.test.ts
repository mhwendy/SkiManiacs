import { describe, expect, it } from '@jest/globals';
import { colors } from '@/theme/colors';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('WCAG AA text contrast (4.5:1)', () => {
  it.each(['light', 'dark'] as const)(
    '%s theme text on its surfaces',
    (mode) => {
      const theme = colors[mode];
      for (const background of [theme.background, theme.surface]) {
        for (const text of [
          theme.textPrimary,
          theme.textSecondary,
          theme.textHint,
          theme.accentBlue,
        ]) {
          expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5);
        }
      }
    },
  );

  it('white text on badge and button backgrounds', () => {
    for (const background of [
      colors.accentBlue,
      colors.accentGreen,
      colors.accentRed,
      colors.navy,
    ]) {
      expect(contrast(colors.white, background)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
