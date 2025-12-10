import type { LanguageCode, Dictionary } from '../types'
import extJa from '../locales/extension-ja.json'
import extZhTw from '../locales/extension-zh-TW.json'

const EXTENSION_LOCALES: Record<Exclude<LanguageCode, 'off'>, Dictionary> = {
    ja: extJa,
    'zh-TW': extZhTw
}

type SettingsUpdate = { language?: LanguageCode; enabled?: boolean }

// State for delay
let isReady = false
let pendingArgs: { currentLanguage: Exclude<LanguageCode, 'off'>, isEnabled: boolean, onUpdate?: (settings: SettingsUpdate) => void } | null = null

// Initialize 2s delay
setTimeout(() => {
    isReady = true
    if (pendingArgs) {
        injectDashboardFooter(pendingArgs.currentLanguage, pendingArgs.isEnabled, pendingArgs.onUpdate)
        pendingArgs = null
    }
}, 2000)

export function injectDashboardFooter(
    currentLanguage: Exclude<LanguageCode, 'off'>,
    isEnabled: boolean,
    onUpdate?: (settings: SettingsUpdate) => void
) {
    // Always store latest args
    pendingArgs = { currentLanguage, isEnabled, onUpdate }

    // If not ready, just return (it will be called when timeout fires)
    if (!isReady) return

    const href = window.location.href
    const isDesigner = href.includes('preview.webflow.com') || href.includes('.design.webflow.com')
    const isDashboardOrAuth = href.includes('webflow.com/dashboard') ||
        href.includes('webflow.com/login') ||
        href.includes('webflow.com/signup') ||
        href.includes('webflow.com/forgot')

    if (isDesigner) {
        injectDesignerFooter(currentLanguage, isEnabled, onUpdate)
    } else if (isDashboardOrAuth) {
        injectSimpleFooter(currentLanguage, isEnabled)
    }
}

function injectDesignerFooter(
    currentLanguage: Exclude<LanguageCode, 'off'>,
    isEnabled: boolean,
    onUpdate?: (settings: SettingsUpdate) => void
) {
    // Target: Specific settings pane
    let target = document.querySelector('div[data-dsi-area="siteSettings"] .bem-Pane_Body_Inner')

    // Fallback to main left nav if the detailed pane isn't found (for broader compatibility)
    if (!target) {
        target = document.querySelector('nav[data-sc="LeftNavView VStack Stack View"]')
    }

    if (!target) return

    const footerId = 'webflow-ui-localization-footer'
    let footer = document.getElementById(footerId)

    // Check availability and location
    if (footer && footer.dataset.type === 'designer' && footer.parentElement === target) {
        if (target.lastElementChild !== footer) target.appendChild(footer)
        // Update selection state if needed (though interaction handling usually covers this)
        // To be safe, we re-render if fundamental state changed externally
        if (footer.dataset.lang !== currentLanguage || footer.dataset.enabled !== String(isEnabled)) {
            // Re-render
        } else {
            return
        }
    }

    if (!footer) {
        footer = document.createElement('div')
        footer.id = footerId
        footer.dataset.type = 'designer'
        footer.style.cssText = `
            margin-top: 12px;
            margin-bottom: 12px;
            padding: 15px 12px;
            color: var(--text-sys-subtle, #9e9e9e); 
            font-size: 10px;
            line-height: 1.5;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        `
        target.appendChild(footer)
    } else {
        // Move if needed
        if (footer.parentElement !== target) target.appendChild(footer)
        else if (target.lastElementChild !== footer) target.appendChild(footer)
    }

    const { msg, opt, join, madeByText } = getLocalizedStrings(currentLanguage, isEnabled)

    // Determine value for select
    const selectValue = isEnabled ? currentLanguage : 'off'

    footer.innerHTML = `
    <div style="margin-bottom: 8px;">
        <select id="wul-language-select" style="
            width: 100%;
            background: #2b2b2b;
            color: #ececec;
            border: 1px solid #3d3d3d;
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 11.5px;
            outline: none;
            cursor: pointer;
        ">
            <option value="off">English</option>
            <option value="ja">日本語 (Japanese)</option>
            <option value="zh-TW">繁體中文 (Traditional Chinese)</option>
        </select>
    </div>
    <div style="margin-bottom: 6px;">${msg}</div>
    <div style="display: flex; gap: 8px; align-items: center;">
       <a href="#" id="wul-options" style="color: inherit; text-decoration: none;">${opt}</a>
       <a href="https://poeditor.com/join/project/7drFUDh3dh" target="_blank" style="color: inherit; text-decoration: none;">${join}</a>
    </div>
    <div style="margin-top: 12px; opacity: 0.6; font-size: 10px;">
      <a href="https://x.com/anthonycxc" target="_blank" style="color: inherit; text-decoration: none;">${madeByText}</a>
    </div>
    `
    footer.dataset.lang = currentLanguage
    footer.dataset.enabled = String(isEnabled)

    // Set Select Value
    const select = footer.querySelector('#wul-language-select') as HTMLSelectElement
    if (select) {
        select.value = selectValue
        select.addEventListener('change', (e) => {
            const val = (e.target as HTMLSelectElement).value

            const storage = chrome.storage.sync || chrome.storage.local

            let update: SettingsUpdate = {}
            if (val === 'off') {
                update = { enabled: false }
            } else {
                update = { enabled: true, language: val as LanguageCode }
            }

            storage.set(update)
            onUpdate?.(update)
        })
    }

    bindOptionsLink(footer)
}

