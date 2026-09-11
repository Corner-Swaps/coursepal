/**
 * FocusStudyModal
 * Apple HIG Pomodoro Study Timer & Ambient Soundscape Player.
 * Synchronizes background audio loops, dynamic sine wave visualizer, and haptics.
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTimer } from '../../hooks/useTimer';
import { useAudio } from '../../hooks/useAudio';
import { CoursePalTheme } from '../../constants/theme';
import { formatTime } from '../../utils/timeFormatters';
import { SoundscapeId } from '../../types/audio';
import { SoundscapeWaveVisualizer } from '../SoundscapeWaveVisualizer';
import { PrecisionSlider } from '../PrecisionSlider';
import {
  PlayFillIcon,
  PauseFillIcon,
  ArrowPathIcon,
  HeadphonesFillIcon,
  XMarkIcon
} from '../SvgIcons';
import { haptics } from '../../services/HapticsService';

export interface FocusStudyModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  courseCode?: string;
  courseColor?: string;
  onSessionComplete?: () => void;
}

interface SoundscapeOption {
  id: SoundscapeId | 'none';
  label: string;
  emoji: string;
}

const SOUNDSCAPES: SoundscapeOption[] = [
  { id: 'rain', label: 'Rain', emoji: '🌧️' },
  { id: 'library', label: 'Library', emoji: '📚' },
  { id: 'waves', label: 'Waves', emoji: '🌊' },
  { id: 'white_noise', label: 'Noise', emoji: '🎧' },
  { id: 'none', label: 'Mute', emoji: '🔇' }
];

export const FocusStudyModal: React.FC<FocusStudyModalProps> = ({
  visible,
  onClose,
  title = 'Study Focus Session',
  courseCode,
  courseColor = CoursePalTheme.accentBlue,
  onSessionComplete
}) => {
  const {
    state: timerState,
    start: startTimer,
    pause: pauseTimer,
    resume: resumeTimer,
    reset: resetTimer,
    setMode
  } = useTimer('focus');

  const {
    play: playSoundscape,
    stop: stopSoundscape,
    setVolume: setAudioVolume,
    isPlaying
  } = useAudio();

  const [selectedSoundscape, setSelectedSoundscape] = useState<SoundscapeId | 'none'>('rain');
  const [volume, setVolume] = useState<number>(0.7);

  // Play/pause soundscape aligned with timer state
  useEffect(() => {
    if (visible && timerState.status === 'running' && selectedSoundscape !== 'none') {
      playSoundscape(selectedSoundscape);
    } else {
      stopSoundscape();
    }
  }, [visible, timerState.status, selectedSoundscape, playSoundscape, stopSoundscape]);

  // Handle completion chime
  useEffect(() => {
    if (timerState.status === 'completed') {
      playSoundscape('completion_chime');
      haptics.notifySuccess();
      if (onSessionComplete) {
        onSessionComplete();
      }
    }
  }, [timerState.status, playSoundscape, onSessionComplete]);

  // Clean up sound on close
  const handleClose = () => {
    pauseTimer();
    stopSoundscape();
    onClose();
  };

  const handleToggleTimer = () => {
    haptics.impactMedium();
    if (timerState.status === 'running') {
      pauseTimer();
    } else if (timerState.status === 'paused') {
      resumeTimer();
    } else {
      startTimer();
    }
  };

  const handleResetTimer = () => {
    haptics.impactLight();
    resetTimer();
  };

  const handleSelectSoundscape = (id: SoundscapeId | 'none') => {
    haptics.selection();
    setSelectedSoundscape(id);
    if (id === 'none') {
      stopSoundscape();
    } else if (timerState.status === 'running') {
      playSoundscape(id);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    setAudioVolume(newVol);
  };

  const currentMode = timerState.mode;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeButton}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <XMarkIcon size={18} color="#596B85" />
          </TouchableOpacity>

          <View style={styles.navTitleContainer}>
            <HeadphonesFillIcon size={18} color={courseColor} />
            <Text style={styles.navTitle} numberOfLines={1}>
              Focus Session
            </Text>
          </View>

          <View style={styles.navPlaceholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Active Context Card */}
          <View style={styles.contextCard}>
            {courseCode && (
              <View style={[styles.coursePill, { backgroundColor: courseColor }]}>
                <Text style={styles.coursePillText}>{courseCode}</Text>
              </View>
            )}
            <Text style={styles.contextTitle} numberOfLines={2}>
              {title}
            </Text>
          </View>

          {/* Mode Selector Tabs (Focus / Short Break / Long Break) */}
          <View style={styles.modeTabsRow}>
            <TouchableOpacity
              style={[
                styles.modeTab,
                currentMode === 'focus' && [styles.modeTabActive, { borderColor: courseColor }]
              ]}
              onPress={() => {
                haptics.selection();
                setMode('focus', 25 * 60);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.modeTabText,
                  currentMode === 'focus' && [styles.modeTabTextActive, { color: courseColor }]
                ]}
              >
                Focus (25m)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeTab,
                currentMode === 'shortBreak' && [
                  styles.modeTabActive,
                  { borderColor: CoursePalTheme.successGreen }
                ]
              ]}
              onPress={() => {
                haptics.selection();
                setMode('shortBreak', 5 * 60);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.modeTabText,
                  currentMode === 'shortBreak' && [
                    styles.modeTabTextActive,
                    { color: CoursePalTheme.successGreen }
                  ]
                ]}
              >
                Short Break (5m)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeTab,
                currentMode === 'longBreak' && [
                  styles.modeTabActive,
                  { borderColor: '#7C3AED' }
                ]
              ]}
              onPress={() => {
                haptics.selection();
                setMode('longBreak', 15 * 60);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.modeTabText,
                  currentMode === 'longBreak' && [
                    styles.modeTabTextActive,
                    { color: '#7C3AED' }
                  ]
                ]}
              >
                Long Break (15m)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Large Circular Countdown Display */}
          <View style={styles.timerRingCard}>
            <View style={styles.timerDisplayCol}>
              <Text style={styles.timerRemainingText}>
                {formatTime(timerState.remainingSeconds)}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  timerState.status === 'running'
                    ? { backgroundColor: 'rgba(46, 184, 102, 0.15)' }
                    : { backgroundColor: 'rgba(89, 107, 133, 0.12)' }
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    timerState.status === 'running'
                      ? { color: CoursePalTheme.successGreen }
                      : { color: '#596B85' }
                  ]}
                >
                  {timerState.status === 'running'
                    ? 'In Progress'
                    : timerState.status === 'paused'
                    ? 'Paused'
                    : 'Ready'}
                </Text>
              </View>
            </View>

            {/* Timer Play / Pause & Reset Controls */}
            <View style={styles.timerControlsRow}>
              <TouchableOpacity
                style={[styles.playPauseButton, { backgroundColor: courseColor }]}
                onPress={handleToggleTimer}
                activeOpacity={0.8}
              >
                {timerState.status === 'running' ? (
                  <PauseFillIcon size={24} color="#FFFFFF" />
                ) : (
                  <PlayFillIcon size={24} color="#FFFFFF" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleResetTimer}
                activeOpacity={0.7}
              >
                <ArrowPathIcon size={18} color="#596B85" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Soundscape Selector Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Ambient Soundscape</Text>
            <View style={styles.soundscapeTilesRow}>
              {SOUNDSCAPES.map(s => {
                const isSelected = selectedSoundscape === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.soundscapeTile,
                      isSelected && [
                        styles.soundscapeTileSelected,
                        { borderColor: courseColor }
                      ]
                    ]}
                    onPress={() => handleSelectSoundscape(s.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.soundscapeEmoji}>{s.emoji}</Text>
                    <Text
                      style={[
                        styles.soundscapeLabel,
                        isSelected && [
                          styles.soundscapeLabelSelected,
                          { color: courseColor }
                        ]
                      ]}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Real-Time Sine Wave Visualizer */}
            <View style={styles.visualizerContainer}>
              <SoundscapeWaveVisualizer
                width={310}
                height={54}
                isPlaying={timerState.status === 'running' && selectedSoundscape !== 'none'}
                intensity={volume}
                color={courseColor}
              />
            </View>
          </View>

          {/* Volume Control */}
          <View style={styles.sectionContainer}>
            <View style={styles.volumeHeaderRow}>
              <Text style={styles.sectionTitle}>Soundscape Volume</Text>
              <Text style={styles.volumeValueText}>{Math.round(volume * 100)}%</Text>
            </View>
            <PrecisionSlider
              value={volume}
              min={0}
              max={1}
              step={0.05}
              tintColor={courseColor}
              onValueChange={handleVolumeChange}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F5FA'
  },
  navBar: {
    paddingTop: 14,
    paddingBottom: 10,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D1D9E6',
    backgroundColor: '#F2F5FA'
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  navTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#081324'
  },
  navPlaceholder: {
    width: 36
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: 20,
    gap: 16
  },
  contextCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    gap: 8
  },
  coursePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
  coursePillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  contextTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#141F38',
    lineHeight: 22
  },
  modeTabsRow: {
    flexDirection: 'row',
    gap: 8
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0'
  },
  modeTabActive: {
    backgroundColor: '#FFFFFF'
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#718096'
  },
  modeTabTextActive: {
    fontWeight: '700'
  },
  timerRingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 18
  },
  timerDisplayCol: {
    alignItems: 'center',
    gap: 6
  },
  timerRemainingText: {
    fontSize: 56,
    fontWeight: '800',
    letterSpacing: -1,
    color: '#141F38',
    fontVariant: ['tabular-nums']
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700'
  },
  timerControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20
  },
  playPauseButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4
  },
  resetButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDF2F7',
    alignItems: 'center',
    justifyContent: 'center'
  },
  sectionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    gap: 12
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#596B85',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  soundscapeTilesRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between'
  },
  soundscapeTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 4
  },
  soundscapeTileSelected: {
    backgroundColor: '#FFFFFF'
  },
  soundscapeEmoji: {
    fontSize: 20
  },
  soundscapeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#718096'
  },
  soundscapeLabelSelected: {
    fontWeight: '700'
  },
  visualizerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 58,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    overflow: 'hidden'
  },
  volumeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  volumeValueText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#141F38'
  }
});
