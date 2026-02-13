// app/ui/anim.ts
import { InteractionManager } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import {
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

/* =========================
   GLOBAL ANIM PRESETS
========================= */
export const ENTER_D = 170;
export const ENTER_START = 120;
export const ENTER_STEPS = {
  header: 0,
  content: 55,
  bar: 105,
};

export const SPRING_IN = { damping: 18, stiffness: 260, mass: 0.7 };
export const SPRING_OUT = { damping: 18, stiffness: 260, mass: 0.7 };

/* =========================
   MICRO PRESS (buttons/cards)
========================= */
export function usePressMicro(scaleTo = 0.985, opacityTo = 0.92) {
  const p = useSharedValue(0);

  const aStyle = useAnimatedStyle(() => {
    const s = interpolate(p.value, [0, 1], [1, scaleTo]);
    const o = interpolate(p.value, [0, 1], [1, opacityTo]);
    return { transform: [{ scale: s }], opacity: o };
  });

  const onPressIn = () => {
    p.value = withSpring(1, SPRING_IN);
  };

  const onPressOut = () => {
    p.value = withSpring(0, SPRING_OUT);
  };

  return { aStyle, onPressIn, onPressOut };
}

/* =========================
   ENTER STYLE (fade + slide)
========================= */
export function useEnterStyle(sv: SharedValue<number>, yFrom = 6) {
  return useAnimatedStyle(() => ({
    opacity: sv.value,
    transform: [{ translateY: interpolate(sv.value, [0, 1], [yFrom, 0]) }],
  }));
}

/* =========================
   NO-FLASH ENTER (USE EVERYWHERE)
========================= */
export function useNoFlashEnter(opts?: {
  withBar?: boolean;
  yHeader?: number;
  yContent?: number;
  yBar?: number;
  duration?: number;
  startDelay?: number;
}) {
  const {
    withBar = false,
    yHeader = 6,
    yContent = 10,
    yBar = 6,
    duration = ENTER_D,
    startDelay = ENTER_START,
  } = opts ?? {};

  const ready = useSharedValue(0);
  const aHeader = useSharedValue(0);
  const aContent = useSharedValue(0);
  const aBar = useSharedValue(0);

  const sHeader = useEnterStyle(aHeader, yHeader);
  const sContent = useEnterStyle(aContent, yContent);
  const sBar = useEnterStyle(aBar, yBar);

  const run = () => {
    ready.value = 0;
    aHeader.value = 0;
    aContent.value = 0;
    aBar.value = 0;

    let cancelled = false;

    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;

      ready.value = 1;

      aHeader.value = withDelay(startDelay + ENTER_STEPS.header, withTiming(1, { duration }));
      aContent.value = withDelay(startDelay + ENTER_STEPS.content, withTiming(1, { duration }));
      if (withBar) {
        aBar.value = withDelay(startDelay + ENTER_STEPS.bar, withTiming(1, { duration }));
      }
    });

    return () => {
      cancelled = true;
      // @ts-ignore
      task?.cancel?.();
    };
  };

  return { ready, sHeader, sContent, sBar, run };
}
