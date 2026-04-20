'use client';

import { useTheme } from '@/app/theme-provider';

const themes = [
  { value: 'light' as const, label: 'Claro', preview: 'bg-white text-gray-900 border-gray-200' },
  {
    value: 'dark' as const,
    label: 'Escuro',
    preview: 'bg-[#0b0e14] text-[#e6e8ef] border-[#262b3c]',
  },
];

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <p className="text-mute text-sm mb-4">
        Escolha a aparência da plataforma. A opção &quot;Claro&quot; é o padrão.
      </p>
      <div className="flex gap-3">
        {themes.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTheme(t.value)}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition cursor-pointer ${
              theme === t.value
                ? 'border-accent ring-2 ring-accent/20'
                : 'border-border hover:border-mute'
            }`}
          >
            <div className={`w-20 h-14 rounded-lg border ${t.preview}`} />
            <span className="text-sm font-medium">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
