// app/(tabs)/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

/* =========================
   ANIMATED TAB ICON
========================= */

const ICON_Y_OFFSET = 13;

function AnimatedTabIcon({
  name,
  color,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
}) {
  const p = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    p.value = withSpring(focused ? 1 : 0, {
      damping: 22,
      stiffness: 220,
      mass: 0.9,
    });
  }, [focused, p]);

  const aStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: ICON_Y_OFFSET },
      { scale: interpolate(p.value, [0, 1], [0.96, 1.05]) },
    ],
    opacity: interpolate(p.value, [0, 1], [0.7, 1]),
  }));

  return (
    <Animated.View style={aStyle}>
      <Ionicons name={name} size={23} color={color} />
    </Animated.View>
  );
}

// 🔹 CSAK href: null (nincs tabBarButton!)
const hiddenTabOptions = { href: null as any };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,

        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#6B7280',

        // ✅ FINOM KÖZÉPRE ZÁRÁS
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: 'rgba(230,232,240,0.9)',
          borderTopWidth: 1,

          // ⬅️ ettől lesznek közelebb, de középen
          paddingHorizontal: 24,
        },
      }}
    >
      {/* ✅ AZ 5 TAB */}
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              name={focused ? 'home' : 'home-outline'}
              color={color}
              focused={focused}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="timeline"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              name={focused ? 'time' : 'time-outline'}
              color={color}
              focused={focused}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="calculator"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              name={focused ? 'calculator' : 'calculator-outline'}
              color={color}
              focused={focused}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="foodsearch"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              name={focused ? 'restaurant' : 'restaurant-outline'}
              color={color}
              focused={focused}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="assistent"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
              color={color}
              focused={focused}
            />
          ),
        }}
      />

      {/* 🔹 REJTETT */}
      <Tabs.Screen name="registration" options={hiddenTabOptions} />
      <Tabs.Screen name="analysis" options={hiddenTabOptions} />
      <Tabs.Screen name="analysis-monthly" options={hiddenTabOptions} />
      <Tabs.Screen name="food-add" options={hiddenTabOptions} />
      <Tabs.Screen name="food-detail" options={hiddenTabOptions} />

      <Tabs.Screen name="settings" options={hiddenTabOptions} />
      <Tabs.Screen name="settings-account" options={hiddenTabOptions} />
      <Tabs.Screen name="settings-icr" options={hiddenTabOptions} />
      <Tabs.Screen name="settings-isf" options={hiddenTabOptions} />
      <Tabs.Screen name="settings-privacy" options={hiddenTabOptions} />
      <Tabs.Screen name="settings-reminders" options={hiddenTabOptions} />
      <Tabs.Screen name="settings-subscription" options={hiddenTabOptions} />
      <Tabs.Screen name="settings-targetvc" options={hiddenTabOptions} />
      <Tabs.Screen name="settings-terms" options={hiddenTabOptions} />

      <Tabs.Screen name="modal" options={hiddenTabOptions} />
    </Tabs>
  );
}
