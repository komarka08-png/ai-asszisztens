// app/foodsearch.tsx
// ✅ Swipe paging stays the same (categories + results)
// ✅ Tap vs swipe stays the same (NO accidental detail open on swipe)
// ✅ STILL: list rows have NO icons (category + result), empty block no icon
// ✅ NOW: Material-style animations (NO Reanimated):
// - Screen intro (fade + slight translate)
// - Surface enter (stagger)
// - Press micro anim (scale) + Android ripple
// - Page-change micro anim (fade + slight translate) for categories/results lists

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BUILTIN_FOODS, FOOD_CATEGORIES, Food, FoodCategoryId } from '../data/builtinFoods';

/* =========================
   THEME
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

  accent: '#7C3AED',
  accentSoft: '#F5F3FF',

  danger: '#EF4444',
  dangerSoft: '#FEF2F2',

  shadowStrong: 'rgba(15, 23, 42, 0.12)',

  // ✅ same as calculator background blobs
  gradA: 'rgba(37, 99, 235, 0.08)',
  gradB: 'rgba(124, 58, 237, 0.06)',
};

const GRID = 8;
const H_MARGIN = 16;

const STORAGE_FOODS_KEY = '@food_db_v1';

const DEBOUNCE_MS = 120;
const MIN_CHARS = 2;

/* =========================
   “CSAK A LEGJOBBAK” (nem kategória keresésnél)
========================= */
const MAX_RESULTS = 12;

/* =========================
   ACTION BAR
========================= */
const CTA_H = 56;
const ACTION_PAD_Y = GRID * 1.5;
const ACTION_BAR_H = CTA_H + ACTION_PAD_Y * 2 + 1;

/* =========================
   PAGER (6 sor + swipe)
========================= */
const ROWS_PER_PAGE = 6;
const SWIPE_ACTIVATE_PX = 6;
const SWIPE_TRIGGER_PX = 24;

// ✅ FIX MAGASSÁG (fake row nélkül)
const ROW_H = 52;
const ROW_GAP = GRID * 1.25;
const ROW_SLOT = ROW_H + ROW_GAP;

/* =========================
   TEXT HELPERS
========================= */
const norm = (s: any) =>
  String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/* =========================
   SMALL HELPERS
========================= */
const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/* =========================
   STABLE ID
========================= */
const hashStr = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
};

const stableFoodId = (src: 'builtin' | 'user', maybeId: any, name: any, category: any) => {
  const id = String(maybeId ?? '').trim();
  if (id) return id;
  const key = `${src}:${String(name ?? '').trim()}|${String(category ?? '').trim()}`;
  return `${src}-${hashStr(key)}`;
};

/* =========================
   CATEGORY MATCH
========================= */
const findMatchedCategory = (q: string, categoryLabelNorm: Record<FoodCategoryId, string>): FoodCategoryId | null => {
  for (const cat of Object.keys(categoryLabelNorm) as FoodCategoryId[]) {
    const label = categoryLabelNorm[cat];
    if (!label) continue;
    if (label.startsWith(q) || label.includes(q)) return cat;
  }
  return null;
};

/* =========================
   STRICT SEARCH
========================= */
const strictMatch = (qNorm: string, nameNorm: string) => {
  if (!qNorm) return { ok: false, score: 999 };
  if (nameNorm.startsWith(qNorm)) return { ok: true, score: 0 };
  if (nameNorm.includes(qNorm)) return { ok: true, score: 1 };
  return { ok: false, score: 999 };
};

