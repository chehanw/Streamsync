/**
 * App-wide typography scale
 *
 * All screens and components should import from here instead of
 * hardcoding fontSize / fontWeight values. When a font family is
 * chosen it only needs to be added in one place.
 *
 * Size scale (iOS HIG-aligned):
 *   display      34  — Screen hero / large titles
 *   titleLarge   28  — Big metric numbers
 *   titleMedium  22  — Card value headings
 *   titleSmall   20  — Section headings
 *   headline     17  — Module / card titles, nav bar titles, button text
 *   body         17  — Body content (same size as headline, lighter weight)
 *   subhead      15  — Supporting text, descriptions, vital labels
 *   footnote     13  — Secondary labels, dates, card labels
 *   caption      12  — Pills, chips, stat units
 *   micro        11  — Badges, uppercase micro-labels
 *   chartAxis     9  — Chart axis labels only
 */

export const FontSize = {
  display:     34,
  titleLarge:  28,
  titleMedium: 22,
  titleSmall:  20,
  headline:    17,
  body:        17,
  subhead:     15,
  footnote:    13,
  caption:     12,
  micro:       11,
  chartAxis:    9,
} as const;

export const FontWeight = {
  bold:     '700' as const,
  semibold: '600' as const,
  medium:   '500' as const,
  regular:  '400' as const,
} as const;

/** Convenience line-height values paired with the size scale. */
export const LineHeight = {
  display:    40,
  titleLarge: 34,
  titleSmall: 26,
  headline:   22,
  subhead:    22,
  footnote:   18,
  caption:    16,
} as const;
