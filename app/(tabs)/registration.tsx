// app/registration.tsx
// ✅ Material-style animations (NO Reanimated) — screen intro, press scale + ripple, Surface enter, segmented thumb slide (FIXED, no bug)
// ✅ FIX: canSave csak akkor true, ha NUMERIKUSAN is valid (pl. "5,8,8" -> NaN -> disabled)
// ✅ Pulse akkor fut, amikor valid lesz (edge-trigger)

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  DeviceEventEmitter,
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
const STORAGE_KEY = '@diab_timeline';

/* =========================
   TYPES
========================= */
type EntryType = 'bolus' | 'basal';

type TimelineEntry = {
  id: string;
  ts: number;
  vc: number | null; // mmol/L
  ch: number | null; // g
  type: EntryType;
  units: number | null; // E
};

/* =========================
   HELPERS
========================= */
const toNumberOrNaN = (s: string) => {
  const t = String(s ?? '').trim();
  if (!t) return NaN;
  // ✅ szándékosan csak 1 cserét csinál (mint a többiben)
  // "5,8,8" -> "5.8,8" -> NaN
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

const pad2 = (n: number) => String(n).padStart(2, '0');
const toYmdLocal = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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
   FIELD (like calculator)
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
          onChangeText={(t) => onChangeText(t.replace('.', ','))}
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
   HEADER (Material press + ripple)
   ✅ BACK: always to /timeline
========================= */
function Header() {
  const onBack = () => router.replace('/timeline');
  const { scale, onPressIn, onPressOut } = usePressScale(false, 0.96);

  return (
    <View style={styles.headerWrap}>
      <View pointerEvents="none" style={styles.headerGlowA} />
      <View pointerEvents="none" style={styles.headerGlowB} />

      <View style={styles.headerTitleRow}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Pressable
            onPress={onBack}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            hitSlop={12}
            style={styles.headerIconBtn}
            accessibilityRole="button"
            accessibilityLabel="Vissza"
            {...androidRipple('rgba(0,0,0,0.08)')}
          >
            <Ionicons name="chevron-back" size={20} color={THEME.text} />
          </Pressable>
        </Animated.View>

        <Text style={styles.headerTitleCentered} numberOfLines={1}>
          Új bejegyzés
        </Text>

        <View style={{ width: 42, height: 42 }} />
      </View>
    </View>
  );
}

/* =========================
   SEGMENTED (FIXED)
========================= */
function InsulinTypeSelector({ value, onChange }: { value: EntryType; onChange: (v: EntryType) => void }) {
  const [wrapW, setWrapW] = useState(0);

  const thumbT = useRef(new Animated.Value(value === 'bolus' ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(thumbT, {
      toValue: value === 'bolus' ? 0 : 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [value, thumbT]);

  const innerW = Math.max(0, wrapW - 8);
  const halfW = innerW / 2;

  const translateX = thumbT.interpolate({
    inputRange: [0, 1],
    outputRange: [0, halfW],
  });

  const leftPress = usePressScale(false, 0.985);
  const rightPress = usePressScale(false, 0.985);

  return (
    <View
      style={styles.segWrap}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && w !== wrapW) setWrapW(w);
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.segThumbActiveBlue,
          {
            width: halfW > 0 ? halfW : undefined,
            transform: [{ translateX }],
            opacity: innerW > 0 ? 1 : 0,
          },
        ]}
      />

      <Animated.View style={{ flex: 1, transform: [{ scale: leftPress.scale }] }}>
        <Pressable
          onPress={() => onChange('bolus')}
          onPressIn={leftPress.onPressIn}
          onPressOut={leftPress.onPressOut}
          style={styles.segItem}
          {...androidRipple('rgba(255,255,255,0.18)')}
        >
          <View style={styles.segRow}>
            <Ionicons name="flash-outline" size={16} color={value === 'bolus' ? '#fff' : THEME.muted} />
            <Text style={[styles.segText, value === 'bolus' ? styles.segTextOnBlue : styles.segTextOff]}>Bólus</Text>
          </View>
        </Pressable>
      </Animated.View>

      <Animated.View style={{ flex: 1, transform: [{ scale: rightPress.scale }] }}>
        <Pressable
          onPress={() => onChange('basal')}
          onPressIn={rightPress.onPressIn}
          onPressOut={rightPress.onPressOut}
          style={styles.segItem}
          {...androidRipple('rgba(255,255,255,0.18)')}
        >
          <View style={styles.segRow}>
            <Ionicons name="time-outline" size={16} color={value === 'basal' ? '#fff' : THEME.muted} />
            <Text style={[styles.segText, value === 'basal' ? styles.segTextOnBlue : styles.segTextOff]}>Bázis</Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/* =========================
   PRIMARY BUTTON (Material press + ripple)
========================= */
function PrimaryButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  const { scale, onPressIn, onPressOut } = usePressScale(!!disabled, 0.985);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        disabled={!!disabled}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.primaryBtn, disabled && styles.primaryBtnDisabled]}
        accessibilityRole="button"
        accessibilityLabel={title}
        {...androidRipple('rgba(255,255,255,0.18)')}
      >
        <Text style={styles.primaryBtnText}>{title}</Text>
      </Pressable>
    </Animated.View>
  );
}

