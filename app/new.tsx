import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Svg, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTaskStore } from '../store/taskStore';
import { useSettingsStore } from '../store/settingsStore';
import { aiService, AIAnalysis, AIStep } from '../services/ai';
import ScreenBackdrop from '../components/ScreenBackdrop';
import ModeNavBar from '../components/ModeNavBar';
import { useSvgId } from '../components/useSvgId';

// ─── Constants ──────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  work: '工作类',
  study: '学习类',
  creative: '创意类',
};

const FALLBACK_STEP_MINUTES = 15;

function buildFallbackStep(title: string): AIStep {
  return {
    title,
    estimatedMinutes: FALLBACK_STEP_MINUTES,
  };
}

function formatMinutes(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `预计 ${hours} 小时 ${mins} 分钟` : `预计 ${hours} 小时`;
  }
  return `预计 ${minutes} 分钟`;
}

function formatStepMinutes(minutes: number): string {
  return `${minutes}分钟`;
}

// ─── Bouncing Dot ───────────────────────────────────────────

function BouncingDot({ delayMs }: { delayMs: number }) {
  const offset = useSharedValue(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      offset.value = withRepeat(
        withSequence(
          withTiming(-4, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    }, delayMs);
    return () => clearTimeout(timeout);
  }, [delayMs, offset]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));

  return (
    <Animated.View style={[styles.dot, animatedStyle]} />
  );
}

// ─── Step Row ───────────────────────────────────────────────

function StepRow({
  step,
  index,
  onDelete,
}: {
  step: AIStep;
  index: number;
  onDelete: () => void;
}) {
  const translateX = useSharedValue(0);
  const deleteTriggered = useRef(false);

  const panGesture = Gesture.Pan()
    .activateAfterLongPress(0)
    .onUpdate((e) => {
      // Only allow left swipe
      if (e.translationX < 0) {
        translateX.value = Math.max(e.translationX, -80);
      }
    })
    .onEnd(() => {
      if (translateX.value < -60 && !deleteTriggered.current) {
        deleteTriggered.current = true;
        // Animate back then delete
        translateX.value = withTiming(0, { duration: 150 }, () => {
          onDelete();
          deleteTriggered.current = false;
        });
      } else {
        translateX.value = withTiming(0, { duration: 200 });
      }
    });

  const animatedRowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.stepRowContainer]}>
        <Animated.View style={[styles.stepRow, animatedRowStyle]}>
          <Text style={styles.stepNum}>{String(index + 1).padStart(2, '0')}</Text>
          <View style={styles.stepCopy}>
            <Text style={styles.stepText} numberOfLines={1}>
              {step.title}
            </Text>
            {step.output && (
              <Text style={styles.stepOutput} numberOfLines={1}>
                产出：{step.output}
              </Text>
            )}
          </View>
          <Text style={styles.stepMin}>{formatStepMinutes(step.estimatedMinutes)}</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

function AssessmentSection({ analysis }: { analysis: AIAnalysis }) {
  return (
    <View style={styles.assessmentPanel}>
      {analysis.checkpoints.map((checkpoint, index) => (
        <View key={`${checkpoint.title}-${index}`} style={styles.assessmentBlock}>
          <View style={styles.assessmentHeader}>
            <Text style={styles.assessmentKicker}>过程测验</Text>
            <Text style={styles.assessmentTitle}>{checkpoint.title}</Text>
          </View>
          <Text style={styles.assessmentPrompt}>{checkpoint.prompt}</Text>
          <Text style={styles.criteriaText}>
            通过标准：{checkpoint.passCriteria.join(' / ')}
          </Text>
        </View>
      ))}

      <View style={styles.assessmentBlock}>
        <View style={styles.assessmentHeader}>
          <Text style={styles.assessmentKicker}>成果测验</Text>
          <Text style={styles.assessmentTitle}>{analysis.finalAssessment.title}</Text>
        </View>
        <Text style={styles.assessmentPrompt}>{analysis.finalAssessment.prompt}</Text>
        <Text style={styles.criteriaText}>
          通过标准：{analysis.finalAssessment.passCriteria.join(' / ')}
        </Text>
      </View>
    </View>
  );
}

// ─── Main Component ─────────────────────────────────────────

