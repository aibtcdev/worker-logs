/**
 * Brand configuration for dashboard customization
 */

const HEX_COLOR_RE = /^#?[0-9a-fA-F]{6}$/

/**
 * Environment variables that control branding
 */
export interface BrandEnv {
  BRAND_NAME?: string
  BRAND_ACCENT?: string
  BRAND_CDN_URL?: string
  BRAND_FONT_NAME?: string
  BRAND_LOGO_URL?: string
  BRAND_FAVICON_URL?: string
  BRAND_FONT_REGULAR_URL?: string
  BRAND_FONT_MEDIUM_URL?: string
  BRAND_PATTERN_URL?: string
}

/**
 * Complete brand configuration interface
 */
export interface BrandConfig {
  name: string
  accentColor: string
  accentHoverColor: string
  accentLightColor: string
  accentDimColor: string
  accentGlowColor: string
  accentBorderColor: string
  fontName: string
  fontRegularUrl: string
  fontMediumUrl: string
  logoUrl: string
  faviconUrl: string
  patternImageUrl: string
  cdnHost: string
}

/**
 * Default AIBTC brand configuration
 */
export const DEFAULT_BRAND_CONFIG: BrandConfig = {
  name: 'AIBTC',
  accentColor: '#FF4F03',
  accentHoverColor: '#e54400',
  accentLightColor: '#ff7033',
  accentDimColor: 'rgba(255, 79, 3, 0.12)',
  accentGlowColor: 'rgba(255, 79, 3, 0.08)',
  accentBorderColor: 'rgba(255, 79, 3, 0.3)',
  fontName: 'Roc Grotesk',
  fontRegularUrl: 'https://aibtc.com/fonts/RocGrotesk-Regular.woff2',
  fontMediumUrl: 'https://aibtc.com/fonts/RocGrotesk-WideMedium.woff2',
  logoUrl: 'https://aibtc.com/Primary_Logo/SVG/AIBTC_PrimaryLogo_KO.svg',
  faviconUrl: 'https://aibtc.com/favicon-32x32.png',
  patternImageUrl: 'https://aibtc.com/Artwork/AIBTC_Pattern1_optimized.jpg',
  cdnHost: 'https://aibtc.com',
}

/**
 * Convert hex color to rgba string
 */
export function hexToRgba(hex: string, alpha: number): string {
  if (!HEX_COLOR_RE.test(hex)) {
    return `rgba(0, 0, 0, ${alpha})`
  }

  const cleanHex = hex.replace(/^#/, '')
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Get brand configuration from environment variables
 *
 * Supports:
 * - BRAND_NAME: Brand display name
 * - BRAND_ACCENT: Hex color (derives hover/dim/glow/border/light automatically)
 * - BRAND_CDN_URL: Base URL for assets (derives logo/favicon/font/pattern paths)
 * - BRAND_FONT_NAME: Font family name
 * - BRAND_LOGO_URL: Full logo URL override
 * - BRAND_FAVICON_URL: Full favicon URL override
 * - BRAND_FONT_REGULAR_URL: Full font regular URL override
 * - BRAND_FONT_MEDIUM_URL: Full font medium URL override
 * - BRAND_PATTERN_URL: Full pattern image URL override
 */
export function getBrandConfig(env: BrandEnv): BrandConfig {
  const cdnUrl = env.BRAND_CDN_URL || DEFAULT_BRAND_CONFIG.cdnHost
  const rawAccent = env.BRAND_ACCENT || DEFAULT_BRAND_CONFIG.accentColor
  const accentHex = HEX_COLOR_RE.test(rawAccent) ? rawAccent : DEFAULT_BRAND_CONFIG.accentColor

  // Derive accent variations from base accent color
  const r = parseInt(accentHex.replace(/^#/, '').substring(0, 2), 16)
  const g = parseInt(accentHex.replace(/^#/, '').substring(2, 4), 16)
  const b = parseInt(accentHex.replace(/^#/, '').substring(4, 6), 16)

  // Generate hover color (darken by ~10%)
  const hoverR = Math.max(0, Math.floor(r * 0.9))
  const hoverG = Math.max(0, Math.floor(g * 0.9))
  const hoverB = Math.max(0, Math.floor(b * 0.9))
  const accentHoverColor = `#${hoverR.toString(16).padStart(2, '0')}${hoverG.toString(16).padStart(2, '0')}${hoverB.toString(16).padStart(2, '0')}`

  // Generate light color (lighten by ~15%)
  const lightR = Math.min(255, Math.floor(r + (255 - r) * 0.15))
  const lightG = Math.min(255, Math.floor(g + (255 - g) * 0.15))
  const lightB = Math.min(255, Math.floor(b + (255 - b) * 0.15))
  const accentLightColor = `#${lightR.toString(16).padStart(2, '0')}${lightG.toString(16).padStart(2, '0')}${lightB.toString(16).padStart(2, '0')}`

  return {
    name: env.BRAND_NAME || DEFAULT_BRAND_CONFIG.name,
    accentColor: accentHex,
    accentHoverColor: accentHoverColor,
    accentLightColor: accentLightColor,
    accentDimColor: hexToRgba(accentHex, 0.12),
    accentGlowColor: hexToRgba(accentHex, 0.08),
    accentBorderColor: hexToRgba(accentHex, 0.3),
    fontName: env.BRAND_FONT_NAME || DEFAULT_BRAND_CONFIG.fontName,
    fontRegularUrl: env.BRAND_FONT_REGULAR_URL || `${cdnUrl}/fonts/${env.BRAND_FONT_NAME || 'RocGrotesk'}-Regular.woff2`,
    fontMediumUrl: env.BRAND_FONT_MEDIUM_URL || `${cdnUrl}/fonts/${env.BRAND_FONT_NAME || 'RocGrotesk'}-WideMedium.woff2`,
    logoUrl: env.BRAND_LOGO_URL || `${cdnUrl}/Primary_Logo/SVG/${env.BRAND_NAME || 'AIBTC'}_PrimaryLogo_KO.svg`,
    faviconUrl: env.BRAND_FAVICON_URL || `${cdnUrl}/favicon-32x32.png`,
    patternImageUrl: env.BRAND_PATTERN_URL || `${cdnUrl}/Artwork/${env.BRAND_NAME || 'AIBTC'}_Pattern1_optimized.jpg`,
    cdnHost: cdnUrl,
  }
}
