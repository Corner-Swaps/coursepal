/**
 * Standardized 3-Tier Typography Tokens
 * 1:1 match with Font.cpPageTitle, Font.cpItemTitle, Font.cpDescription
 */

export const Typography = {
  // Tier 1 (Thick / Bold): Page Titles, Screen Headers, Modal Titles (21.5pt Bold Rounded)
  cpPageTitle: {
    fontSize: 21.5,
    fontWeight: '700' as const,
    lineHeight: 26,
    letterSpacing: -0.4,
    fontFamily: 'System'
  },

  // Tier 2 (Thick / Bold): Item Titles, Assignment Names, Reading Titles, Card Titles (14.5pt Bold Rounded)
  cpItemTitle: {
    fontSize: 14.5,
    fontWeight: '700' as const,
    lineHeight: 19,
    letterSpacing: -0.2,
    fontFamily: 'System'
  },

  // Tier 3 (Thin / Regular): Descriptions, Dates, Subtitles, Metadata, Body Text (13pt Rounded)
  cpDescription: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 17,
    letterSpacing: 0,
    fontFamily: 'System'
  },

  cpDescriptionMedium: {
    fontSize: 13,
    fontWeight: '500' as const,
    lineHeight: 17,
    letterSpacing: 0,
    fontFamily: 'System'
  },

  cpDescriptionBold: {
    fontSize: 13,
    fontWeight: '700' as const,
    lineHeight: 17,
    letterSpacing: 0,
    fontFamily: 'System'
  },

  // Specialized micro-tokens
  tabLabel: {
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0,
    fontFamily: 'System'
  },

  badgeCaps: {
    fontSize: 10.5,
    fontWeight: '800' as const,
    lineHeight: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    fontFamily: 'System'
  },

  monoVersion: {
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 16,
    letterSpacing: 0,
    fontFamily: 'Courier'
  }
} as const;
