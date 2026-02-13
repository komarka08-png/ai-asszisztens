// app/(tabs)/settings.tsx
// ✅ Animálva (NO Reanimated) — ugyanúgy, mint calculator / timeline:
// - Screen intro (fade + slight translate)
// - Section blokkok enter (stagger)
// - Press micro anim (scale) + Android ripple (Row + gomb + header back)
// ✅ UI/ikonok/design marad 1:1
// ✅ Logika változatlan (reminders betöltés, goBack, logout)

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
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
const VERSION = '1.0.0';

/* ===== STORAGE KEYS ===== */
const STORAGE_REMINDERS = '@meal_reminders_v1';

/* ===== TYPES ===== */
type MealReminders = {
  enabled: boolean;
  breakfast: string;
  lunch: string;
  dinner: string;
};

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
   HEADER (calculator layout) — press micro anim + ripple
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
            accessibilityRole={onBack ? 'button' : undefined}
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
   ROW (settings item) — press micro anim + ripple
========================= */
function RowOpen({
  title,
  subtitle,
  rightText,
  icon,
  onPress,
}: {
  title: string;
  subtitle?: string;
  rightText?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}) {
  const press = usePressScale(!onPress, 0.99);

  return (
    <Animated.View style={{ transform: [{ scale: press.scale }] }}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        hitSlop={6}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={title}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[styles.row, !onPress && { opacity: 0.95 }]}
        {...androidRipple('rgba(0,0,0,0.06)')}
      >
        <View style={styles.rowIconBox}>
          <Ionicons name={icon} size={18} color={THEME.muted} />
        </View>

        <View style={{ flex: 1, paddingRight: GRID }}>
          <Text style={styles.rowTitle} numberOfLines={1} ellipsizeMode="tail">
            {title}
          </Text>

          {!!subtitle && (
            <Text style={styles.rowSubtitle} numberOfLines={2} ellipsizeMode="tail">
              {subtitle}
            </Text>
          )}
        </View>

        {!!rightText && (
          <View style={styles.rightPill}>
            <Text style={styles.rightPillText}>{rightText}</Text>
          </View>
        )}

        <Ionicons name="chevron-forward" size={18} color={THEME.muted} />
      </Pressable>
    </Animated.View>
  );
}

const Divider = () => <View style={styles.divider} />;

