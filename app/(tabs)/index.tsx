// app/(tabs)/index.tsx
// ✅ Animálva (NO Reanimated):
// - Screen intro (fade + slight translate)
// - Section blocks enter (fade + slight translate)
// - Stat tiles subtle stagger enter
// ✅ UI/ikonok/design/logika marad

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

/* ===== STORAGE KEYS ===== */
const STORAGE_TIMELINE = '@diab_timeline';

/* ===== TYPES ===== */
type Entry = {
  id: string;
  ts: number;
  vc: number | null;
  ch: number | null;
  type: 'bolus' | 'basal';
  units: number | null;
};

/* =========================
   HELPERS
========================= */
const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const isSameYMD = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const toComma = (v: number) => {
  if (!Number.isFinite(v)) return '—';
  const s = String(v);
  return s.includes('.') ? s.replace('.', ',') : s;
};

const numOrNull = (v: any): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const normalizeEntry = (raw: any): Entry | null => {
  if (!raw || typeof raw !== 'object') return null;

  const ts = Number(raw.ts);
  if (!Number.isFinite(ts) || ts <= 0) return null;

  const typeRaw = String(raw.type ?? '').trim();
  const type: Entry['type'] = typeRaw === 'basal' ? 'basal' : 'bolus';

  const vc = raw.vc === null || raw.vc === undefined ? null : numOrNull(raw.vc);
  const ch = raw.ch === null || raw.ch === undefined ? null : numOrNull(raw.ch);
  const units = raw.units === null || raw.units === undefined ? null : numOrNull(raw.units);

  return {
    id: String(raw.id ?? `${ts}`),
    ts,
    vc,
    ch,
    type,
    units,
  };
};

/* =========================
   ANIM PRIMITIVE (NO reanimated)
========================= */
function AnimatedIn({
  children,
  delay = 0,
  dy = 10,
  duration = 360,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  dy?: number;
  duration?: number;
  style?: any;
}) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
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
   UI PRIMITIVES (calculator)
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
   HEADER (calculator layout)
========================= */
function Header({ title, onSettings }: { title: string; onSettings: () => void }) {
  return (
    <View style={styles.headerWrap}>
      <View pointerEvents="none" style={styles.headerGlowA} />
      <View pointerEvents="none" style={styles.headerGlowB} />

      <View style={styles.headerTitleRow}>
        <View style={{ width: 42, height: 42 }} />

        <Text style={styles.headerTitleCentered} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>

        <Pressable
          onPress={onSettings}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Beállítások"
          style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="settings-outline" size={20} color={THEME.text} />
        </Pressable>
      </View>
    </View>
  );
}

/* =========================
   SMALL STAT TILE (home cards)
========================= */
function StatTile({
  title,
  value,
  icon,
  tone = 'primary',
  animDelay = 0,
}: {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: 'primary' | 'neutral';
  animDelay?: number;
}) {
  const toneBg = tone === 'primary' ? 'rgba(37, 99, 235, 0.06)' : 'rgba(148,163,184,0.04)';
  const toneBorder = tone === 'primary' ? 'rgba(37, 99, 235, 0.16)' : 'rgba(148,163,184,0.18)';

  return (
    <AnimatedIn delay={animDelay} dy={8} duration={320} style={{ width: '48.5%' }}>
      <View style={[styles.statTile, { backgroundColor: toneBg, borderColor: toneBorder }]}>
        <View style={styles.statIcon}>
          <Ionicons name={icon} size={18} color={THEME.muted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.statTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.statValue} numberOfLines={1}>
            {value}
          </Text>
        </View>
      </View>
    </AnimatedIn>
  );
}

