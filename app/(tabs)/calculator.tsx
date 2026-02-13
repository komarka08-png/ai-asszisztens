// app/calculator.tsx

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/* =========================
   PREMIUM LIGHT THEME (upgraded, still clean)
========================= */
const THEME = {
  bg: '#F6F7FB',
  surface: '#FFFFFF',
  text: '#0B1220',
  muted: '#6B7280',
  subtle: '#94A3B8',
  border: '#E6E8F0',
  borderStrong: '#D3D8E6',

  primary: '#2563EB',
  primarySoft: '#EEF2FF',

  good: '#16A34A',
  goodSoft: '#ECFDF5',

  accent: '#7C3AED',
  accentSoft: '#F5F3FF',

  danger: '#EF4444',
  dangerSoft: '#FEF2F2',

  shadow: 'rgba(15, 23, 42, 0.08)',

  gradA: 'rgba(37, 99, 235, 0.08)',
  gradB: 'rgba(124, 58, 237, 0.06)',
  shadowStrong: 'rgba(15, 23, 42, 0.12)',
  ctaShadow: 'rgba(37, 99, 235, 0.35)',
};

const GRID = 8;
const H_MARGIN = 16;
const STORAGE_PARAMS = '@calc_params_v1';

/* =========================
   TYPES
========================= */
type IcrPeriod = {
  start: number;
  end: number;
  unitsPer10g: number;
};

type IcrPeriods = {
  morning?: IcrPeriod;
  noon?: IcrPeriod;
  evening?: IcrPeriod;
};

type TargetRange = { min: number; max: number };

