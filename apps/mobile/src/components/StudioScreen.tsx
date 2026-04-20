import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

type StudioScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  className?: string;
  edges?: Edge[];
};

type StudioPanelProps = {
  children: ReactNode;
  className?: string;
};

type StudioPillProps = {
  label: string;
  tone?: 'neutral' | 'accent' | 'success';
};

export function StudioScreen({
  children,
  scroll = false,
  className = '',
  edges = ['top', 'left', 'right', 'bottom'],
}: StudioScreenProps) {
  return (
    <View className="flex-1 bg-bg">
      <View className="absolute -right-12 -top-24 h-72 w-72 rounded-full bg-accent/15" />
      <View className="absolute left-[-96px] top-[32%] h-64 w-64 rounded-full bg-[#68d7ca]/10" />
      <View className="absolute bottom-[-120px] right-[10%] h-72 w-72 rounded-full bg-white/5" />

      <SafeAreaView edges={edges} className="flex-1">
        {scroll ? (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            <View className={`flex-1 px-5 ${className}`}>{children}</View>
          </ScrollView>
        ) : (
          <View className={`flex-1 px-5 ${className}`}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

export function StudioPanel({ children, className = '' }: StudioPanelProps) {
  return (
    <View className={`rounded-[30px] border border-border bg-surface px-5 py-5 ${className}`}>
      {children}
    </View>
  );
}

export function StudioPill({ label, tone = 'neutral' }: StudioPillProps) {
  const toneClass =
    tone === 'accent'
      ? 'border-accent/40 bg-accent/10 text-accentSoft'
      : tone === 'success'
        ? 'border-ok/40 bg-ok/10 text-ok'
        : 'border-border bg-surfaceAlt text-mute';

  return (
    <View className={`self-start rounded-full border px-3 py-1.5 ${toneClass}`}>
      <Text className="text-[11px] font-semibold uppercase tracking-[0.24em]">{label}</Text>
    </View>
  );
}
