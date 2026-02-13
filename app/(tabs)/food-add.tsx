// app/food-add.tsx
// ✅ Animok VISSZA (reanimated FadeIn/FadeInDown/FadeInUp + micro enter)
// ✅ UI + logika marad 1:1
// ✅ Press feedback: Pressable pressed style marad

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Food, FoodCategoryId } from '../data/builtinFoods';

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

  // subtle ambient tones
  gradA: 'rgba(37, 99, 235, 0.08)',
  gradB: 'rgba(124, 58, 237, 0.06)',
  shadowStrong: 'rgba(15, 23, 42, 0.12)',
  ctaShadow: 'rgba(37, 99, 235, 0.35)',
};

const GRID = 8;
const H_MARGIN = 16;

const STORAGE_FOODS_KEY = '@food_db_v1';

/* =========================
   HELPERS
========================= */
const normName = (s: string) =>
  String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const toNumberOrNaN = (s: string) => {
  const t = String(s ?? '').trim();
  if (!t) return NaN;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

const normalizeFood = (item: any): Food | null => {
  if (!item || typeof item !== 'object') return null;
  const id = String(item.id ?? '').trim();
  const name = String(item.name ?? '').trim();
  const carbs = Number(item.carbs);
  const category = (item.category ?? 'CUSTOM') as FoodCategoryId;

  if (!id || !name) return null;
  if (!Number.isFinite(carbs) || carbs < 0) return null;

  return { id, name, carbs, category };
};

/* =========================
   UI (match calculator)
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
   HEADER (calculator layout) — ✅ anim
========================= */
function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <Animated.View entering={FadeInDown.duration(220)} style={styles.headerWrap}>
      <View pointerEvents="none" style={styles.headerGlowA} />
      <View pointerEvents="none" style={styles.headerGlowB} />

      <View style={styles.headerTitleRow}>
        <Pressable
          onPress={onBack}
          hitSlop={12}
          style={({ pressed }) => [styles.headerIconBtn, pressed && { transform: [{ scale: 0.985 }], opacity: 0.92 }]}
          accessibilityRole="button"
          accessibilityLabel="Vissza"
        >
          <Ionicons name="chevron-back" size={20} color={THEME.text} />
        </Pressable>

        <Text style={styles.headerTitleCentered} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>

        <View style={{ width: 42, height: 42 }} />
      </View>
    </Animated.View>
  );
}

