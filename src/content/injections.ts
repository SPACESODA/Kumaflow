import type { LanguageCode, Dictionary } from '../types'
import extJa from '../locales/extension-ja.json'
import extZhTw from '../locales/extension-zh-TW.json'

const EXTENSION_LOCALES: Record<Exclude<LanguageCode, 'off'>, Dictionary> = {
    ja: extJa,
    'zh-TW': extZhTw
}

// State for delay
let isReady = false
let pendingArgs: { currentLanguage: Exclude<LanguageCode, 'off'>, isEnabled: boolean } | null = null

// Initialize 2s delay
setTimeout(() => {
    isReady = true
    if (pendingArgs) {
        injectDashboardFooter(pendingArgs.currentLanguage, pendingArgs.isEnabled)
        pendingArgs = null
    }
}, 2000)

export function injectDashboardFooter(currentLanguage: Exclude<LanguageCode, 'off'>, isEnabled: boolean) {
    // Always store latest args
    pendingArgs = { currentLanguage, isEnabled }

    // If not ready, just return (it will be called when timeout fires)
    if (!isReady) return

    if (!window.location.href.includes('https://webflow.com/dashboard')) return

    // Target: <nav data-sc="LeftNavView VStack Stack View">
    const targetSelector = 'nav[data-sc="LeftNavView VStack Stack View"]'
    const target = document.querySelector(targetSelector)
    if (!target) return

    const footerId = 'webflow-ui-localization-footer'
    let footer = document.getElementById(footerId)

    // Prevent redundant updates (infinite loop fix)
    if (footer && footer.dataset.lang === currentLanguage && footer.dataset.enabled === String(isEnabled)) {
        // Ensure it is at the bottom if target changed (though appendChild moves it)
        if (footer.parentElement !== target) {
            target.appendChild(footer)
        } else if (target.lastElementChild !== footer) {
            // Only move if not already last to avoid unnecessary reflows/jitter
            target.appendChild(footer)
        }
        return
    }
    // Default English Content
    const defaultMsg = 'Thanks for using the Webflow UI Localization browser extension. Click the extension icon to toggle on/off at anytime.'
    const defaultOpt = 'Options'
    const defaultJoin = 'Join translations?'
    const madeByText = 'Made with ♥ by Anthony C.'

    // Helper to safely get string from dictionary
    const getString = (key: string, fallback: string) => {
        // If global extension is disabled ("off"), we still want to match the "off" behavior (typically English)
        // But footer injection logic:
        // If isEnabled is false, we want English.
        // If isEnabled is true, we want currentLanguage.

        if (!isEnabled) return fallback
        const dictionary = EXTENSION_LOCALES[currentLanguage]
        return dictionary?.[key] || fallback
    }

    const msg = getString('footer_message', defaultMsg)
    const opt = getString('footer_options', defaultOpt)
    const join = getString('footer_join', defaultJoin)
    // madeBy is strictly hardcoded

    if (!footer) {
        footer = document.createElement('div')
        footer.id = footerId

        // Subtle style
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
        // Hover effect
        footer.addEventListener('mouseenter', () => { footer!.style.opacity = '1' })
        footer.addEventListener('mouseleave', () => { footer!.style.opacity = '0.6' })

        target.appendChild(footer)
    } else {
        // Ensure it is at the bottom if target changed (though appendChild moves it)
        if (footer.parentElement !== target) {
            target.appendChild(footer)
        } else if (target.lastElementChild !== footer) {
            // Only move if not already last to avoid unnecessary reflows/jitter
            target.appendChild(footer)
        }
    }

    // Update content
    footer.innerHTML = `
    <div style="margin-bottom: 6px;">${msg}</div>
    <div>
       <a href="#" id="wul-options" style="color: inherit; text-decoration: none;">${opt}</a>
       <span style="opacity: 0.8; margin: 0 4px;">&#x2022;</span>
       <a href="https://poeditor.com/join/project/7drFUDh3dh" target="_blank" style="color: inherit; text-decoration: none;">${join}</a>
    </div>
    <div style="margin-top: 12px; opacity: 0.8; font-size: 10px;">
      <a href="https://x.com/anthonycxc" target="_blank" style="color: inherit; text-decoration: none;">${madeByText}</a>
    </div>
  `
    footer.dataset.lang = currentLanguage
    footer.dataset.enabled = String(isEnabled)

    const optionsLink = footer.querySelector('#wul-options') as HTMLAnchorElement
    if (optionsLink) {
        optionsLink.onclick = (e) => {
            e.preventDefault()
            if (chrome?.runtime?.sendMessage) {
                chrome.runtime.sendMessage({ action: 'openOptionsPage' })
            } else {
                console.warn('Webflow UI Localization: Extension context invalidated.')
                alert('Please reload the page to use this feature.')
            }
        }
    }
}
