import { useEffect } from 'react';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';

/** Convert hex (#RRGGBB) → "H S% L%" string for CSS variables */
function hexToHSL(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '45 100% 50%';
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
  const { corPrimaria, corSecundaria, corTerciaria } = usePlatformConfig();

  useEffect(() => {
    const root = document.documentElement;
    const primary = hexToHSL(corPrimaria);
    const bg = hexToHSL(corSecundaria);
    const fg = hexToHSL(corTerciaria);

    // Primary / Accent colors
    root.style.setProperty('--primary', primary);
    root.style.setProperty('--accent', primary);
    root.style.setProperty('--ring', primary);
    root.style.setProperty('--sidebar-primary', primary);
    root.style.setProperty('--sidebar-ring', primary);

    // Background-derived
    root.style.setProperty('--background', bg);
    root.style.setProperty('--card', adjustLightness(bg, 4));
    root.style.setProperty('--popover', adjustLightness(bg, 4));
    root.style.setProperty('--secondary', adjustLightness(bg, 8));
    root.style.setProperty('--muted', adjustLightness(bg, 8));
    root.style.setProperty('--border', adjustLightness(bg, 10));
    root.style.setProperty('--input', adjustLightness(bg, 10));
    root.style.setProperty('--sidebar-background', bg);
    root.style.setProperty('--sidebar-accent', adjustLightness(bg, 8));
    root.style.setProperty('--sidebar-border', adjustLightness(bg, 12));

    // Foreground-derived
    root.style.setProperty('--foreground', fg);
    root.style.setProperty('--card-foreground', fg);
    root.style.setProperty('--popover-foreground', fg);
    root.style.setProperty('--secondary-foreground', fg);
    root.style.setProperty('--sidebar-foreground', adjustLightness(fg, -6));
    root.style.setProperty('--sidebar-accent-foreground', adjustLightness(fg, -6));
    root.style.setProperty('--muted-foreground', adjustLightness(fg, -46));

    // Gradient accent
    const darkerPrimary = adjustLightness(primary, -5);
    root.style.setProperty('--gradient-accent', `linear-gradient(135deg, hsl(${primary}), hsl(${darkerPrimary}))`);
    root.style.setProperty('--gradient-primary', `linear-gradient(135deg, hsl(${adjustLightness(bg, 2)}), hsl(${adjustLightness(bg, 8)}))`);

    // body bg
    document.body.style.background = `hsl(${bg})`;

    // CSS custom property for raw hex values (for inline styles)
    root.style.setProperty('--theme-primary-hex', corPrimaria);
    root.style.setProperty('--theme-bg-hex', corSecundaria);
    root.style.setProperty('--theme-fg-hex', corTerciaria);
  }, [corPrimaria, corSecundaria, corTerciaria]);

  return null;
}
