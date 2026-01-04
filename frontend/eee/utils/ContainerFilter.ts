/**
 * Container Filter for DOM Element Processing
 *
 * Implements blacklist/whitelist strategies to filter out unwanted containers
 * Reduces noise and prevents translation of UI elements like buttons, navigation, etc.
 */

import { logger } from './logger'

/**
 * Filter configuration options
 */
export interface FilterConfig {
  /** Enable blacklist filtering (default: true) */
  useBlacklist: boolean
  /** Enable whitelist filtering (default: false) */
  useWhitelist: boolean
  /** Custom blacklist selectors */
  blacklistSelectors: string[]
  /** Custom whitelist selectors */
  whitelistSelectors: string[]
  /** Exclude button elements (default: true) */
  excludeButtons: boolean
  /** Exclude navigation elements (default: true) */
  excludeNavigation: boolean
}

/**
 * Default blacklist selectors
 * Elements that should never be processed for translation
 */
const DEFAULT_BLACKLIST_SELECTORS = [
  'script',
  'style',
  'noscript',
  'textarea',
  'code',
  'pre',
  'svg',
  'canvas',
  'iframe',
  'object',
  'embed',
  'video',
  'audio',
  'input',
  'select',
  'option',
  '[contenteditable="false"]',
  '[aria-hidden="true"]',
  '[data-no-translate]'
]

/**
 * Button-related selectors
 */
const BUTTON_SELECTORS = [
  'button',
  '[role="button"]',
  '[type="button"]',
  '[type="submit"]',
  '[type="reset"]'
]

/**
 * Navigation-related selectors
 */
const NAVIGATION_SELECTORS = [
  'nav',
  '[role="navigation"]',
  '[role="menubar"]',
  '[role="menu"]',
  'header',
  'footer',
  'aside'
]

/**
 * Default whitelist selectors (optional)
 * Only process elements within these containers
 */
const DEFAULT_WHITELIST_SELECTORS = [
  'main',
  'article',
  '[role="main"]',
  '[role="article"]',
  'section',
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'td',
  'th',
  'blockquote',
  'figcaption',
  'dd',
  'dt'
]

/**
 * Default filter configuration
 */
const DEFAULT_CONFIG: FilterConfig = {
  useBlacklist: true,
  useWhitelist: false, // Whitelist disabled by default (more permissive)
  blacklistSelectors: DEFAULT_BLACKLIST_SELECTORS,
  whitelistSelectors: DEFAULT_WHITELIST_SELECTORS,
  excludeButtons: true,
  excludeNavigation: true
}

export class ContainerFilter {
  private config: FilterConfig
  private blacklistCache = new WeakSet<Element>()
  private whitelistCache = new WeakSet<Element>()

  constructor(config: Partial<FilterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }

    // Build complete blacklist with buttons and navigation
    if (this.config.excludeButtons) {
      this.config.blacklistSelectors.push(...BUTTON_SELECTORS)
    }

    if (this.config.excludeNavigation) {
      this.config.blacklistSelectors.push(...NAVIGATION_SELECTORS)
    }

