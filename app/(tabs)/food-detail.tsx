// app/food-detail.tsx
// ✅ Animok VISSZA (reanimated FadeIn/FadeInDown/FadeInUp)
// ✅ CUSTOM ételnél: kuka ikon a headerben (jobb oldalt)
// ✅ logika marad: törlés megerősítéssel + AsyncStorage
// ✅ Input viselkedés: calculator-mód (5,8,8 -> NaN)
// ✅ ScrollView + UI marad

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

import { BUILTIN_FOODS, Food, FoodCategoryId } from '../data/builtinFoods';

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

// ✅ ugyanaz a logika, mint calculator.tsx
// - csak az első ","-t cseréli "."-ra
// - ha több vessző van: "5,8,8" -> "5.8,8" -> NaN
const toNumber = (s: string) => {
  const t = String(s ?? '').trim();
  if (!t) return NaN;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

const toComma = (v: number | string) => String(v).replace('.', ',');

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
   HEADER (calculator layout)
   ✅ right side: optional trash for CUSTOM food
   ✅ press feedback: sima Pressable
   ✅ anim
========================= */
function Header({
  title,
  onBack,
  showTrash,
  onTrash,
}: {
  title: string;
  onBack: () => void;
  showTrash?: boolean;
  onTrash?: () => void;
}) {
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

        {showTrash ? (
          <Pressable
            onPress={onTrash}
            hitSlop={12}
            style={({ pressed }) => [styles.headerIconBtn, pressed && { transform: [{ scale: 0.985 }], opacity: 0.92 }]}
            accessibilityRole="button"
            accessibilityLabel="Étel törlése"
          >
            <Ionicons name="trash-outline" size={20} color={THEME.muted} />
          </Pressable>
        ) : (
          <View style={{ width: 42, height: 42 }} />
        )}
      </View>
    </Animated.View>
  );
}

/* =========================
   FIELD (match calculator)
   ✅ calculator-mód: csak "." -> ","
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
          onChangeText={(t) => onChangeText(String(t).replace('.', ','))}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={THEME.subtle}
          style={styles.input}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          blurOnSubmit={false}
        />

        <View style={styles.unitPill}>
          <Text style={styles.unitText}>{unit}</Text>
        </View>
      </View>
    </View>
  );
}

/* =========================
   META ROW (match calculator pill style)
========================= */
function MetaRow({ carbsPer100 }: { carbsPer100: number }) {
  return (
    <View style={styles.metaRow}>
      <View style={styles.metaItem}>
        <Ionicons name="nutrition-outline" size={16} color={THEME.muted} />
        <Text style={styles.metaText}>Szénhidrát: {toComma(carbsPer100)} g / 100g</Text>
      </View>
    </View>
  );
}

/* =========================
   RESULT BOX (match calculator)
========================= */
function ResultBox({ value }: { value: number }) {
  const hasValue = value > 0;

  return (
    <View style={styles.resultBox}>
      <View style={{ flex: 1 }}>
        <Text style={styles.resultLabel}>Szénhidráttartalom</Text>

        <View style={styles.resultValueRow}>
          <Text style={styles.resultValue}>{hasValue ? toComma(value) : '—'}</Text>
          <Text style={styles.resultUnit}>{hasValue ? 'g' : ''}</Text>
        </View>

        <Text style={styles.resultNote}>
          {hasValue ? 'Kerekített összeg a mennyiség alapján.' : 'Add meg a mennyiséget a számításhoz.'}
        </Text>
      </View>

      <View style={styles.resultIcon}>
        <Ionicons
          name={hasValue ? 'checkmark-circle-outline' : 'information-circle-outline'}
          size={26}
          color={hasValue ? THEME.primary : THEME.muted}
        />
      </View>
    </View>
  );
}

