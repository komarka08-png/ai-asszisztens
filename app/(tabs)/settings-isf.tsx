// app/settings-isf.tsx
// ✅ Animated (NO Reanimated) — ugyanúgy mint calculator / timeline
// - Screen intro (fade + slight translate)
// - Content block enter (stagger FadeSlideIn)
// - Press micro anim (scale) + Android ripple (header back + save)
// ✅ Logika változatlan
// ✅ ISF mező: number-pad
// ✅ Diszklémer nincs
// ✅ Action bar tömör, nem áttetsző, NO shadow/elevation

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
   ACTION BAR (tömör)
========================= */
const CTA_H = 52;
const ACTION_PAD_Y = GRID * 1.25; // 10
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
   HEADER (calculator) — press micro anim + ripple
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
   FIELD (match calculator) — UI unchanged
========================= */
function Field({
  label,
  value,
  onChangeText,
  placeholder,
  unit,
  icon,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  unit: string;
  icon: keyof typeof Ionicons.glyphMap;
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
          keyboardType="number-pad"
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
   PRIMARY BUTTON (calculator) — press micro anim + ripple
   ✅ NO glow / NO shadow
========================= */
function PrimaryButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  const press = usePressScale(!!disabled, 0.985);

  return (
    <Animated.View style={{ transform: [{ scale: press.scale }] }}>
      <Pressable
        onPress={onPress}
        disabled={!!disabled}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
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
export default function SettingsIsfScreen() {
  const router = useRouter();
  const [isf, setIsf] = useState('');
  const [savedIsf, setSavedIsf] = useState('');

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
        const val = data?.isf;

        if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
          const s = String(val).replace('.', ',');
          setIsf(s);
          setSavedIsf(s);
        } else {
          setIsf('');
          setSavedIsf('');
        }
      } catch {
        setIsf('');
        setSavedIsf('');
      }
    })();
  }, []);

  const isfNum = useMemo(() => toNumOrNaN(isf), [isf]);
  const canSave = useMemo(() => Number.isFinite(isfNum) && isfNum > 0, [isfNum]);

  const onBack = () => {
    const t = String(isf || '').trim();
    if (!t) setIsf(savedIsf);
    router.push('/settings');
  };

  const saveISF = async () => {
    if (!canSave) {
      Alert.alert('Hibás adat', 'Adj meg valódi inzulinerzékenységi faktort!');
      return;
    }

    const n = isfNum;

    try {
      await AsyncStorage.mergeItem(STORAGE_PARAMS, JSON.stringify({ isf: n }));
    } catch {
      Alert.alert('Hiba', 'Nem sikerült elmenteni. Próbáld újra!');
      return;
    }

    const s = String(n).includes('.') ? String(n).replace('.', ',') : String(n);
    setIsf(s);
    setSavedIsf(s);

    Alert.alert('Sikeres mentés', 'Az Inzulinerzékenységi faktor elmentve.', [
      { text: 'OK', onPress: () => router.push('/settings') },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View pointerEvents="none" style={styles.bgAmbient} />
      <View pointerEvents="none" style={styles.bgBlobA} />
      <View pointerEvents="none" style={styles.bgBlobB} />

      <Header title="Inzulinerzékenységi faktor" onBack={onBack} />

      <Animated.View
        style={{
          flex: 1,
          opacity: screenIn,
          transform: [{ translateY: screenIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: ACTION_BAR_H + GRID * 2 }, // ✅ action barhoz igazítva
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <FadeSlideIn delay={30} dy={8}>
            <SectionTitle icon="analytics-outline" title="Beállítás" hint="Add meg, mennyit csökkent 1 E inzulin" />
          </FadeSlideIn>

          <FadeSlideIn delay={90} dy={10}>
            <Surface>
              <Field
                label="Inzulinerzékenységi faktor"
                value={isf}
                onChangeText={setIsf}
                placeholder="..."
                unit="mmol/L"
                icon="pulse-outline"
                testID="input-isf"
              />
            </Surface>
          </FadeSlideIn>
        </ScrollView>
      </Animated.View>

      <View style={styles.actionBar}>
        <View style={styles.actionBarInner}>
          <PrimaryButton title="Mentés" onPress={saveISF} disabled={!canSave} />
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

  scrollContent: { paddingHorizontal: H_MARGIN, paddingTop: GRID * 2 },

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

  /* ✅ action bar: tömör + NO shadow/elevation */
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: THEME.surface, // ✅ nem áttetsző
    borderTopWidth: 1,
    borderTopColor: 'rgba(230,232,240,0.9)',
    shadowOpacity: 0, // ✅ NO shadow
    elevation: 0, // ✅ NO elevation
  },
  actionBarInner: { paddingHorizontal: H_MARGIN, paddingTop: ACTION_PAD_Y, paddingBottom: ACTION_PAD_Y },

  primaryBtn: {
    height: CTA_H, // ✅ tömör
    borderRadius: 16, // ✅ kicsit “timeline”
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