function injectSimpleFooter(currentLanguage: Exclude<LanguageCode, 'off'>, isEnabled: boolean) {
    const target = document.querySelector('nav[data-sc="LeftNavView VStack Stack View"]')
    if (!target) return

    const footerId = 'webflow-ui-localization-footer'
    let footer = document.getElementById(footerId)

    if (footer && footer.dataset.type === 'simple' && footer.parentElement === target) {
        if (target.lastElementChild !== footer) target.appendChild(footer)
        if (footer.dataset.lang === currentLanguage && footer.dataset.enabled === String(isEnabled)) return
    }

    if (!footer) {
        footer = document.createElement('div')
        footer.id = footerId
        footer.dataset.type = 'simple'
        footer.style.cssText = `
            max-width: 240px;
            margin-top: 12px;
            margin-bottom: 12px;
            padding: 0 12px;
            color: var(--text-sys-subtle, #565656); 
            font-size: 10px;
            line-height: 1.5;
            opacity: 0.6;
            transition: opacity 0.2s ease;
            position: relative;
            z-index: 100;
        `
        footer.addEventListener('mouseenter', () => { footer!.style.opacity = '1' })
        footer.addEventListener('mouseleave', () => { footer!.style.opacity = '0.6' })
        target.appendChild(footer)
    } else {
        if (footer.parentElement !== target) target.appendChild(footer)
        else if (target.lastElementChild !== footer) target.appendChild(footer)
    }

    const { msg, opt, join, madeByText } = getLocalizedStrings(currentLanguage, isEnabled)

    footer.innerHTML = `
    <div style="margin-bottom: 6px;">${msg}</div>
    <div>
       <a href="#" id="wul-options" style="color: inherit; text-decoration: none;">${opt}</a>
       <span style="opacity: 0.8; margin: 0 3px;"> </span>
       <a href="https://poeditor.com/join/project/7drFUDh3dh" target="_blank" style="color: inherit; text-decoration: none;">${join}</a>
    </div>
    <div style="margin-top: 12px; opacity: 0.8; font-size: 10px;">
      <a href="https://x.com/anthonycxc" target="_blank" style="color: inherit; text-decoration: none;">${madeByText}</a>
    </div>
    `
    footer.dataset.lang = currentLanguage
    footer.dataset.enabled = String(isEnabled)

    bindOptionsLink(footer)
}

function getLocalizedStrings(currentLanguage: Exclude<LanguageCode, 'off'>, isEnabled: boolean) {
    const defaultMsg = 'Thanks for using the Webflow UI Localization browser extension.'
    const defaultOpt = 'Options'
    const defaultJoin = 'Join translations?'
    const madeByText = 'Made with ♥ by Anthony C.'

    const getString = (key: string, fallback: string) => {
        if (!isEnabled) return fallback
        const dictionary = EXTENSION_LOCALES[currentLanguage]
        return dictionary?.[key] || fallback
    }

    return {
        msg: getString('footer_message', defaultMsg),
        opt: getString('footer_options', defaultOpt),
        join: getString('footer_join', defaultJoin),
        madeByText
    }
}

function bindOptionsLink(footer: HTMLElement) {
    const optionsLink = footer.querySelector('#wul-options') as HTMLAnchorElement
    if (optionsLink) {
        optionsLink.onclick = (e) => {
            e.preventDefault()
            if (chrome?.runtime?.sendMessage) {
                chrome.runtime.sendMessage({ action: 'openOptionsPage' })
            } else {
                alert('Please reload the page to use this feature.')
            }
        }
    }
}
