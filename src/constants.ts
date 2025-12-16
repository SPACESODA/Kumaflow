/**
 * Key used for caching fetched locale data in local storage.
 */
export const LOCALE_CACHE_KEY = 'cdnLocaleCache_v1'

/**
 * List of CSS selectors to exclude from translation.
 * Any text node inside an element matching these selectors (or the element itself) will be skipped.
 */
export const EXCLUDED_SELECTORS = [
    // Examples:
    // '#apple-pie',        // ID
    // '.top-bar',          // Class
    // '[data-pop="wow"]',  // Attribute
    // 'nav.top',           // Tag + Class
    // Parts in Webflow, especially in the Designer, that should not be translated:
    // Webflow Pages
    'div.bem-SearchResultPreview',
    // Webflow Designer
    '[data-automation-id="page-list-row-wrapper"] div.bem-List_Cell',
    '[data-palette="CMSListItem"]',
    '[data-palette="CMSItemsListPanelTitle"]',
    '[data-palette="VirtualizedSearchableListGroup"] [data-sc="RowItemLabel"]',
    '[data-automation-id="style-rule-token-text"]',
    '[data-automation-id="symbol-panel-styles-name"]',  // Style Panel > Styles names
    '[data-automation-id="style-rule-token-all-styles-tooltip-text"]',  // Style Selector > Style names
    '[data-automation-id="components-group-Templates"] span[data-text="true"]',
    '.CodeMirror-scroll'
];
