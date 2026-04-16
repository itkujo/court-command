export interface ThemePreset {
  id: string
  name: string
  group: string
  light: Record<string, string>
  dark: Record<string, string>
}

export const themePresets: ThemePreset[] = [
  // --- Default ---
  {
    id: 'default',
    name: 'Court Command',
    group: 'Default',
    light: {
      '--color-bg-primary': '#ffffff',
      '--color-bg-secondary': '#f8fafc',
      '--color-bg-sidebar': '#f1f5f9',
      '--color-text-primary': '#0f172a',
      '--color-text-secondary': '#64748b',
      '--color-text-accent': '#22d3ee',
      '--color-border': '#e2e8f0',
      '--color-success': '#22c55e',
      '--color-warning': '#f59e0b',
      '--color-error': '#ef4444',
      '--color-bg-input': '#ffffff',
      '--color-bg-hover': '#f1f5f9',
    },
    dark: {
      '--color-bg-primary': '#0f172a',
      '--color-bg-secondary': '#1e293b',
      '--color-bg-sidebar': '#1e293b',
      '--color-text-primary': '#f8fafc',
      '--color-text-secondary': '#94a3b8',
      '--color-text-accent': '#22d3ee',
      '--color-border': '#334155',
      '--color-success': '#22c55e',
      '--color-warning': '#f59e0b',
      '--color-error': '#ef4444',
      '--color-bg-input': '#1e293b',
      '--color-bg-hover': '#334155',
    },
  },

  // --- Catppuccin ---
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    group: 'Catppuccin',
    light: {
      '--color-bg-primary': '#eff1f5',
      '--color-bg-secondary': '#e6e9ef',
      '--color-bg-sidebar': '#dce0e8',
      '--color-text-primary': '#4c4f69',
      '--color-text-secondary': '#6c6f85',
      '--color-text-accent': '#1e66f5',
      '--color-border': '#ccd0da',
      '--color-success': '#40a02b',
      '--color-warning': '#df8e1d',
      '--color-error': '#d20f39',
      '--color-bg-input': '#eff1f5',
      '--color-bg-hover': '#e6e9ef',
    },
    dark: {
      '--color-bg-primary': '#eff1f5',
      '--color-bg-secondary': '#e6e9ef',
      '--color-bg-sidebar': '#dce0e8',
      '--color-text-primary': '#4c4f69',
      '--color-text-secondary': '#6c6f85',
      '--color-text-accent': '#1e66f5',
      '--color-border': '#ccd0da',
      '--color-success': '#40a02b',
      '--color-warning': '#df8e1d',
      '--color-error': '#d20f39',
      '--color-bg-input': '#eff1f5',
      '--color-bg-hover': '#e6e9ef',
    },
  },
  {
    id: 'catppuccin-frappe',
    name: 'Catppuccin Frappe',
    group: 'Catppuccin',
    light: {
      '--color-bg-primary': '#f2f0eb',
      '--color-bg-secondary': '#e8e5df',
      '--color-bg-sidebar': '#dedad3',
      '--color-text-primary': '#51576d',
      '--color-text-secondary': '#737994',
      '--color-text-accent': '#8caaee',
      '--color-border': '#d0ccbf',
      '--color-success': '#a6d189',
      '--color-warning': '#e5c890',
      '--color-error': '#e78284',
      '--color-bg-input': '#f2f0eb',
      '--color-bg-hover': '#e8e5df',
    },
    dark: {
      '--color-bg-primary': '#303446',
      '--color-bg-secondary': '#292c3c',
      '--color-bg-sidebar': '#232634',
      '--color-text-primary': '#c6d0f5',
      '--color-text-secondary': '#a5adce',
      '--color-text-accent': '#8caaee',
      '--color-border': '#414559',
      '--color-success': '#a6d189',
      '--color-warning': '#e5c890',
      '--color-error': '#e78284',
      '--color-bg-input': '#292c3c',
      '--color-bg-hover': '#414559',
    },
  },
  {
    id: 'catppuccin-macchiato',
    name: 'Catppuccin Macchiato',
    group: 'Catppuccin',
    light: {
      '--color-bg-primary': '#f0edea',
      '--color-bg-secondary': '#e6e2de',
      '--color-bg-sidebar': '#dcd7d2',
      '--color-text-primary': '#494d64',
      '--color-text-secondary': '#6e738d',
      '--color-text-accent': '#8aadf4',
      '--color-border': '#cec9c3',
      '--color-success': '#a6da95',
      '--color-warning': '#eed49f',
      '--color-error': '#ed8796',
      '--color-bg-input': '#f0edea',
      '--color-bg-hover': '#e6e2de',
    },
    dark: {
      '--color-bg-primary': '#24273a',
      '--color-bg-secondary': '#1e2030',
      '--color-bg-sidebar': '#181926',
      '--color-text-primary': '#cad3f5',
      '--color-text-secondary': '#a5adcb',
      '--color-text-accent': '#8aadf4',
      '--color-border': '#363a4f',
      '--color-success': '#a6da95',
      '--color-warning': '#eed49f',
      '--color-error': '#ed8796',
      '--color-bg-input': '#1e2030',
      '--color-bg-hover': '#363a4f',
    },
  },
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    group: 'Catppuccin',
    light: {
      '--color-bg-primary': '#efece8',
      '--color-bg-secondary': '#e5e1dc',
      '--color-bg-sidebar': '#dbd6d0',
      '--color-text-primary': '#45475a',
      '--color-text-secondary': '#6c7086',
      '--color-text-accent': '#89b4fa',
      '--color-border': '#cdc7c0',
      '--color-success': '#a6e3a1',
      '--color-warning': '#f9e2af',
      '--color-error': '#f38ba8',
      '--color-bg-input': '#efece8',
      '--color-bg-hover': '#e5e1dc',
    },
    dark: {
      '--color-bg-primary': '#1e1e2e',
      '--color-bg-secondary': '#181825',
      '--color-bg-sidebar': '#11111b',
      '--color-text-primary': '#cdd6f4',
      '--color-text-secondary': '#a6adc8',
      '--color-text-accent': '#89b4fa',
      '--color-border': '#313244',
      '--color-success': '#a6e3a1',
      '--color-warning': '#f9e2af',
      '--color-error': '#f38ba8',
      '--color-bg-input': '#181825',
      '--color-bg-hover': '#313244',
    },
  },

  // --- Dracula ---
  {
    id: 'dracula',
    name: 'Dracula',
    group: 'Community',
    light: {
      '--color-bg-primary': '#f8f8f2',
      '--color-bg-secondary': '#eeeee8',
      '--color-bg-sidebar': '#e4e4de',
      '--color-text-primary': '#282a36',
      '--color-text-secondary': '#44475a',
      '--color-text-accent': '#bd93f9',
      '--color-border': '#d6d6d0',
      '--color-success': '#50fa7b',
      '--color-warning': '#f1fa8c',
      '--color-error': '#ff5555',
      '--color-bg-input': '#f8f8f2',
      '--color-bg-hover': '#eeeee8',
    },
    dark: {
      '--color-bg-primary': '#282a36',
      '--color-bg-secondary': '#21222c',
      '--color-bg-sidebar': '#191a21',
      '--color-text-primary': '#f8f8f2',
      '--color-text-secondary': '#6272a4',
      '--color-text-accent': '#bd93f9',
      '--color-border': '#44475a',
      '--color-success': '#50fa7b',
      '--color-warning': '#f1fa8c',
      '--color-error': '#ff5555',
      '--color-bg-input': '#21222c',
      '--color-bg-hover': '#44475a',
    },
  },

  // --- Nord ---
  {
    id: 'nord',
    name: 'Nord',
    group: 'Community',
    light: {
      '--color-bg-primary': '#eceff4',
      '--color-bg-secondary': '#e5e9f0',
      '--color-bg-sidebar': '#d8dee9',
      '--color-text-primary': '#2e3440',
      '--color-text-secondary': '#4c566a',
      '--color-text-accent': '#5e81ac',
      '--color-border': '#d8dee9',
      '--color-success': '#a3be8c',
      '--color-warning': '#ebcb8b',
      '--color-error': '#bf616a',
      '--color-bg-input': '#eceff4',
      '--color-bg-hover': '#e5e9f0',
    },
    dark: {
      '--color-bg-primary': '#2e3440',
      '--color-bg-secondary': '#3b4252',
      '--color-bg-sidebar': '#2e3440',
      '--color-text-primary': '#eceff4',
      '--color-text-secondary': '#d8dee9',
      '--color-text-accent': '#88c0d0',
      '--color-border': '#434c5e',
      '--color-success': '#a3be8c',
      '--color-warning': '#ebcb8b',
      '--color-error': '#bf616a',
      '--color-bg-input': '#3b4252',
      '--color-bg-hover': '#434c5e',
    },
  },

  // --- Gruvbox ---
  {
    id: 'gruvbox',
    name: 'Gruvbox',
    group: 'Community',
    light: {
      '--color-bg-primary': '#fbf1c7',
      '--color-bg-secondary': '#f2e5bc',
      '--color-bg-sidebar': '#ebdbb2',
      '--color-text-primary': '#3c3836',
      '--color-text-secondary': '#665c54',
      '--color-text-accent': '#458588',
      '--color-border': '#d5c4a1',
      '--color-success': '#98971a',
      '--color-warning': '#d79921',
      '--color-error': '#cc241d',
      '--color-bg-input': '#fbf1c7',
      '--color-bg-hover': '#f2e5bc',
    },
    dark: {
      '--color-bg-primary': '#282828',
      '--color-bg-secondary': '#3c3836',
      '--color-bg-sidebar': '#1d2021',
      '--color-text-primary': '#ebdbb2',
      '--color-text-secondary': '#a89984',
      '--color-text-accent': '#83a598',
      '--color-border': '#504945',
      '--color-success': '#b8bb26',
      '--color-warning': '#fabd2f',
      '--color-error': '#fb4934',
      '--color-bg-input': '#3c3836',
      '--color-bg-hover': '#504945',
    },
  },

  // --- Tokyo Night ---
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    group: 'Community',
    light: {
      '--color-bg-primary': '#d5d6db',
      '--color-bg-secondary': '#cbccd1',
      '--color-bg-sidebar': '#c1c2c7',
      '--color-text-primary': '#343b58',
      '--color-text-secondary': '#565a6e',
      '--color-text-accent': '#34548a',
      '--color-border': '#b7b8bd',
      '--color-success': '#587539',
      '--color-warning': '#8f5e15',
      '--color-error': '#8c4351',
      '--color-bg-input': '#d5d6db',
      '--color-bg-hover': '#cbccd1',
    },
    dark: {
      '--color-bg-primary': '#1a1b26',
      '--color-bg-secondary': '#16161e',
      '--color-bg-sidebar': '#13131a',
      '--color-text-primary': '#c0caf5',
      '--color-text-secondary': '#a9b1d6',
      '--color-text-accent': '#7aa2f7',
      '--color-border': '#292e42',
      '--color-success': '#9ece6a',
      '--color-warning': '#e0af68',
      '--color-error': '#f7768e',
      '--color-bg-input': '#16161e',
      '--color-bg-hover': '#292e42',
    },
  },

  // --- One Dark ---
  {
    id: 'one-dark',
    name: 'One Dark',
    group: 'Community',
    light: {
      '--color-bg-primary': '#fafafa',
      '--color-bg-secondary': '#f0f0f0',
      '--color-bg-sidebar': '#e5e5e6',
      '--color-text-primary': '#383a42',
      '--color-text-secondary': '#696c77',
      '--color-text-accent': '#4078f2',
      '--color-border': '#d3d3d4',
      '--color-success': '#50a14f',
      '--color-warning': '#c18401',
      '--color-error': '#e45649',
      '--color-bg-input': '#fafafa',
      '--color-bg-hover': '#f0f0f0',
    },
    dark: {
      '--color-bg-primary': '#282c34',
      '--color-bg-secondary': '#21252b',
      '--color-bg-sidebar': '#1b1f27',
      '--color-text-primary': '#abb2bf',
      '--color-text-secondary': '#5c6370',
      '--color-text-accent': '#61afef',
      '--color-border': '#3e4452',
      '--color-success': '#98c379',
      '--color-warning': '#e5c07b',
      '--color-error': '#e06c75',
      '--color-bg-input': '#21252b',
      '--color-bg-hover': '#3e4452',
    },
  },

  // --- Solarized ---
  {
    id: 'solarized',
    name: 'Solarized',
    group: 'Community',
    light: {
      '--color-bg-primary': '#fdf6e3',
      '--color-bg-secondary': '#eee8d5',
      '--color-bg-sidebar': '#eee8d5',
      '--color-text-primary': '#657b83',
      '--color-text-secondary': '#93a1a1',
      '--color-text-accent': '#268bd2',
      '--color-border': '#eee8d5',
      '--color-success': '#859900',
      '--color-warning': '#b58900',
      '--color-error': '#dc322f',
      '--color-bg-input': '#fdf6e3',
      '--color-bg-hover': '#eee8d5',
    },
    dark: {
      '--color-bg-primary': '#002b36',
      '--color-bg-secondary': '#073642',
      '--color-bg-sidebar': '#002028',
      '--color-text-primary': '#839496',
      '--color-text-secondary': '#586e75',
      '--color-text-accent': '#268bd2',
      '--color-border': '#073642',
      '--color-success': '#859900',
      '--color-warning': '#b58900',
      '--color-error': '#dc322f',
      '--color-bg-input': '#073642',
      '--color-bg-hover': '#073642',
    },
  },
]

export function getPresetById(id: string): ThemePreset | undefined {
  return themePresets.find((t) => t.id === id)
}

export function getPresetGroups(): { group: string; presets: ThemePreset[] }[] {
  const groups = new Map<string, ThemePreset[]>()
  for (const preset of themePresets) {
    const list = groups.get(preset.group) ?? []
    list.push(preset)
    groups.set(preset.group, list)
  }
  return Array.from(groups.entries()).map(([group, presets]) => ({ group, presets }))
}

export function applyPresetColors(preset: ThemePreset, resolvedMode: 'light' | 'dark'): void {
  const colors = resolvedMode === 'dark' ? preset.dark : preset.light
  const root = document.documentElement
  for (const [key, value] of Object.entries(colors)) {
    root.style.setProperty(key, value)
  }
}

export function clearPresetColors(): void {
  const root = document.documentElement
  const props = [
    '--color-bg-primary', '--color-bg-secondary', '--color-bg-sidebar',
    '--color-text-primary', '--color-text-secondary', '--color-text-accent',
    '--color-border', '--color-success', '--color-warning', '--color-error',
    '--color-bg-input', '--color-bg-hover',
  ]
  for (const prop of props) {
    root.style.removeProperty(prop)
  }
}
