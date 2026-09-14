/**
 * CoursePal Theme & Visual Design Tokens
 * 1:1 match with iOS CoursePalTheme, MasterColorPalette, VaultPalette, ConfettiPalette
 */

export const CoursePalTheme = {
  // Deep Slate Dark (Primary text & page headers)
  textDark: '#121C33', // Color(red: 0.07, green: 0.11, blue: 0.20)

  // Crisp Slate Gray (Subtitles, metadata, secondary body)
  textMuted: '#596B85', // Color(red: 0.35, green: 0.42, blue: 0.52)

  // Electric Blue (Primary accent & active state)
  accentBlue: '#2470F5', // Color(red: 0.14, green: 0.44, blue: 0.96)

  // Soft Blue Pill (Background for badges & pills)
  pillBlueBg: '#E3EDFF', // Color(red: 0.89, green: 0.93, blue: 1.0)

  // Light Slate Canvas (Default app background)
  bgCanvas: '#F2F5FA', // Color(red: 0.95, green: 0.96, blue: 0.98)

  // Card Background
  cardBg: '#FFFFFF',

  // Structural Dividers & Borders
  borderSlate: '#E3E8F0', // Color(red: 0.89, green: 0.91, blue: 0.94)
  headerDark: '#141F38', // Color(red: 0.08, green: 0.12, blue: 0.22)
  mutedIcon: '#73859E', // Color(red: 0.45, green: 0.52, blue: 0.62)
  progressTrack: '#EBF0F7', // Color(red: 0.92, green: 0.94, blue: 0.97)

  // Semantic
  successGreen: '#0DBF73', // Color(red: 0.05, green: 0.75, blue: 0.45)
  warningOrange: '#F97316',
  dangerRed: '#EF4444'
} as const;

export const CoursePalTypography = {
  // Page Hero / Big Header (Readings, Assignments, Syllabi, Invite)
  pageTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#141F38',
    letterSpacing: -0.5
  },
  // Subtitle directly under Page Hero
  pageSubtitle: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#596B85',
    lineHeight: 17
  },
  // Modal Sheet Navigation Bar Title
  modalTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#141F38',
    letterSpacing: -0.2
  },
  // Section / Group Header (e.g. "UPLOAD CLASS MATERIAL", "SCHEDULE & DUE DATE")
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#596B85',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const
  },
  // Prominent Section Title
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#141F38',
    letterSpacing: -0.3
  },
  // Standardized Card & Item Title (matching Readings title: THE REFERENCE STANDARD)
  title: {
    fontSize: 14.5,
    fontWeight: '700' as const,
    color: '#141F38',
    lineHeight: 19,
    letterSpacing: -0.2
  },
  // Standardized Subtitle (matching Readings author/subtext: THE REFERENCE STANDARD)
  subtitle: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#596B85',
    lineHeight: 17
  },
  // Regular Body Text
  body: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#141F38',
    lineHeight: 20
  },
  // Secondary / Description Body Text
  bodyMuted: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#596B85',
    lineHeight: 18
  },
  // Small caption / metadata
  caption: {
    fontSize: 11.5,
    fontWeight: '500' as const,
    color: '#718096'
  },
  // Badges & Pill Labels
  badge: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF'
  },
  // Compact Mini Badge
  miniBadge: {
    fontSize: 10,
    fontWeight: '700' as const
  }
} as const;

export const MasterCoursePalette = [
  '#2563EB', // 0: Vibrant Blue (Default)
  '#7C3AED', // 1: Royal Purple
  '#059669', // 2: Emerald Green
  '#EA580C', // 3: Deep Orange
  '#DB2777', // 4: Vibrant Pink
  '#0D9488', // 5: Teal Cyan
  '#D97706', // 6: Amber Gold
  '#4F46E5', // 7: Deep Indigo
  '#DC2626', // 8: Crimson Red
  '#E11D48', // 9: Coral Rose
  '#06B6D4', // 10: Aqua Turquoise
  '#9333EA'  // 11: Grape Purple
] as const;

export const VaultDocPalette = [
  '#7C3AED', // Royal Purple
  '#EA580C', // Deep Orange
  '#059669', // Emerald Green
  '#DB2777', // Vibrant Pink
  '#D97706', // Amber Gold
  '#4F46E5', // Indigo
  '#0D9488', // Teal
  '#DC2626', // Crimson Red
  '#8B5CF6', // Violet
  '#06B6D4', // Turquoise
  '#E11D48'  // Rose
] as const;

export const SemanticColors = {
  media: '#8B5CF6',      // Purple
  reading: '#3B82F6',    // Blue
  assignment: '#EF4444', // Red
  inClass: '#10B981'     // Green
} as const;

export const ConfettiPalette = [
  '#FA702E', // Gold: rgb(0.98, 0.75, 0.18)
  '#0DBF73', // Emerald Green: rgb(0.05, 0.75, 0.45)
  '#2470F5', // Royal Blue: rgb(0.14, 0.44, 0.96)
  '#F2408C', // Hot Pink: rgb(0.95, 0.25, 0.55)
  '#8C45F5', // Purple: rgb(0.55, 0.27, 0.96)
  '#FA7A2E', // Coral: rgb(0.98, 0.48, 0.18)
  '#05C7E0', // Cyan: rgb(0.02, 0.78, 0.88)
  '#FFEB3B'  // Bright Yellow: rgb(1.00, 0.92, 0.23)
] as const;

export const HighlighterInk = {
  color: 'rgba(255, 240, 38, 0.45)', // CGColor(red: 1.0, green: 0.94, blue: 0.15, alpha: 0.45)
  blendMode: 'multiply' as const,
  cornerRadius: 3.5,
  paddingX: 4.0,
  paddingY: 2.0
} as const;
