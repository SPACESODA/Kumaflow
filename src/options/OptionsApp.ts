// ---------------------------------------------------------------------------
// OPTIONS PAGE APPLICATION
// ---------------------------------------------------------------------------
// This file handles the rendering and logic for the extension's options page.
// It manages user settings and provides manual controls for clearing cache.

import type { LanguageCode, Dictionary } from '../types'
import { LOCALE_CACHE_KEY, EXCLUDED_SELECTORS } from '../constants'

// Extension UI Translations
import extJa from '../locales-extension/ja.json'
import extZhTw from '../locales-extension/zh-TW.json'
import extZhCn from '../locales-extension/zh-CN.json'
import extKo from '../locales-extension/ko.json'
import extTh from '../locales-extension/th.json'
import extFr from '../locales-extension/fr.json'
import extIt from '../locales-extension/it.json'

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

type Settings = {
  language: LanguageCode;
  enabled: boolean;
  strictMatching: boolean;
  useCdn: boolean;
  exclusionSelectors: string[];
  grabMode: boolean;
}
type LocaleMeta = { source: 'primary' | 'secondary' | 'bundled'; fetchedAt?: number }

// ---------------------------------------------------------------------------
// CONSTANTS & CONFIGURATION
// ---------------------------------------------------------------------------

const DEFAULT_LANGUAGE: LanguageCode = 'ja'
const DEFAULT_SETTINGS: Settings = {
  language: DEFAULT_LANGUAGE,
  enabled: true,
  strictMatching: true,
  useCdn: true,
  exclusionSelectors: getDefaultExclusionSelectors(),
  grabMode: false
}

// Supported languages for the options UI (English + native label for clarity)
const LANGUAGES: Array<{ value: LanguageCode; en: string; native: string }> = [
  { value: 'ja', en: 'Japanese', native: '日本語' },
  { value: 'zh-TW', en: 'Traditional Chinese', native: '繁體中文' },
  { value: 'zh-CN', en: 'Simplified Chinese', native: '简体中文' },
  { value: 'ko', en: 'Korean', native: '한국어' },
  { value: 'th', en: 'Thai', native: 'ไทย' },
  { value: 'fr', en: 'French', native: 'Français' },
  { value: 'it', en: 'Italian', native: 'Italiano' }
]

// Extension UI translations (used to localize the options page itself)
const EXTENSION_LOCALES: Record<Exclude<LanguageCode, 'off'>, Dictionary> = {
  ja: extJa,
  'zh-TW': extZhTw,
  'zh-CN': extZhCn,
  ko: extKo,
  th: extTh,
  fr: extFr,
  it: extIt
}

