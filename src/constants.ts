/**
 * Key used for caching fetched locale data in local storage.
 */
export const LOCALE_CACHE_KEY = 'cdnLocaleCache_v1'

/**
 * List of CSS selectors to exclude from translation.
 * Any text node inside an element matching these selectors (or the element itself) will be skipped.
 * Test site - look for the text "EXCLUDE-THIS" (testing string: notranslate):
 * https://preview.webflow.com/preview/notranslate?preview=1db9e911959b56d89fe51bfa4a4962bb
 */
export const EXCLUDED_SELECTORS = [
    // Examples:
    // '#apple-pie',        // ID
    // '.top-bar',          // Class
    // '[data-pop="wow"]',  // Attribute
    // 'nav.top',           // Tag + Class
    // Webflow Pages
    // Webflow Designer
    'div.bem-SearchResultPreview', // SEO Preview
    '[data-automation-id="page-list-row-wrapper"] div.bem-List_Cell',
    '[data-palette="CMSListItem"]',
    '[data-palette="CMSItemsListPanelTitle"]',
    '[data-palette="VirtualizedSearchableListGroup"] [data-sc="RowItemLabel"]',
    '[data-automation-id="style-rule-token-text"]',
    '[data-automation-id="symbol-panel-styles-name"]', // Style Panel > Styles names
    '[data-automation-id="style-rule-token-all-styles-tooltip-text"]', // Style Selector > Style names
    '[data-automation-id="components-group-Templates"] span[data-text="true"]',
    '[data-automation-id="default-collection-row"]', // Variable Group names
    '.CodeMirror-scroll'
];
