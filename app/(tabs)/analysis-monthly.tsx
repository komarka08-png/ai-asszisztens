// app/(tabs)/analysis-monthly.tsx
// ✅ Animálva (NO Reanimated) — ugyanúgy, mint calculator.tsx / timeline.tsx:
// - Screen intro (fade + slight translate)
// - Surface enter (fade + translate + slight scale) stagger delay-ekkel
// - Press micro anim (scale) + Android ripple
// ✅ UI/design/layout marad (analysis.tsx / calculator design)
// ✅ logika változatlan (havi)
// ✅ "Vércukor összefoglaló" cím alatt pontosan annyi hely van, mint analysis.tsx-ben
//    (SectionTitle marginBottom-ja adja a spacinget, nem plusz padding wrapper)

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  DeviceEventEmitter,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/* =========================
   PREMIUM LIGHT THEME (SAME AS analysis.tsx)
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
   HEADER (same as analysis.tsx) + press micro anim
========================= */
function Header({ title, onBack }: { title: string; onBack?: () => void }) {
  const backPress = usePressScale(!onBack, 0.96);

  return (
    <View style={styles.headerWrap}>
      <View pointerEvents="none" style={styles.headerGlowA} />
      <View pointerEvents="none" style={styles.headerGlowB} />

      <View style={styles.headerTitleRow}>
        <Animated.View style={[!onBack ? { opacity: 0 } : undefined, { transform: [{ scale: backPress.scale }] }]}>
          <Pressable
            onPress={onBack}
            disabled={!onBack}
            hitSlop={12}
            style={styles.headerIconBtn}
            accessibilityRole={onBack ? 'button' : undefined}
            accessibilityLabel="Vissza"
            onPressIn={backPress.onPressIn}
            onPressOut={backPress.onPressOut}
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
   UI PRIMITIVES (analysis/calc style)
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

function StatRow({
  title,
  rightText,
  icon,
}: {
  title: string;
  rightText: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const press = usePressScale(false, 0.99);

  return (
    <Animated.View style={{ transform: [{ scale: press.scale }] }}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={styles.row}
        {...androidRipple('rgba(0,0,0,0.06)')}
      >
        <View style={styles.rowIconBox}>
          <Ionicons name={icon} size={18} color={THEME.muted} />
        </View>

        <View style={{ flex: 1, paddingRight: GRID }}>
          <Text style={styles.rowTitle} numberOfLines={1} ellipsizeMode="tail">
            {title}
          </Text>
        </View>

        <View style={styles.pill}>
          <Text style={styles.pillText}>{rightText}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const Divider = () => <View style={styles.divider} />;

/* =========================
   DATE PILL (press micro anim)
========================= */
function DatePill({ label, onPress }: { label: string; onPress?: () => void }) {
  const press = usePressScale(!onPress, 0.985);

  return (
    <Animated.View style={{ transform: [{ scale: press.scale }] }}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        hitSlop={10}
        style={styles.datePillContainer}
        accessibilityRole={onPress ? 'button' : undefined}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        {...androidRipple('rgba(37, 99, 235, 0.12)')}
      >
        <Text style={styles.unitText} numberOfLines={1} ellipsizeMode="tail">
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/* =========================
   DATA
========================= */
type Entry = {
  id: string;
  ts: number;
  vc: number;
  ch: number;
  type: 'bolus' | 'basal';
  units?: number;
  note?: string;
};

const STORAGE_KEY = '@diab_timeline';
const STORAGE_PARAMS = '@calc_params_v1';

const MONTHS_FULL = [
  'Január',
  'Február',
  'Március',
  'Április',
  'Május',
  'Június',
  'Július',
  'Augusztus',
  'Szeptember',
  'Október',
  'November',
  'December',
];

function isSameYM(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * ✅ támogatjuk:
 * - ym=YYYY-MM
 * - m=YYYY-MM vagy m=YYYY-MM-DD
 * - m=ISO
 */
function parseMonthParamFlexible(v?: string): Date | null {
  if (!v) return null;
  const raw = decodeURIComponent(v).trim();

  if (raw.includes('T')) {
    const dt = new Date(raw);
    if (isNaN(dt.getTime())) return null;
    return startOfMonth(dt);
  }

  const parts = raw.split('-').map((x) => Number(x));
  const yy = parts[0];
  const mm = parts[1];

  if (!yy || !mm) return null;
  if (mm < 1 || mm > 12) return null;

  return startOfMonth(new Date(yy, mm - 1, 1));
}

const toFinite = (v: any): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toComma = (v: number | null, digits?: number) => {
  if (v === null || !Number.isFinite(v)) return '—';
  const x = typeof digits === 'number' ? Number(v.toFixed(digits)) : v;
  const s = String(x);
  return s.includes('.') ? s.replace('.', ',') : s;
};

const normalizeEntry = (raw: any): Entry | null => {
  if (!raw || typeof raw !== 'object') return null;

  const id = String(raw.id ?? '').trim();
  const ts = toFinite(raw.ts);
  const vc = toFinite(raw.vc);
  const ch = toFinite(raw.ch);

  if (!id) return null;
  if (!ts || ts <= 0) return null;
  if (vc === null || ch === null) return null;

  const typeRaw = String(raw.type ?? '').trim();
  const type: Entry['type'] = typeRaw === 'basal' ? 'basal' : 'bolus';

  const unitsN = toFinite(raw.units);
  const note = raw.note != null ? String(raw.note) : undefined;

  return {
    id,
    ts,
    vc,
    ch,
    type,
    ...(unitsN !== null ? { units: unitsN } : {}),
    ...(note ? { note } : {}),
  };
};

/* =========================
   SCREEN
========================= */
export default function MonthlyAnalysisScreen() {
  const { m, ym, d } = useLocalSearchParams<{ m?: string; ym?: string; d?: string }>();

  const [all, setAll] = useState<Entry[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));

  const [targetMin, setTargetMin] = useState<number>(5);
  const [targetMax, setTargetMax] = useState<number>(10);

  // Screen intro anim (calculator/timeline pattern)
  const screenIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(screenIn, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [screenIn]);

  useFocusEffect(
    useCallback(() => {
      const fromParam = parseMonthParamFlexible(ym ?? m);
      setCurrentMonth(fromParam ?? startOfMonth(new Date()));
      return () => {};
    }, [m, ym])
  );

  const loadTimeline = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const arr: any[] = Array.isArray(parsed) ? parsed : [];

      const normalized = arr.map(normalizeEntry).filter(Boolean) as Entry[];
      normalized.sort((a, b) => b.ts - a.ts);

      if (normalized.length !== arr.length) {
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)).catch(() => {});
      }

      setAll(normalized);
    } catch {
      setAll([]);
    }
  }, []);

  useEffect(() => {
    loadTimeline();
    const sub = DeviceEventEmitter.addListener('entriesUpdated', loadTimeline);
    return () => sub.remove();
  }, [loadTimeline]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_PARAMS);
        if (!raw) return;

        const data = JSON.parse(raw);
        const tr = data?.targetRange;
        const min = toFinite(tr?.min);
        const max = toFinite(tr?.max);

        if (min !== null) setTargetMin(min);
        if (max !== null) setTargetMax(max);
      } catch {}
    })();
  }, []);

  const monthEntries = useMemo(() => all.filter((e) => isSameYM(new Date(e.ts), currentMonth)), [all, currentMonth]);

  const summary = useMemo(() => {
    if (monthEntries.length === 0) return null;

    const vcs = monthEntries.map((e) => e.vc).filter((v) => Number.isFinite(v));

    const avg = vcs.length ? vcs.reduce((a, b) => a + b, 0) / vcs.length : null;
    const min = vcs.length ? Math.min(...vcs) : null;
    const max = vcs.length ? Math.max(...vcs) : null;

    const bolusUnits = monthEntries
      .filter((e) => e.type === 'bolus' && Number.isFinite(e.units as number))
      .reduce((s, e) => s + (e.units as number), 0);

    const basalUnits = monthEntries
      .filter((e) => e.type === 'basal' && Number.isFinite(e.units as number))
      .reduce((s, e) => s + (e.units as number), 0);

    const totalUnits = bolusUnits + basalUnits;
    const totalCH = monthEntries.reduce((s, e) => s + (Number.isFinite(e.ch) ? e.ch : 0), 0);

    const lowCount = vcs.filter((v) => v < targetMin).length;
    const highCount = vcs.filter((v) => v > targetMax).length;
    const idealCount = vcs.filter((v) => v >= targetMin && v <= targetMax).length;

    const daysWithData = new Set(
      monthEntries.map((e) => {
        const dd2 = new Date(e.ts);
        return `${dd2.getFullYear()}-${dd2.getMonth()}-${dd2.getDate()}`;
      })
    ).size;

    return {
      avg,
      min,
      max,
      count: vcs.length,
      daysWithData,
      bolusUnits,
      basalUnits,
      totalUnits,
      totalCH,
      lowCount,
      highCount,
      idealCount,
      targetMin,
      targetMax,
    };
  }, [monthEntries, targetMin, targetMax]);

  const monthLabel = `${currentMonth.getFullYear()}. ${MONTHS_FULL[currentMonth.getMonth()]}`;

  const goBack = () => {
    const dd = d ? String(d) : '';
    if (dd) {
      router.replace({ pathname: '/timeline', params: { d: dd } });
      return;
    }
    router.replace('/timeline');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View pointerEvents="none" style={styles.bgAmbient} />
      <View pointerEvents="none" style={styles.bgBlobA} />
      <View pointerEvents="none" style={styles.bgBlobB} />

      <Header title="Havi elemzések" onBack={goBack} />

      <Animated.View
        style={{
          opacity: screenIn,
          transform: [{ translateY: screenIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          flex: 1,
        }}
      >
        {/* ✅ Date pill nudge marad */}
        <View style={styles.topBlock}>
          <View style={styles.datePillNudge}>
            <DatePill label={monthLabel} />
          </View>
        </View>

        <View style={{ flex: 1 }}>
          {!summary ? (
            <ScrollView
              contentContainerStyle={styles.emptyScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={{ flex: 1 }} />
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>Ebben a hónapban nem voltak bejegyzések.</Text>
              </View>
            </ScrollView>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.contentPad}>
                {/* ✅ ugyanannyi hely a cím alatt, mint analysis.tsx-ben */}
                <SectionTitle icon="water-outline" title="Vércukor összefoglaló" hint="Havi értékek" />

                <Surface delay={70}>
                  <StatRow title="Átlag vércukor" rightText={`${toComma(summary.avg, 1)} mmol/L`} icon="analytics-outline" />
                  <Divider />
                  <StatRow title="Max. vércukor" rightText={`${toComma(summary.max, 1)} mmol/L`} icon="arrow-up-outline" />
                  <Divider />
                  <StatRow title="Min. vércukor" rightText={`${toComma(summary.min, 1)} mmol/L`} icon="arrow-down-outline" />
                  <Divider />
                  <StatRow title="Mérések száma" rightText={`${summary.count}`} icon="list-outline" />
                  <Divider />
                  <StatRow title="Napok adatokkal" rightText={`${summary.daysWithData}`} icon="calendar-number-outline" />
                </Surface>

                <View style={{ height: GRID * 2 }} />

                <SectionTitle
                  icon="speedometer-outline"
                  title="Vércukor tartományok"
                  hint={`Céltartomány: ${toComma(summary.targetMin)}–${toComma(summary.targetMax)} mmol/L`}
                />

                <Surface delay={190}>
                  <StatRow title="Magas vércukor" rightText={`${summary.highCount}`} icon="trending-up-outline" />
                  <Divider />
                  <StatRow title="Ideális vércukor" rightText={`${summary.idealCount}`} icon="checkmark-circle-outline" />
                  <Divider />
                  <StatRow title="Alacsony vércukor" rightText={`${summary.lowCount}`} icon="trending-down-outline" />
                </Surface>

                <View style={{ height: GRID * 2 }} />

                <SectionTitle icon="medkit-outline" title="Inzulin és szénhidrát" hint="Havi összesítés" />

                <Surface delay={310}>
                  <StatRow title="Összes inzulin" rightText={`${Math.round(summary.totalUnits)} E`} icon="medical-outline" />
                  <Divider />
                  <StatRow title="Bólus" rightText={`${Math.round(summary.bolusUnits)} E`} icon="flash-outline" />
                  <Divider />
                  <StatRow title="Bázis" rightText={`${Math.round(summary.basalUnits)} E`} icon="time-outline" />
                  <Divider />
                  <StatRow
                    title="Összes szénhidrát"
                    rightText={`${Number.isInteger(summary.totalCH) ? summary.totalCH : +summary.totalCH.toFixed(1)} g`}
                    icon="nutrition-outline"
                  />
                </Surface>
              </View>
            </ScrollView>
          )}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

/* =========================
   STYLES (UI unchanged)
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

  topBlock: {
    paddingHorizontal: H_MARGIN,
    paddingTop: 0,
    paddingBottom: GRID * 1.25,
    alignItems: 'center',
    marginTop: -1,
  },
  datePillNudge: { transform: [{ translateY: 5 }] },

  scrollContent: {
    paddingHorizontal: H_MARGIN,
    paddingTop: GRID * 2,
    paddingBottom: 44,
  },
  contentPad: { paddingTop: GRID * 0.5, paddingBottom: GRID * 2 },

  emptyScrollContent: {
    flexGrow: 1,
    paddingHorizontal: H_MARGIN,
    paddingTop: GRID * 2,
    paddingBottom: 44,
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

  row: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(230,232,240,0.95)',
    backgroundColor: 'rgba(148,163,184,0.05)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },
  rowIconBox: {
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
  rowTitle: { fontSize: 14, fontWeight: '800', color: THEME.text, letterSpacing: 0.1 },

  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: THEME.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.20)',
    marginLeft: 10,
  },
  pillText: { fontSize: 12.5, fontWeight: '800', color: THEME.primary },

  datePillContainer: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: THEME.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.20)',
    maxWidth: '100%',
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },
  unitText: { fontSize: 12.5, fontWeight: '800', color: THEME.primary },

  divider: { height: GRID * 1.25 },

  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: H_MARGIN,
    paddingBottom: GRID * 3,
  },
  emptyText: { color: THEME.muted, textAlign: 'center', fontSize: 12.5, lineHeight: 18 },
});