// English fallback strings (when a translation is missing or language is off)
const FALLBACK_STRINGS: Dictionary = {
  options_title: 'Choose your Webflow UI language',
  options_description: 'This extension translates the UI of Webflow Dashboard and Designer. The goal is to make Webflow easier to use without distorting its terminology. It may not translate every term.',
  options_enable_label: 'Enable translation',
  options_enable_desc: 'Turn this off to keep Webflow in English.',
  options_status_idle: 'Choose the language you want to see in Webflow. More languages coming soon!',
  options_strict_label: 'Avoid partial translations (Recommended)',
  options_strict_desc: 'Only translate when the full text matches our translation phrase. Prevents partial phrase changes.',
  options_cdn_label: 'Use the latest translation updates',
  options_cdn_desc: 'Fetch the latest translations from CDN. Turn off to use only the bundled version.',
  options_refreshing_msg: 'Refreshing Cache...',
  options_refresh_done_msg: 'Done: Please reload Webflow pages.',
  options_saved_msg: 'Saved',
  options_contribute: 'Contribute on GitHub',
  footer_join: 'Join translations',
  options_advanced_toggle: 'Advanced Settings',
  options_advanced_label: 'Excluded Selectors',
  options_advanced_desc: 'Any elements that match these selectors will be skipped and not translated. One selector per line.',
  options_advanced_save: 'Save Exclusions',
  options_advanced_saved: 'Saved!',
  options_advanced_reset: 'Reset to default',
  options_advanced_reset_confirm: 'Confirm reset to default?',
  options_grab_mode_label: 'Grab Mode',
  options_grab_mode_desc: 'Easily capture untranslated UI text and paste it into POEditor to help complete translations.'
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

// Safely retrieve the storage area (Sync if available, otherwise Local)
function getStorage(): chrome.storage.SyncStorageArea | chrome.storage.LocalStorageArea {
  return chrome?.storage?.sync || chrome?.storage?.local
}

// Heavier cache reads (like the large translation map) should come from 'local' storage
// when available to avoid hitting 'sync' storage quotas and latency.
function getCacheStorage(): chrome.storage.LocalStorageArea | chrome.storage.SyncStorageArea {
  return chrome?.storage?.local || chrome?.storage?.sync
}

// Get a localized string for the Options UI (fallback to English)
function getText(lang: LanguageCode, key: string): string {
  if (lang === 'off') return FALLBACK_STRINGS[key] || ''
  const dict = EXTENSION_LOCALES[lang as Exclude<LanguageCode, 'off'>]
  return dict?.[key] || FALLBACK_STRINGS[key] || ''
}

// Always return a fresh copy to avoid shared mutations between defaults and storage
function getDefaultExclusionSelectors(): string[] {
  return [...EXCLUDED_SELECTORS]
}

function resolveExclusionSelectors(value: unknown): string[] {
  return Array.isArray(value) ? value : getDefaultExclusionSelectors()
}

function normalizeSettings(raw: Partial<Settings>): Settings {
  return {
    language: (raw.language as LanguageCode) ?? DEFAULT_LANGUAGE,
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
    strictMatching: typeof raw.strictMatching === 'boolean' ? raw.strictMatching : true,
    useCdn: typeof raw.useCdn === 'boolean' ? raw.useCdn : true,
    exclusionSelectors: resolveExclusionSelectors(raw.exclusionSelectors),
    grabMode: typeof raw.grabMode === 'boolean' ? raw.grabMode : false
  }
}

// ---------------------------------------------------------------------------
// STATE MANAGEMENT
// ---------------------------------------------------------------------------

// Tracks the last rendered language to decide when a full re-render is needed
const appState = {
  lastRenderedLanguage: null as LanguageCode | null,
  currentSettings: { ...DEFAULT_SETTINGS } as Settings,
  // Latest locale source metadata (per language).
  // This tells us if we are using the bundled JSON or a fresher version from CDN.
  latestLocaleMeta: null as Record<Exclude<LanguageCode, 'off'>, LocaleMeta> | null,
  // Track if a manual refresh is in progress to prevent UI flickering
  isManuallyRefreshing: false
}

// ---------------------------------------------------------------------------
// DOM RENDERING
// ---------------------------------------------------------------------------

// Main render: full re-render on language change, otherwise just sync values
function renderApp(settings: Settings) {
  currentSettings = settings
  const root = document.getElementById('root')
  if (!root) return

  // Full re-render needed if language changed (to update UI text).
  // We must re-bind events because the DOM nodes are replaced.
  if (lastRenderedLanguage !== settings.language) {
    lastRenderedLanguage = settings.language
    renderFullPage(root, settings)
    bindEvents(root)
  }

  // Always update input states (checked/disabled) to match settings
  updateValues(root, settings)

  // Only update badge if not in the middle of a manual refresh result.
  // This prevents the "Done" message from being immediately overwritten by "Bundled"
  // before the user has a chance to see it.
  if (!isManuallyRefreshing) {
    updateLocaleBadge(root, latestLocaleMeta, settings)
  }
}

// Render the full options page for the selected language
function renderFullPage(root: HTMLElement, settings: Settings) {
  const lang = settings.language

  root.innerHTML = `
    <div class="options_shell">
      <div class="options_header">
        <div>
          <p class="eyebrow">Kumaflow - Webflow UI Localization</p>
          <h1 class="title">${getText(lang, 'options_title')}</h1>
          <p class="lede">${getText(lang, 'options_description')}</p>
        </div>
        <a class="json_badge" id="cdn_json_badge" target="_blank" rel="noreferrer noopener"></a>
      </div>
    </div>
  `

  const container = document.createElement('div')
  container.className = 'options_card'
  root.querySelector('.options_shell')?.appendChild(container)


  const localizedLabel = getText(lang, 'options_enable_label')
  const englishLabel = FALLBACK_STRINGS['options_enable_label']
  const displayLabel = localizedLabel === englishLabel
    ? localizedLabel
    : `${localizedLabel} (${englishLabel})`

  renderToggleItem(container, 'enabled', displayLabel, getText(lang, 'options_enable_desc'))


  const status = document.createElement('p')
  status.className = 'status'
  status.id = 'status_msg'
  status.textContent = getText(lang, 'options_status_idle')
  container.appendChild(status)


  renderLanguageList(container)

  renderToggleItem(container, 'strictMatching', getText(lang, 'options_strict_label'), getText(lang, 'options_strict_desc'))
  renderToggleItem(container, 'useCdn', getText(lang, 'options_cdn_label'), getText(lang, 'options_cdn_desc'))
  renderToggleItem(container, 'grabMode', getText(lang, 'options_grab_mode_label'), getText(lang, 'options_grab_mode_desc'))

  renderAdvancedSection(container, settings)

  const footer = document.createElement('div')
  footer.className = 'footer'

  footer.innerHTML = `
    <div class="footer_divider"></div>
    <div class="footer_meta">
        <p class="credit">Made with &hearts; by <a href="https://x.com/anthonycxc" target="_blank" rel="noreferrer">Anthony C</a></p>
        <p class="links">
            <a href="https://poeditor.com/join/project/7drFUDh3dh" target="_blank" rel="noreferrer">${getText(lang, 'footer_join')}</a>
            <span style="opacity: 0.6;">&#x2022;</span>
            <a href="https://github.com/SPACESODA/Kumaflow" target="_blank" rel="noreferrer">${getText(lang, 'options_contribute')}</a>
        </p>
    </div>
    <p class="disclaimer" style="margin-bottom: 18px;">This extension provides unofficial translations that may not be accurate.</p>
    <p class="disclaimer">This extension is an independent project and is not affiliated with or endorsed by Webflow. Webflow is a trademark of Webflow, Inc.</p>
    <p class="disclaimer">This extension does not collect, store, or transmit any personal information or usage data.</p>
  `
  container.appendChild(footer)
}

// Render a checkbox toggle row
function renderToggleItem(parent: HTMLElement, name: string, title: string, desc: string) {
  const label = document.createElement('label')
  label.className = `toggle toggle_${name}`
  label.innerHTML = `
    <input type="checkbox" name="${name}">
    <span class="toggle_track"><span class="toggle_thumb"></span></span>
    <div class="toggle_text"><strong>${title}</strong><span>${desc}</span></div>
  `
  parent.appendChild(label)
}

// Render Advanced Section
function renderAdvancedSection(parent: HTMLElement, settings: Settings) {
  const lang = settings.language
  const wrapper = document.createElement('div')

  wrapper.innerHTML = `
    <button type="button" class="advanced_toggle">
      <span>▶</span> ${getText(lang, 'options_advanced_toggle')}
    </button>
    
    <div class="advanced_section" id="advanced_panel">
      <label class="advanced_label">${getText(lang, 'options_advanced_label')}</label>
      <p class="advanced_desc">
        ${getText(lang, 'options_advanced_desc')}
      </p>
      
      <textarea class="exclusion_input" spellcheck="false" placeholder=".my-class\n#my-id\n[data-my-attr=&quot;my-value&quot;]"></textarea>
      
      <div style="display: flex; align-items: center;">
        <button type="button" class="save_button">${getText(lang, 'options_advanced_save')}</button>
        <button type="button" class="reset_button">${getText(lang, 'options_advanced_reset')}</button>
        <span class="save_status">${getText(lang, 'options_advanced_saved')}</span>
      </div>
    </div>
  `

  parent.appendChild(wrapper)

  // Set initial value
  const textarea = wrapper.querySelector('textarea')
  if (textarea) {
    textarea.value = resolveExclusionSelectors(settings.exclusionSelectors).join('\n')
  }
}

// Render a checkbox toggle row
function renderLanguageList(parent: HTMLElement) {
  const form = document.createElement('form')
  form.id = 'language-form'

  LANGUAGES.forEach((item) => {
    const label = document.createElement('label')
    label.className = 'language_option'
    label.innerHTML = `
        <input type="radio" name="language" value="${item.value}">
        <span class="language_name">
            ${item.en}
            <span class="language_sep">|</span>
            <span class="language_native">${item.native}</span>
        </span>
    `
    form.appendChild(label)
  })
  parent.appendChild(form)
}

// Sync inputs with current settings without recreating the DOM
function updateValues(root: HTMLElement, settings: Settings) {
  // Update Toggles
  const toggles = root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
  toggles.forEach((box: HTMLInputElement) => {
    const key = box.name as keyof Settings
    if (key in settings) {
      box.checked = Boolean(settings[key])
    }
  })

  // Update Selected Language
  const langRadio = root.querySelector<HTMLInputElement>(`input[name="language"][value="${settings.language}"]`)
  if (langRadio) langRadio.checked = true

  // Handle Disabled State (when extension is disabled)
  const form = root.querySelector('#language-form')
  if (form) {
    if (settings.enabled) form.removeAttribute('data-disabled')
    else form.setAttribute('data-disabled', 'true')

    const radios = form.querySelectorAll<HTMLInputElement>('input[type="radio"]')
    radios.forEach(r => r.disabled = !settings.enabled)
  }

  // Update Exclusion List (keep in sync with storage/reset)
  const textarea = root.querySelector('.exclusion_input') as HTMLTextAreaElement
  if (textarea) {
    const currentVal = textarea.value.split('\n').map(s => s.trim()).filter(Boolean).join('\n')
    const newVal = resolveExclusionSelectors(settings.exclusionSelectors).join('\n')
    // Only update if significantly different to avoid cursor jumping if user is typing
    // (Though user typing usually doesn't trigger external setting updates unless we debounced save)
    // For Reset, this is crucial.
    if (currentVal !== newVal) {
      textarea.value = newVal
    }
  }
}

function updateLocaleBadge(
  root: HTMLElement,
  meta: Record<Exclude<LanguageCode, 'off'>, LocaleMeta> | null,
  settings: Settings
) {
  const el = root.querySelector<HTMLElement>('#cdn_json_badge')
  if (!el) return
  const { language, useCdn } = settings
  const entry = meta?.[language as Exclude<LanguageCode, 'off'>]

  // Hide when language is off
  if (language === 'off') {
    el.textContent = ''
    el.removeAttribute('href')
    el.style.display = 'none'
    return
  }

  // If CDN is disabled, force bundled label regardless of cache
  if (!useCdn) {
    el.textContent = 'JSON: Bundled'
    el.removeAttribute('href')
    el.style.display = 'inline-block'
    el.classList.remove('clickable')
    el.removeAttribute('title')
    return
  }

  // When a manual refresh clears the cache, the click handler keeps custom text while
  // isManuallyRefreshing is true; once a new cache arrives this normal rendering runs again.

  // Otherwise show the fetched source or fall back to bundled
  if (!entry) {
    el.textContent = 'JSON: Bundled'
    el.removeAttribute('href')
    el.style.display = 'inline-block'
    el.classList.remove('clickable')
    el.removeAttribute('title')
    return
  }

  const label =
    entry.source === 'primary' ? 'JSON: Cloudflare'
      : entry.source === 'secondary' ? 'JSON: jsDelivr'
        : 'JSON: Bundled'

  el.textContent = label
  el.removeAttribute('href')
  el.style.display = 'inline-block'

  el.classList.add('clickable')
}

// ---------------------------------------------------------------------------
// EVENTS & INTERACTION
// ---------------------------------------------------------------------------

function bindEvents(root: HTMLElement) {
  const storage = getStorage()

  // Checkbox handlers (Enable, Strict, CDN)
  const toggles = root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
  toggles.forEach(box => {
    box.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement
      const key = target.name
      const val = target.checked

      // Optimistic UI update: Toggle the switch visually immediately.
      // The actual storage save happens asynchronously below.
      if (key === 'enabled') {
        updateValues(root, { ...currentSettings, enabled: val })
      }

      // Save to storage
      storage.set({ [key]: val }, () => {
        setStatusMsg(root, getText(currentSettings.language, 'options_saved_msg'))
      })
    })
  })

  // Language selection handler
  const form = root.querySelector('#language-form')
  form?.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement
    if (target.name === 'language') {
      const val = target.value as LanguageCode

      // Saving language triggers 'onChanged', which will call renderApp() and re-render the page.
      storage.set({ language: val, enabled: true }, () => {
        setStatusMsg(root, getText(currentSettings.language, 'options_saved_msg'))
      })

      // Updates internal state loosely until the re-render happens
      currentSettings.language = val
      currentSettings.enabled = true
    }
  })

  // Badge click handler (Force Refresh)
  const badge = root.querySelector('#cdn_json_badge')
  badge?.addEventListener('click', () => {
    // Only allow refresh if using CDN (checked via valid class or settings)
    if (!currentSettings.useCdn) return

    const el = badge as HTMLElement
    // 1. Set Loading Text
    el.textContent = getText(currentSettings.language, 'options_refreshing_msg')
    isManuallyRefreshing = true

    chrome.storage.local.remove(LOCALE_CACHE_KEY, () => {
      // 2. Set Done Text on completion
      // We keep isManuallyRefreshing = true so onChanged doesn't overwrite this with "Bundled"
      // It stays true so this message persists until the user reloads the Page
      // or until a NEW cache entry appears (which happens when they visit Webflow).
      el.textContent = getText(currentSettings.language, 'options_refresh_done_msg')
    })
  })

  // Advanced Toggle Handler
  const advToggle = root.querySelector('.advanced_toggle')
  if (advToggle) {
    advToggle.addEventListener('click', () => {
      const panel = root.querySelector('#advanced_panel') as HTMLElement
      const arrow = advToggle.querySelector('span')
      const isOpen = panel.getAttribute('data-open') === 'true'

      panel.setAttribute('data-open', (!isOpen).toString())
      if (arrow) arrow.textContent = isOpen ? '▶' : '▼'
    })
  }

  // Advanced Save Handler
  const saveBtn = root.querySelector('.save_button')
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const textarea = root.querySelector('.exclusion_input') as HTMLTextAreaElement
      const status = root.querySelector('.save_status') as HTMLElement

      const raw = textarea.value
      const lines = raw.split('\n').map(s => s.trim()).filter(Boolean)

      // Save
      storage.set({ exclusionSelectors: lines }, () => {
        // Show saved status
        if (status) {
          status.classList.add('visible')
          setTimeout(() => status.classList.remove('visible'), 2000)
        }
        // Update local state
        currentSettings.exclusionSelectors = lines
      })
    })
  }

  // Advanced Reset Handler
  const resetBtn = root.querySelector('.reset_button')
  if (resetBtn) {
    // Inline two-click confirm for reset:
    // 1) First click flips the label to the confirm text and starts a short timeout.
    // 2) Second click (while confirming) actually restores defaults and saves them.
    // This avoids alert() and keeps intent visible in the UI.
    let resetConfirming = false
    let resetConfirmTimeout: ReturnType<typeof setTimeout> | undefined

    // Clean up the timeout if the page is unloaded, to prevent memory leaks
    window.addEventListener('beforeunload', () => {
      if (resetConfirmTimeout) {
        clearTimeout(resetConfirmTimeout)
        resetConfirmTimeout = undefined
      }
    });
    const defaultResetLabel = getText(currentSettings.language, 'options_advanced_reset')
    const confirmResetLabel = getText(currentSettings.language, 'options_advanced_reset_confirm')

    const setResetState = (confirming: boolean) => {
      resetConfirming = confirming
      resetBtn.textContent = confirming ? confirmResetLabel : defaultResetLabel
      resetBtn.setAttribute('data-confirming', confirming.toString())
      if (resetConfirmTimeout) {
        clearTimeout(resetConfirmTimeout)
        resetConfirmTimeout = undefined
      }
      if (confirming) {
        resetConfirmTimeout = setTimeout(() => setResetState(false), 4000)
      }
    }

    resetBtn.addEventListener('click', () => {
      if (!resetConfirming) {
        setResetState(true)
        return
      }

      const textarea = root.querySelector('.exclusion_input') as HTMLTextAreaElement
      const status = root.querySelector('.save_status') as HTMLElement

      const defaults = getDefaultExclusionSelectors()
      const updatedSettings = { ...currentSettings, exclusionSelectors: defaults }

      // Update UI immediately
      if (textarea) textarea.value = defaults.join('\n')

      const finish = () => {
        if (status) {
          status.classList.add('visible')
          setTimeout(() => status.classList.remove('visible'), 2000)
        }
        setResetState(false)
        // Keep local state and inputs in sync without needing a full reload
        renderApp(updatedSettings)
      }

      // Clear any stored custom values and rely on runtime defaults.
      // Do NOT write defaults back, so extension updates can change them.
      storage.remove('exclusionSelectors', finish)
    })
  }
}

