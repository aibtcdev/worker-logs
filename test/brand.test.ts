import { describe, it, expect } from 'vitest'
import { getBrandConfig, hexToRgba, DEFAULT_BRAND_CONFIG } from '../src/dashboard/brand'

describe('Brand configuration', () => {
  describe('DEFAULT_BRAND_CONFIG', () => {
    it('has AIBTC defaults', () => {
      expect(DEFAULT_BRAND_CONFIG.name).toBe('AIBTC')
      expect(DEFAULT_BRAND_CONFIG.accentColor).toBe('#FF4F03')
      expect(DEFAULT_BRAND_CONFIG.cdnHost).toBe('https://aibtc.com')
    })

    it('has all required fields', () => {
      const keys: (keyof typeof DEFAULT_BRAND_CONFIG)[] = [
        'name',
        'accentColor',
        'accentHoverColor',
        'accentLightColor',
        'accentDimColor',
        'accentGlowColor',
        'accentBorderColor',
        'fontName',
        'fontRegularUrl',
        'fontMediumUrl',
        'logoUrl',
        'faviconUrl',
        'patternImageUrl',
        'cdnHost',
      ]
      for (const key of keys) {
        expect(DEFAULT_BRAND_CONFIG[key]).toBeDefined()
      }
    })
  })

  describe('hexToRgba', () => {
    it('converts hex color to rgba', () => {
      expect(hexToRgba('#FF4F03', 1)).toBe('rgba(255, 79, 3, 1)')
      expect(hexToRgba('#FF4F03', 0.5)).toBe('rgba(255, 79, 3, 0.5)')
    })

    it('handles hex without #', () => {
      expect(hexToRgba('FF4F03', 0.3)).toBe('rgba(255, 79, 3, 0.3)')
    })

    it('converts black and white', () => {
      expect(hexToRgba('#000000', 1)).toBe('rgba(0, 0, 0, 1)')
      expect(hexToRgba('#ffffff', 1)).toBe('rgba(255, 255, 255, 1)')
    })

    it('returns fallback for invalid hex strings', () => {
      expect(hexToRgba('', 1)).toBe('rgba(0, 0, 0, 1)')
      expect(hexToRgba('GGGGGG', 0.5)).toBe('rgba(0, 0, 0, 0.5)')
      expect(hexToRgba('#12345', 1)).toBe('rgba(0, 0, 0, 1)')
      expect(hexToRgba('#12345G', 1)).toBe('rgba(0, 0, 0, 1)')
      expect(hexToRgba('xyz', 0.3)).toBe('rgba(0, 0, 0, 0.3)')
    })
  })

  describe('getBrandConfig', () => {
    it('returns defaults when no env vars set', () => {
      const config = getBrandConfig({})
      expect(config.name).toBe('AIBTC')
      expect(config.accentColor).toBe('#FF4F03')
      expect(config.cdnHost).toBe('https://aibtc.com')
      expect(config.logoUrl).toContain('AIBTC')
      expect(config.faviconUrl).toContain('aibtc.com')
    })

    it('overrides name from env', () => {
      const config = getBrandConfig({ BRAND_NAME: 'MyBrand' })
      expect(config.name).toBe('MyBrand')
      // Logo and pattern paths derive from name
      expect(config.logoUrl).toContain('MyBrand')
      expect(config.patternImageUrl).toContain('MyBrand')
    })

    it('overrides accent color and derives variants', () => {
      const config = getBrandConfig({ BRAND_ACCENT: '#3366FF' })
      expect(config.accentColor).toBe('#3366FF')
      // Dim, glow, border are rgba variants of the accent
      expect(config.accentDimColor).toBe('rgba(51, 102, 255, 0.12)')
      expect(config.accentGlowColor).toBe('rgba(51, 102, 255, 0.08)')
      expect(config.accentBorderColor).toBe('rgba(51, 102, 255, 0.3)')
      // Hover is darkened (~10%)
      expect(config.accentHoverColor).not.toBe('#3366FF')
    })

    it('overrides CDN URL and derives asset paths', () => {
      const config = getBrandConfig({ BRAND_CDN_URL: 'https://cdn.example.com' })
      expect(config.cdnHost).toBe('https://cdn.example.com')
      expect(config.fontRegularUrl).toContain('https://cdn.example.com/fonts/')
      expect(config.fontMediumUrl).toContain('https://cdn.example.com/fonts/')
      expect(config.faviconUrl).toBe('https://cdn.example.com/favicon-32x32.png')
      expect(config.patternImageUrl).toContain('https://cdn.example.com/Artwork/')
      expect(config.logoUrl).toContain('https://cdn.example.com/Primary_Logo/')
    })

    it('allows individual URL overrides', () => {
      const config = getBrandConfig({
        BRAND_LOGO_URL: 'https://other.com/logo.svg',
        BRAND_FAVICON_URL: 'https://other.com/fav.png',
        BRAND_FONT_REGULAR_URL: 'https://other.com/font-regular.woff2',
        BRAND_FONT_MEDIUM_URL: 'https://other.com/font-medium.woff2',
        BRAND_PATTERN_URL: 'https://other.com/pattern.jpg',
      })
      expect(config.logoUrl).toBe('https://other.com/logo.svg')
      expect(config.faviconUrl).toBe('https://other.com/fav.png')
      expect(config.fontRegularUrl).toBe('https://other.com/font-regular.woff2')
      expect(config.fontMediumUrl).toBe('https://other.com/font-medium.woff2')
      expect(config.patternImageUrl).toBe('https://other.com/pattern.jpg')
    })

    it('overrides font name and derives font URLs', () => {
      const config = getBrandConfig({ BRAND_FONT_NAME: 'Inter' })
      expect(config.fontName).toBe('Inter')
      expect(config.fontRegularUrl).toContain('Inter-Regular.woff2')
      expect(config.fontMediumUrl).toContain('Inter-WideMedium.woff2')
    })

    it('combines CDN URL with name for derived paths', () => {
      const config = getBrandConfig({
        BRAND_CDN_URL: 'https://cdn.example.com',
        BRAND_NAME: 'Acme',
      })
      expect(config.logoUrl).toBe(
        'https://cdn.example.com/Primary_Logo/SVG/Acme_PrimaryLogo_KO.svg'
      )
      expect(config.patternImageUrl).toBe(
        'https://cdn.example.com/Artwork/Acme_Pattern1_optimized.jpg'
      )
    })

    it('falls back to default accent when BRAND_ACCENT is invalid', () => {
      const config = getBrandConfig({ BRAND_ACCENT: 'not-a-color' })
      expect(config.accentColor).toBe(DEFAULT_BRAND_CONFIG.accentColor)
      expect(config.accentDimColor).not.toContain('NaN')
    })
  })
})
