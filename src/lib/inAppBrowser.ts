export interface InAppBrowserDetection {
  isInAppBrowser: boolean
  source: string | null
}

const IN_APP_BROWSER_PATTERNS: Array<{ pattern: RegExp; source: string }> = [
  { pattern: /instagram/i, source: 'Instagram' },
  { pattern: /fban|fbav|fb_iab|messenger/i, source: 'Facebook' },
  { pattern: /whatsapp/i, source: 'WhatsApp' },
  { pattern: /line\//i, source: 'LINE' },
  { pattern: /twitter/i, source: 'Twitter' },
  { pattern: /telegram/i, source: 'Telegram' },
  { pattern: /linkedinapp/i, source: 'LinkedIn' },
  { pattern: /micromessenger/i, source: 'WeChat' },
  { pattern: /duckduckgo/i, source: 'DuckDuckGo' },
  { pattern: /pinterest/i, source: 'Pinterest' },
  { pattern: /snapchat/i, source: 'Snapchat' },
  { pattern: /tiktok/i, source: 'TikTok' },
]

function detectIosWebView(userAgent: string) {
  const isIOS = /iphone|ipad|ipod/i.test(userAgent)
  const hasWebKit = /applewebkit/i.test(userAgent)
  const hasSafari = /safari/i.test(userAgent)
  return isIOS && hasWebKit && !hasSafari
}

function detectAndroidWebView(userAgent: string) {
  return /; wv\)|\bwv\b|version\/\d+\.\d+ chrome\/\d+\.0\.\d+\.0 mobile safari\/\d+/i.test(userAgent)
}

function detectGeneralWebView(userAgent: string) {
  return /\bwebview\b|cordova|crosswalk|okhttp|miuibrowser/i.test(userAgent)
}

export function getInAppBrowserDetection(userAgent?: string): InAppBrowserDetection {
  const ua = (userAgent || '').trim()
  if (!ua) return { isInAppBrowser: false, source: null }

  for (const item of IN_APP_BROWSER_PATTERNS) {
    if (item.pattern.test(ua)) {
      return { isInAppBrowser: true, source: item.source }
    }
  }

  if (detectIosWebView(ua)) {
    return { isInAppBrowser: true, source: 'iOS WebView' }
  }

  if (detectAndroidWebView(ua)) {
    return { isInAppBrowser: true, source: 'Android WebView' }
  }

  if (detectGeneralWebView(ua)) {
    return { isInAppBrowser: true, source: 'WebView' }
  }

  return { isInAppBrowser: false, source: null }
}

export function isInAppBrowser(userAgent?: string) {
  return getInAppBrowserDetection(userAgent).isInAppBrowser
}