function setStatusMsg(root: HTMLElement, msg: string) {
  const el = root.querySelector('#status_msg') as HTMLElement
  if (el) {
    el.textContent = msg
    el.dataset.status = 'changed'
    setTimeout(() => {
      // Revert to idle message if still in 'changed' state
      if (el.dataset.status === 'changed') {
        el.textContent = getText(currentSettings.language, 'options_status_idle')
        el.dataset.status = 'idle'
      }
    }, 2000)
  }
}

// ---------------------------------------------------------------------------
// INITIALIZATION
// ---------------------------------------------------------------------------

export default function initOptionsPage() {
  const storage = getStorage()
  const cacheStorage = getCacheStorage()

  // 1. Initial Load: Get settings and cache meta from storage.
  // We fetch both user settings (sync/local) and the translation cache metadata (local).
  storage.get(Object.assign({}, DEFAULT_SETTINGS, { exclusionSelectors: getDefaultExclusionSelectors() }), (items) => {
    cacheStorage.get({ [LOCALE_CACHE_KEY]: null }, (cacheItems: { [LOCALE_CACHE_KEY]: Record<Exclude<LanguageCode, 'off'>, { source?: string; fetchedAt?: number }> | null }) => {
      latestLocaleMeta = extractLocaleMeta(cacheItems[LOCALE_CACHE_KEY])
      // Merge defaults with loaded items to ensure complete object
      const settings = normalizeSettings({ ...DEFAULT_SETTINGS, ...items })
      renderApp(settings)
    })
  })

  // 2. Storage Listener: Handle updates from other tabs/contexts
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' && area !== 'local') return

    const newSettings = { ...currentSettings }
    let hasChange = false

    // Update settings object with any changed values
    // We use explicit checks instead of iteration for type safety (avoid TS2322)
    if (changes.language) {
      newSettings.language = changes.language.newValue
      hasChange = true
    }
    if (changes.enabled) {
      newSettings.enabled = changes.enabled.newValue
      hasChange = true
    }
    if (changes.strictMatching) {
      newSettings.strictMatching = changes.strictMatching.newValue
      hasChange = true
    }
    if (changes.useCdn) {
      newSettings.useCdn = changes.useCdn.newValue
      hasChange = true
    }
    if (changes.grabMode) {
      newSettings.grabMode = changes.grabMode.newValue
      hasChange = true
    }
    if (changes.exclusionSelectors) {
      newSettings.exclusionSelectors = resolveExclusionSelectors(changes.exclusionSelectors.newValue)
      // Re-render to keep the textarea in sync if changed externally
      hasChange = true
    }

    // Check for cache updates (usually fetched by content scripts in the background).
    // The options page listens for this to update the "JSON: Cloudflare" badge.
    if (changes[LOCALE_CACHE_KEY]) {
      const newValue = changes[LOCALE_CACHE_KEY].newValue
      latestLocaleMeta = extractLocaleMeta(newValue)

      // If we receive a NEW valid cache, we can clear the manual refresh state
      // and show the new source (e.g. Cloudflare).
      if (newValue && Object.keys(newValue).length > 0) {
        isManuallyRefreshing = false
      }

      const root = document.getElementById('root')
      if (root && !isManuallyRefreshing) {
        updateLocaleBadge(root, latestLocaleMeta, newSettings)
      }
    }

    if (hasChange) {
      renderApp(newSettings)
    }
  })
}

function extractLocaleMeta(
  cache: Record<Exclude<LanguageCode, 'off'>, { source?: string; fetchedAt?: number }> | null
): Record<Exclude<LanguageCode, 'off'>, LocaleMeta> | null {
  if (!cache || typeof cache !== 'object') return null
  const meta: Partial<Record<Exclude<LanguageCode, 'off'>, LocaleMeta>> = {}
  Object.entries(cache).forEach(([code, entry]) => {
    const source = entry?.source
    if (source === 'primary' || source === 'secondary') {
      meta[code as Exclude<LanguageCode, 'off'>] = {
        source,
        fetchedAt: entry?.fetchedAt
      }
    }
  })
  return Object.keys(meta).length ? (meta as Record<Exclude<LanguageCode, 'off'>, LocaleMeta>) : null
}
