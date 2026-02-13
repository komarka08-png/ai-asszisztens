// app/analysis.tsx
// ✅ Animált (NO Reanimated) — ugyanúgy, mint calculator.tsx / timeline.tsx:
// - Screen intro (fade + slight translate)
// - Surface enter (fade + translate + slight scale) stagger delay-ekkel
// - Press micro anim (scale) + Android ripple
// ✅ UI / design / layout változatlan (csak anim wrapper-ek)

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
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/* =========================
   PREMIUM LIGHT THEME (SAME AS calculator.tsx)
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
   HEADER (calculator-style, but with back) + press micro anim
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
            onPressIn={backPress.onPressIn}
            onPressOut={backPress.onPressOut}
            style={styles.headerIconBtn}
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
   UI PRIMITIVES (calculator style)
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
   DATA
========================= */
type Entry = {
  id: string;
  ts: number;
  vc: number;
  ch: number;
  type: 'bolus' | 'basal';
  units?: number;
};

const STORAGE_KEY = '@diab_timeline';
const STORAGE_PARAMS = '@calc_params_v1';

const MONTHS = ['Jan.', 'Febr.', 'Márc.', 'Ápr.', 'Máj.', 'Jún.', 'Júl.', 'Aug.', 'Szept.', 'Okt.', 'Nov.', 'Dec.'];

