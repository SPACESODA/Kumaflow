import ja from '../locales/ja.json'
import zhTw from '../locales/zh-TW.json'
import zhCn from '../locales/zh-CN.json'
import ko from '../locales/ko.json'
import { injectDashboardFooter } from './injections'
import type { LanguageCode, Dictionary } from '../types'

type Replacement = {
  regex: RegExp
  replacement: string | ((substring: string, ...args: any[]) => string)
  marker?: string
}

type Settings = { language: LanguageCode; enabled: boolean; strictMatching: boolean; useCdn: boolean }

const BUNDLED_LANGUAGES: Record<Exclude<LanguageCode, 'off'>, Dictionary> = {
  ja,
  'zh-TW': zhTw,
  'zh-CN': zhCn,
  ko
}

const DEFAULT_LANGUAGE: Exclude<LanguageCode, 'off'> = 'ja'
const DEFAULT_SETTINGS: Settings = { language: DEFAULT_LANGUAGE, enabled: true, strictMatching: true, useCdn: true }
const FLEXIBLE_STRICT_WHITESPACE = true
const initialDocumentLang = document.documentElement?.getAttribute('lang') || 'en'

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'IFRAME',
  'CANVAS',
  'INPUT',
  'TEXTAREA',
  'SELECT',
  'OPTION',
  'BUTTON'
])

import { EXCLUDED_SELECTORS } from './exclusions'

const IGNORE_PATTERN = EXCLUDED_SELECTORS.join(',')

let activeReplacements: Replacement[] = []
let reverseReplacements: Replacement[] = []
let currentLanguage: Exclude<LanguageCode, 'off'> = DEFAULT_LANGUAGE
let isEnabled = true
let strictMatching = true
let latestSettings: Settings = DEFAULT_SETTINGS
let loadedLanguages: Record<Exclude<LanguageCode, 'off'>, Dictionary> = { ...BUNDLED_LANGUAGES }
let observer: MutationObserver | null = null
let flushScheduled = false
const pendingTextNodes = new Set<Text>()
const pendingElements = new Set<Element>()
const CDN_REPO_OWNER = 'SPACESODA'
const CDN_REPO_NAME = 'Webflow-UI-Localization'
const CDN_REPO_BRANCH = 'main'
const CDN_SHA_CACHE_TTL = 60 * 60 * 1000 // 60 minutes
const CDN_SHA_STORAGE_KEY = 'cdnSha'
let cachedCdnSha: string | null = null
let cachedCdnShaFetchedAt = 0

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ')
}

function buildFlexiblePattern(value: string): string {
  return normalizeWhitespace(value)
    .split(' ')
    .map((segment) => escapeRegExp(segment))
    .join('\\s+')
}