/* =========================
   QUICK ACTION ROW
========================= */
function ActionRow({
  title,
  icon,
  onPress,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.rowIconBox}>
        <Ionicons name={icon} size={18} color={THEME.muted} />
      </View>

      <View style={{ flex: 1, paddingRight: GRID }}>
        <Text style={styles.rowTitle} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={THEME.muted} />
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [todayEntries, setTodayEntries] = useState<Entry[]>([]);

  const load = useCallback(async () => {
    try {
      const rawT = await AsyncStorage.getItem(STORAGE_TIMELINE);
      const list = rawT ? JSON.parse(rawT) : [];
      const arr: any[] = Array.isArray(list) ? list : [];
      const normalized = arr.map(normalizeEntry).filter(Boolean) as Entry[];

      const today = startOfDay(new Date());
      const onlyToday = normalized.filter((e) => isSameYMD(new Date(e.ts), today)).sort((a, b) => b.ts - a.ts);

      setTodayEntries(onlyToday);
    } catch {
      setTodayEntries([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const stats = useMemo(() => {
    const vcVals = todayEntries.map((e) => e.vc).filter((x): x is number => Number.isFinite(x as number));
    const chVals = todayEntries.map((e) => e.ch).filter((x): x is number => Number.isFinite(x as number));
    const uVals = todayEntries.map((e) => e.units).filter((x): x is number => Number.isFinite(x as number));

    const avgVc = vcVals.length > 0 ? vcVals.reduce((a, b) => a + b, 0) / vcVals.length : NaN;
    const sumCh = chVals.length > 0 ? chVals.reduce((a, b) => a + b, 0) : NaN;
    const sumU = uVals.length > 0 ? uVals.reduce((a, b) => a + b, 0) : NaN;

    return { count: todayEntries.length, avgVc, sumCh, sumU };
  }, [todayEntries]);

  const openSettings = () => router.push({ pathname: '/settings', params: { from: 'index' } });

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

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View pointerEvents="none" style={styles.bgAmbient} />
      <View pointerEvents="none" style={styles.bgBlobA} />
      <View pointerEvents="none" style={styles.bgBlobB} />

      <>
        <Header title="Kezdőlap" onSettings={openSettings} />

        <Animated.View
          style={{
            flex: 1,
            opacity: screenIn,
            transform: [{ translateY: screenIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          }}
        >
          <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              <AnimatedIn delay={30} dy={8} duration={360}>
                <SectionTitle icon="sparkles-outline" title="Mai összegzés" hint="A mai rögzítéseid gyors áttekintése." />
              </AnimatedIn>

              <AnimatedIn delay={70} dy={10} duration={380}>
                <Surface>
                  <View style={styles.statGrid}>
                    <StatTile
                      title="Bejegyzések"
                      value={String(stats.count)}
                      icon="list-outline"
                      tone="primary"
                      animDelay={0}
                    />
                    <StatTile
                      title="Átlag vércukor"
                      value={Number.isFinite(stats.avgVc) ? `${toComma(+stats.avgVc.toFixed(1))} mmol/L` : '—'}
                      icon="water-outline"
                      tone="primary"
                      animDelay={40}
                    />
                    <StatTile
                      title="Össz szénhidrát"
                      value={Number.isFinite(stats.sumCh) ? `${toComma(+stats.sumCh.toFixed(1))} g` : '—'}
                      icon="nutrition-outline"
                      tone="primary"
                      animDelay={80}
                    />
                    <StatTile
                      title="Össz inzulin"
                      value={Number.isFinite(stats.sumU) ? `${toComma(+stats.sumU.toFixed(1))} E` : '—'}
                      icon="medical-outline"
                      tone="neutral"
                      animDelay={120}
                    />
                  </View>

                  <View style={{ height: GRID * 1.5 }} />

                  <Pressable
                    // ✅ MOD: pass from=index so Timeline always jumps to today
                    onPress={() => router.push({ pathname: '/timeline', params: { from: 'index' } })}
                    hitSlop={8}
                    style={({ pressed }) => [styles.rowLink, pressed && { opacity: 0.85 }]}
                  >
                    <View style={styles.rowIconBox}>
                      <Ionicons name="time-outline" size={18} color={THEME.muted} />
                    </View>
                    <Text style={styles.rowLinkText}>Idővonal</Text>
                    <Ionicons name="chevron-forward" size={18} color={THEME.muted} />
                  </Pressable>
                </Surface>
              </AnimatedIn>

              <View style={{ height: GRID * 2 }} />

              <AnimatedIn delay={130} dy={8} duration={360}>
                <SectionTitle icon="flash-outline" title="Gyors műveletek" hint="Válassz egy gyors indítást." />
              </AnimatedIn>

              <AnimatedIn delay={170} dy={10} duration={380}>
                <Surface>
                  <ActionRow title="Új bejegyzés" icon="create-outline" onPress={() => router.push('/registration')} />
                  <View style={{ height: GRID * 1.25 }} />
                  <ActionRow title="Kalkulátor" icon="calculator-outline" onPress={() => router.push('/calculator')} />
                  <View style={{ height: GRID * 1.25 }} />
                  <ActionRow title="Ételadatbázis" icon="restaurant-outline" onPress={() => router.push('/foodsearch')} />
                  <View style={{ height: GRID * 1.25 }} />
                  <ActionRow title="Asszisztens" icon="chatbubbles-outline" onPress={() => router.push('/assistent')} />
                </Surface>
              </AnimatedIn>

              <View style={{ height: GRID * 3 }} />
            </ScrollView>
          </View>
        </Animated.View>
      </>
    </SafeAreaView>
  );
}

/* =========================
   STYLES (match calculator)
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(230,232,240,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingBottom: 44,
  },

  sectionTitleWrap: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: GRID * 1.5,
  },
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

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  statTile: {
    minHeight: 74,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(230,232,240,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  statTitle: {
    fontSize: 12.5,
    fontWeight: '400',
    color: THEME.muted,
    letterSpacing: 0,
  },
  statValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '800',
    color: THEME.text,
    letterSpacing: 0.2,
  },

  rowLink: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(230,232,240,0.95)',
    backgroundColor: 'rgba(148,163,184,0.05)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    marginRight: 0,
  },
  rowLinkText: { flex: 1, fontSize: 14, fontWeight: '800', color: THEME.text },

  actionRow: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(230,232,240,0.95)',
    backgroundColor: 'rgba(148,163,184,0.05)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.text,
    letterSpacing: 0.1,
  },
});
