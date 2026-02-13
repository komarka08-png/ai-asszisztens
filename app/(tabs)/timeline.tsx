// app/timeline.tsx
// ✅ Animated (NO Reanimated):
// - Screen intro stays: fade + slight translate
// - Day change: ALL cards appear EXACTLY TOGETHER (single wrapper anim, no per-card enter)
// - Press micro anim (scale) + Android ripple

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  DeviceEventEmitter,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Entry = {
  id: string;
  ts: number;
  vc: number;
  ch: number;
  type: 'bolus' | 'basal';
  units?: number;
};

/* =========================
   PREMIUM LIGHT THEME (match calculator.tsx 1:1)
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

const STORAGE_KEY = '@diab_timeline';

/* =========================
   DATE UTILS
========================= */
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
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function isSameYMD(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function fmtDayLabel(d: Date) {
  return `${d.getFullYear()}. ${MONTHS[d.getMonth()]} ${d.getDate()}. ${WEEKDAY_NAMES[d.getDay()]}`;
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
}
function parseYmdLocal(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const dd = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(dd)) return null;
  return startOfDay(new Date(y, mo, dd, 0, 0, 0, 0));
}

const toComma = (v: number) => {
  if (!Number.isFinite(v)) return '—';
  const s = String(v);
  return s.includes('.') ? s.replace('.', ',') : s;
};