/* =========================
   FIELD (match calculator) — anim nélkül (marad)
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
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  unit: string;
  icon: keyof typeof Ionicons.glyphMap;
  inputRef?: React.Ref<TextInput>;
  testID?: string;
  keyboardType?: 'default' | 'decimal-pad';
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
          keyboardType={keyboardType ?? 'default'}
          placeholder={placeholder}
          placeholderTextColor={THEME.subtle}
          style={styles.input}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />

        {!!unit && (
          <View style={styles.unitPill}>
            <Text style={styles.unitText}>{unit}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/* =========================
   PRIMARY BUTTON — anim nélkül (marad)
========================= */
function PrimaryButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!!disabled}
      style={({ pressed }) => [
        styles.primaryBtn,
        disabled && styles.primaryBtnDisabled,
        pressed && !disabled && { transform: [{ scale: 0.985 }], opacity: 0.95 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Text style={styles.primaryBtnText}>{title}</Text>
    </Pressable>
  );
}

/* =========================
   SCREEN
========================= */
export default function FoodAddScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ suggestedName?: string }>();

  const [newName, setNewName] = useState('');
  const [newCarbsText, setNewCarbsText] = useState('');
  const [userFoods, setUserFoods] = useState<Food[]>([]);

  const nameInputRef = useRef<TextInput | null>(null);

  // ✅ ALWAYS go back to foodsearch (no router.back)
  const goBackToSearch = () => {
    router.replace('/foodsearch');
  };

  const resetForm = useCallback(() => {
    setNewName('');
    setNewCarbsText('');
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (params.suggestedName) {
        const q = String(params.suggestedName);
        setNewName(q ? q.charAt(0).toUpperCase() + q.slice(1) : '');
      } else {
        setNewName('');
      }
      setNewCarbsText('');

      return () => resetForm();
    }, [params.suggestedName, resetForm])
  );

  const loadUserFoods = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_FOODS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const arr: any[] = Array.isArray(parsed) ? parsed : [];

      const fixed = arr
        .map(normalizeFood)
        .filter(Boolean)
        .map((f) => (f!.category ? f! : { ...f!, category: 'CUSTOM' as FoodCategoryId })) as Food[];

      if (fixed.length !== arr.length) {
        AsyncStorage.setItem(STORAGE_FOODS_KEY, JSON.stringify(fixed)).catch(() => {});
      }

      setUserFoods(fixed);
    } catch {
      setUserFoods([]);
    }
  }, []);

  useEffect(() => {
    loadUserFoods();
  }, [loadUserFoods]);

  // ✅ IMPORTANT: removed auto-focus useEffect so keyboard won't pop up automatically

  const nameTrim = newName.trim();
  const carbsTrim = newCarbsText.trim();
  const carbs = useMemo(() => toNumberOrNaN(newCarbsText), [newCarbsText]);

  const canSave = nameTrim.length > 0 && carbsTrim.length > 0 && Number.isFinite(carbs) && carbs >= 0;

  const saveNewFood = async () => {
    const name = nameTrim;
    const carbsTextTrimmed = carbsTrim;

    if (!name && carbsTextTrimmed === '') {
      Alert.alert('Hiányzó adatok', 'Add meg a hiányzó adatokat!');
      return;
    }
    if (!name) {
      Alert.alert('Hiányzó adat', 'Add meg az étel nevét!');
      return;
    }
    if (carbsTextTrimmed === '') {
      Alert.alert('Hiányzó adat', 'Add meg az étel szénhidrát tartalmát!');
      return;
    }

    if (!Number.isFinite(carbs) || carbs < 0) {
      Alert.alert('Hibás adat', 'Adj meg valódi szénhidrát tartalmat!');
      return;
    }

    const nameKey = normName(name);
    const exists = userFoods.some((f) => normName(f.name) === nameKey);
    if (exists) {
      Alert.alert('Már létezik', 'Ez az étel már szerepel a saját ételek között.');
      return;
    }

    const newFood: Food = {
      id: `user_${Date.now()}`,
      name,
      carbs,
      category: 'CUSTOM',
    };

    const updated = [...userFoods, newFood];

    try {
      await AsyncStorage.setItem(STORAGE_FOODS_KEY, JSON.stringify(updated));
    } catch {
      Alert.alert('Hiba', 'Nem sikerült elmenteni az ételt. Próbáld újra!');
      return;
    }

    resetForm();

    // ✅ after save go to foodsearch, and avoid stacking
    router.replace('/foodsearch?saved=1');
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View pointerEvents="none" style={styles.bgAmbient} />
        <View pointerEvents="none" style={styles.bgBlobA} />
        <View pointerEvents="none" style={styles.bgBlobB} />

        <Header title="Új étel" onBack={goBackToSearch} />

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.duration(220)}>
            <SectionTitle icon="create-outline" title="Adatok" hint="Add meg az étel nevét és a szénhidrátot." />
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(220)}>
            <Surface>
              <Field
                label="Étel neve"
                value={newName}
                onChangeText={setNewName}
                placeholder="..."
                unit=""
                icon="restaurant-outline"
                inputRef={nameInputRef}
                testID="input-name"
                keyboardType="default"
              />

              <Field
                label="Szénhidrát (100 g-ban)"
                value={newCarbsText}
                onChangeText={(t) => setNewCarbsText(String(t).replace('.', ','))}
                placeholder="..."
                unit="g"
                icon="nutrition-outline"
                testID="input-carbs"
                keyboardType="decimal-pad"
              />
            </Surface>
          </Animated.View>
        </ScrollView>

        <Animated.View entering={FadeInUp.duration(220)} style={styles.actionBar}>
          <View style={styles.actionBarInner}>
            <PrimaryButton title="Mentés" onPress={saveNewFood} disabled={!canSave} />
          </View>
        </Animated.View>
      </SafeAreaView>
    </TouchableWithoutFeedback>
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
  },
  primaryBtnDisabled: { backgroundColor: 'rgba(37, 99, 235, 0.45)' },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