/* =========================
   SCREEN
========================= */
export default function RegistrationScreen() {
  const params = useLocalSearchParams<{
    vc?: string;
    ch?: string;
    units?: string;
    type?: EntryType;
  }>();

  const [vcText, setVcText] = useState('');
  const [chText, setChText] = useState('');
  const [type, setType] = useState<EntryType>('bolus');
  const [insulinText, setInsulinText] = useState('');

  const vcRef = useRef<TextInput>(null);
  const chRef = useRef<TextInput>(null);
  const insulinRef = useRef<TextInput>(null);

  // Screen intro (Material)
  const screenIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(screenIn, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [screenIn]);

  // Pulse when form becomes valid (edge)
  const canSavePulse = useRef(new Animated.Value(0)).current;
  const prevCanSaveRef = useRef(false);

  useEffect(() => {
    const vc = typeof params.vc === 'string' ? params.vc : '';
    const ch = typeof params.ch === 'string' ? params.ch : '';
    const units = typeof params.units === 'string' ? params.units : '';
    const t: EntryType = params.type === 'basal' ? 'basal' : 'bolus';

    setType(t);

    if (vc && vcText.trim() === '') setVcText(String(vc));
    if (ch && chText.trim() === '') setChText(String(ch));
    if (units && insulinText.trim() === '') setInsulinText(String(units));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.vc, params.ch, params.units, params.type]);

  // ✅ NUMERIKUS validáció canSave-hez
  const vcNum = useMemo(() => toNumberOrNaN(vcText), [vcText]);
  const chNum = useMemo(() => toNumberOrNaN(chText), [chText]);
  const unitsNum = useMemo(() => toNumberOrNaN(insulinText), [insulinText]);

  const isVcValid = Number.isFinite(vcNum) && vcNum > 0;
  const isChValid = Number.isFinite(chNum) && chNum >= 0;
  const isUnitsValid = Number.isFinite(unitsNum) && unitsNum >= 0;

  const canSave = isVcValid && isChValid && isUnitsValid;

  // ✅ Pulse csak akkor, amikor false -> true
  useEffect(() => {
    const prev = prevCanSaveRef.current;
    if (!prev && canSave) {
      canSavePulse.stopAnimation();
      canSavePulse.setValue(0);
      Animated.timing(canSavePulse, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    prevCanSaveRef.current = canSave;
  }, [canSave, canSavePulse]);

  const resetForm = () => {
    setVcText('');
    setChText('');
    setType('bolus');
    setInsulinText('');
  };

  const onSave = async () => {
    // ✅ itt már numerikusan is védve van, de marad a safety
    if (!canSave) {
      // pontosabb hibaüzi
      if (vcText.trim() === '' || chText.trim() === '' || insulinText.trim() === '') {
        Alert.alert('Hiányzó adatok', 'Töltsd ki az összes mezőt a mentéshez.');
        return;
      }
      if (!isVcValid) return Alert.alert('Hibás adat', 'Adj meg valódi vércukorszint adatot!');
      if (!isChValid) return Alert.alert('Hibás adat', 'Adj meg valódi szénhidrát adatot!');
      if (!isUnitsValid) return Alert.alert('Hibás adat', 'Adj meg valódi inzulin adatot!');
      Alert.alert('Hibás adatok', 'Adj meg valódi adatokat!');
      return;
    }

    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const list: TimelineEntry[] = Array.isArray(parsed) ? parsed : [];

    const ts = Date.now();
    const entry: TimelineEntry = {
      id: ts.toString(),
      ts,
      vc: vcNum,
      ch: chNum,
      type,
      units: unitsNum,
    };

    list.unshift(entry);

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    DeviceEventEmitter.emit('entriesUpdated');

    resetForm();

    const d = toYmdLocal(ts);
    requestAnimationFrame(() => {
      router.replace({ pathname: '/timeline', params: { d, saved: '1' } });
    });
  };

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

      <Header />

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Animated.View
            style={{
              opacity: screenIn,
              transform: [{ translateY: screenIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            }}
          >
            <SectionTitle icon="create-outline" title="Adatok" hint="Új mérés, étkezés vagy inzulin rögzítése" />

            <Surface delay={70}>
              <Field
                label="Vércukorszint"
                value={vcText}
                onChangeText={setVcText}
                placeholder="..."
                unit="mmol/L"
                icon="water-outline"
                inputRef={vcRef}
                testID="input-vc"
              />

              <Field
                label="Szénhidrát"
                value={chText}
                onChangeText={setChText}
                placeholder="..."
                unit="g"
                icon="nutrition-outline"
                inputRef={chRef}
                testID="input-ch"
              />

              <Text style={[styles.label, { marginTop: GRID * 2 }]}>Inzulin típusa</Text>

              <InsulinTypeSelector value={type} onChange={setType} />

              <Field
                label="Inzulinmennyiség"
                value={insulinText}
                onChangeText={setInsulinText}
                placeholder="..."
                unit="E"
                icon="medical-outline"
                inputRef={insulinRef}
                testID="input-units"
              />
            </Surface>
          </Animated.View>
        </ScrollView>
      </View>

      <View style={styles.actionBar}>
        <View style={styles.actionBarInner}>
          <Animated.View
            style={{
              transform: [{ scale: canSavePulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.01] }) }],
            }}
          >
            <PrimaryButton title="Mentés" onPress={onSave} disabled={!canSave} />
          </Animated.View>
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

  scrollContent: { paddingHorizontal: H_MARGIN, paddingTop: GRID * 2, paddingBottom: 140 },

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

  segWrap: {
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    paddingHorizontal: 4,
    paddingVertical: 4,
    flexDirection: 'row',
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 0,
  },
  segThumbActiveBlue: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    width: '50%',
    borderRadius: 14,
    backgroundColor: THEME.primary,
  },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 14, overflow: 'hidden' },
  segRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  segText: { fontSize: 13.5, fontWeight: '900' },
  segTextOnBlue: { color: '#fff' },
  segTextOff: { color: THEME.muted },

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