    logger.debug('ContainerFilter initialized', {
      blacklistCount: this.config.blacklistSelectors.length,
      whitelistCount: this.config.whitelistSelectors.length,
      useWhitelist: this.config.useWhitelist
    })
  }

  /**
   * Check if element should be processed (non-recursive)
   * Only checks the element itself, not parents
   *
   * @param element - Element to check
   * @returns true if element should be processed
   *
   * @example
   * filter.shouldProcessElement(document.querySelector('p'))  // true
   * filter.shouldProcessElement(document.querySelector('script'))  // false
   */
  shouldProcessElement(element: Element): boolean {
    // Check blacklist cache
    if (this.blacklistCache.has(element)) {
      return false
    }

    // Check whitelist cache
    if (this.config.useWhitelist && this.whitelistCache.has(element)) {
      return true
    }

    // Blacklist check
    if (this.config.useBlacklist) {
      for (const selector of this.config.blacklistSelectors) {
        try {
          if (element.matches(selector)) {
            this.blacklistCache.add(element)
            return false
          }
        } catch (e) {
          // Invalid selector, skip
          logger.warn(`Invalid blacklist selector: ${selector}`)
        }
      }
    }

    // Whitelist check (if enabled)
    if (this.config.useWhitelist) {
      for (const selector of this.config.whitelistSelectors) {
        try {
          if (element.matches(selector)) {
            this.whitelistCache.add(element)
            return true
          }
        } catch (e) {
          // Invalid selector, skip
          logger.warn(`Invalid whitelist selector: ${selector}`)
        }
      }

      // If whitelist is enabled and element doesn't match, reject
      return false
    }

    // No filtering applied, allow by default
    return true
  }

  /**
   * Check if element should be processed (recursive)
   * Checks element and all parent elements up to document.body
   *
   * @param element - Element to check
   * @returns true if element and all ancestors should be processed
   *
   * @example
   * // <script><div><p>text</p></div></script>
   * filter.shouldProcessElementRecursive(p)  // false (ancestor is script)
   *
   * // <article><div><p>text</p></div></article>
   * filter.shouldProcessElementRecursive(p)  // true
   */
  shouldProcessElementRecursive(element: Element): boolean {
    let current: Element | null = element

    while (current && current !== document.body) {
      if (!this.shouldProcessElement(current)) {
        return false
      }

      current = current.parentElement
    }

    return true
  }

  /**
   * Batch check multiple elements
   * Optimized for processing arrays of elements
   *
   * @param elements - Array of elements to check
   * @param recursive - Use recursive checking (default: true)
   * @returns Array of elements that should be processed
   *
   * @example
   * const elements = Array.from(document.querySelectorAll('p'))
   * const filtered = filter.filterElements(elements)
   */
  filterElements(elements: Element[], recursive = true): Element[] {
    const checkFn = recursive
      ? this.shouldProcessElementRecursive.bind(this)
      : this.shouldProcessElement.bind(this)

    return elements.filter(checkFn)
  }

  /**
   * Clear caches (useful when config changes)
   */
  clearCache(): void {
    this.blacklistCache = new WeakSet<Element>()
    this.whitelistCache = new WeakSet<Element>()
  }

  /**
   * Update configuration
   * Automatically clears caches when config changes
   *
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<FilterConfig>): void {
    this.config = { ...this.config, ...config }
    this.clearCache()

    logger.debug('ContainerFilter config updated', config)
  }

  /**
   * Get current configuration
   */
  getConfig(): FilterConfig {
    return { ...this.config }
  }

  /**
   * Check if specific selector is in blacklist
   */
  isBlacklisted(selector: string): boolean {
    return this.config.blacklistSelectors.includes(selector)
  }

  /**
   * Check if specific selector is in whitelist
   */
  isWhitelisted(selector: string): boolean {
    return this.config.whitelistSelectors.includes(selector)
  }

  /**
   * Add custom blacklist selector
   */
  addBlacklistSelector(selector: string): void {
    if (!this.config.blacklistSelectors.includes(selector)) {
      this.config.blacklistSelectors.push(selector)
      this.clearCache()
    }
  }

  /**
   * Add custom whitelist selector
   */
  addWhitelistSelector(selector: string): void {
    if (!this.config.whitelistSelectors.includes(selector)) {
      this.config.whitelistSelectors.push(selector)
      this.clearCache()
    }
  }

  /**
   * Remove blacklist selector
   */
  removeBlacklistSelector(selector: string): void {
    const index = this.config.blacklistSelectors.indexOf(selector)
    if (index > -1) {
      this.config.blacklistSelectors.splice(index, 1)
      this.clearCache()
    }
  }

  /**
   * Remove whitelist selector
   */
  removeWhitelistSelector(selector: string): void {
    const index = this.config.whitelistSelectors.indexOf(selector)
    if (index > -1) {
      this.config.whitelistSelectors.splice(index, 1)
      this.clearCache()
    }
  }
}