function buildTokenizedReplacement(
  sourceString: string,
  targetString: string,
  flexible: boolean
): Replacement {
  // 1. Build Regex Pattern & Identify Tokens
  // Split keeps placeholder names because the capturing group is retained
  // We use this single pass to ensure token names in `tokenNames` 
  // exactly match the capture groups in the generated regex.
  const parts = sourceString.split(/\{([^}]+)\}/g)

  const toPattern = flexible ? buildFlexiblePattern : escapeRegExp
  const tokenNames: string[] = []

  let patternString = '^(\\s*)'

  parts.forEach((part, index) => {
    const isToken = index % 2 === 1
    if (isToken) {
      // It's a token (e.g. "name" from "{name}")
      // We normalize it to the full placeholder format "{name}" for the pool lookup
      // or just keep the name? 
      // scripts.ts logic uses "{name}" as keys in valuePool. 
      // The split gives us just "name". Let's reconstruct it.
      const tokenName = `{${part}}`
      tokenNames.push(tokenName)

      // Require at least one character for placeholders to avoid "ghost" matches
      patternString += '(.+?)'
    } else if (part) {
      // It's static text
      patternString += toPattern(part)
    }
  })

  patternString += '(\\s*)$'
  const regex = new RegExp(patternString)

  // 2. Build Replacement Function
  const replacement = (_match: string, ...args: any[]) => {
    // args: [leading, t1, t2, ..., tN, trailing, offset, string]
    // leading = args[0]
    // trailing = args[tokenNames.length + 1]

    const leading = args[0]
    const trailing = args[tokenNames.length + 1]

    // Map token names to captured values
    // Using a pool to handle repeated tokens like {*}
    const valuePool: Record<string, string[]> = {}

    tokenNames.forEach((tokenName, i) => {
      if (!valuePool[tokenName]) valuePool[tokenName] = []
      valuePool[tokenName].push(args[i + 1])
    })

    // Construct result by replacing tokens in targetString
    // We clone the pool so we can shift values out
    const currentPool = { ...valuePool }
    // Shallow copy of arrays inside
    for (const k in currentPool) {
      currentPool[k] = [...currentPool[k]]
    }

    // We use the same regex for target replacement to find where to put values
    const targetTokenRegex = /\{[^}]+\}/g

    const result = targetString.replace(targetTokenRegex, (token) => {
      if (currentPool[token] && currentPool[token].length > 0) {
        return currentPool[token].shift()!
      }

      // Warn if we have a placeholder in translation that we can't fill
      // This usually means the translation file has a typo (e.g. {naame} instead of {name})
      // or expects a variable that the source text didn't provide.
      console.warn(`[Webflow-Localization] Missing value for token "${token}" in translation for: "${sourceString}"`)

      return token // Leave as is
    })

    return `${leading}${result}${trailing}`
  }

  return { regex, replacement }
}

function buildReplacements(dictionary: Dictionary, strict: boolean): Replacement[] {
  const entries = Object.entries(dictionary).sort(([a], [b]) => b.length - a.length)

  if (strict) {
    return entries.map(([source, replacement]: [string, string]) =>
      buildTokenizedReplacement(source, replacement, FLEXIBLE_STRICT_WHITESPACE)
    )
  }

  return entries.map(([source, replacement]: [string, string]) => ({
    regex: new RegExp(escapeRegExp(source), 'g'),
    replacement,
    marker: source.slice(0, 6)
  }))
}

function buildReverseReplacements(dictionary: Dictionary, strict: boolean): Replacement[] {
  const entries = Object.entries(dictionary).sort(([a], [b]) => b.length - a.length)

  if (strict) {
    return entries.map(([source, replacement]: [string, string]) =>
      buildTokenizedReplacement(replacement, source, FLEXIBLE_STRICT_WHITESPACE)
    )
  }

  return entries.map(([source, replacement]: [string, string]) => ({
    regex: new RegExp(escapeRegExp(replacement), 'g'),
    replacement: source,
    marker: replacement.slice(0, 6)
  }))
}

function maybeContains(text: string, marker?: string) {
  if (!marker) return true
  return text.includes(marker)
}

function applyReplacements(text: string, replacements: Replacement[]): { updated: string; changed: boolean } {
  if (!text.trim() || !replacements.length) return { updated: text, changed: false }

  let updated = text
  let changed = false

  for (let i = 0; i < replacements.length; i += 1) {
    const { regex, replacement, marker } = replacements[i]
    if (!maybeContains(updated, marker)) continue
    const next = updated.replace(regex, replacement as any)
    if (next !== updated) {
      updated = next
      changed = true
    }
  }

  return { updated, changed }
}

function translateTextNode(node: Text) {
  if (!isEnabled) return
  const { updated, changed } = applyReplacements(node.data, activeReplacements)
  if (changed) {
    node.data = updated
  }
}

function revertTextNode(node: Text) {
  // We removed the isEnabled check here because applySettings calls this
  // specifically to clear existing translations *while* isEnabled is still true
  // (before switching to the new language).
  // The caller is responsible for deciding when to revert.

  const { updated, changed } = applyReplacements(node.data, reverseReplacements)
  if (changed) {
    node.data = updated
  }
}

let titleObserver: MutationObserver | null = null

function translateTitle() {
  if (!isEnabled) return

  const current = document.title
  const { updated, changed } = applyReplacements(current, activeReplacements)

  if (changed && updated !== current) {
    document.title = updated
  }
}