/* =========================
   ICONS (category -> icon)
   (MEGMARAD: máshol használhatod, de listában NEM használjuk)
========================= */
const categoryIcon = (id: FoodCategoryId): keyof typeof Ionicons.glyphMap => {
  switch (id) {
    case 'MEAT':
      return 'restaurant-outline';
    case 'FISH':
      return 'fish-outline';
    case 'DAIRY':
      return 'cafe-outline';
    case 'GRAIN':
      return 'leaf-outline';
    case 'VEG':
      return 'nutrition-outline';
    case 'FRUIT':
      return 'aperture-outline';
    case 'NUTS':
      return 'ellipse-outline';
    case 'CUSTOM':
      return 'star-outline';
    default:
      return 'albums-outline';
  }
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
   UI PRIMITIVES (ANIM)
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
  icon,
  title,
  hint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint?: string;
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

function Header({ title, onSettings }: { title: string; onSettings: () => void }) {
  const press = usePressScale(false, 0.96);

  return (
    <View style={styles.headerWrap}>
      <View pointerEvents="none" style={styles.headerGlowA} />
      <View pointerEvents="none" style={styles.headerGlowB} />

      <View style={styles.headerTitleRow}>
        <View style={{ width: 42, height: 42 }} />

        <Text style={styles.headerTitleCentered} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>

        <Animated.View style={{ transform: [{ scale: press.scale }] }}>
          <Pressable
            onPress={onSettings}
            onPressIn={press.onPressIn}
            onPressOut={press.onPressOut}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Beállítások"
            style={styles.headerIconBtn}
            {...androidRipple('rgba(0,0,0,0.08)')}
          >
            <Ionicons name="settings-outline" size={20} color={THEME.text} />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

function SearchField({
  value,
  onChangeText,
  placeholder,
  testID,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  testID?: string;
}) {
  const [focused, setFocused] = useState(false);
  const filled = value.trim().length > 0;

  const clearPress = usePressScale(false, 0.92);

  return (
    <View style={[styles.field, focused && styles.fieldFocused, filled && styles.fieldFilled]}>
      <View style={[styles.fieldIcon, focused && styles.fieldIconFocused]}>
        <Ionicons name="search-outline" size={18} color={focused ? THEME.primary : THEME.muted} />
      </View>

      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={THEME.subtle}
        style={styles.input}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel="Keresés mező"
      />

      {filled ? (
        <Animated.View style={{ transform: [{ scale: clearPress.scale }] }}>
          <Pressable
            onPress={() => onChangeText('')}
            onPressIn={clearPress.onPressIn}
            onPressOut={clearPress.onPressOut}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Keresés törlése"
            style={styles.clearBtn}
            {...androidRipple('rgba(0,0,0,0.08)')}
          >
            <Ionicons name="close" size={16} color={THEME.muted} />
          </Pressable>
        </Animated.View>
      ) : (
        <View style={{ width: 34, height: 34 }} />
      )}
    </View>
  );
}

/* =========================
   ROWS (ANIM) — LISTÁBAN NINCS IKON
========================= */

// ✅ Kategória sor: NINCS bal ikon, NINCS chevron
function CategoryTile({
  id,
  label,
  onPress,
  guardRef,
  disabled,
}: {
  id: FoodCategoryId;
  label: string;
  onPress: () => void;
  guardRef: React.MutableRefObject<boolean>;
  disabled?: boolean;
}) {
  const press = usePressScale(!!disabled, 0.985);

  return (
    <Animated.View style={{ transform: [{ scale: press.scale }] }}>
      <Pressable
        disabled={!!disabled}
        onPress={() => {
          if (disabled) return;
          if (guardRef.current) return; // ✅ swipe = lock, so never open
          onPress();
        }}
        onPressIn={() => {
          if (disabled) return;
          guardRef.current = false; // keep original behavior
          press.onPressIn();
        }}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={`Kategória: ${label}`}
        accessibilityState={{ disabled: !!disabled }}
        style={[styles.tileRow, disabled && styles.disabledRow]}
        {...androidRipple('rgba(0,0,0,0.06)')}
      >
        <Text
          style={[styles.tileText, styles.tileTextNoLeftIcon, disabled && styles.tileTextDisabled]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ✅ Találatok sor: NINCS bal ikon, NINCS chevron
function ResultRow({ label, onPress }: { label: string; onPress: () => void }) {
  const press = usePressScale(false, 0.985);

  return (
    <Animated.View style={{ transform: [{ scale: press.scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={styles.tileRow}
        {...androidRipple('rgba(0,0,0,0.06)')}
      >
        <Text style={[styles.tileText, styles.tileTextNoLeftIcon]} numberOfLines={1} ellipsizeMode="tail">
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ✅ Empty state blokk: nincs ikon
function EmptyBlock({ title }: { title: string }) {
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyTitle} numberOfLines={2} ellipsizeMode="tail">
        {title}
      </Text>
    </View>
  );
}

function PrimaryButton({ title, onPress }: { title: string; onPress: () => void }) {
  const press = usePressScale(false, 0.985);

  return (
    <Animated.View style={{ transform: [{ scale: press.scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={styles.primaryBtn}
        {...androidRipple('rgba(255,255,255,0.18)')}
      >
        <Text style={styles.primaryBtnText}>{title}</Text>
      </Pressable>
    </Animated.View>
  );
}

/* =========================
   TYPES
========================= */
type FoodWithSrc = Food & { __src: 'builtin' | 'user' };

/* =========================
   SCREEN
========================= */
export default function FoodSearchScreen() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [userFoods, setUserFoods] = useState<Food[]>([]);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const [catPage, setCatPage] = useState(0);
  const [resPage, setResPage] = useState(0);

  const pendingOpenRef = useRef<null | { id: string }>(null);

  // ✅ swipe lock CSAK kategóriáknál
  const swipeLockRef = useRef(false);
  const lockPress = () => {
    swipeLockRef.current = true;
  };
  const unlockPressSoon = () => {
    setTimeout(() => {
      swipeLockRef.current = false;
    }, 90);
  };

  // Screen intro
  const screenIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(screenIn, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [screenIn]);

  // Page-change micro anims
  const catPageAnim = useRef(new Animated.Value(1)).current;
  const resPageAnim = useRef(new Animated.Value(1)).current;

  const bump = (v: Animated.Value) => {
    v.stopAnimation();
    v.setValue(0);
    Animated.timing(v, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const validCategorySet = useMemo(() => {
    const s = new Set<string>();
    try {
      for (const c of FOOD_CATEGORIES as any[]) s.add(String(c?.id));
    } catch {}
    s.add('CUSTOM');
    return s;
  }, []);

  const toSafeCategory = useCallback(
    (cat: any): FoodCategoryId => {
      const c = String(cat ?? '');
      return (validCategorySet.has(c) ? c : 'CUSTOM') as FoodCategoryId;
    },
    [validCategorySet]
  );

  const loadUserFoods = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_FOODS_KEY);
      if (!raw) return setUserFoods([]);

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return setUserFoods([]);

      const fixed: Food[] = parsed
        .map((item: any) => {
          const name = String(item?.name ?? '').trim();
          if (!name) return null;

          const category = toSafeCategory(item?.category);
          const id = stableFoodId('user', item?.id, name, category);

          return { ...item, name, category, id } as Food;
        })
        .filter(Boolean) as Food[];

      setUserFoods(fixed);
    } catch {
      setUserFoods([]);
    }
  }, [toSafeCategory]);

  useEffect(() => {
    loadUserFoods();
  }, [loadUserFoods]);

  useFocusEffect(
    useCallback(() => {
      loadUserFoods();
    }, [loadUserFoods])
  );

  const hasUserFoods = userFoods.length > 0;

  const allFoods = useMemo<FoodWithSrc[]>(() => {
    const builtins: FoodWithSrc[] = (BUILTIN_FOODS as any[]).map((f: any) => {
      const name = String(f?.name ?? '').trim();
      const category = toSafeCategory(f?.category);
      const id = stableFoodId('builtin', f?.id, name, category);
      return { ...f, name, category, id, __src: 'builtin' } as FoodWithSrc;
    });

    const users: FoodWithSrc[] = userFoods.map((f: any) => {
      const name = String(f?.name ?? '').trim();
      const category = toSafeCategory(f?.category);
      const id = stableFoodId('user', f?.id, name, category);
      return { ...f, name, category, id, __src: 'user' } as FoodWithSrc;
    });

    return [...builtins, ...users].filter((x) => !!x.name);
  }, [userFoods, toSafeCategory]);

  const categoryLabelNorm = useMemo(() => {
    const map: Record<FoodCategoryId, string> = {
      MEAT: 'hus',
      FISH: 'hal',
      DAIRY: 'tejtermek',
      GRAIN: 'gabonafele',
      VEG: 'zoldseg',
      FRUIT: 'gyumolcs',
      NUTS: 'magvak',
      CUSTOM: 'sajat egyedi custom',
    };

    try {
      for (const c of FOOD_CATEGORIES as any[]) {
        if (c?.id && c?.label) map[c.id as FoodCategoryId] = norm(c.label);
      }
    } catch {}
    return map;
  }, []);

  // ✅ Kategóriák: FOOD_CATEGORIES-ből + CUSTOM
  const categoryRows = useMemo(() => {
    const fallbackLabel: Record<FoodCategoryId, string> = {
      MEAT: 'Hús',
      FISH: 'Hal',
      DAIRY: 'Tejtermék',
      GRAIN: 'Gabonafélék',
      VEG: 'Zöldség',
      FRUIT: 'Gyümölcs',
      NUTS: 'Magvak',
      CUSTOM: 'Saját ételek',
    };

    const base = (FOOD_CATEGORIES as any[]).map((c) => ({
      id: c.id as FoodCategoryId,
      label: (c as any).label ?? fallbackLabel[c.id as FoodCategoryId] ?? String(c.id),
    }));

    const hasCustom = base.some((x) => String(x.id) === 'CUSTOM');
    const withCustom = hasCustom ? base : [...base, { id: 'CUSTOM' as FoodCategoryId, label: fallbackLabel.CUSTOM }];

    return withCustom.slice(0, 8);
  }, []);

  const catPages = useMemo(() => {
    const pages = chunk(categoryRows, ROWS_PER_PAGE);
    return pages.length ? pages : [[]];
  }, [categoryRows]);

  useEffect(() => {
    setCatPage((p) => Math.max(0, Math.min(p, catPages.length - 1)));
  }, [catPages.length]);

  const canCatPage = catPages.length > 1;

  // ✅ refs (PanResponder always fresh)
  const canCatPageRef = useRef(false);
  const catPagesLenRef = useRef(1);
  useEffect(() => {
    canCatPageRef.current = canCatPage;
    catPagesLenRef.current = catPages.length;
  }, [canCatPage, catPages.length]);

  // ✅ swipe + lock (kategóriák)
  const catPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, g) =>
        canCatPageRef.current && Math.abs(g.dx) > SWIPE_ACTIVATE_PX && Math.abs(g.dy) < 20,
      onMoveShouldSetPanResponderCapture: (_evt, g) =>
        canCatPageRef.current && Math.abs(g.dx) > SWIPE_ACTIVATE_PX && Math.abs(g.dy) < 20,

      onPanResponderGrant: () => {
        lockPress();
      },

      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_e, g) => {
        if (!canCatPageRef.current) return;

        if (g.dx < -SWIPE_TRIGGER_PX) {
          setCatPage((p) => {
            const np = Math.min(p + 1, catPagesLenRef.current - 1);
            if (np !== p) bump(catPageAnim);
            return np;
          });
        } else if (g.dx > SWIPE_TRIGGER_PX) {
          setCatPage((p) => {
            const np = Math.max(p - 1, 0);
            if (np !== p) bump(catPageAnim);
            return np;
          });
        }

        unlockPressSoon();
      },
      onPanResponderTerminate: () => {
        unlockPressSoon();
      },
    })
  ).current;

  const flatResults = useMemo(() => {
    const qRaw = debouncedQuery.trim();
    if (qRaw.length < MIN_CHARS) return [] as FoodWithSrc[];

    const q = norm(qRaw);

    const matchedCategory = findMatchedCategory(q, categoryLabelNorm);
    if (matchedCategory) {
      const items = allFoods
        .filter((f) => toSafeCategory(f.category) === matchedCategory)
        .sort((a, b) => a.name.localeCompare(b.name, 'hu'));

      const seen = new Set<string>();
      const out: FoodWithSrc[] = [];
      for (const f of items) {
        const k = `${f.__src}:${String(f.id)}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(f);
      }
      return out;
    }

    const tokens = q.split(/\s+/).filter(Boolean);

    const scored = allFoods
      .map((f) => {
        const nameN = norm(f.name);
        const tokensOk = tokens.every((t) => nameN.includes(t));
        if (!tokensOk) return null;

        const primary = strictMatch(q, nameN);
        if (!primary.ok) return { f, score: 2 };
        return { f, score: primary.score };
      })
      .filter(Boolean) as { f: FoodWithSrc; score: number }[];

    scored.sort((a, b) => a.score - b.score || a.f.name.localeCompare(b.f.name, 'hu'));

    const picked = scored.slice(0, MAX_RESULTS).map((x) => x.f);

    const seen = new Set<string>();
    const deduped: FoodWithSrc[] = [];
    for (const f of picked) {
      const k = `${f.__src}:${String(f.id)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push(f);
    }

    return deduped;
  }, [debouncedQuery, allFoods, categoryLabelNorm, toSafeCategory]);

  const resPages = useMemo(() => {
    const pages = chunk(flatResults, ROWS_PER_PAGE);
    return pages.length ? pages : [[]];
  }, [flatResults]);

  useEffect(() => {
    setResPage(0);
    bump(resPageAnim);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  useEffect(() => {
    setResPage((p) => Math.max(0, Math.min(p, resPages.length - 1)));
  }, [resPages.length]);

  const canResPage = resPages.length > 1;

  // ✅ refs (PanResponder always fresh)
  const canResPageRef = useRef(false);
  const resPagesLenRef = useRef(1);
  useEffect(() => {
    canResPageRef.current = canResPage;
    resPagesLenRef.current = resPages.length;
  }, [canResPage, resPages.length]);

  // ✅ swipe (találatok)
  const resPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, g) =>
        canResPageRef.current && Math.abs(g.dx) > SWIPE_ACTIVATE_PX && Math.abs(g.dy) < 20,
      onMoveShouldSetPanResponderCapture: (_evt, g) =>
        canResPageRef.current && Math.abs(g.dx) > SWIPE_ACTIVATE_PX && Math.abs(g.dy) < 20,
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_e, g) => {
        if (!canResPageRef.current) return;

        if (g.dx < -SWIPE_TRIGGER_PX) {
          setResPage((p) => {
            const np = Math.min(p + 1, resPagesLenRef.current - 1);
            if (np !== p) bump(resPageAnim);
            return np;
          });
        } else if (g.dx > SWIPE_TRIGGER_PX) {
          setResPage((p) => {
            const np = Math.max(p - 1, 0);
            if (np !== p) bump(resPageAnim);
            return np;
          });
        }
      },
      onPanResponderTerminate: () => {},
    })
  ).current;

  const openFood = useCallback((foodId: string) => {
    router.push({ pathname: '/food-detail', params: { id: foodId } });
  }, []);

  const onPressFood = useCallback(
    (food: FoodWithSrc) => {
      const id = String(food?.id ?? '');
      if (!id) return;

      if (keyboardOpen) {
        pendingOpenRef.current = { id };
        Keyboard.dismiss();
        return;
      }
      openFood(id);
    },
    [keyboardOpen, openFood]
  );

  useEffect(() => {
    if (!keyboardOpen && pendingOpenRef.current) {
      const id = pendingOpenRef.current.id;
      pendingOpenRef.current = null;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => openFood(id));
      });
    }
  }, [keyboardOpen, openFood]);

  const showResults = debouncedQuery.trim().length >= MIN_CHARS;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* ✅ SAME BACKGROUND AS CALCULATOR (px exact) */}
      <View pointerEvents="none" style={styles.bgAmbient} />
      <View pointerEvents="none" style={styles.bgBlobA} />
      <View pointerEvents="none" style={styles.bgBlobB} />

      <Header
        title="Ételadatbázis"
        onSettings={() => router.push({ pathname: '/settings', params: { from: 'foodsearch' } })}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: GRID * 2 },
          { paddingBottom: ACTION_BAR_H + GRID * 2 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={{
            opacity: screenIn,
            transform: [{ translateY: screenIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          }}
        >
          <SectionTitle icon="search-outline" title="Keresés" hint="Írj be egy ételnevet / kategóriát." />
          <Surface delay={60}>
            <SearchField value={query} onChangeText={setQuery} placeholder="..." testID="input-food-search" />
          </Surface>

          <View style={{ marginTop: GRID * 2 }}>
            {showResults ? (
              <SectionTitle icon="list-outline" title="Találatok" hint="Válassz egy ételt a részletekhez." />
            ) : (
              <SectionTitle icon="albums-outline" title="Kategóriák" hint="Válassz egy ételt a részletekhez." />
            )}

            <Surface delay={120}>
              {showResults ? (
                flatResults.length === 0 ? (
                  <EmptyBlock title="Nincs találat erre a keresésre" />
                ) : (
                  <View {...resPanResponder.panHandlers}>
                    <Animated.View
                      style={{
                        opacity: resPageAnim,
                        transform: [
                          {
                            translateY: resPageAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }),
                          },
                        ],
                      }}
                    >
                      <View style={styles.rowsCol}>
                        {(resPages[resPage] ?? []).map((food) => (
                          <View key={`${food.__src}:${food.id}`}>
                            <ResultRow label={food.name} onPress={() => onPressFood(food)} />
                          </View>
                        ))}

                        {(() => {
                          const len = resPages[resPage]?.length ?? 0;
                          const missing = Math.max(0, ROWS_PER_PAGE - len);
                          const h = missing > 0 ? missing * ROW_SLOT - ROW_GAP : 0;
                          return h > 0 ? <View pointerEvents="none" style={{ height: h }} /> : null;
                        })()}
                      </View>

                      {canResPage ? (
                        <View style={styles.pagerDots}>
                          {resPages.map((_, i) => (
                            <View key={`res-dot-${i}`} style={[styles.pagerDot, i === resPage && styles.pagerDotActive]} />
                          ))}
                        </View>
                      ) : null}
                    </Animated.View>
                  </View>
                )
              ) : (
                <View {...catPanResponder.panHandlers}>
                  <Animated.View
                    style={{
                      opacity: catPageAnim,
                      transform: [
                        {
                          translateY: catPageAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }),
                        },
                      ],
                    }}
                  >
                    <View style={styles.rowsCol}>
                      {(catPages[catPage] ?? []).map((c) => {
                        const isCustom = String(c.id) === 'CUSTOM';
                        const disabled = isCustom && !hasUserFoods;

                        return (
                          <View key={String(c.id)}>
                            <CategoryTile
                              id={c.id}
                              label={c.label}
                              guardRef={swipeLockRef}
                              disabled={disabled}
                              onPress={() => {
                                setQuery(c.label);
                                setDebouncedQuery(c.label);
                                setResPage(0);
                                bump(resPageAnim);
                                Keyboard.dismiss();
                              }}
                            />
                          </View>
                        );
                      })}

                      {(() => {
                        const len = catPages[catPage]?.length ?? 0;
                        const missing = Math.max(0, ROWS_PER_PAGE - len);
                        const h = missing > 0 ? missing * ROW_SLOT - ROW_GAP : 0;
                        return h > 0 ? <View pointerEvents="none" style={{ height: h }} /> : null;
                      })()}
                    </View>

                    {canCatPage ? (
                      <View style={styles.pagerDots}>
                        {catPages.map((_, i) => (
                          <View key={`cat-dot-${i}`} style={[styles.pagerDot, i === catPage && styles.pagerDotActive]} />
                        ))}
                      </View>
                    ) : null}
                  </Animated.View>
                </View>
              )}
            </Surface>
          </View>
        </Animated.View>
      </ScrollView>

      <View style={styles.actionBar}>
        <View style={styles.actionBarInner}>
          <PrimaryButton title="Új étel hozzáadása" onPress={() => router.push('/food-add')} />
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

  // ✅ SAME BACKGROUND AS CALCULATOR
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
  clearBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(148,163,184,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },

  rowsCol: { gap: ROW_GAP },

  pagerDots: { marginTop: 12, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  pagerDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: 'rgba(148,163,184,0.35)' },
  pagerDotActive: { backgroundColor: 'rgba(37, 99, 235, 0.65)' },

  tileRow: {
    minHeight: ROW_H,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(230,232,240,0.95)',
    backgroundColor: 'rgba(148,163,184,0.05)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },

  tileText: { flex: 1, fontSize: 13.5, fontWeight: '900', color: THEME.text, letterSpacing: 0.1 },

  // ✅ mivel nincs bal ikon box, adunk pici bal paddinget
  tileTextNoLeftIcon: { paddingLeft: 2 },

  disabledRow: { opacity: 0.38 },
  tileTextDisabled: { color: 'rgba(11,18,32,0.45)' },

  emptyBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(230,232,240,0.95)',
    backgroundColor: 'rgba(148,163,184,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  emptyTitle: {
    width: '100%',
    fontSize: 14,
    fontWeight: '900',
    color: THEME.text,
    letterSpacing: 0.1,
  },

  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: THEME.surface,
    borderTopWidth: 1,
    borderTopColor: 'rgba(230,232,240,0.9)',
  },
  actionBarInner: { paddingHorizontal: H_MARGIN, paddingTop: ACTION_PAD_Y, paddingBottom: ACTION_PAD_Y },

  primaryBtn: {
    height: CTA_H,
    borderRadius: 18,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0,
    elevation: 0,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.2, textAlign: 'center' },
});