export default function NewTask() {
  const router = useRouter();
  const { createTask, addTaskToToday } = useTaskStore();
  const { aiModel } = useSettingsStore();
  const KeyboardShell = Platform.OS === 'ios' ? KeyboardAvoidingView : View;

  const [inputText, setInputText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [steps, setSteps] = useState<AIStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showAnalyzingIndicator, setShowAnalyzingIndicator] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyzingIndicatorRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);
  const requestIdRef = useRef(0);
  const lastAnalyzedTextRef = useRef('');
  const inflightTextRef = useRef('');
  const primaryGradId = useSvgId('newTaskPrimaryGrad');

  const handleInputFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  useEffect(() => {
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 350);

    return () => clearTimeout(focusTimer);
  }, []);

  // ─── AI Analysis ────────────────────────────────────────────

  const runAnalysis = useCallback(
    async (text: string, options?: { force?: boolean }) => {
      const normalizedText = text.trim();
      if (!normalizedText || normalizedText.length < 3) return;
      if (!options?.force) {
        if (normalizedText === lastAnalyzedTextRef.current) return;
        if (normalizedText === inflightTextRef.current) return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      inflightTextRef.current = normalizedText;
      setIsAnalyzing(true);
      setError(null);

      try {
        const model = aiModel;
        const result = await aiService.analyzeTask(normalizedText, model);
        if (requestId !== requestIdRef.current) return;

        lastAnalyzedTextRef.current = normalizedText;
        setAnalysis(result);
        setSteps(result.steps);
      } catch (err: any) {
        if (requestId !== requestIdRef.current) return;
        setError(err.message || 'AI 分析失败，请重试');
      } finally {
        if (requestId === requestIdRef.current) {
          inflightTextRef.current = '';
          setIsAnalyzing(false);
        }
      }
    },
    [aiModel],
  );

  // Debounced auto-analysis
  const handleTextChange = useCallback(
    (text: string) => {
      setInputText(text);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      if (text.trim().length >= 3) {
        debounceRef.current = setTimeout(() => {
          runAnalysis(text);
        }, 1000);
      } else {
        requestIdRef.current += 1;
        inflightTextRef.current = '';
        lastAnalyzedTextRef.current = '';
        setIsAnalyzing(false);
        setAnalysis(null);
        setSteps([]);
      }
    },
    [runAnalysis],
  );

  // Manual re-analyze
  const handleReanalyze = useCallback(() => {
    if (inputText.trim()) {
      lastAnalyzedTextRef.current = '';
      runAnalysis(inputText, { force: true });
    }
  }, [inputText, runAnalysis]);

  // ─── Step deletion ──────────────────────────────────────────

  const handleDeleteStep = useCallback((index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ─── Save Task ──────────────────────────────────────────────

  const handleSave = useCallback(
    async (addToToday: boolean) => {
      if (!inputText.trim() || isSaving) return;

      setIsSaving(true);
      try {
        const category = analysis?.category || 'work';
        const normalizedTitle = inputText.trim();
        const fallbackStep = buildFallbackStep(normalizedTitle);
        const resolvedSteps = steps.length > 0 ? steps : [fallbackStep];
        const minimalStep = analysis?.minimalStep || resolvedSteps[0].title;
        const taskSteps = resolvedSteps.map((s, i) => ({
          title: s.title,
          estimatedMinutes: s.estimatedMinutes,
          order: i,
        }));

        const task = await createTask(normalizedTitle, category, taskSteps, minimalStep);

        if (addToToday) {
          await addTaskToToday(task.id);
        }

        router.back();
      } catch (err) {
        console.error('[NewTask] Save failed:', err);
        setError('保存失败，请重试');
      } finally {
        setIsSaving(false);
      }
    },
    [inputText, analysis, steps, isSaving, createTask, addTaskToToday, router],
  );

  // ─── Cleanup ────────────────────────────────────────────────

  useEffect(() => {
    if (analyzingIndicatorRef.current) {
      clearTimeout(analyzingIndicatorRef.current);
    }

    if (isAnalyzing) {
      analyzingIndicatorRef.current = setTimeout(() => {
        setShowAnalyzingIndicator(true);
      }, 250);
    } else {
      setShowAnalyzingIndicator(false);
    }

    return () => {
      if (analyzingIndicatorRef.current) {
        clearTimeout(analyzingIndicatorRef.current);
      }
    };
  }, [isAnalyzing]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (analyzingIndicatorRef.current) {
        clearTimeout(analyzingIndicatorRef.current);
      }
    };
  }, []);

  // ─── Render ─────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenBackdrop variant="capture" />

      <KeyboardShell
        style={styles.keyboardAvoid}
        {...(Platform.OS === 'ios'
          ? {
              behavior: 'padding' as const,
              keyboardVerticalOffset: 0,
            }
          : {})}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>新想法</Text>
              <Text style={styles.headerSub}>随便说，AI 来拆解</Text>
            </View>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.cancelBtn}>取消</Text>
            </Pressable>
          </View>

          {/* ── Input Area ── */}
          <Pressable
            style={[styles.captureArea, isFocused && styles.captureAreaFocused]}
            onPress={() => inputRef.current?.focus()}
          >
            <TextInput
              ref={inputRef}
              style={styles.captureInput}
              placeholder="描述你想完成的任务…"
              placeholderTextColor="#55556A"
              multiline
              value={inputText}
              onChangeText={handleTextChange}
              onFocus={handleInputFocus}
              onBlur={() => setIsFocused(false)}
              editable={!isSaving}
              autoFocus
              showSoftInputOnFocus
            />

            {/* Analyzing indicator inside input area */}
            {showAnalyzingIndicator && (
              <>
                <View style={styles.separator} />
                <View style={styles.analyzingRow}>
                  <View style={styles.dotsContainer}>
                    <BouncingDot delayMs={0} />
                    <BouncingDot delayMs={200} />
                    <BouncingDot delayMs={400} />
                  </View>
                  <Text style={styles.analyzingText}>AI 正在理解你的想法…</Text>
                </View>
              </>
            )}
          </Pressable>

          {/* ── Error ── */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={handleReanalyze} hitSlop={8}>
                <Text style={styles.retryBtn}>重试</Text>
              </Pressable>
            </View>
          )}

          {/* ── Suggestion Chips ── */}
          {analysis && !isAnalyzing && (
            <View style={styles.chipsContainer}>
              <View style={[styles.chip, styles.chipActive]}>
                <Text style={styles.chipTextActive}>
                  {CATEGORY_LABELS[analysis.category] || analysis.category}
                </Text>
              </View>
              <View style={[styles.chip, styles.chipActive]}>
                <Text style={styles.chipTextActive}>
                  {formatMinutes(analysis.totalMinutes)}
                </Text>
              </View>
              <View style={[styles.chip, styles.chipActive]}>
                <Text style={styles.chipTextActive}>
                  建议拆成 {steps.length} 步
                </Text>
              </View>
            </View>
          )}

          {/* ── AI Steps Preview ── */}
          {analysis && !isAnalyzing && steps.length > 0 && (
            <View style={styles.stepsPreview}>
              {/* Header */}
              <View style={styles.stepsHeader}>
                <Text style={styles.stepsTitle}>AI 拆解的步骤</Text>
                <View style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>
                    ✦{' '}
                    {analysis.source === 'fallback'
                      ? '本地拆解'
                      : aiModel === 'claude'
                        ? 'Claude'
                        : 'GLM'}{' '}
                    AI
                  </Text>
                </View>
              </View>

              {/* Step list */}
              {steps.map((step, index) => (
                <StepRow
                  key={`${index}-${step.title}`}
                  step={step}
                  index={index}
                  onDelete={() => handleDeleteStep(index)}
                />
              ))}

              <AssessmentSection analysis={analysis} />

              {/* Re-analyze button */}
              <Pressable onPress={handleReanalyze} style={styles.reanalyzeBtn}>
                <Text style={styles.reanalyzeText}>重新拆解</Text>
              </Pressable>
            </View>
          )}

          {/* ── Action Buttons ── */}
          {(analysis || inputText.trim().length >= 3) && (
            <View style={styles.buttonsContainer}>
              <Pressable
                style={({ pressed }) => [
                  styles.btnPrimary,
                  pressed && styles.btnPressed,
                  isSaving && styles.btnDisabled,
                ]}
                onPress={() => handleSave(true)}
                disabled={isSaving}
              >
                <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
                  <Defs>
                    <LinearGradient id={primaryGradId} x1="0" y1="0" x2="1" y2="1">
                      <Stop offset="0%" stopColor="#3B7BF5" />
                      <Stop offset="100%" stopColor="#4F8EF7" />
                    </LinearGradient>
                  </Defs>
                  <Rect x="0" y="0" width="100%" height="100%" rx="16" ry="16" fill={`url(#${primaryGradId})`} />
                </Svg>
                <Text style={styles.btnPrimaryText}>
                  {isSaving ? '保存中…' : '加入今日计划'}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.btnGhost,
                  pressed && styles.btnGhostPressed,
                  isSaving && styles.btnDisabled,
                ]}
                onPress={() => handleSave(false)}
                disabled={isSaving}
              >
                <Text style={styles.btnGhostText}>先存起来</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardShell>

      <View style={styles.bottomNav}>
        <ModeNavBar active="new" />
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    position: 'relative',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    flexGrow: 1,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitle: {
    fontFamily: 'Syne',
    fontSize: 15,
    fontWeight: '700',
    color: '#E8E8F0',
  },
  headerSub: {
    fontSize: 12,
    color: '#55556A',
    marginTop: 2,
  },
  cancelBtn: {
    fontFamily: 'DM Mono',
    fontSize: 11,
    color: '#4F8EF7',
  },

  // ── Capture Area ──
  captureArea: {
    backgroundColor: '#18181F',
    borderWidth: 1,
    borderColor: '#2A2A38',
    borderRadius: 22,
    padding: 14,
    gap: 8,
  },
  captureAreaFocused: {
    borderColor: '#4F8EF7',
    shadowColor: '#4F8EF7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 0,
  },
  captureInput: {
    fontSize: 13,
    color: '#8888A0',
    minHeight: 60,
    textAlignVertical: 'top',
    lineHeight: 20,
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: '#2A2A38',
  },

  // ── Analyzing ──
  analyzingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4F8EF7',
  },
  analyzingText: {
    fontFamily: 'DM Mono',
    fontSize: 10,
    color: '#4F8EF7',
  },

  // ── Error ──
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 11,
    color: '#F87171',
    flex: 1,
  },
  retryBtn: {
    fontFamily: 'DM Mono',
    fontSize: 10,
    color: '#4F8EF7',
  },

  // ── Chips ──
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  chip: {
    fontFamily: 'DM Mono',
    fontSize: 9,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#333345',
    color: '#8888A0',
    backgroundColor: '#1E1E28',
  },
  chipActive: {
    borderColor: '#4F8EF7',
    backgroundColor: 'rgba(79,142,247,0.18)',
  },
  chipTextActive: {
    fontFamily: 'DM Mono',
    fontSize: 9,
    color: '#4F8EF7',
  },

  // ── Steps Preview ──
  stepsPreview: {
    backgroundColor: '#18181F',
    borderWidth: 1,
    borderColor: '#2A2A38',
    borderRadius: 22,
    padding: 14,
    gap: 8,
    marginTop: 4,
  },
  stepsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepsTitle: {
    fontSize: 12,
    color: '#8888A0',
    fontWeight: '500',
  },
  aiBadge: {
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.25)',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  aiBadgeText: {
    fontFamily: 'DM Mono',
    fontSize: 9,
    color: '#A78BFA',
  },

  // ── Step Row ──
  stepRowContainer: {
    overflow: 'hidden',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  stepNum: {
    fontFamily: 'DM Mono',
    fontSize: 9,
    color: '#55556A',
    width: 16,
  },
  stepText: {
    fontSize: 12,
    color: '#8888A0',
  },
  stepCopy: {
    flex: 1,
    gap: 2,
  },
  stepOutput: {
    fontSize: 10,
    color: '#55556A',
  },
  stepMin: {
    fontFamily: 'DM Mono',
    fontSize: 9,
    color: '#55556A',
  },

  // ── Assessments ──
  assessmentPanel: {
    borderTopWidth: 1,
    borderTopColor: '#2A2A38',
    marginTop: 4,
    paddingTop: 10,
    gap: 10,
  },
  assessmentBlock: {
    gap: 5,
  },
  assessmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assessmentKicker: {
    fontFamily: 'DM Mono',
    fontSize: 9,
    color: '#34D399',
  },
  assessmentTitle: {
    fontSize: 12,
    color: '#E8E8F0',
    fontWeight: '600',
    flex: 1,
  },
  assessmentPrompt: {
    fontSize: 11,
    color: '#8888A0',
    lineHeight: 16,
  },
  criteriaText: {
    fontSize: 10,
    color: '#55556A',
    lineHeight: 14,
  },

  // ── Re-analyze ──
  reanalyzeBtn: {
    alignSelf: 'center',
    marginTop: 4,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  reanalyzeText: {
    fontFamily: 'DM Mono',
    fontSize: 10,
    color: '#55556A',
  },

  // ── Buttons ──
  buttonsContainer: {
    marginTop: 16,
    gap: 8,
  },
  btnPrimary: {
    backgroundColor: '#4F8EF7',
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    shadowColor: '#4F8EF7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  btnPressed: {
    transform: [{ translateY: 1 }, { scale: 0.99 }],
  },
  btnPrimaryText: {
    fontFamily: 'Syne',
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2A2A38',
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnGhostPressed: {
    backgroundColor: '#1E1E28',
    borderColor: '#333345',
  },
  btnGhostText: {
    fontSize: 12,
    color: '#55556A',
  },
  btnDisabled: {
    opacity: 0.5,
  },

  // ── Spacing ──
  bottomNav: {
    borderTopWidth: 1,
    borderTopColor: '#2A2A38',
    paddingHorizontal: 20,
    paddingBottom: 6,
    backgroundColor: '#0A0A0F',
  },
});
