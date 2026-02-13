// app/settings-icr.tsx
// ✅ Animated (NO Reanimated) — ugyanúgy mint calculator / timeline
// - Screen intro (fade + slight translate)
// - Content blocks enter (stagger)
// - Press micro anim (scale) + Android ripple (header back + save)
// ✅ UI + logika változatlan
// ✅ Action bar tömör (timeline-szerű)
// ✅ Mentés gomb NO glow / NO shadow

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
   PREMIUM LIGHT THEME (match calculator)
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
   ACTION BAR (tömör timeline-szerű)
========================= */
const CTA_H = 52; // ✅ tömörebb mint 56
const ACTION_PAD_Y = GRID * 1.25; // ✅ kisebb padding (10px)
const ACTION_BAR_H = CTA_H + ACTION_PAD_Y * 2 + 1;

/* =========================
   ANDROID RIPPLE
========================= */
const androidRipple = (color = 'rgba(0,0,0,0.10)') =>
  Platform.OS === 'android' ? { android_ripple: { color, borderless: false } } : {};

/* =========================
   PRESS SCALE (NO Reanimated)
========================= */
function usePressScale(disabled?: boolean, to = 0.985) {
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

/* =========================
   FADE + SLIDE IN WRAPPER (calculator-like)
========================= */
function FadeSlideIn({
  children,
  delay = 0,
  style,
  dy = 10,
  duration = 360,
}: React.PropsWithChildren<{ delay?: number; style?: any; dy?: number; duration?: number }>) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    v.stopAnimation();
    v.setValue(0);
    Animated.timing(v, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      delay,
    }).start();
  }, [v, delay, duration]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/* =========================
   HELPERS
========================= */
const toNumOrNaN = (s: string) => {
  const t = String(s ?? '').trim();
  if (!t) return NaN;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

const toNum = (s: string) => Number((s || '').replace(',', '.'));
const checkHour = (n: number) => Number.isFinite(n) && n >= 0 && n <= 24;

/* =========================
   UI PRIMITIVES (match calculator)
========================= */
const Surface: React.FC<React.PropsWithChildren<{ style?: any }>> = ({ children, style }) => (
  <View style={[styles.surface, style]}>{children}</View>
);

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
   HEADER (calculator-style) — press micro anim + ripple
========================= */
function Header({ title, onBack }: { title: string; onBack: () => void }) {
  const backPress = usePressScale(false, 0.96);

  return (
    <View style={styles.headerWrap}>
      <View pointerEvents="none" style={styles.headerGlowA} />
      <View pointerEvents="none" style={styles.headerGlowB} />

      <View style={styles.headerTitleRow}>
        <Animated.View style={{ transform: [{ scale: backPress.scale }] }}>
          <Pressable
            onPress={onBack}
            hitSlop={12}
            onPressIn={backPress.onPressIn}
            onPressOut={backPress.onPressOut}
            style={styles.headerIconBtn}
            accessibilityRole="button"
            accessibilityLabel="Vissza"
            {...androidRipple('rgba(0,0,0,0.08)')}
          >
            <Ionicons name="chevron-back" size={20} color={THEME.text} />
          </Pressable>
        </Animated.View>

        <Text style={styles.headerTitleCentered} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>

        <View style={{ width: 42, height: 42 }} />
      </View>
    </View>
  );
}

/* =========================
   FIELD (match calculator) — no anim (UI unchanged)
========================= */
function Field({
  label,
  value,
  onChangeText,
  placeholder,
  unit,
  icon,
  keyboardType,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  unit: string;
  icon: keyof typeof Ionicons.glyphMap;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'number-pad';
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
          testID={testID}
          value={value}
          onChangeText={(t) => onChangeText(String(t).replace('.', ','))}
          keyboardType={keyboardType ?? 'decimal-pad'}
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
   PRIMARY BUTTON (match calculator)
   ✅ NO glow / NO shadow
   ✅ press micro anim + ripple
========================= */
function PrimaryButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  const press = usePressScale(!!disabled, 0.985);

  return (
    <Animated.View style={{ transform: [{ scale: press.scale }] }}>
      <Pressable
        onPress={onPress}
        disabled={!!disabled}
        accessibilityRole="button"
        accessibilityLabel={title}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[styles.primaryBtn, disabled && styles.primaryBtnDisabled]}
        {...androidRipple('rgba(255,255,255,0.18)')}
      >
        <Text style={styles.primaryBtnText}>{title}</Text>
      </Pressable>
    </Animated.View>
  );
}

/* =========================
   PERIOD CARD (3 separate cards) — UI unchanged
========================= */
function PeriodCard({
  startValue,
  endValue,
  unitsValue,
  onStartChange,
  onEndChange,
  onUnitsChange,
  startPh,
  endPh,
  unitsPh,
}: {
  startValue: string;
  endValue: string;
  unitsValue: string;
  onStartChange: (t: string) => void;
  onEndChange: (t: string) => void;
  onUnitsChange: (t: string) => void;
  startPh: string;
  endPh: string;
  unitsPh: string;
}) {
  return (
    <View>
      {/* ✅ KÁRTYÁK KÖZÖTT: timeline -> GRID * 1.5 = 12px */}
      <Surface style={{ marginBottom: GRID * 1.5 }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Kezdet"
              value={startValue}
              onChangeText={onStartChange}
              placeholder={startPh}
              unit="ó"
              icon="log-in-outline"
              keyboardType="number-pad"
            />
          </View>

          <View style={{ flex: 1 }}>
            <Field
              label="Vége"
              value={endValue}
              onChangeText={onEndChange}
              placeholder={endPh}
              unit="ó"
              icon="log-out-outline"
              keyboardType="number-pad"
            />
          </View>
        </View>

        <Field
          label="Szénhidrát (10 g-hoz)"
          value={unitsValue}
          onChangeText={onUnitsChange}
          placeholder={unitsPh}
          unit="E"
          icon="nutrition-outline"
          keyboardType="decimal-pad"
        />
      </Surface>
    </View>
  );
}

/* =========================
   SCREEN
========================= */
export default function SettingsIcrScreen() {
  const router = useRouter();

  const [p1Start, setP1Start] = useState('');
  const [p1End, setP1End] = useState('');
  const [p1Units, setP1Units] = useState('');

  const [p2Start, setP2Start] = useState('');
  const [p2End, setP2End] = useState('');
  const [p2Units, setP2Units] = useState('');

  const [p3Start, setP3Start] = useState('');
  const [p3End, setP3End] = useState('');
  const [p3Units, setP3Units] = useState('');

  const [saved, setSaved] = useState({
    p1Start: '',
    p1End: '',
    p1Units: '',
    p2Start: '',
    p2End: '',
    p2Units: '',
    p3Start: '',
    p3End: '',
    p3Units: '',
  });

  // Screen intro anim
  const screenIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(screenIn, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [screenIn]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_PARAMS);
        if (!raw) return;

        const data = JSON.parse(raw);
        const icr = data?.icrPeriods;
        if (!icr) return;

        const next = {
          p1Start: icr.morning ? String(icr.morning.start) : '',
          p1End: icr.morning ? String(icr.morning.end) : '',
          p1Units: icr.morning ? String(icr.morning.unitsPer10g).replace('.', ',') : '',

          p2Start: icr.noon ? String(icr.noon.start) : '',
          p2End: icr.noon ? String(icr.noon.end) : '',
          p2Units: icr.noon ? String(icr.noon.unitsPer10g).replace('.', ',') : '',

          p3Start: icr.evening ? String(icr.evening.start) : '',
          p3End: icr.evening ? String(icr.evening.end) : '',
          p3Units: icr.evening ? String(icr.evening.unitsPer10g).replace('.', ',') : '',
        };

        setP1Start(next.p1Start);
        setP1End(next.p1End);
        setP1Units(next.p1Units);

        setP2Start(next.p2Start);
        setP2End(next.p2End);
        setP2Units(next.p2Units);

        setP3Start(next.p3Start);
        setP3End(next.p3End);
        setP3Units(next.p3Units);

        setSaved(next);
      } catch {}
    })();
  }, []);

  const onBack = () => {
    const fields = [p1Start, p1End, p1Units, p2Start, p2End, p2Units, p3Start, p3End, p3Units];
    const hasAnyEmpty = fields.some((v) => String(v).trim() === '');

    if (hasAnyEmpty) {
      setP1Start(saved.p1Start);
      setP1End(saved.p1End);
      setP1Units(saved.p1Units);

      setP2Start(saved.p2Start);
      setP2End(saved.p2End);
      setP2Units(saved.p2Units);

      setP3Start(saved.p3Start);
      setP3End(saved.p3End);
      setP3Units(saved.p3Units);
    }

    router.push('/settings');
  };

  const fields = [p1Start, p1End, p1Units, p2Start, p2End, p2Units, p3Start, p3End, p3Units];
  const allFilled = fields.every((v) => String(v).trim() !== '');

  const s1 = useMemo(() => toNumOrNaN(p1Start), [p1Start]);
  const e1 = useMemo(() => toNumOrNaN(p1End), [p1End]);
  const s2 = useMemo(() => toNumOrNaN(p2Start), [p2Start]);
  const e2 = useMemo(() => toNumOrNaN(p2End), [p2End]);
  const s3 = useMemo(() => toNumOrNaN(p3Start), [p3Start]);
  const e3 = useMemo(() => toNumOrNaN(p3End), [p3End]);

  const u1 = useMemo(() => toNumOrNaN(p1Units), [p1Units]);
  const u2 = useMemo(() => toNumOrNaN(p2Units), [p2Units]);
  const u3 = useMemo(() => toNumOrNaN(p3Units), [p3Units]);

  const intervalInvalid =
    !checkHour(s1) ||
    !checkHour(e1) ||
    !checkHour(s2) ||
    !checkHour(e2) ||
    !checkHour(s3) ||
    !checkHour(e3) ||
    s1 === e1 ||
    s2 === e2 ||
    s3 === e3;

  const unitsInvalid =
    !Number.isFinite(u1) || u1 <= 0 || !Number.isFinite(u2) || u2 <= 0 || !Number.isFinite(u3) || u3 <= 0;

  const canSave = allFilled && !intervalInvalid && !unitsInvalid;

  const saveICR = async () => {
    const emptyCount = fields.filter((v) => String(v).trim() === '').length;

    if (emptyCount === fields.length) return Alert.alert('Hiányzó adatok', 'Add meg a hiányzó adatokat!');
    if (emptyCount === 1) return Alert.alert('Hiányzó adat', 'Add meg a hiányzó adatot!');
    if (emptyCount > 1) return Alert.alert('Hiányzó adatok', 'Add meg a hiányzó adatokat!');

    const _s1 = toNum(p1Start);
    const _e1 = toNum(p1End);
    const _s2 = toNum(p2Start);
    const _e2 = toNum(p2End);
    const _s3 = toNum(p3Start);
    const _e3 = toNum(p3End);

    const _u1 = toNum(p1Units);
    const _u2 = toNum(p2Units);
    const _u3 = toNum(p3Units);

    const _intervalInvalid =
      !checkHour(_s1) ||
      !checkHour(_e1) ||
      !checkHour(_s2) ||
      !checkHour(_e2) ||
      !checkHour(_s3) ||
      !checkHour(_e3) ||
      _s1 === _e1 ||
      _s2 === _e2 ||
      _s3 === _e3;

    const _unitsInvalid = !_u1 || _u1 <= 0 || !_u2 || _u2 <= 0 || !_u3 || _u3 <= 0;

    const invalidCount = [_intervalInvalid, _unitsInvalid].filter(Boolean).length;
    if (invalidCount > 1) return Alert.alert('Hibás adatok', 'Adj meg valódi adatokat!');
    if (_intervalInvalid) return Alert.alert('Hibás adat', 'Adj meg valódi időintervallumot!');
    if (_unitsInvalid) return Alert.alert('Hibás adat', 'Adj meg valódi inzulin egységet!');

    const data = {
      icrPeriods: {
        morning: { start: _s1, end: _e1, unitsPer10g: _u1 },
        noon: { start: _s2, end: _e2, unitsPer10g: _u2 },
        evening: { start: _s3, end: _e3, unitsPer10g: _u3 },
      },
    };

    await AsyncStorage.mergeItem(STORAGE_PARAMS, JSON.stringify(data));

    const nextSaved = {
      p1Start: String(_s1),
      p1End: String(_e1),
      p1Units: String(_u1).includes('.') ? String(_u1).replace('.', ',') : String(_u1),

      p2Start: String(_s2),
      p2End: String(_e2),
      p2Units: String(_u2).includes('.') ? String(_u2).replace('.', ',') : String(_u2),

      p3Start: String(_s3),
      p3End: String(_e3),
      p3Units: String(_u3).includes('.') ? String(_u3).replace('.', ',') : String(_u3),
    };
    setSaved(nextSaved);

    Alert.alert('Sikeres mentés', 'Az Inzulin–szénhidrát arány elmentve.', [
      { text: 'OK', onPress: () => router.push('/settings') },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View pointerEvents="none" style={styles.bgAmbient} />
      <View pointerEvents="none" style={styles.bgBlobA} />
      <View pointerEvents="none" style={styles.bgBlobB} />

      <Header title="Inzulin–szénhidrát arány" onBack={onBack} />

      <Animated.View
        style={{
          flex: 1,
          opacity: screenIn,
          transform: [{ translateY: screenIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <FadeSlideIn delay={30} dy={8}>
            <SectionTitle
              icon="options-outline"
              title="Beállítás"
              hint="Add meg az időintervallumot és az inzulint 10 g-hoz."
            />
          </FadeSlideIn>

          <FadeSlideIn delay={80}>
            <PeriodCard
              startValue={p1Start}
              endValue={p1End}
              unitsValue={p1Units}
              onStartChange={setP1Start}
              onEndChange={setP1End}
              onUnitsChange={setP1Units}
              startPh="..."
              endPh="..."
              unitsPh="..."
            />
          </FadeSlideIn>

          <FadeSlideIn delay={130}>
            <PeriodCard
              startValue={p2Start}
              endValue={p2End}
              unitsValue={p2Units}
              onStartChange={setP2Start}
              onEndChange={setP2End}
              onUnitsChange={setP2Units}
              startPh="..."
              endPh="..."
              unitsPh="..."
            />
          </FadeSlideIn>

          <FadeSlideIn delay={180}>
            <PeriodCard
              startValue={p3Start}
              endValue={p3End}
              unitsValue={p3Units}
              onStartChange={setP3Start}
              onEndChange={setP3End}
              onUnitsChange={setP3Units}
              startPh="..."
              endPh="..."
              unitsPh="..."
            />
          </FadeSlideIn>
        </ScrollView>
      </Animated.View>

      <View style={styles.actionBar}>
        <View style={styles.actionBarInner}>
          <PrimaryButton title="Mentés" onPress={saveICR} disabled={!canSave} />
        </View>
      </View>
    </SafeAreaView>
  );
}

/* =========================
   STYLES (match calculator) — UI unchanged
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
    paddingBottom: ACTION_BAR_H + GRID * 2, // ✅ a tömör action barhoz igazítva
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
    paddingTop: ACTION_PAD_Y, // ✅ tömörebb
    paddingBottom: ACTION_PAD_Y, // ✅ tömörebb
  },

  primaryBtn: {
    height: CTA_H, // ✅ tömörebb
    borderRadius: 16, // ✅ picit “timeline” érzés
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