function revertTitle() {
  // Removed isEnabled check for same reason as revertTextNode
  const current = document.title
  const { updated, changed } = applyReplacements(current, reverseReplacements)
  if (changed) {
    document.title = updated
  }
}

function observeTitle() {
  if (titleObserver) titleObserver.disconnect()

  const titleEl = document.querySelector('title')
  if (!titleEl) return // Should observe head if title doesn't exist yet? Webflow usually has it.

  titleObserver = new MutationObserver(() => {
    // When title changes (by app or by us)
    // If by us, we probably shouldn't react?
    // But the app might overwrite our translation with English.
    // So we need to re-apply translation.
    // To avoid loop: check if translation needed.
    if (isEnabled) {
      translateTitle()
    }
  })

  titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true })
}

function disconnectTitleObserver() {
  if (titleObserver) {
    titleObserver.disconnect()
    titleObserver = null
  }
}


function shouldSkipTextNode(textNode: Text) {
  const parent = textNode.parentElement
  if (!parent) return true
  if (SKIP_TAGS.has(parent.tagName)) return true
  if (parent.isContentEditable) return true
  if (IGNORE_PATTERN && parent.closest(IGNORE_PATTERN)) return true
  if (!textNode.textContent?.trim()) return true
  return false
}

function translateWithin(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(textNode) {
      return shouldSkipTextNode(textNode as Text) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    }
  })

  let current = walker.nextNode() as Text | null
  while (current) {
    translateTextNode(current)
    current = walker.nextNode() as Text | null
  }
}

function revertWithin(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(textNode) {
      return shouldSkipTextNode(textNode as Text) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    }
  })

  let current = walker.nextNode() as Text | null
  while (current) {
    revertTextNode(current)
    current = walker.nextNode() as Text | null
  }
}


function translatePlaceholder(element: HTMLInputElement | HTMLTextAreaElement) {
  if (!isEnabled) return
  const current = element.placeholder
  if (!current) return

  const { updated, changed } = applyReplacements(current, activeReplacements)
  if (changed) {
    element.placeholder = updated
  }
}

function revertPlaceholder(element: HTMLInputElement | HTMLTextAreaElement) {
  const current = element.placeholder
  if (!current) return

  const { updated, changed } = applyReplacements(current, reverseReplacements)
  if (changed) {
    element.placeholder = updated
  }
}

function translatePlaceholdersWithin(root: Node) {
  if (root.nodeType === Node.ELEMENT_NODE) {
    const el = root as Element
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      translatePlaceholder(el as HTMLInputElement | HTMLTextAreaElement)
    }
    const inputs = el.querySelectorAll('input[placeholder], textarea[placeholder]')
    inputs.forEach((input) => translatePlaceholder(input as HTMLInputElement | HTMLTextAreaElement))
  }
}

function revertPlaceholdersWithin(root: Node) {
  if (root.nodeType === Node.ELEMENT_NODE) {
    const el = root as Element
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      revertPlaceholder(el as HTMLInputElement | HTMLTextAreaElement)
    }
    const inputs = el.querySelectorAll('input[placeholder], textarea[placeholder]')
    inputs.forEach((input) => revertPlaceholder(input as HTMLInputElement | HTMLTextAreaElement))
  }
}

function flushPending() {
  flushScheduled = false
  if (!document.body) return

  if (isEnabled) {
    pendingTextNodes.forEach((text) => translateTextNode(text))
    pendingElements.forEach((element) => {
      translateWithin(element)
      translatePlaceholdersWithin(element)
    })
  } else {
    pendingTextNodes.forEach((text) => revertTextNode(text))
    pendingElements.forEach((element) => {
      revertWithin(element)
      revertPlaceholdersWithin(element)
    })
  }

  pendingTextNodes.clear()
  pendingElements.clear()
  injectDashboardFooter(currentLanguage, isEnabled, (updates: any) => {
    applySettings({ ...latestSettings, ...updates })
  })
}



function scheduleFlush() {
  if (flushScheduled) return
  flushScheduled = true

  const runner = () => {
    flushPending()
  }

  // Use requestAnimationFrame to update before the next repaint.
  // This minimizes the "flash of untranslated content" for dynamic UI elements.
  requestAnimationFrame(runner)
}

