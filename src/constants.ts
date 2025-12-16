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
    // '#apple-pie',        // ID example
    // '.top-bar',          // Class example
    // '[data-pop="wow"]',  // Attribute example
    // 'nav.top',           // Tag + Class example
    // There are parts in Webflow, especially in the Designer, that should not be translated.
    // Default selectors here:
    'div.bem-SearchResultPreview',
    '[data-automation-id="page-list-row-wrapper"] div.bem-List_Cell',
    '[data-palette="CMSListItem"]',
    '[data-palette="CMSItemsListPanelTitle"]',
    '[data-palette="VirtualizedSearchableListGroup"] [data-sc="RowItemLabel"]'
];
