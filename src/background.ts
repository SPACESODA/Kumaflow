// Open options page on install
chrome.runtime.onInstalled.addListener((details) => {
  updateBadge(true) // Default to enabled on install
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage()
  }
})

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openOptionsPage') {
    chrome.runtime.openOptionsPage()
  }
})

// --- Icon Click Handler & Badge Logic ---

const DEFAULT_SETTINGS = { enabled: true }

function getStorage() {
  return chrome.storage.sync || chrome.storage.local
}

function updateBadge(enabled: boolean) {
  const text = enabled ? '' : 'OFF'
  const color = enabled ? '#00000000' : '#6b6b6b' // Transparent if enabled (no badge), Gray if disabled

  chrome.action.setBadgeText({ text })
  chrome.action.setBadgeBackgroundColor({ color })
}

// 1. Handle Icon Click -> Toggle Enabled
chrome.action.onClicked.addListener(() => {
  const storage = getStorage()
  storage.get(DEFAULT_SETTINGS, (result) => {
    const nextState = !result.enabled
    storage.set({ enabled: nextState })
    updateBadge(nextState)
  })
})

// 2. Listen for Storage Changes (to sync badge if toggled elsewhere)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync' && areaName !== 'local') return
  if (changes.enabled) {
    updateBadge(changes.enabled.newValue)
  }
})

// 3. Initialize Badge on Startup
getStorage().get(DEFAULT_SETTINGS, (result) => {
  updateBadge(result.enabled)
})