function observeDocument() {
  if (observer) observer.disconnect()
  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'characterData') {
        if (mutation.target.nodeType === Node.TEXT_NODE) {
          pendingTextNodes.add(mutation.target as Text)
        }
      } else if (mutation.type === 'attributes' && mutation.attributeName === 'placeholder') {
        // Handle placeholder change
        const target = mutation.target as HTMLInputElement | HTMLTextAreaElement
        pendingElements.add(target)
        // We add to pendingElements so it gets processed by translatePlaceholdersWithin
        // Optimization: could have specific set for attributes but this works since pendingElements triggers scan
      }

      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          pendingTextNodes.add(node as Text)
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          pendingElements.add(node as Element)
        }
      })
    })

    if (pendingTextNodes.size || pendingElements.size) {
      scheduleFlush()
    }
  })

  observer.observe(document.body, {
    characterData: true,
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['placeholder']
  })
}

function disconnectObserver() {
  if (observer) {
    observer.disconnect()
    observer = null
  }
  pendingTextNodes.clear()
  pendingElements.clear()
}

function getStorage(): chrome.storage.SyncStorageArea | chrome.storage.LocalStorageArea {
  if (chrome?.storage?.sync) return chrome.storage.sync
  return chrome.storage.local
}

function getSavedSettings(): Promise<Settings> {
  const storage = getStorage()
  return new Promise((resolve) => {
    storage.get(DEFAULT_SETTINGS, (result) => {
      const language = (result.language as LanguageCode) ?? DEFAULT_LANGUAGE
      const enabled =
        typeof result.enabled === 'boolean' ? result.enabled : DEFAULT_SETTINGS.enabled
      const strict =
        typeof result.strictMatching === 'boolean'
          ? result.strictMatching
          : DEFAULT_SETTINGS.strictMatching
      const useCdn =
        typeof result.useCdn === 'boolean' ? result.useCdn : DEFAULT_SETTINGS.useCdn
      resolve({ language, enabled, strictMatching: strict, useCdn })
    })
  })
}

function updateDocumentLang(language: LanguageCode, enabled: boolean) {
  const langToSet = enabled && language !== 'off' ? language : initialDocumentLang
  document.documentElement?.setAttribute('lang', langToSet)
}

