// app/(tabs)/assistant.tsx
// ✅ Animok VISSZA: reanimated enter anim + micro enter anim
// ✅ UI/ikonok/komponensek/logika marad
// ✅ Composer px mozgás: ugyanaz (KeyboardAvoidingView iOS padding)
// ✅ Typing: Messenger-szerű 3 pöttyös buborék
// ✅ FIX: ha user bezárja a billentyűzetet gondolkodás közben, válasz után NEM ugrik vissza
//
// ✅ AUTH UPDATE (BIZTONSÁGOSABB):
// - EXPO_PUBLIC_API_KEY KISZEDVE a kliensből
// - Kliens JWT tokent kér: POST /auth/anonymous
// - Authorization: Bearer <JWT_TOKEN>
// - API base: EXPO_PUBLIC_API_BASE (publikus HTTPS backend URL)

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// ✅ REANIMATED (animok)
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/* =========================
   CONFIG
========================= */
const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ??
  (Constants.expoConfig as any)?.extra?.apiBase ??
  (Constants.manifest as any)?.extra?.apiBase ??
  'https://generated-now-hampton-cpu.trycloudflare.com';

const STORAGE_KEY = 'ai_assistant_chat_v1';
const TOKEN_STORAGE_KEY = 'ai_auth_token_v1';

const GRID = 8;
const H_MARGIN = 16;
const SMALL_GAP = 10;

// ✅ calculator action bar: 12 + 56 + 12 = 80
const ACTION_BAR_H = 80;

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

/* =========================
   TYPES
========================= */
type ChatRole = 'user' | 'assistant';

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  ts: number;
  kind?: 'message' | 'typing';
};

type Part = { type: 'text'; text: string };
type ChatMsg = { role: 'user' | 'assistant' | 'system'; content: Part[] };

