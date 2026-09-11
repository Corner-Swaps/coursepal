import React from 'react';
import Svg, { Path, Circle, Rect, G, Line } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const BookFillIcon: React.FC<IconProps> = ({ size = 22, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 6.25C9.8 4.2 6.5 3.8 3.5 4.5A1.5 1.5 0 0 0 2.25 6v12.2c0 .9.8 1.6 1.7 1.45 2.55-.4 5.35-.05 7.05 1.6.4.35 1 .35 1.4 0 1.7-1.65 4.5-2 7.05-1.6.9.15 1.7-.55 1.7-1.45V6a1.5 1.5 0 0 0-1.25-1.5c-3-.7-6.3-.3-8.5 1.75z"
      fill={color}
    />
  </Svg>
);

export const GlassesFillIcon: React.FC<IconProps> = ({ size = 22, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="7" cy="13.5" r="4.2" stroke={color} strokeWidth="2.3" />
    <Circle cx="17" cy="13.5" r="4.2" stroke={color} strokeWidth="2.3" />
    <Path d="M11.2 12.2c.5-.7 1.1-.7 1.6 0" stroke={color} strokeWidth="2.3" strokeLinecap="round" />
    <Path d="M2.8 9.5l2.2 2" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    <Path d="M21.2 9.5l-2.2 2" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

export const BookClosedFillIcon: React.FC<IconProps> = ({ size = 22, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z"
      fill={color}
    />
    <Path
      d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-2H6.5a.5.5 0 0 1-.5-.5v0z"
      fill={color}
      opacity={0.85}
    />
  </Svg>
);

export const CalendarIcon: React.FC<IconProps> = ({ size = 22, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="4" width="18" height="18" rx="4" stroke={color} strokeWidth="2" />
    <Line x1="16" y1="2" x2="16" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Line x1="8" y1="2" x2="8" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Line x1="3" y1="10" x2="21" y2="10" stroke={color} strokeWidth="1.8" />
    <Circle cx="8" cy="14" r="1.2" fill={color} />
    <Circle cx="12" cy="14" r="1.2" fill={color} />
    <Circle cx="16" cy="14" r="1.2" fill={color} />
    <Circle cx="8" cy="18" r="1.2" fill={color} />
    <Circle cx="12" cy="18" r="1.2" fill={color} />
  </Svg>
);

export const FolderFillIcon: React.FC<IconProps> = ({ size = 22, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M2 6a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z"
      fill={color}
    />
  </Svg>
);

export const PersonGroupFillIcon: React.FC<IconProps> = ({ size = 22, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="8.5" cy="7" r="3.5" fill={color} />
    <Path d="M2 18.5a6.5 6.5 0 0 1 13 0v.5H2v-.5z" fill={color} />
    <Circle cx="16.5" cy="7.5" r="2.8" fill={color} opacity={0.7} />
    <Path d="M14.5 15.2a5.5 5.5 0 0 1 6.5 3.3v.5h-5.2c-.3-.8-.7-1.5-1.3-2.1v-1.7z" fill={color} opacity={0.7} />
  </Svg>
);

export const PersonFillIcon: React.FC<IconProps> = ({ size = 22, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="7" r="4" fill={color} />
    <Path d="M4 19.5c0-4.14 3.58-7.5 8-7.5s8 3.36 8 7.5v.5H4v-.5z" fill={color} />
  </Svg>
);

export const FilterIcon: React.FC<IconProps> = ({ size = 18, color = '#596B85' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10.5" fill={color} />
    <Line x1="7" y1="8.5" x2="17" y2="8.5" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
    <Line x1="9" y1="12" x2="15" y2="12" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
    <Line x1="10.5" y1="15.5" x2="13.5" y2="15.5" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

export const FilterCircleFillIcon = FilterIcon;

export const CheckmarkCircleFillIcon: React.FC<IconProps> = ({ size = 18, color = '#2EB866' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10.5" fill={color} />
    <Path d="M7.5 12.5l3 3 6-6" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const TrashIcon: React.FC<IconProps> = ({ size = 17, color = '#D94033' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Line x1="10" y1="11" x2="10" y2="17" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Line x1="14" y1="11" x2="14" y2="17" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

export const MagnifyingGlassIcon: React.FC<IconProps> = ({ size = 15, color = '#8E9BAE' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2.2" />
    <Path d="M16.5 16.5L21 21" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

export const XMarkCircleFillIcon: React.FC<IconProps> = ({ size = 16, color = '#B3BCC9' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" fill={color} />
    <Path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

export const ChevronLeftIcon: React.FC<IconProps> = ({ size = 14, color = '#596B85' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M15 19l-7-7 7-7" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const ChevronRightIcon: React.FC<IconProps> = ({ size = 14, color = '#596B85' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M9 5l7 7-7 7" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const QRCodeIcon: React.FC<IconProps> = ({ size = 22, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="3" width="7" height="7" rx="1.5" stroke={color} strokeWidth="2" />
    <Rect x="5" y="5" width="3" height="3" fill={color} />
    <Rect x="14" y="3" width="7" height="7" rx="1.5" stroke={color} strokeWidth="2" />
    <Rect x="16" y="5" width="3" height="3" fill={color} />
    <Rect x="3" y="14" width="7" height="7" rx="1.5" stroke={color} strokeWidth="2" />
    <Rect x="5" y="16" width="3" height="3" fill={color} />
    <Path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h2v1h-2zM20 14h1v2h-1z" fill={color} />
  </Svg>
);

export const JoinArrowDownIcon: React.FC<IconProps> = ({ size = 22, color = '#8C45F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 3v12M7 10l5 5 5-5" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M4 17v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

export const ShieldLockIcon: React.FC<IconProps> = ({ size = 18, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 2L4 6v6c0 5.5 3.5 10.5 8 12 4.5-1.5 8-6.5 8-12V6l-8-4z" fill={color} opacity={0.15} />
    <Path d="M12 2L4 6v6c0 5.5 3.5 10.5 8 12 4.5-1.5 8-6.5 8-12V6l-8-4z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    <Path d="M12 2v20c4.5-1.5 8-6.5 8-12V6l-8-4z" fill={color} />
  </Svg>
);

export const DocFillIcon: React.FC<IconProps> = ({ size = 22, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6z" fill={color} />
    <Path d="M14 2v6h6" fill="#FFFFFF" opacity={0.4} />
  </Svg>
);

export const DocBadgePlusIcon: React.FC<IconProps> = ({ size = 18, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6z" fill={color} />
    <Path d="M14 2v6h6" fill="#FFFFFF" opacity={0.4} />
    <Circle cx="16" cy="16" r="5" fill="#FFFFFF" />
    <Path d="M16 13.5v5M13.5 16h5" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

export const GraduationCapFillIcon: React.FC<IconProps> = ({ size = 18, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 2L1 7l11 5 9-4.09V14h2V7L12 2z" fill={color} />
    <Path d="M5 10.5V16c0 3 3.13 5 7 5s7-2 7-5v-5.5l-7 3.5-7-3.5z" fill={color} />
  </Svg>
);

export const CameraFillIcon: React.FC<IconProps> = ({ size = 18, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" fill={color} />
    <Circle cx="12" cy="14" r="4" fill="#FFFFFF" />
    <Circle cx="12" cy="14" r="2.5" fill={color} />
  </Svg>
);

export const ChartBarFillIcon: React.FC<IconProps> = ({ size = 14, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="12" width="4" height="9" rx="1.5" fill={color} />
    <Rect x="10" y="7" width="4" height="14" rx="1.5" fill={color} />
    <Rect x="17" y="3" width="4" height="18" rx="1.5" fill={color} />
  </Svg>
);

export const CopyDocIcon: React.FC<IconProps> = ({ size = 12, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="8" y="8" width="12" height="12" rx="2" stroke={color} strokeWidth="2.2" />
    <Path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size = 22, color = '#FFFFFF', strokeWidth = 2.8 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </Svg>
);

export const PlusCircleFillIcon: React.FC<IconProps> = ({ size = 16, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" fill={color} />
    <Path d="M12 8v8M8 12h8" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

export const XMarkIcon: React.FC<IconProps> = ({ size = 18, color = '#596B85' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const ChevronDownIcon: React.FC<IconProps> = ({ size = 14, color = '#596B85' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const PencilSquareIcon: React.FC<IconProps> = ({ size = 18, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const ChevronUpIcon: React.FC<IconProps> = ({ size = 14, color = '#596B85' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M18 15l-6-6-6 6" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const SparklesIcon: React.FC<IconProps> = ({ size = 18, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z"
      fill={color}
    />
    <Path
      d="M19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16z"
      fill={color}
    />
  </Svg>
);

export const EyeFillIcon: React.FC<IconProps> = ({ size = 16, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
  </Svg>
);

export const FolderBadgePlusIcon: React.FC<IconProps> = ({ size = 18, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M19 13v6M16 16h6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const ChecklistIcon: React.FC<IconProps> = ({ size = 18, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M9 11l3 3L22 4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const DocTextViewfinderIcon: React.FC<IconProps> = ({ size = 14, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M7 8h10M7 12h10M7 16h6" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

export const CheckmarkShieldFillIcon: React.FC<IconProps> = ({ size = 14, color = '#E07314' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" fill={color} />
    <Path d="M9 12l2 2 4-4" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const ArchiveBoxFillIcon: React.FC<IconProps> = ({ size = 16, color = '#8C45F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v4H3V4z" fill={color} />
    <Path d="M4 8h16v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" fill={color} opacity={0.85} />
    <Rect x="9" y="11" width="6" height="2" rx="1" fill="#FFFFFF" />
  </Svg>
);

export const ArrowPathIcon: React.FC<IconProps> = ({ size = 16, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4 12a8 8 0 0 1 14.93-4M20 12a8 8 0 0 1-14.93 4"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
    />
    <Path d="M20 4v4h-4M4 20v-4h4" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const HeadphonesFillIcon: React.FC<IconProps> = ({ size = 20, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 12a9 9 0 0 1 18 0v6a3 3 0 0 1-3 3h-1a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h3V12a8 8 0 0 0-16 0v1h3a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H6a3 3 0 0 1-3-3v-6z"
      fill={color}
    />
  </Svg>
);

export const PlayFillIcon: React.FC<IconProps> = ({ size = 18, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M8 5v14l11-7L8 5z" fill={color} />
  </Svg>
);

export const PauseFillIcon: React.FC<IconProps> = ({ size = 18, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" fill={color} />
  </Svg>
);

export const ShareIcon: React.FC<IconProps> = ({ size = 18, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const DocTextFillIcon: React.FC<IconProps> = ({ size = 22, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6z" fill={color} />
    <Path d="M14 2v6h6" fill="#FFFFFF" opacity={0.35} />
    <Line x1="8" y1="12" x2="16" y2="12" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
    <Line x1="8" y1="15" x2="16" y2="15" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
    <Line x1="8" y1="18" x2="13" y2="18" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

export const DocRichtextFillIcon: React.FC<IconProps> = ({ size = 22, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6z" fill={color} />
    <Path d="M14 2v6h6" fill="#FFFFFF" opacity={0.35} />
    <Path d="M8 12h8M8 15.5h5" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

export const WandAndStarsIcon: React.FC<IconProps> = ({ size = 16, color = '#8C45F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 21l10-10M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2zM19 12l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6.6-1.4zM7 5l.5 1 1 .5-1 .5-.5 1-.5-1-1-.5 1-.5.5-1z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const NumberIcon: React.FC<IconProps> = ({ size = 14, color = '#596B85' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
  </Svg>
);

export const LinkCircleFillIcon: React.FC<IconProps> = ({ size = 18, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" fill={color} />
    <Path d="M10 14a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-5l-1 1" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M14 10a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 5l1-1" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

export const PlayCircleFillIcon: React.FC<IconProps> = ({ size = 18, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" fill={color} />
    <Path d="M10 8.5l6 3.5-6 3.5V8.5z" fill="#FFFFFF" />
  </Svg>
);

export const ArrowUpRightIcon: React.FC<IconProps> = ({ size = 14, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M7 17L17 7M7 7h10v10" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const ArrowUpRightSquareIcon: React.FC<IconProps> = ({ size = 14, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="3" width="18" height="18" rx="4" stroke={color} strokeWidth="2" />
    <Path d="M9 15l6-6M10 9h5v5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const ArrowUpRightCircleFillIcon: React.FC<IconProps> = ({ size = 18, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="10" fill={color} />
    <Path d="M9.5 14.5l5-5M11 9.5h3.5v3.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const CheckmarkIcon: React.FC<IconProps> = ({ size = 14, color = '#FFFFFF', strokeWidth = 2.4 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 13l4 4L19 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const PencilAndRulerIcon: React.FC<IconProps> = ({ size = 18, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M18 2l4 4-10 10H8v-4L18 2z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M2 22l6-6M5 16l3 3M8 13l3 3M11 10l3 3" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

export const ChartPieFillIcon: React.FC<IconProps> = ({ size = 16, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M21.21 15.89A10 10 0 1 1 8 2.83" fill={color} />
    <Path d="M22 12A10 10 0 0 0 12 2v10z" fill={color} opacity={0.7} />
  </Svg>
);

export const PlayTvFillIcon: React.FC<IconProps> = ({ size = 16, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="2" y="5" width="20" height="15" rx="3" fill={color} />
    <Path d="M10 9l5 3.5-5 3.5V9z" fill="#FFFFFF" />
    <Path d="M8 2l4 3 4-3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

export const WaveformPathEcgIcon: React.FC<IconProps> = ({ size = 16, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M2 12h4l2.5-6 4 12 3-8 2.5 4h4" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const RectangleInsetTopLeftFilledIcon: React.FC<IconProps> = ({ size = 16, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="3" width="18" height="18" rx="3" stroke={color} strokeWidth="2" />
    <Rect x="5" y="5" width="7" height="7" rx="1.5" fill={color} />
  </Svg>
);

export const Person3FillIcon: React.FC<IconProps> = ({ size = 16, color = '#2470F5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </Svg>
);

export const ExclamationTriangleFillIcon: React.FC<IconProps> = ({ size = 16, color = '#EA580C' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2L1 21h22L12 2zm0 4.5l8.5 13.5H3.5L12 6.5zM11 10h2v4h-2v-4zm0 6h2v2h-2v-2z"
      fill={color}
    />
  </Svg>
);

export const ArrowRightIcon: React.FC<IconProps> = ({ size = 14, color = '#FFFFFF', strokeWidth = 2.4 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 12h14M13 5l7 7-7 7"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

