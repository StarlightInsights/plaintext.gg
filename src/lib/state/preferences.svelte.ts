import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE, DEFAULT_FONT_WEIGHT, FONT_FAMILY_WEIGHTS, STORAGE_KEYS, THEME_COLORS } from '../constants';
import { clampFontSize, clampFontWeight, normalizeFontFamily, parseStoredFontItalic, parseStoredFontSize, parseStoredFontWeight } from '../utils/fonts';
import { loadStored, saveStored } from '../utils/local-storage';
import { normalizeTheme, normalizeToolbarVisibility } from '../utils/theme';
import type { FontFamily, Theme } from '../types';

class PreferencesState {
  theme: Theme = $state('light');
  fontSize: number = $state(DEFAULT_FONT_SIZE);
  fontFamily: FontFamily = $state(DEFAULT_FONT_FAMILY);
  fontWeight: number = $state(DEFAULT_FONT_WEIGHT);
  fontItalic: boolean = $state(false);
  toolbarVisible: boolean = $state(false);

  /** Color driving the `<meta name="theme-color">` + root backgroundColor for a flash-free theme swap. */
  themeColor: string = $derived(THEME_COLORS[this.theme]);

  hydrate(): void {
    this.theme = normalizeTheme(loadStored(STORAGE_KEYS.theme));
    const storedSize = parseStoredFontSize(loadStored(STORAGE_KEYS.fontSize));
    if (Number.isFinite(storedSize)) this.fontSize = clampFontSize(storedSize);
    this.fontFamily = normalizeFontFamily(loadStored(STORAGE_KEYS.fontFamily));
    this.fontWeight = parseStoredFontWeight(loadStored(STORAGE_KEYS.fontWeight));
    this.fontItalic = parseStoredFontItalic(loadStored(STORAGE_KEYS.fontItalic));
    this.toolbarVisible = normalizeToolbarVisibility(loadStored(STORAGE_KEYS.toolbarIcons));
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    saveStored(STORAGE_KEYS.theme, theme);
  }

  toggleTheme(): void {
    this.setTheme(this.theme === 'dark' ? 'light' : 'dark');
  }

  setFontSize(size: number): void {
    this.fontSize = clampFontSize(size);
    saveStored(STORAGE_KEYS.fontSize, String(this.fontSize));
  }

  setFontFamily(family: FontFamily): void {
    this.fontFamily = family;
    saveStored(STORAGE_KEYS.fontFamily, family);
    const supported = FONT_FAMILY_WEIGHTS[family] ?? FONT_FAMILY_WEIGHTS.mono;
    if (!supported.includes(this.fontWeight)) {
      this.fontWeight = DEFAULT_FONT_WEIGHT;
      saveStored(STORAGE_KEYS.fontWeight, String(DEFAULT_FONT_WEIGHT));
    }
  }

  setFontWeight(weight: number): void {
    this.fontWeight = clampFontWeight(weight);
    saveStored(STORAGE_KEYS.fontWeight, String(this.fontWeight));
  }

  toggleItalic(): void {
    this.fontItalic = !this.fontItalic;
    saveStored(STORAGE_KEYS.fontItalic, String(this.fontItalic));
  }

  setToolbarVisible(visible: boolean): void {
    this.toolbarVisible = visible;
    saveStored(STORAGE_KEYS.toolbarIcons, visible ? 'visible' : 'hidden');
  }

  toggleToolbar(): void {
    this.setToolbarVisible(!this.toolbarVisible);
  }

  resetFonts(): void {
    this.fontFamily = DEFAULT_FONT_FAMILY;
    this.fontSize = DEFAULT_FONT_SIZE;
    this.fontWeight = DEFAULT_FONT_WEIGHT;
    this.fontItalic = false;
    saveStored(STORAGE_KEYS.fontFamily, DEFAULT_FONT_FAMILY);
    saveStored(STORAGE_KEYS.fontSize, String(DEFAULT_FONT_SIZE));
    saveStored(STORAGE_KEYS.fontWeight, String(DEFAULT_FONT_WEIGHT));
    saveStored(STORAGE_KEYS.fontItalic, 'false');
  }

  handleStorageEvent(e: StorageEvent): void {
    if (e.storageArea !== localStorage || !e.key) return;

    switch (e.key) {
      case STORAGE_KEYS.theme:
        this.theme = normalizeTheme(e.newValue);
        break;
      case STORAGE_KEYS.toolbarIcons:
        this.toolbarVisible = normalizeToolbarVisibility(e.newValue);
        break;
      case STORAGE_KEYS.fontFamily: {
        this.fontFamily = normalizeFontFamily(e.newValue);
        const supported = FONT_FAMILY_WEIGHTS[this.fontFamily] ?? FONT_FAMILY_WEIGHTS.mono;
        if (!supported.includes(this.fontWeight)) {
          this.fontWeight = DEFAULT_FONT_WEIGHT;
          saveStored(STORAGE_KEYS.fontWeight, String(DEFAULT_FONT_WEIGHT));
        }
        break;
      }
      case STORAGE_KEYS.fontSize: {
        const next = parseStoredFontSize(e.newValue);
        this.fontSize = Number.isFinite(next) ? clampFontSize(next) : DEFAULT_FONT_SIZE;
        break;
      }
      case STORAGE_KEYS.fontWeight:
        this.fontWeight = parseStoredFontWeight(e.newValue);
        break;
      case STORAGE_KEYS.fontItalic:
        this.fontItalic = parseStoredFontItalic(e.newValue);
        break;
    }
  }

}

export const preferences = new PreferencesState();
