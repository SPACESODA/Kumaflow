import './styles.css'

let isGrabModeEnabled = false
let currentHighlight: HTMLElement | null = null

// Returns true if the node has text directly inside it (not counting empty whitespace).
function hasDirectText(el: Node): boolean {
    return Array.from(el.childNodes).some(
        node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim().length! > 0
    )
}

// Decide whether the element can be highlighted/copied.
function isValidTarget(el: HTMLElement): boolean {
    // 1. Exclude Kumaflow's own UI elements (footer, toast)
    if (el.closest('.wul-footer')) return false
    if (el.closest('.kumaflow-grab-toast')) return false

    // 2. Exclude non-interactive or media tags
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'IMG', 'VIDEO'].includes(el.tagName)) return false
    if (el.isContentEditable) return false

    // 3. Allow inputs and textareas (for placeholder text)
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return true

    // 4. Otherwise, require direct text content
    return hasDirectText(el)
}

// Highlight the element under the cursor if it is a valid target.
function handleHover(e: MouseEvent) {
    if (!isGrabModeEnabled) return

    const target = e.target as HTMLElement

    // If invalid target, clear any existing highlight and return
    if (!target || !isValidTarget(target)) {
        if (currentHighlight) {
            currentHighlight.classList.remove('kumaflow-grab-highlight')
            currentHighlight = null
        }
        return
    }

    // Optimization: Skip if the target hasn't changed
    if (currentHighlight === target) return

    // Remove highlight from previous element
    if (currentHighlight) {
        currentHighlight.classList.remove('kumaflow-grab-highlight')
    }

    // Apply highlight to new target
    currentHighlight = target
    currentHighlight.classList.add('kumaflow-grab-highlight')
}

// Copy text when the user clicks a highlighted target.
function handleClick(e: MouseEvent) {
    if (!isGrabModeEnabled) return

    const target = e.target as HTMLElement
    if (!target || !isValidTarget(target)) return

    // Prevent default browser behavior (e.g., following links) to ensure copy action takes precedence
    e.preventDefault()
    e.stopPropagation()

    let textToCopy = ''

    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        textToCopy = (target as HTMLInputElement | HTMLTextAreaElement).placeholder || ''
    } else {
        // Fallback to textContent. Future improvement: verify if we should use `data - original - text` if available.
        textToCopy = target.textContent || ''
    }

    textToCopy = textToCopy.trim()

    if (textToCopy) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            showToast(`Copied: "${textToCopy.substring(0, 30)}${textToCopy.length > 30 ? '...' : ''}"`)

            // Visual feedback: brief green flash
            target.style.outlineColor = '#4CAF50'
            setTimeout(() => {
                target.style.outlineColor = ''
            }, 300)
        })
    }
}

// Show a short toast in the bottom-right corner.
function showToast(message: string) {
    const toast = document.createElement('div')
    toast.className = 'kumaflow-grab-toast success'
    toast.textContent = message
    document.body.appendChild(toast)

    // Remove toast after animation completes (2 seconds total)
    setTimeout(() => {
        toast.style.opacity = '0'
        toast.style.transform = 'translateY(20px) scale(0.95)'
        toast.addEventListener('transitionend', () => toast.remove())
    }, 2000)
}

// Turn on Grab Mode: start listening for hover + click.
export function enableGrabMode() {
    if (isGrabModeEnabled) return
    isGrabModeEnabled = true

    document.addEventListener('mouseover', handleHover, true)
    document.addEventListener('click', handleClick, true)

    // console.log('Kumaflow: Grab Mode Enabled')
}

// Turn off Grab Mode: remove listeners and clear highlight.
export function disableGrabMode() {
    isGrabModeEnabled = false

    document.removeEventListener('mouseover', handleHover, true)
    document.removeEventListener('click', handleClick, true)

    if (currentHighlight) {
        currentHighlight.classList.remove('kumaflow-grab-highlight')
        currentHighlight = null
    }
    document.body.style.cursor = ''
    // console.log('Kumaflow: Grab Mode Disabled')
}