/* =========================
   HELPERS
========================= */
const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const clean = (s: string) =>
  String(s ?? '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^>\s?/gm, '')
    .trim();

async function fetchJsonWithTimeout<T>(url: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });

    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${t}`.trim());
    }

    return (await res.json()) as T;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('timeout');
    throw e;
  } finally {
    clearTimeout(id);
  }
}

/* =========================
   UI PRIMITIVES
========================= */
const Surface: React.FC<React.PropsWithChildren<{ style?: any }>> = ({ children, style }) => (
  <View style={[styles.surface, style]}>{children}</View>
);

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

/* =========================
   HEADER (same layout) + anim
========================= */
function Header({ onSettings, onTrash }: { onSettings: () => void; onTrash: () => void }) {
  return (
    <Animated.View entering={FadeInDown.duration(220)} style={styles.headerWrap}>
      <View pointerEvents="none" style={styles.headerGlowA} />
      <View pointerEvents="none" style={styles.headerGlowB} />

      <View style={styles.headerTitleRow}>
        <Pressable
          onPress={onTrash}
          hitSlop={10}
          style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Törlés"
        >
          <Ionicons name="trash-outline" size={20} color={THEME.text} />
        </Pressable>

        <Text style={styles.headerTitleCentered} numberOfLines={1}>
          AI Asszisztens
        </Text>

        <Pressable
          onPress={onSettings}
          hitSlop={10}
          style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Beállítások"
        >
          <Ionicons name="settings-outline" size={20} color={THEME.text} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

/* =========================
   EMPTY TOP (same content) + anim
========================= */
function EmptyAssistantIntro() {
  return (
    <Animated.View entering={FadeInDown.duration(220)} style={styles.emptyTopWrap}>
      <SectionTitle icon="sparkles-outline" title="Asszisztens" hint="Kérdezz bármit, akár több üzenetben is." />

      <Surface>
        <View style={styles.emptyCardRow}>
          <View style={styles.emptyCardIcon}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={THEME.muted} />
          </View>
          <Text style={styles.emptyCardText}>Miben segíthetek?</Text>
        </View>
      </Surface>
    </Animated.View>
  );
}

/* =========================
   TYPING INDICATOR (Messenger dots) + anim
========================= */
function TypingDot({ delayMs }: { delayMs: number }) {
  const v = useSharedValue(0);

  useEffect(() => {
    v.value = withDelay(
      delayMs,
      withRepeat(withTiming(1, { duration: 520, easing: Easing.inOut(Easing.quad) }), -1, true)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rStyle = useAnimatedStyle(() => {
    const opacity = 0.35 + 0.65 * v.value;
    const translateY = -3 * v.value;
    return { opacity, transform: [{ translateY }] };
  });

  return <Animated.View style={[styles.typingDot, rStyle]} />;
}

const TypingIndicator = () => (
  <Animated.View entering={FadeInUp.duration(160)} exiting={FadeOutUp.duration(120)} style={{ alignItems: 'flex-start' }}>
    <View style={[styles.msgBubble, styles.msgAiBubble, styles.typingBubble]}>
      <View style={styles.typingDotsRow}>
        <TypingDot delayMs={0} />
        <TypingDot delayMs={140} />
        <TypingDot delayMs={280} />
      </View>
    </View>
  </Animated.View>
);

/* =========================
   SCREEN
========================= */
export default function AssistantScreen() {
  const insets = useSafeAreaInsets();

  const [input, setInput] = useState('');
  const inputRef = useRef<TextInput>(null);

  const [composerH, setComposerH] = useState(0);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<ChatMsg[]>([]);
  const historyRef = useRef<ChatMsg[]>([]);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const [loading, setLoading] = useState(false);

  // ✅ loading ref
  const loadingRef = useRef(false);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  // ✅ JWT token (kliensben NEM titok, szerver adja, rotálható)
  const [token, setToken] = useState<string>('');

  // ✅ ha a user bezárja a billentyűzetet válaszra várás közben, ne fókuszoljunk vissza
  const userDismissedKbRef = useRef(false);

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const nearBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const uiGap = useMemo(() => Math.max(GRID * 1.5, insets.bottom), [insets.bottom]);

  const keepKeyboardOpen = useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const canSend = input.trim().length > 0 && !loading;

  const dataForList = useMemo<ChatMessage[]>(() => {
    const base: ChatMessage[] = messages.length > 0 ? messages.map((m) => ({ ...m, kind: m.kind ?? 'message' })) : [];

    if (!loading) return base.slice().reverse();

    const typingMsg: ChatMessage = {
      id: '__typing__',
      role: 'assistant',
      text: '',
      ts: Date.now(),
      kind: 'typing',
    };

    return [...base, typingMsg].slice().reverse();
  }, [messages, loading]);

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated });
    });
  }, []);

  /* =========================
     keyboard height -> composer bottom fill
========================= */
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvt as any, (e: any) => {
      const h = e?.endCoordinates?.height ?? 0;
      setKbHeight(Math.max(0, h));
    });

    const hideSub = Keyboard.addListener(hideEvt as any, () => {
      setKbHeight(0);
      if (loadingRef.current) userDismissedKbRef.current = true;
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const bottomFillStyle = useMemo(
    () => ({
      height: kbHeight,
      marginBottom: -kbHeight,
    }),
    [kbHeight]
  );

  /* =========================
     LOAD + SAVE
========================= */
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw) as { messages?: ChatMessage[]; history?: ChatMsg[] };
        const loadedMessages = Array.isArray(parsed?.messages) ? parsed.messages : [];
        const loadedHistory = Array.isArray(parsed?.history) ? parsed.history : [];

        setMessages(loadedMessages);
        setHistory(loadedHistory);
        historyRef.current = loadedHistory;

        if (loadedMessages.length > 0) setTimeout(() => scrollToBottom(false), 0);
      } catch {
        setMessages([]);
        setHistory([]);
        historyRef.current = [];
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, history })).catch(() => {});
    }, 350);
    return () => clearTimeout(id);
  }, [messages, history]);

  /* =========================
     AUTH: get token from backend
========================= */
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
        if (saved) {
          setToken(saved);
          return;
        }

        const r = await fetchJsonWithTimeout<{ token: string }>(
          `${API_BASE}/auth/anonymous`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' } },
          12000
        );

        if (r?.token) {
          setToken(r.token);
          await AsyncStorage.setItem(TOKEN_STORAGE_KEY, r.token);
        } else {
          Alert.alert('Hiba', 'Nem kaptam tokent a szervertől.');
        }
      } catch {
        Alert.alert('Hiba', 'Nem sikerült autentikálni a szerveren.');
      }
    })();
  }, []);

  const refreshToken = useCallback(async () => {
    const r = await fetchJsonWithTimeout<{ token: string }>(
      `${API_BASE}/auth/anonymous`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      12000
    );

    if (r?.token) {
      setToken(r.token);
      await AsyncStorage.setItem(TOKEN_STORAGE_KEY, r.token);
      return r.token;
    }
    throw new Error('Nem kaptam tokent a szervertől.');
  }, []);

  /* =========================
     TRASH
========================= */
  const onTrash = useCallback(() => {
    if (messages.length === 0) return;
    Alert.alert('Törlés', 'Biztos törlöd a beszélgetést?', [
      { text: 'Mégse', style: 'cancel' },
      {
        text: 'Törlés',
        style: 'destructive',
        onPress: async () => {
          setMessages([]);
          setHistory([]);
          historyRef.current = [];
          setLoading(false);
          try {
            await AsyncStorage.removeItem(STORAGE_KEY);
          } catch {}
        },
      },
    ]);
  }, [messages.length]);

  /* =========================
     SEND
========================= */
  const reqGuardRef = useRef<string | null>(null);
  const sendingRef = useRef(false);

  const send = useCallback(async () => {
    if (sendingRef.current) return;

    const t = input.trim();
    if (!t || loading) return;

    // ✅ régi EXPO_PUBLIC_API_KEY guard kiszedve, token kell
    if (!token) {
      Alert.alert('Hiba', 'Nincs bejelentkezési token. Próbáld újra pár mp múlva.');
      return;
    }

    sendingRef.current = true;
    userDismissedKbRef.current = false;

    keepKeyboardOpen();
    setLoading(true);

    const reqId = makeId();
    reqGuardRef.current = reqId;

    const userMsg: ChatMessage = {
      id: makeId(),
      role: 'user',
      text: t,
      ts: Date.now(),
      kind: 'message',
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    const userHistoryMsg: ChatMsg = { role: 'user', content: [{ type: 'text', text: t }] };
    const nextHistory = [...historyRef.current, userHistoryMsg];
    setHistory(nextHistory);
    historyRef.current = nextHistory;

    if (nearBottomRef.current) setTimeout(() => scrollToBottom(true), 0);

    try {
      const body = JSON.stringify({ messages: nextHistory });

      const doChat = async (tkn: string) =>
        fetchJsonWithTimeout<{ reply?: string }>(
          `${API_BASE}/chat`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${tkn}`,
            },
            body,
          },
          25000
        );

      let data: { reply?: string } | null = null;

      try {
        data = await doChat(token);
      } catch (e: any) {
        const msg = String(e?.message || '');

        // ✅ ha 401 (lejárt/érvénytelen token), kérünk újat és 1x újrapróbáljuk
        if (msg.includes('HTTP 401')) {
          const newTok = await refreshToken();
          data = await doChat(newTok);
        } else {
          throw e;
        }
      }

      if (reqGuardRef.current !== reqId) return;

      const replyText = clean(data?.reply || 'Most nem tudtam válaszolni.');
      const aiMsg: ChatMessage = {
        id: makeId(),
        role: 'assistant',
        text: replyText,
        ts: Date.now() + 1,
        kind: 'message',
      };
      setMessages((prev) => [...prev, aiMsg]);

      const asstHistoryMsg: ChatMsg = { role: 'assistant', content: [{ type: 'text', text: replyText }] };
      const finalHistory = [...historyRef.current, asstHistoryMsg];
      setHistory(finalHistory);
      historyRef.current = finalHistory;

      if (nearBottomRef.current) setTimeout(() => scrollToBottom(true), 0);
    } catch (e: any) {
      Alert.alert('Hiba', e?.message === 'timeout' ? 'A szerver túl lassú.' : 'Nem sikerült elérni a szervert.', [
        { text: 'OK' },
      ]);
    } finally {
      if (reqGuardRef.current === reqId) setLoading(false);
      sendingRef.current = false;

      if (!userDismissedKbRef.current) {
        keepKeyboardOpen();
      }
    }
  }, [input, loading, token, keepKeyboardOpen, scrollToBottom, refreshToken]);

  /* =========================
     SCROLL STATE
========================= */
  const onListScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset } = e.nativeEvent;
      const pad = Platform.OS === 'ios' ? 60 : 90;
      const isNear = contentOffset.y <= pad;
      nearBottomRef.current = isNear;
      setShowJump(!isNear && messages.length > 3);
    },
    [messages.length]
  );

  const renderMsg = useCallback(({ item }: { item: ChatMessage }) => {
    if (item.kind === 'typing') {
      return (
        <View style={[styles.msgRow, styles.msgRowLeft, { marginTop: 0 }]}>
          <TypingIndicator />
        </View>
      );
    }

    const isUser = item.role === 'user';
    const entering = FadeInUp.duration(160);
    const exiting = FadeOut.duration(120);

    return (
      <Animated.View
        entering={entering}
        exiting={exiting}
        style={[styles.msgRow, isUser ? styles.msgRowRight : styles.msgRowLeft, { marginTop: 0 }]}
      >
        <Pressable
          onLongPress={() => {
            if (!item.text) return;
            Clipboard.setStringAsync(item.text);
            Alert.alert('Másolva', 'Az üzenet a vágólapra került.');
          }}
          delayLongPress={220}
          style={({ pressed }) => [
            styles.msgBubble,
            isUser ? styles.msgUserBubble : styles.msgAiBubble,
            pressed && { opacity: 0.92 },
          ]}
        >
          <Text style={[styles.msgText, isUser ? styles.msgUserText : styles.msgAiText]}>{item.text}</Text>
        </Pressable>
      </Animated.View>
    );
  }, []);

  const showEmptyTop = messages.length === 0 && !loading;
  const Separator = useCallback(() => <View style={{ height: SMALL_GAP }} />, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View pointerEvents="none" style={styles.bgAmbient} />
      <View pointerEvents="none" style={styles.bgBlobA} />
      <View pointerEvents="none" style={styles.bgBlobB} />

      <Header onTrash={onTrash} onSettings={() => router.push({ pathname: '/settings', params: { from: 'assistant' } })} />

      {showEmptyTop && <EmptyAssistantIntro />}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1 }}>
          <FlatList<ChatMessage>
            ref={listRef}
            data={dataForList}
            inverted
            keyExtractor={(m) => m.id}
            renderItem={renderMsg}
            ItemSeparatorComponent={Separator}
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: H_MARGIN,
              paddingTop: SMALL_GAP,
              paddingBottom: GRID * 3,
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            onScroll={onListScroll}
            scrollEventThrottle={16}
            removeClippedSubviews={false}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={7}
          />

          {showJump && (
            <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(120)} style={{ position: 'absolute' }}>
              <Pressable
                onPress={() => scrollToBottom(true)}
                style={({ pressed }) => [
                  styles.jumpBtn,
                  { bottom: Math.min(composerH + uiGap + 12, 180) },
                  pressed && { opacity: 0.85 },
                ]}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Ugrás a legfrissebb üzenetre"
              >
                <Ionicons name="arrow-down" size={18} color={THEME.text} />
              </Pressable>
            </Animated.View>
          )}

          <View
            style={styles.actionBarWrap}
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (h !== composerH) setComposerH(h);
            }}
          >
            <Animated.View entering={FadeInUp.duration(180)} style={styles.bottomBarFull}>
              <View style={styles.bottomBarInner}>
                <View style={styles.field}>
                  <View style={styles.fieldIcon}>
                    <Ionicons name="chatbubble-ellipses-outline" size={18} color={THEME.muted} />
                  </View>

                  <TextInput
                    ref={inputRef}
                    value={input}
                    onChangeText={setInput}
                    placeholder="..."
                    placeholderTextColor={THEME.subtle}
                    style={styles.input}
                    returnKeyType="send"
                    onSubmitEditing={() => {
                      keepKeyboardOpen();
                      send();
                    }}
                    blurOnSubmit={false}
                    multiline
                    scrollEnabled={false}
                    editable
                    textAlignVertical="top"
                  />

                  <Pressable
                    onPress={
                      canSend
                        ? () => {
                            keepKeyboardOpen();
                            send();
                          }
                        : undefined
                    }
                    disabled={!canSend}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Küldés"
                    style={({ pressed }) => [
                      styles.sendIconBtnBlue,
                      !canSend && styles.sendIconBtnBlueDisabled,
                      pressed && canSend && { opacity: 0.9 },
                    ]}
                  >
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </Pressable>
                </View>
              </View>

              <View style={[styles.composerBottomFill, bottomFillStyle]} pointerEvents="none" />
            </Animated.View>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  },
  headerTitleCentered: {
    flex: 1,
    color: THEME.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.2,
    textAlign: 'center',
  },

  emptyTopWrap: { paddingHorizontal: H_MARGIN, paddingTop: GRID * 2, paddingBottom: GRID * 1.5 },
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

  emptyCardRow: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(230,232,240,0.95)',
    backgroundColor: 'rgba(148,163,184,0.05)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyCardIcon: {
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
  emptyCardText: { color: THEME.text, fontSize: 14, fontWeight: '800' },

  msgRow: { flexDirection: 'row' },
  msgRowLeft: { justifyContent: 'flex-start' },
  msgRowRight: { justifyContent: 'flex-end' },

  msgBubble: { maxWidth: '86%', borderRadius: 18, paddingVertical: 9, paddingHorizontal: 12, borderWidth: 1 },
  msgAiBubble: { backgroundColor: THEME.surface, borderColor: 'rgba(230,232,240,0.9)' },
  msgUserBubble: { backgroundColor: THEME.primary, borderColor: 'rgba(255,255,255,0.18)' },
  msgText: { fontSize: 15, lineHeight: 21 },
  msgAiText: { color: THEME.text },
  msgUserText: { color: '#fff' },

  typingBubble: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 56,
  },
  typingDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: THEME.muted,
  },

  actionBarWrap: { paddingHorizontal: 0, paddingTop: 0, backgroundColor: 'transparent' },

  bottomBarFull: {
    backgroundColor: THEME.surface,
    borderTopWidth: 1,
    borderTopColor: 'rgba(230,232,240,0.9)',
  },

  bottomBarInner: {
    paddingHorizontal: H_MARGIN,
    paddingTop: GRID * 1.5,
    paddingBottom: GRID * 1.5,
    minHeight: ACTION_BAR_H,
    justifyContent: 'center',
  },

  composerBottomFill: {
    width: '100%',
    backgroundColor: THEME.surface,
  },

  field: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(230,232,240,0.95)',
    backgroundColor: 'rgba(148,163,184,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },

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
    alignSelf: 'flex-end',
  },

  input: {
    flex: 1,
    fontSize: 16,
    color: THEME.text,
    lineHeight: 20,
    minHeight: 20,
    maxHeight: 180,
    paddingTop: 6,
    paddingBottom: 6,
    paddingRight: 8,
  },

  sendIconBtnBlue: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: THEME.primary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    alignSelf: 'flex-end',
  },
  sendIconBtnBlueDisabled: {
    backgroundColor: 'rgba(37, 99, 235, 0.45)',
    borderColor: 'rgba(255,255,255,0.12)',
    opacity: 0.85,
  },

  jumpBtn: {
    position: 'absolute',
    right: H_MARGIN,
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(230,232,240,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: THEME.shadowStrong,
    shadowOpacity: Platform.OS === 'ios' ? 1 : 0,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: Platform.OS === 'android' ? 3 : 0,
  },
});