const WEEKDAY_NAMES: { [k: number]: string } = {
  1: 'Hét.',
  2: 'Ke.',
  3: 'Sze.',
  4: 'Csüt.',
  5: 'Pén.',
  6: 'Szo.',
  0: 'Vas.',
};

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function isSameYMD(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function fmtDayLabel(d: Date) {
  return `${d.getFullYear()}. ${MONTHS[d.getMonth()]} ${d.getDate()}. ${WEEKDAY_NAMES[d.getDay()]}`;
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

  return {
    id,
    ts,
    vc,
    ch,
    type,
    ...(unitsN !== null ? { units: unitsN } : {}),
  };
};

function parseDayParamFlexible(v?: string): Date | null {
  if (!v) return null;
  const raw = decodeURIComponent(String(v)).trim();

  if (raw.includes('T')) {
    const dt = new Date(raw);
    if (isNaN(dt.getTime())) return null;
    return startOfDay(dt);
  }

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return null;

  const yy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;
  if (mm < 1 || mm > 12) return null;
  if (dd < 1 || dd > 31) return null;

  const dt = new Date(yy, mm - 1, dd);
  if (isNaN(dt.getTime())) return null;
  return startOfDay(dt);
}

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
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={styles.datePillContainer}
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
   SCREEN
========================= */
export default function AnalysisScreen() {
  const { d } = useLocalSearchParams<{ d?: string }>();

  const currentDate = useMemo(() => {
    const parsed = parseDayParamFlexible(d);
    return parsed ?? startOfDay(new Date());
  }, [d]);

  const [all, setAll] = useState<Entry[]>([]);
  const [targetMin, setTargetMin] = useState<number>(5);
  const [targetMax, setTargetMax] = useState<number>(10);

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

  const dayEntries = useMemo(() => all.filter((e) => isSameYMD(new Date(e.ts), currentDate)), [all, currentDate]);

  const summary = useMemo(() => {
    if (dayEntries.length === 0) return null;

    const vcs = dayEntries.map((e) => e.vc).filter((v) => Number.isFinite(v));

    const avg = vcs.length ? vcs.reduce((a, b) => a + b, 0) / vcs.length : null;
    const min = vcs.length ? Math.min(...vcs) : null;
    const max = vcs.length ? Math.max(...vcs) : null;

    const bolusUnits = dayEntries
      .filter((e) => e.type === 'bolus' && Number.isFinite(e.units as number))
      .reduce((s, e) => s + (e.units as number), 0);

    const basalUnits = dayEntries
      .filter((e) => e.type === 'basal' && Number.isFinite(e.units as number))
      .reduce((s, e) => s + (e.units as number), 0);

    const totalUnits = bolusUnits + basalUnits;
    const totalCH = dayEntries.reduce((s, e) => s + (Number.isFinite(e.ch) ? e.ch : 0), 0);

    const lowCount = vcs.filter((v) => v < targetMin).length;
    const highCount = vcs.filter((v) => v > targetMax).length;
    const idealCount = vcs.filter((v) => v >= targetMin && v <= targetMax).length;

    return {
      avg,
      min,
      max,
      count: vcs.length,
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
  }, [dayEntries, targetMin, targetMax]);

  const goBack = () => {
    const y = currentDate.getFullYear();
    const m2 = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dd = String(currentDate.getDate()).padStart(2, '0');
    router.replace(`/timeline?d=${y}-${m2}-${dd}`);
  };

  const sections = useMemo(() => (summary ? [{ title: '', data: [summary] }] : []), [summary]);
  const dateLabel = useMemo(() => fmtDayLabel(currentDate), [currentDate]);

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
      return () => {};
    }, [])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View pointerEvents="none" style={styles.bgAmbient} />
      <View pointerEvents="none" style={styles.bgBlobA} />
      <View pointerEvents="none" style={styles.bgBlobB} />

      <Header title="Napi elemzések" onBack={goBack} />

      <Animated.View
        style={{
          opacity: screenIn,
          transform: [{ translateY: screenIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          flex: 1,
        }}
      >
        <View style={styles.topBlock}>
          <View style={styles.datePillNudge}>
            <DatePill label={dateLabel} />
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <SectionList
            sections={sections}
            keyExtractor={(_, i) => `row-${i}`}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.contentPad}>
                <SectionTitle icon="water-outline" title="Vércukor összefoglaló" hint="Napi értékek" />
                <Surface delay={70}>
                  <StatRow title="Átlag vércukor" rightText={`${toComma(item.avg, 1)} mmol/L`} icon="analytics-outline" />
                  <Divider />
                  <StatRow title="Max. vércukor" rightText={`${toComma(item.max, 1)} mmol/L`} icon="arrow-up-outline" />
                  <Divider />
                  <StatRow title="Min. vércukor" rightText={`${toComma(item.min, 1)} mmol/L`} icon="arrow-down-outline" />
                  <Divider />
                  <StatRow title="Mérések száma" rightText={`${item.count}`} icon="list-outline" />
                </Surface>

                <View style={{ height: GRID * 2 }} />

                <SectionTitle
                  icon="speedometer-outline"
                  title="Vércukor tartományok"
                  hint={`Céltartomány: ${toComma(item.targetMin)}–${toComma(item.targetMax)} mmol/L`}
                />
                <Surface delay={190}>
                  <StatRow title="Magas vércukor" rightText={`${item.highCount}`} icon="trending-up-outline" />
                  <Divider />
                  <StatRow title="Ideális vércukor" rightText={`${item.idealCount}`} icon="checkmark-circle-outline" />
                  <Divider />
                  <StatRow title="Alacsony vércukor" rightText={`${item.lowCount}`} icon="trending-down-outline" />
                </Surface>

                <View style={{ height: GRID * 2 }} />

                <SectionTitle icon="medkit-outline" title="Inzulin és szénhidrát" hint="Napi összesítés" />
                <Surface delay={310}>
                  <StatRow title="Összes inzulin" rightText={`${Math.round(item.totalUnits)} E`} icon="medical-outline" />
                  <Divider />
                  <StatRow title="Bólus" rightText={`${Math.round(item.bolusUnits)} E`} icon="flash-outline" />
                  <Divider />
                  <StatRow title="Bázis" rightText={`${Math.round(item.basalUnits)} E`} icon="time-outline" />
                  <Divider />
                  <StatRow
                    title="Összes szénhidrát"
                    rightText={`${Number.isInteger(item.totalCH) ? item.totalCH : +item.totalCH.toFixed(1)} g`}
                    icon="nutrition-outline"
                  />
                </Surface>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>Ezen a napon nem voltak bejegyzések.</Text>
              </View>
            }
          />
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

  listContent: {
    flexGrow: 1,
    paddingHorizontal: H_MARGIN,
    paddingTop: GRID * 2,
    paddingBottom: 44,
  },

  contentPad: {
    paddingTop: GRID * 0.5,
    paddingBottom: GRID * 2,
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