/* =========================
   SCREEN
========================= */
export default function FoodDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [userFoods, setUserFoods] = useState<Food[]>([]);
  const [amountText, setAmountText] = useState('');

  const amountRef = useRef<TextInput>(null);

  const loadUserFoods = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_FOODS_KEY);
      if (!raw) {
        setUserFoods([]);
        return;
      }

      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : [];

      const fixed: Food[] = arr
        .filter(Boolean)
        .map((item: any) => (item.category ? item : { ...item, category: 'CUSTOM' as FoodCategoryId }));

      setUserFoods(fixed);
    } catch {
      setUserFoods([]);
    }
  }, []);

  useEffect(() => {
    loadUserFoods();
  }, [loadUserFoods]);

  useFocusEffect(
    useCallback(() => {
      loadUserFoods();
      return () => setAmountText('');
    }, [loadUserFoods])
  );

  const allFoods = useMemo(() => [...BUILTIN_FOODS, ...userFoods], [userFoods]);

  const selectedFood = useMemo(() => {
    if (!id) return null;
    return allFoods.find((f) => String(f.id) === String(id)) || null;
  }, [id, allFoods]);

  const parsedAmount = toNumber(amountText);

  // ✅ invalid ("5,8,8") => parsedAmount = NaN => totalCarbs = 0
  const totalCarbs =
    selectedFood && Number.isFinite(parsedAmount) && parsedAmount > 0
      ? +(selectedFood.carbs * (parsedAmount / 100)).toFixed(1)
      : 0;

  const isCustomFood = selectedFood?.category === ('CUSTOM' as FoodCategoryId);

  const goBackToSearch = useCallback(() => {
    router.push('/foodsearch');
  }, [router]);

  const deleteCustomFood = useCallback(() => {
    if (!selectedFood) return;

    Alert.alert('Étel törlése', 'Biztosan törlöd ezt az ételt?', [
      { text: 'Mégse', style: 'cancel' },
      {
        text: 'Törlés',
        style: 'destructive',
        onPress: async () => {
          try {
            const raw = await AsyncStorage.getItem(STORAGE_FOODS_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            const list: Food[] = Array.isArray(parsed) ? parsed : [];

            const next = list.filter((f) => String(f.id) !== String(selectedFood.id));
            await AsyncStorage.setItem(STORAGE_FOODS_KEY, JSON.stringify(next));

            goBackToSearch();
          } catch {
            goBackToSearch();
          }
        },
      },
    ]);
  }, [selectedFood, goBackToSearch]);

  if (!selectedFood) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View pointerEvents="none" style={styles.bgAmbient} />
        <View pointerEvents="none" style={styles.bgBlobA} />
        <View pointerEvents="none" style={styles.bgBlobB} />

        <Header title="Étel információk" onBack={goBackToSearch} />
      </SafeAreaView>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View pointerEvents="none" style={styles.bgAmbient} />
        <View pointerEvents="none" style={styles.bgBlobA} />
        <View pointerEvents="none" style={styles.bgBlobB} />

        <Header
          title={selectedFood.name}
          onBack={goBackToSearch}
          showTrash={!!isCustomFood}
          onTrash={deleteCustomFood}
        />

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInDown.duration(220)}>
            <SectionTitle icon="create-outline" title="Adatok" hint="A számításhoz szükséges értékek" />
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(220)}>
            <Surface>
              <Field
                label="Mennyiség"
                value={amountText}
                onChangeText={setAmountText}
                placeholder="..."
                unit="g"
                icon="scale-outline"
                inputRef={amountRef}
                testID="input-amount"
              />

              <MetaRow carbsPer100={selectedFood.carbs} />
            </Surface>
          </Animated.View>

          <View style={{ height: GRID * 2 }} />

          <Animated.View entering={FadeInDown.duration(220)}>
            <SectionTitle icon="sparkles-outline" title="Számítás" hint="Összesített szénhidrát a mennyiség alapján" />
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(220)}>
            <Surface>
              <ResultBox value={totalCarbs} />
            </Surface>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

/* =========================
   STYLES (match calculator)
========================= */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME.bg },

  /* ambient background */
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

  /* header */
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

  scrollContent: { paddingHorizontal: H_MARGIN, paddingTop: GRID * 2, paddingBottom: 44 },

  /* section title */
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

  /* surfaces */
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
  },
  resultLabel: {
    color: THEME.muted,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
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
});