/* =========================
   HELPERS
========================= */
const toNumber = (s: string) => {
  const n = Number(String(s ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const format1 = (n: number) => {
  const s = (Math.round(n * 10) / 10).toFixed(1);
  return s.replace('.', ',');
};

/* =========================
   MATERIAL PRESS HELPERS (ANIM)
========================= */
function usePressScale(disabled?: boolean, to = 0.98) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    if (disabled) return;
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();
  };

  const onPressOut = () => {
    if (disabled) return;
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();
  };

  return { scale, onPressIn, onPressOut };
}

const androidRipple = (color = 'rgba(0,0,0,0.10)') =>
  Platform.OS === 'android' ? { android_ripple: { color, borderless: false } } : {};

/* =========================
   UI
========================= */
const Surface: React.FC<React.PropsWithChildren<{ style?: any; delay?: number }>> = ({
  children,
  style,
  delay = 0,
}) => {
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(appear, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      delay,
    }).start();
  }, [appear, delay]);

  return (
    <Animated.View
      style={[
        styles.surface,
        style,
        {
          opacity: appear,
          transform: [
            { translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
            { scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

const SectionTitle = ({
  title,
  hint,
  icon,
}: {
  title: string;
  hint?: string;
  icon: keyof typeof Ionicons.glyphMap;
}) => (
  <View style={styles.sectionTitleWrap}>
    <View style={styles.sectionIcon}>
      <Ionicons name={icon} size={16} color={THEME.text} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!hint && <Text style={styles.sectionHint}>{hint}</Text>}
    </View>
  </View>
);

/* =========================
   FIELD
========================= */
function Field({
  label,
  value,
  onChangeText,
  placeholder,
  unit,
  icon,
  inputRef,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  unit: string;
  icon: keyof typeof Ionicons.glyphMap;
  inputRef?: React.Ref<TextInput>;
  testID?: string;
}) {
  const [focused, setFocused] = useState(false);
  const filled = value.trim().length > 0;

  return (
    <View style={{ marginTop: GRID * 1.5 }}>
      <Text style={styles.label}>{label}</Text>

      <View style={[styles.field, focused && styles.fieldFocused, filled && styles.fieldFilled]}>
        <View style={[styles.fieldIcon, focused && styles.fieldIconFocused]}>
          <Ionicons name={icon} size={18} color={focused ? THEME.primary : THEME.muted} />
        </View>

        <TextInput
          ref={inputRef}
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={THEME.subtle}
          style={styles.input}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />

        <View style={styles.unitPill}>
          <Text style={styles.unitText}>{unit}</Text>
        </View>
      </View>
    </View>
  );
}

/* =========================
   PILL (ANIM + RIPPLE)
========================= */
function Pill({
  icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tone?: 'neutral' | 'primary' | 'accent' | 'good' | 'danger';
}) {
  const toneStyle =
    tone === 'primary'
      ? styles.pillPrimary
      : tone === 'accent'
        ? styles.pillAccent
        : tone === 'good'
          ? styles.pillGood
          : tone === 'danger'
            ? styles.pillDanger
            : styles.pillNeutral;

  const toneText =
    tone === 'primary'
      ? styles.pillTextPrimary
      : tone === 'accent'
        ? styles.pillTextAccent
        : tone === 'good'
          ? styles.pillTextGood
          : tone === 'danger'
            ? styles.pillTextDanger
            : styles.pillTextNeutral;

  const { scale, onPressIn, onPressOut } = usePressScale(false, 0.97);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        {...androidRipple('rgba(0,0,0,0.08)')}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.pill, toneStyle]}
      >
        <Ionicons name={icon} size={14} color={toneText.color as string} />
        <Text style={[styles.pillLabel, toneText]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.pillValue, toneText]} numberOfLines={1}>
          {value}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/* =========================
   HEADER
========================= */
function Header({ onSettings }: { onSettings: () => void }) {
  const { scale, onPressIn, onPressOut } = usePressScale(false, 0.96);

  return (
    <View style={styles.headerWrap}>
      <View pointerEvents="none" style={styles.headerGlowA} />
      <View pointerEvents="none" style={styles.headerGlowB} />

      <View style={styles.headerTitleRow}>
        <View style={{ width: 42, height: 42 }} />

        <Text style={styles.headerTitleCentered} numberOfLines={1}>
          Bólus kalkulátor
        </Text>

        <Animated.View style={{ transform: [{ scale }] }}>
          <Pressable
            onPress={onSettings}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            hitSlop={10}
            style={styles.headerIconBtn}
            accessibilityRole="button"
            accessibilityLabel="Beállítások"
            {...androidRipple('rgba(0,0,0,0.08)')}
          >
            <Ionicons name="settings-outline" size={20} color={THEME.text} />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

/* =========================
   PRIMARY BUTTON (ANIM + RIPPLE)
========================= */
function PrimaryButton({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { scale, onPressIn, onPressOut } = usePressScale(!!disabled, 0.985);

  return (
    <View style={styles.primaryBtnWrap}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          {...androidRipple('rgba(255,255,255,0.18)')}
          onPress={onPress}
          disabled={!!disabled}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={[styles.primaryBtn, disabled && styles.primaryBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel={title}
        >
          <Text style={styles.primaryBtnText}>{title}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/* =========================
   SCREEN
========================= */
export default function CalculatorScreen() {
  const [bloodSugar, setBloodSugar] = useState('');
  const [carbs, setCarbs] = useState('');

  const carbsRef = useRef<TextInput>(null);

  const resetInputs = useCallback(() => {
    setBloodSugar('');
    setCarbs('');
  }, []);

  const [icrPeriods, setIcrPeriods] = useState<IcrPeriods | null>(null);
  const [isf, setIsf] = useState<number | null>(null);
  const [targetRange, setTargetRange] = useState<TargetRange | null>(null);
  const [paramsLoading, setParamsLoading] = useState(true);

  const FALLBACK_UNITS_PER_10G = 1;

  const VC_NORMAL_FROM = 5.0;
  const VC_ZERO_AT = 3.0;
  const STEP = 0.1;
  const STEP_DROP = 0.05;

  // Screen enter animation (Material-style)
  const screenIn = useRef(new Animated.Value(0)).current;
  // Result pulse when it becomes valid / changes
  const resultPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(screenIn, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [screenIn]);

  const [minuteTick, setMinuteTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setMinuteTick((x) => x + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const loadCalcParams = useCallback(async () => {
    setParamsLoading(true);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_PARAMS);
      const data = raw ? JSON.parse(raw) : {};

      setIcrPeriods(data?.icrPeriods ?? null);

      if (typeof data?.isf === 'number' && Number.isFinite(data.isf) && data.isf > 0) setIsf(data.isf);
      else setIsf(null);

      if (
        data?.targetRange &&
        Number.isFinite(data.targetRange.min) &&
        Number.isFinite(data.targetRange.max) &&
        data.targetRange.min <= data.targetRange.max
      ) {
        setTargetRange({ min: data.targetRange.min, max: data.targetRange.max });
      } else {
        setTargetRange(null);
      }
    } catch {
      setIcrPeriods(null);
      setIsf(null);
      setTargetRange(null);
    } finally {
      setParamsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCalcParams();
    }, [loadCalcParams])
  );

  const getCurrentUnitsPer10g = useCallback((): number => {
    const safeFallback = FALLBACK_UNITS_PER_10G;

    const safeNum = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const safeUnits = (u: any) => {
      const n = safeNum(u);
      return n != null && n > 0 ? n : null;
    };

    if (!icrPeriods) return safeFallback;

    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;

    const match = (p?: IcrPeriod) => {
      if (!p) return null;

      const u = safeUnits((p as any).unitsPer10g);
      if (u == null) return null;

      const start = safeNum((p as any).start);
      const end = safeNum((p as any).end);
      if (start == null || end == null) return null;

      if (start < end) {
        if (hour >= start && hour < end) return u;
      } else {
        if (hour >= start || hour < end) return u;
      }
      return null;
    };

    return match(icrPeriods.morning) ?? match(icrPeriods.noon) ?? match(icrPeriods.evening) ?? safeFallback;
  }, [icrPeriods]);

  const unitsPer10g = useMemo(() => getCurrentUnitsPer10g(), [getCurrentUnitsPer10g, minuteTick]);

  const hasVc = bloodSugar.trim().length > 0;
  const hasCh = carbs.trim().length > 0;

  const vcRaw = useMemo(() => toNumber(bloodSugar), [bloodSugar]);
  const chRaw = useMemo(() => toNumber(carbs), [carbs]);

  const nCh = useMemo(() => (Number.isFinite(chRaw) ? Math.max(0, chRaw) : 0), [chRaw]);
  const meal = useMemo(() => (nCh > 0 ? (nCh / 10) * unitsPer10g : 0), [nCh, unitsPer10g]);

  const vcFactor = useMemo(() => {
    if (!hasVc || !Number.isFinite(vcRaw)) return 1;

    const vc = vcRaw;
    if (vc >= VC_NORMAL_FROM) return 1;
    if (vc <= VC_ZERO_AT) return 0;

    const bucket = Math.floor((vc + 1e-9) * 10) / 10;
    const steps = Math.floor((VC_NORMAL_FROM - bucket) / STEP + 1e-9);
    const factor = 1 - steps * STEP_DROP;

    return clamp(factor, 0, 1);
  }, [hasVc, vcRaw]);

  const mealAdjusted = useMemo(() => meal * vcFactor, [meal, vcFactor]);

  const correction = useMemo(() => {
    if (!hasVc || !Number.isFinite(vcRaw)) return 0;
    if (!isf || !Number.isFinite(isf) || isf <= 0) return 0;
    if (!targetRange) return 0;

    const vc = vcRaw;
    if (vc <= targetRange.max) return 0;

    const above = vc - targetRange.max;
    const corr = above / isf;
    return Number.isFinite(corr) ? Math.max(0, corr) : 0;
  }, [hasVc, vcRaw, isf, targetRange]);

  const totalUnits = useMemo(() => mealAdjusted + correction, [mealAdjusted, correction]);

  const canShowResult =
    !paramsLoading &&
    hasVc &&
    hasCh &&
    Number.isFinite(vcRaw) &&
    vcRaw > 0 &&
    Number.isFinite(chRaw) &&
    Number.isFinite(totalUnits) &&
    totalUnits >= 0;

  const resultText = canShowResult ? `${Math.round(totalUnits)}` : '—';
  const canTransfer = canShowResult;

  // Pulse when result becomes valid / changes
  useEffect(() => {
    if (!canShowResult) return;
    resultPulse.stopAnimation();
    resultPulse.setValue(0);
    Animated.timing(resultPulse, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [canShowResult, resultText, resultPulse]);

  const onTransfer = () => {
    if (!hasVc && !hasCh) return Alert.alert('Hiányzó adatok', 'Add meg a hiányzó adatokat!');
    if (!hasVc) return Alert.alert('Hiányzó adat', 'Add meg a vércukorszint adatát!');
    if (!hasCh) return Alert.alert('Hiányzó adat', 'Add meg a szénhidrát adatát!');

    const invalidVc = !Number.isFinite(vcRaw) || vcRaw <= 0;
    const invalidCh = !Number.isFinite(chRaw);

    if (invalidVc && invalidCh) return Alert.alert('Hibás adatok', 'Adj meg valódi adatokat!');
    if (invalidVc) return Alert.alert('Hibás adat', 'Adj meg valódi vércukorszint adatot!');
    if (invalidCh) return Alert.alert('Hibás adat', 'Adj meg valódi szénhidrát adatot!');

    if (!Number.isFinite(totalUnits) || totalUnits < 0) {
      return Alert.alert('Hiba', 'A számítás eredménye hibás. Ellenőrizd a beállításokat (ICR/ISF/cél tartomány).');
    }

    const vcToSend = bloodSugar;
    const chToSend = carbs;
    const unitsToSend = String(Math.round(totalUnits));

    resetInputs();

    router.push({
      pathname: '/registration',
      params: { vc: vcToSend, ch: chToSend, units: unitsToSend, type: 'bolus' },
    });
  };

  const correctionTone: 'neutral' | 'primary' = correction > 0 ? 'primary' : 'neutral';
  const factorTone: 'neutral' | 'primary' = hasVc && Number.isFinite(vcRaw) ? 'primary' : 'neutral';

  const mealInt = canShowResult ? Math.round(mealAdjusted) : null;
  const corrInt = canShowResult ? Math.round(correction) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View pointerEvents="none" style={styles.bgAmbient} />
      <View pointerEvents="none" style={styles.bgBlobA} />
      <View pointerEvents="none" style={styles.bgBlobB} />

      <Header
        onSettings={() =>
          router.push({
            pathname: '/settings',
            params: { from: 'calculator' },
          })
        }
      />

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Animated.View
            style={{
              opacity: screenIn,
              transform: [{ translateY: screenIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            }}
          >
            <SectionTitle icon="create-outline" title="Adatok" hint="A számításhoz szükséges értékek" />

            <Surface delay={60}>
              <Field
                label="Vércukorszint"
                value={bloodSugar}
                onChangeText={(t) => setBloodSugar(t.replace('.', ','))}
                placeholder="..."
                unit="mmol/L"
                icon="water-outline"
                testID="input-bloodSugar"
              />

              <Field
                label="Szénhidrát"
                value={carbs}
                onChangeText={(t) => setCarbs(t.replace('.', ','))}
                placeholder="..."
                unit="g"
                icon="nutrition-outline"
                inputRef={carbsRef}
                testID="input-carbs"
              />

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={16} color={THEME.muted} />
                  <Text style={styles.metaText}>ICR: {format1(unitsPer10g)} E / 10g</Text>
                </View>

                <View style={styles.metaItem}>
                  <Ionicons name="analytics-outline" size={16} color={THEME.muted} />
                  <Text style={styles.metaText}>
                    ISF: {isf && isf > 0 ? `${format1(isf)} mmol/L` : 'nincs beállítva'}
                  </Text>
                </View>
              </View>
            </Surface>

            <View style={{ height: GRID * 2 }} />

            <SectionTitle
              icon="sparkles-outline"
              title="Eredmény"
              hint={paramsLoading ? 'Paraméterek betöltése…' : 'Javaslat az értékeid alapján'}
            />

            <Surface delay={120}>
              <Animated.View
                style={{
                  transform: [
                    {
                      scale: resultPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.01] }),
                    },
                  ],
                }}
              >
                <Pressable style={styles.resultBox} {...androidRipple('rgba(37, 99, 235, 0.12)')}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultLabel}>Javasolt inzulin</Text>
                    <View style={styles.resultValueRow}>
                      <Text style={styles.resultValue}>{resultText}</Text>
                      <Text style={styles.resultUnit}>{canShowResult ? 'E' : ''}</Text>
                    </View>
                    <Text style={styles.resultNote}>
                      {canShowResult ? 'Kerekített összeg, étkezési + korrekció.' : 'Töltsd ki a mezőket a számításhoz.'}
                    </Text>
                  </View>

                  <View style={styles.resultIcon}>
                    <Ionicons
                      name={canShowResult ? 'checkmark-circle-outline' : 'information-circle-outline'}
                      size={26}
                      color={canShowResult ? THEME.primary : THEME.muted}
                    />
                  </View>
                </Pressable>
              </Animated.View>

              <View style={{ height: GRID * 2 }} />

              <View style={styles.pillRow}>
                <Pill icon="restaurant-outline" label="Étkezés" value={canShowResult ? `${mealInt} E` : '—'} tone="neutral" />
                <Pill
                  icon="trending-up-outline"
                  label="Korrekció"
                  value={canShowResult ? `${corrInt} E` : '—'}
                  tone={correctionTone}
                />
                <Pill
                  icon="pulse-outline"
                  label="Faktor"
                  value={hasVc && Number.isFinite(vcRaw) ? Math.round(vcFactor * 100) + '%' : '—'}
                  tone={factorTone}
                />
              </View>
            </Surface>
          </Animated.View>
        </ScrollView>
      </View>

      <View style={styles.actionBar}>
        <View style={styles.actionBarInner}>
          <PrimaryButton title="Adatok átvitele" onPress={onTransfer} disabled={!canTransfer} />
        </View>
      </View>
    </SafeAreaView>
  );
}

/* =========================
   STYLES
========================= */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME.bg },

  bgAmbient: { ...StyleSheet.absoluteFillObject, backgroundColor: THEME.bg },
  bgBlobA: {
    position: 'absolute',
    right: -160,
    top: 120,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: THEME.gradA,
  },
  bgBlobB: {
    position: 'absolute',
    left: -180,
    top: 340,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: THEME.gradB,
  },

  headerWrap: {
    paddingHorizontal: H_MARGIN,
    paddingTop: GRID * 1.25,
    paddingBottom: GRID * 1.5,
    backgroundColor: 'transparent',
  },
  headerGlowA: {
    position: 'absolute',
    right: -120,
    top: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(37, 99, 235, 0.10)',
  },
  headerGlowB: {
    position: 'absolute',
    left: -140,
    top: -110,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(230,232,240,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },
  headerTitleCentered: {
    flex: 1,
    color: THEME.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.2,
    textAlign: 'center',
  },

  scrollContent: {
    paddingHorizontal: H_MARGIN,
    paddingTop: GRID * 2,
    paddingBottom: 140,
  },

  sectionTitleWrap: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: GRID * 1.5 },
  sectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(148,163,184,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: THEME.text, letterSpacing: 0.2 },
  sectionHint: { marginTop: 2, fontSize: 12.5, color: THEME.muted },

  surface: {
    backgroundColor: THEME.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(230,232,240,0.9)',
    shadowColor: THEME.shadowStrong,
    shadowOpacity: Platform.OS === 'ios' ? 1 : 0,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: Platform.OS === 'android' ? 3 : 0,
  },

  label: { fontSize: 13, fontWeight: '800', color: THEME.text, marginBottom: 8, letterSpacing: 0.1 },

  field: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(230,232,240,0.95)',
    backgroundColor: 'rgba(148,163,184,0.05)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldFocused: { borderColor: 'rgba(37, 99, 235, 0.55)', backgroundColor: 'rgba(37, 99, 235, 0.07)' },
  fieldFilled: { borderColor: THEME.borderStrong, backgroundColor: 'rgba(148,163,184,0.04)' },
  fieldIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(230,232,240,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  fieldIconFocused: { borderColor: 'rgba(37, 99, 235, 0.25)', backgroundColor: 'rgba(37, 99, 235, 0.08)' },
  input: { flex: 1, fontSize: 16, color: THEME.text, paddingVertical: Platform.OS === 'ios' ? 12 : 10 },
  unitPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: THEME.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.20)',
    marginLeft: 10,
  },
  unitText: { fontSize: 12.5, fontWeight: '800', color: THEME.primary },

  metaRow: { marginTop: GRID * 2, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  metaText: { color: THEME.muted, fontSize: 12, fontWeight: '800' },

  resultBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.16)',
    borderRadius: 20,
    padding: GRID * 2,
    alignItems: 'center',
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },
  resultLabel: { color: THEME.muted, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  resultValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 6 },
  resultValue: { color: THEME.text, fontSize: 44, fontWeight: '900', letterSpacing: -0.2, lineHeight: 46 },
  resultUnit: { color: THEME.muted, fontSize: 16, fontWeight: '900', paddingBottom: 6 },
  resultNote: { marginTop: 8, color: THEME.muted, fontSize: 13, lineHeight: 18 },
  resultIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(230,232,240,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },
  pillNeutral: { backgroundColor: 'rgba(15,23,42,0.04)', borderColor: 'rgba(148,163,184,0.18)' },
  pillPrimary: { backgroundColor: THEME.primarySoft, borderColor: 'rgba(37, 99, 235, 0.22)' },
  pillAccent: { backgroundColor: THEME.accentSoft, borderColor: 'rgba(124, 58, 237, 0.22)' },
  pillGood: { backgroundColor: THEME.goodSoft, borderColor: 'rgba(22, 163, 74, 0.22)' },
  pillDanger: { backgroundColor: THEME.dangerSoft, borderColor: 'rgba(239, 68, 68, 0.22)' },
  pillTextNeutral: { color: THEME.muted },
  pillTextPrimary: { color: THEME.primary },
  pillTextAccent: { color: THEME.accent },
  pillTextGood: { color: THEME.good },
  pillTextDanger: { color: THEME.danger },
  pillLabel: { fontSize: 12, fontWeight: '800' },
  pillValue: { fontSize: 12, fontWeight: '900', marginLeft: 2 },

  /* action bar */
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: THEME.surface,
    borderTopWidth: 1,
    borderTopColor: 'rgba(230,232,240,0.9)',
  },
  actionBarInner: {
    paddingHorizontal: H_MARGIN,
    paddingTop: GRID * 1.5,
    paddingBottom: GRID * 1.5,
  },

  primaryBtnWrap: { position: 'relative' },
  primaryBtn: {
    height: 56,
    borderRadius: 18,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0,
    elevation: 0,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },
  primaryBtnDisabled: { backgroundColor: 'rgba(37, 99, 235, 0.45)' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.2, textAlign: 'center' },
});
