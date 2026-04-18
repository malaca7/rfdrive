import { useEffect } from 'react';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';

/** Convert hex (#RRGGBB) → "H S% L%" string for CSS variables */
function hexToHSL(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '206 92% 38%';
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Derive lighter/darker shades from HSL string */
function adjustLightness(hsl: string, delta: number): string {
  const parts = hsl.match(/([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!parts) return hsl;
  const h = parseFloat(parts[1]);
  const s = parseFloat(parts[2]);
  const l = Math.min(100, Math.max(0, parseFloat(parts[3]) + delta));
  return `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;
}

export function ThemeSync() {
  const {
    nomePlataforma, slogan,
    corPrimaria,
  } = usePlatformConfig();

  // Dynamic page title
  useEffect(() => {
    document.title = slogan ? `${nomePlataforma} | ${slogan}` : nomePlataforma;
  }, [nomePlataforma, slogan]);

  // Only sync primary/accent color from DB — background/foreground handled by CSS dark/light classes
  useEffect(() => {
    const root = document.documentElement;
    const primary = hexToHSL(corPrimaria);
    const darkerPrimary = adjustLightness(primary, -5);

    // Primary / Accent colors
    root.style.setProperty('--primary', primary);
    root.style.setProperty('--accent', primary);
    root.style.setProperty('--ring', primary);
    root.style.setProperty('--sidebar-primary', primary);
    root.style.setProperty('--sidebar-ring', primary);

    // Gradient accent
    root.style.setProperty('--gradient-accent', `linear-gradient(135deg, hsl(${primary}), hsl(${darkerPrimary}))`);

    // CSS custom property for raw hex
    root.style.setProperty('--theme-primary-hex', corPrimaria);
  }, [corPrimaria]);

  // Apply saved theme class on mount
  useEffect(() => {
    const saved = localStorage.getItem('app-theme') || 'dark';
    const root = document.documentElement;
    if (saved === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
  }, []);

  return null;
}