/* =========================
   PRIMARY BUTTON — press micro anim + ripple
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
   SCREEN
========================= */
export default function SettingsScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();

  const [rem, setRem] = useState<MealReminders>({
    enabled: true,
    breakfast: '07:30',
    lunch: '12:30',
    dinner: '18:30',
  });

  // reminders betöltés (változatlan)
  useEffect(() => {
    (async () => {
      try {
        const rr = await AsyncStorage.getItem(STORAGE_REMINDERS);
        if (!rr) return;

        const parsed = JSON.parse(rr) as any;
        if (
          parsed &&
          typeof parsed === 'object' &&
          typeof parsed.enabled === 'boolean' &&
          typeof parsed.breakfast === 'string' &&
          typeof parsed.lunch === 'string' &&
          typeof parsed.dinner === 'string'
        ) {
          setRem(parsed as MealReminders);
        }
      } catch {}
    })();
  }, []);

  const goBack = () => {
    if (from === 'calculator') return router.push('/calculator');
    if (from === 'assistant') return router.push('/assistent');
    if (from === 'timeline') return router.push('/timeline');
    if (from === 'foodsearch') return router.push('/foodsearch');
    if (from === 'index') return router.push('/');
    router.back();
  };

  const logout = async () => {
    Alert.alert('Kijelentkezés', 'Biztosan kijelentkezel?', [
      { text: 'Mégse', style: 'cancel' },
      {
        text: 'Igen',
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.clear();
          } finally {
            router.replace('/');
          }
        },
      },
    ]);
  };

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

      <Animated.View
        style={{
          flex: 1,
          opacity: screenIn,
          transform: [{ translateY: screenIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        }}
      >
        <Header title="Beállítások" onBack={goBack} />

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <FadeSlideIn delay={30} dy={8}>
            <SectionTitle icon="person-circle-outline" title="Fiókbeállítások" hint="Profil és előfizetés" />
          </FadeSlideIn>

          <FadeSlideIn delay={70}>
            <Surface>
              <RowOpen icon="id-card-outline" title="Személyes adatok" onPress={() => router.push('/settings-account')} />
              <Divider />
              <RowOpen icon="card-outline" title="Előfizetés kezelése" onPress={() => router.push('/settings-subscription')} />
            </Surface>
          </FadeSlideIn>

          <View style={{ height: GRID * 2 }} />

          <FadeSlideIn delay={130} dy={8}>
            <SectionTitle icon="calculator-outline" title="Számítási beállítások" hint="Arányok és célértékek beállítása" />
          </FadeSlideIn>

          <FadeSlideIn delay={170}>
            <Surface>
              <RowOpen icon="swap-horizontal-outline" title="Inzulin–szénhidrát arány" onPress={() => router.push('/settings-icr')} />
              <Divider />
              <RowOpen icon="analytics-outline" title="Inzulinerzékenységi faktor" onPress={() => router.push('/settings-isf')} />
              <Divider />
              <RowOpen icon="speedometer-outline" title="Céltartomány" onPress={() => router.push('/settings-targetvc')} />
            </Surface>
          </FadeSlideIn>

          <View style={{ height: GRID * 2 }} />

          <FadeSlideIn delay={230} dy={8}>
            <SectionTitle icon="settings-outline" title="Alkalmazás beállítások" hint="Értesítések és opciók" />
          </FadeSlideIn>

          <FadeSlideIn delay={270}>
            <Surface>
              <RowOpen
                icon="alarm-outline"
                title="Emlékeztetők"
                rightText={rem.enabled ? 'Be' : 'Ki'}
                onPress={() => router.push('/settings-reminders')}
              />
            </Surface>
          </FadeSlideIn>

          <View style={{ height: GRID * 2 }} />

          <FadeSlideIn delay={330} dy={8}>
            <SectionTitle icon="document-text-outline" title="Jogi információk" hint="Dokumentumok" />
          </FadeSlideIn>

          <FadeSlideIn delay={370}>
            <Surface>
              <RowOpen icon="reader-outline" title="Felhasználási feltételek" onPress={() => router.push('/settings-terms')} />
              <Divider />
              <RowOpen icon="lock-closed-outline" title="Adatkezelési tájékoztató" onPress={() => router.push('/settings-privacy')} />
            </Surface>
          </FadeSlideIn>

          <View style={{ height: GRID * 2 }} />

          <FadeSlideIn delay={430} dy={8}>
            <PrimaryButton title="Kijelentkezés" onPress={logout} />
          </FadeSlideIn>

          <FadeSlideIn delay={470} dy={6} style={styles.versionWrap}>
            <Text style={styles.versionText}>Verzió {VERSION}</Text>
          </FadeSlideIn>
        </ScrollView>
      </Animated.View>
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

  scrollContent: { paddingHorizontal: H_MARGIN, paddingTop: GRID * 2, paddingBottom: 44 },

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
  rowSubtitle: { marginTop: 2, fontSize: 12.5, color: THEME.muted, fontWeight: '600' },

  rightPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: THEME.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.20)',
    marginLeft: 10,
    marginRight: 6,
  },
  rightPillText: { fontSize: 12.5, fontWeight: '900', color: THEME.primary },

  divider: { height: GRID * 1.25 },

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

  versionWrap: { alignItems: 'center', marginTop: GRID * 3 + 2, marginBottom: GRID },
  versionText: { color: THEME.muted, fontSize: 13, fontWeight: '700' },
});