async function fetchLatestCdnSha(): Promise<string> {
  const now = Date.now()
  if (cachedCdnSha && now - cachedCdnShaFetchedAt < CDN_SHA_CACHE_TTL) {
    return cachedCdnSha
  }

  const commitUrl = `https://api.github.com/repos/${CDN_REPO_OWNER}/${CDN_REPO_NAME}/commits/${CDN_REPO_BRANCH}`
  const response = await fetch(commitUrl, {
    headers: { Accept: 'application/vnd.github+json' }
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch latest commit SHA: ${response.status}`)
  }
  const data = await response.json()
  const sha = data?.sha
  if (!sha || typeof sha !== 'string') {
    throw new Error('Commit SHA missing in GitHub response')
  }
  cachedCdnSha = sha
  cachedCdnShaFetchedAt = now
  try {
    getStorage().set({ [CDN_SHA_STORAGE_KEY]: sha })
  } catch (err) {
    // Best-effort persistence; failures are non-blocking.
    console.warn('Could not persist CDN SHA', err)
  }
  return sha
}

function buildCdnLocaleUrl(code: Exclude<LanguageCode, 'off'>, sha: string): string {
  return `https://cdn.jsdelivr.net/gh/${CDN_REPO_OWNER}/${CDN_REPO_NAME}@${sha}/src/locales/${code}.json`
}

async function fetchLocale(url: string): Promise<Dictionary> {
  const response = await fetch(url, { cache: 'no-cache' })
  if (!response.ok) {
    throw new Error(`Failed to fetch locale: ${response.status}`)
  }

  const data = await response.json()
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid locale JSON')
  }
  return data as Dictionary
}

async function refreshLocalesFromCdn() {
  if (!latestSettings.useCdn) return

  let sha: string | null = null
  try {
    sha = await fetchLatestCdnSha()
  } catch (err) {
    console.warn('Could not fetch latest CDN SHA; keeping existing locales', err)
    return
  }

  if (!sha) return

  const updates: Partial<Record<Exclude<LanguageCode, 'off'>, Dictionary>> = {}
  const codes = Object.keys(BUNDLED_LANGUAGES) as Exclude<LanguageCode, 'off'>[]

  await Promise.all(
    codes.map(async (code) => {
      try {
        const localeUrl = buildCdnLocaleUrl(code, sha)
        const locale = await fetchLocale(localeUrl)
        updates[code] = locale
      } catch (err) {
        console.warn(`Could not refresh locale for ${code}`, err)
      }
    })
  )

  if (Object.keys(updates).length) {
    loadedLanguages = { ...loadedLanguages, ...updates }
    applySettings(latestSettings)
  }
}

function applySettings(settings: Settings) {
  // 1. Revert existing translations if currently enabled
  // This ensures we have a clean slate (English) before applying a new language
  // or before disabling.
  if (isEnabled) {
    disconnectObserver()
    disconnectTitleObserver()
    revertWithin(document.body)
    revertPlaceholdersWithin(document.body)
    revertTitle()
  }

  // 2. Update state
  latestSettings = settings
  const language = settings.language === 'off' ? currentLanguage : settings.language

  // ensure we load dictionary if needed
  const dictionary =
    loadedLanguages[language] ??
    BUNDLED_LANGUAGES[language] ??
    loadedLanguages[DEFAULT_LANGUAGE] ??
    BUNDLED_LANGUAGES[DEFAULT_LANGUAGE]

  currentLanguage = language
  isEnabled = settings.enabled && settings.language !== 'off'
  strictMatching = settings.strictMatching

  activeReplacements = buildReplacements(dictionary, strictMatching)
  reverseReplacements = buildReverseReplacements(dictionary, strictMatching)
  updateDocumentLang(currentLanguage, isEnabled)

  // 3. Apply new translations if enabled
  if (isEnabled) {
    translateWithin(document.body)
    translatePlaceholdersWithin(document.body)
    translateTitle()
    observeDocument()
    observeTitle()
  }

  // Update footer regardless of enabled state (to show English when disabled)
  // We pass a callback to allow the footer dropdown to trigger immediate updates manually
  injectDashboardFooter(currentLanguage, isEnabled, (updates) => {
    applySettings({ ...latestSettings, ...updates })
  })
}

function listenForSettingsChanges() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' && areaName !== 'local') return
    if (
      !changes.language &&
      typeof changes.enabled === 'undefined' &&
      typeof changes.strictMatching === 'undefined'
    )
      return

    const language = (changes.language?.newValue as LanguageCode) ?? currentLanguage
    const enabled =
      typeof changes.enabled?.newValue === 'boolean' ? changes.enabled.newValue : isEnabled
    const strict =
      typeof changes.strictMatching?.newValue === 'boolean'
        ? changes.strictMatching.newValue
        : strictMatching
    const useCdn =
      typeof changes.useCdn?.newValue === 'boolean'
        ? changes.useCdn.newValue
        : latestSettings.useCdn

    applySettings({ language, enabled, strictMatching: strict, useCdn })
  })
}


function startFooterWatchdog() {
  // Repeatedly check and inject footer. 
  // This is cheap (document.querySelector) and ensures the footer appears 
  // even if the extension is disabled (so no main observer) or if the UI loads late.
  setInterval(() => {
    injectDashboardFooter(currentLanguage, isEnabled, (updates) => {
      applySettings({ ...latestSettings, ...updates })
    })
  }, 1000)
}

function init() {
  if (!document.body) return
  getSavedSettings()
    .then((settings) => {
      applySettings(settings)
      listenForSettingsChanges()
      refreshLocalesFromCdn()
      startFooterWatchdog()
    })
    .catch((err) => {
      console.warn('Failed to load saved settings', err)
      refreshLocalesFromCdn()
      startFooterWatchdog()
    })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