/* =========================
   STORAGE SANITIZE
========================= */
const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const toFiniteNumberOr = (v: any, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeEntry = (raw: any): Entry | null => {
  if (!raw || typeof raw !== 'object') return null;

  const id = String(raw.id ?? '').trim() || makeId();

  const ts = toFiniteNumberOr(raw.ts, NaN);
  if (!Number.isFinite(ts) || ts <= 0) return null;

  const typeRaw = String(raw.type ?? '').trim();
  const type: Entry['type'] = typeRaw === 'basal' ? 'basal' : 'bolus';

  const vc = toFiniteNumberOr(raw.vc, NaN);
  const ch = toFiniteNumberOr(raw.ch, NaN);
  if (!Number.isFinite(vc) || !Number.isFinite(ch)) return null;

  const unitsMaybe = raw.units;
  const units = unitsMaybe === undefined || unitsMaybe === null ? undefined : toFiniteNumberOr(unitsMaybe, NaN);

  return {
    id,
    ts,
    vc,
    ch,
    type,
    ...(Number.isFinite(units as number) ? { units: units as number } : {}),
  };
};

/* =========================
   MATERIAL PRESS HELPERS
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
   UI PRIMITIVES
========================= */
const Surface: React.FC<React.PropsWithChildren<{ style?: any }>> = ({ children, style }) => (
  <View style={[styles.surface, style]}>{children}</View>
);

const AnimatedSurface: React.FC<React.PropsWithChildren<{ style?: any; delay?: number }>> = ({
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

function HeaderIconButton({ icon, onPress }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  const press = usePressScale(false, 0.96);
  return (
    <Animated.View style={{ transform: [{ scale: press.scale }] }}>
      <Pressable
        onPress={onPress}
        hitSlop={10}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={styles.headerIconBtn}
        accessibilityRole="button"
        {...androidRipple('rgba(0,0,0,0.08)')}
      >
        <Ionicons name={icon} size={20} color={THEME.text} />
      </Pressable>
    </Animated.View>
  );
}

function Header({ onSettings, onAnalysis }: { onSettings: () => void; onAnalysis: () => void }) {
  return (
    <View style={styles.headerWrap}>
      <View pointerEvents="none" style={styles.headerGlowA} />
      <View pointerEvents="none" style={styles.headerGlowB} />

      <View style={styles.headerTitleRow}>
        <HeaderIconButton icon="analytics-outline" onPress={onAnalysis} />
        <Text style={styles.headerTitleCentered} numberOfLines={1}>
          Idővonal
        </Text>
        <HeaderIconButton icon="settings-outline" onPress={onSettings} />
      </View>
    </View>
  );
}

function InfoPill({ text, icon }: { text: string; icon: keyof typeof Ionicons.glyphMap }) {
  const press = usePressScale(false, 0.985);
  return (
    <Animated.View style={{ transform: [{ scale: press.scale }] }}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={styles.metaItemPrimary}
        {...androidRipple('rgba(37, 99, 235, 0.12)')}
      >
        <Ionicons name={icon} size={16} color={THEME.primary} />
        <Text style={styles.metaTextPrimary} numberOfLines={1}>
          {text}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function MetaIconPillButton({
  icon,
  onPress,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const press = usePressScale(false, 0.96);
  return (
    <Animated.View style={{ transform: [{ scale: press.scale }] }}>
      <Pressable
        onPress={onPress}
        hitSlop={10}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={styles.headerIconBtn}
        {...androidRipple('rgba(0,0,0,0.08)')}
      >
        <Ionicons name={icon} size={20} color={THEME.text} />
      </Pressable>
    </Animated.View>
  );
}

function StatRow({
  title,
  valueText,
  icon,
}: {
  title: string;
  valueText: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const press = usePressScale(false, 0.99);
  return (
    <Animated.View style={{ transform: [{ scale: press.scale }] }}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={styles.rowStat}
        {...androidRipple('rgba(0,0,0,0.06)')}
      >
        <View style={styles.rowIconBox}>
          <Ionicons name={icon} size={18} color={THEME.muted} />
        </View>

        <View style={{ flex: 1, paddingRight: GRID }}>
          <Text style={styles.rowTitleCsempe} numberOfLines={1} ellipsizeMode="tail">
            {title}
          </Text>
          <Text style={styles.rowValueCsempe} numberOfLines={1} ellipsizeMode="tail">
            {valueText}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function PrimaryButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  const press = usePressScale(!!disabled, 0.985);
  return (
    <View style={styles.primaryBtnWrap}>
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
    </View>
  );
}

function DatePill({ label, onPress }: { label: string; onPress: () => void }) {
  const press = usePressScale(false, 0.985);
  return (
    <Animated.View style={{ transform: [{ scale: press.scale }] }}>
      <Pressable
        onPress={onPress}
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
   ENTRY CARD (NO enter animation here)
========================= */
function EntryCard({ item, onDelete }: { item: Entry; onDelete: (id: string) => void }) {
  const dt = new Date(item.ts);
  const time = fmtTime(dt);

  const isBolus = item.type === 'bolus';
  const typeLabel = isBolus ? 'Bólus' : 'Bázis';

  const vcTxt = toComma(item.vc);
  const chTxt = toComma(item.ch);
  const uTxt = toComma(item.units ?? NaN);

  const cardPress = usePressScale(false, 0.995);

  return (
    <View style={{ marginBottom: GRID * 1.5 }}>
      <Surface style={styles.entryCard}>
        <Animated.View style={{ transform: [{ scale: cardPress.scale }] }}>
          <Pressable
            onPressIn={cardPress.onPressIn}
            onPressOut={cardPress.onPressOut}
            {...androidRipple('rgba(0,0,0,0.05)')}
          >
            <View style={styles.entryTopRow}>
              <View style={styles.metaRow}>
                <InfoPill text={time} icon="time-outline" />
                <InfoPill text={typeLabel} icon={isBolus ? 'flash-outline' : 'time-outline'} />
              </View>

              <View style={styles.trashSlot}>
                <MetaIconPillButton
                  icon="trash-outline"
                  onPress={() => onDelete(item.id)}
                  accessibilityLabel="Bejegyzés törlése"
                />
              </View>
            </View>

            <View style={styles.entryRows}>
              <StatRow title="Vércukor" valueText={`${vcTxt} mmol/L`} icon="water-outline" />
              <StatRow title="Szénhidrát" valueText={`${chTxt} g`} icon="nutrition-outline" />
              <StatRow title="Inzulin" valueText={`${uTxt} E`} icon="medical-outline" />
            </View>
          </Pressable>
        </Animated.View>
      </Surface>
    </View>
  );
}

/* =========================
   SCREEN
========================= */
export default function TimelineScreen() {
  const params = useLocalSearchParams<{ d?: string; from?: string }>();

  const [all, setAll] = useState<Entry[]>([]);
  const [currentDate, setCurrentDate] = useState(() => startOfDay(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const currentDateRef = useRef(currentDate);
  useEffect(() => {
    currentDateRef.current = currentDate;
  }, [currentDate]);

  const skipTodayOnceRef = useRef(false);

  const todayKey = new Date().toDateString();
  const today = useMemo(() => startOfDay(new Date()), [todayKey]);

  // ✅ Screen intro stays (unchanged)
  const screenIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(screenIn, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [screenIn]);

  // ✅ ONE wrapper anim for the whole day's list => ALL cards appear EXACTLY together
  const dayOpacity = useRef(new Animated.Value(1)).current;
  const dayY = useRef(new Animated.Value(0)).current;

  const runDayAppear = useCallback(() => {
    dayOpacity.stopAnimation();
    dayY.stopAnimation();

    dayOpacity.setValue(0);
    dayY.setValue(10);

    Animated.parallel([
      Animated.timing(dayOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(dayY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [dayOpacity, dayY]);

  // ✅ Animate exactly once when the day changes (not from multiple places)
  const dayKeyForAnim = useMemo(
    () => `${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}`,
    [currentDate]
  );
  useEffect(() => {
    runDayAppear();
  }, [dayKeyForAnim, runDayAppear]);

  useFocusEffect(
    useCallback(() => {
      const from = params?.from ? String(params.from) : '';
      const pd = params?.d ? String(params.d) : '';

      if (from === 'index') {
        // always jump to today when coming from index
        if (!isSameYMD(currentDateRef.current, today)) {
          setCurrentDate(today);
        }
        skipTodayOnceRef.current = true;
        requestAnimationFrame(() => router.setParams({ from: undefined }));
        return;
      }

      if (pd) {
        const parsed = parseYmdLocal(pd);
        if (parsed) {
          if (!isSameYMD(currentDateRef.current, parsed)) {
            setCurrentDate(parsed);
          }
          skipTodayOnceRef.current = true;
          requestAnimationFrame(() => router.setParams({ d: undefined }));
          return;
        }
      }

      if (skipTodayOnceRef.current) {
        skipTodayOnceRef.current = false;
        return;
      }
    }, [params?.from, params?.d, today])
  );

  const loadAll = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      const arr: any[] = Array.isArray(list) ? list : [];

      const normalized: Entry[] = arr.map(normalizeEntry).filter(Boolean) as Entry[];
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
    loadAll();
  }, [loadAll]);

  // reload data; anim will still be only "once per day change" (not spamming)
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('entriesUpdated', () => {
      loadAll();
    });
    return () => sub.remove();
  }, [loadAll]);

  const dayEntries = useMemo(() => all.filter((e) => isSameYMD(new Date(e.ts), currentDate)), [all, currentDate]);
  const sections = useMemo(() => (dayEntries.length ? [{ title: '', data: dayEntries }] : []), [dayEntries]);

  const hasEntriesForMonth = useMemo(() => {
    const y = currentDate.getFullYear();
    const m0 = currentDate.getMonth();
    return all.some((e) => {
      const d = new Date(e.ts);
      return d.getFullYear() === y && d.getMonth() === m0;
    });
  }, [all, currentDate]);

  const applyPickedDate = useCallback(
    (picked: Date) => {
      const d0 = startOfDay(picked);
      if (d0.getTime() > today.getTime()) return;
      setCurrentDate(d0);
      // anim will run via dayKeyForAnim effect
    },
    [today]
  );

  const openPicker = () => setShowDatePicker(true);

  const openAnalysisAlert = () => {
    Alert.alert('Elemzések', 'Add meg az elemzés típusát!', [
      {
        text: 'Napi elemzés',
        onPress: () => {
          if (dayEntries.length === 0) {
            Alert.alert('Nincs adat', 'Nincs rögzített adat erre a napra.', [{ text: 'OK' }], { cancelable: true });
            return;
          }
          const y = currentDate.getFullYear();
          const m = pad2(currentDate.getMonth() + 1);
          const d = pad2(currentDate.getDate());
          router.push(`/analysis?d=${y}-${m}-${d}`);
        },
      },
      {
        text: 'Havi elemzés',
        onPress: () => {
          if (!hasEntriesForMonth) {
            Alert.alert('Nincs adat', 'Nincs rögzített adat ebben a hónapban.', [{ text: 'OK' }], { cancelable: true });
            return;
          }
          const y = currentDate.getFullYear();
          const m = pad2(currentDate.getMonth() + 1);
          const ym = `${y}-${m}`;

          router.push({
            pathname: '/analysis-monthly',
            params: { from: 'timeline', ym, d: `${y}-${m}-${pad2(currentDate.getDate())}` },
          });
        },
      },
      { text: 'Mégse', style: 'cancel' },
    ]);
  };

  const deleteOne = useCallback(
    async (id: string) => {
      Alert.alert('Bejegyzés törlése', 'Biztosan törlöd ezt a bejegyzést?', [
        { text: 'Mégse', style: 'cancel' },
        {
          text: 'Törlés',
          style: 'destructive',
          onPress: async () => {
            try {
              const next = all.filter((x) => x.id !== id);
              setAll(next);
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
              DeviceEventEmitter.emit('entriesUpdated');
            } catch {}
          },
        },
      ]);
    },
    [all]
  );

  const SWIPE_ACTIVATE_PX = 6;
  const SWIPE_TRIGGER_PX = 24;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, g) => Math.abs(g.dx) > SWIPE_ACTIVATE_PX && Math.abs(g.dy) < 20,
      onPanResponderRelease: (_e, g) => {
        if (g.dx > SWIPE_TRIGGER_PX) {
          setCurrentDate((prev) => addDays(prev, -1)); // anim runs via effect
        } else if (g.dx < -SWIPE_TRIGGER_PX) {
          setCurrentDate((prev) => {
            const next = addDays(prev, +1);
            if (next.getTime() <= today.getTime()) return next;
            return prev;
          }); // anim runs via effect
        }
      },
    })
  ).current;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View pointerEvents="none" style={styles.bgAmbient} />
      <View pointerEvents="none" style={styles.bgBlobA} />
      <View pointerEvents="none" style={styles.bgBlobB} />

      <Header
        onAnalysis={openAnalysisAlert}
        onSettings={() => router.push({ pathname: '/settings', params: { from: 'timeline' } })}
      />

      {/* intro anim stays */}
      <Animated.View
        style={{
          opacity: screenIn,
          transform: [{ translateY: screenIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          flex: 1,
        }}
      >
        <View style={styles.topBlock}>
          <View style={styles.datePillNudge}>
            <DatePill label={fmtDayLabel(currentDate)} onPress={openPicker} />
          </View>
        </View>

        <View style={{ flex: 1 }} {...panResponder.panHandlers}>
          {/* ✅ SINGLE wrapper anim => all cards appear EXACTLY together */}
          <Animated.View style={{ flex: 1, opacity: dayOpacity, transform: [{ translateY: dayY }] }}>
            <SectionList
              sections={sections}
              keyExtractor={(item) => String(item?.id ?? '') || `${(item as any)?.ts ?? makeId()}`}
              stickySectionHeadersEnabled={false}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <View style={styles.contentPad}>
                  <SectionTitle icon="list-outline" title="Bejegyzések" hint="Napi rögzítések" />
                </View>
              }
              renderItem={({ item }) => <EntryCard item={item} onDelete={deleteOne} />}
              ListEmptyComponent={() => (
                <AnimatedSurface>
                  <View style={styles.emptyRow}>
                    <View style={styles.rowIconBox}>
                      <Ionicons name="alert-circle-outline" size={18} color={THEME.muted} />
                    </View>
                    <View style={{ flex: 1, paddingRight: GRID }}>
                      <Text style={styles.rowTitleEmpty} numberOfLines={1} ellipsizeMode="tail">
                        Nincs bejegyzés ezen a napon
                      </Text>
                    </View>
                  </View>
                </AnimatedSurface>
              )}
            />
          </Animated.View>
        </View>
      </Animated.View>

      <View style={styles.actionBar}>
        <View style={styles.actionBarInner}>
          <PrimaryButton title="Új bejegyzés" onPress={() => router.push('/registration')} disabled={false} />
        </View>
      </View>

      {Platform.OS === 'ios' && (
        <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
          <View style={styles.modalWrap}>
            <Pressable onPress={() => setShowDatePicker(false)} style={styles.modalBackdrop} />
            <View style={styles.modalCard}>
              <DateTimePicker
                value={currentDate}
                mode="date"
                display="inline"
                maximumDate={today}
                onChange={(event: DateTimePickerEvent, date?: Date) => {
                  if (event.type === 'dismissed' || !date) return;
                  applyPickedDate(date);
                  setShowDatePicker(false);
                }}
                style={{ width: '100%', alignSelf: 'center' }}
              />
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS !== 'ios' && showDatePicker && (
        <DateTimePicker
          value={currentDate}
          mode="date"
          display="default"
          maximumDate={today}
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            setShowDatePicker(false);
            if (event.type === 'dismissed' || !date) return;
            applyPickedDate(date);
          }}
        />
      )}
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

  topBlock: {
    paddingHorizontal: H_MARGIN,
    paddingTop: 0,
    paddingBottom: GRID * 1.25,
    alignItems: 'center',
    marginTop: -1,
  },

  datePillNudge: { transform: [{ translateY: 5 }] },

  listContent: {
    paddingHorizontal: H_MARGIN,
    paddingTop: GRID * 2,
    paddingBottom: 112,
  },

  contentPad: { paddingTop: GRID * 0.5, paddingBottom: 0 },

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

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaItemPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: THEME.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.20)',
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },
  metaTextPrimary: { color: THEME.primary, fontSize: 12.5, fontWeight: '800' },

  entryCard: { padding: 16 },
  entryTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: GRID * 1.25 },
  entryRows: { gap: 10 },

  trashSlot: { height: 42, justifyContent: 'center', alignItems: 'center' },

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

  rowStat: {
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

  rowTitleCsempe: { fontSize: 12.5, fontWeight: '400', color: THEME.muted, letterSpacing: 0 },
  rowValueCsempe: { marginTop: 2, fontSize: 14, fontWeight: '800', color: THEME.text, letterSpacing: 0.2 },

  emptyRow: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(230,232,240,0.95)',
    backgroundColor: 'rgba(148,163,184,0.05)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowTitleEmpty: { fontSize: 14, fontWeight: '800', color: THEME.text, letterSpacing: 0.1 },

  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: THEME.surface,
    borderTopWidth: 1,
    borderTopColor: 'rgba(230,232,240,0.9)',
  },
  actionBarInner: { paddingHorizontal: H_MARGIN, paddingTop: GRID * 1.5, paddingBottom: GRID * 1.5 },

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

  modalWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalBackdrop: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.25)' },
  modalCard: {
    width: '88%',
    maxWidth: 520,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 20,
    padding: GRID * 2,
    borderWidth: 1,
    borderColor: 'rgba(230,232,240,0.9)',
    shadowColor: THEME.shadowStrong,
    shadowOpacity: 1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: Platform.OS === 'android' ? 4 : 0,
  },
});
