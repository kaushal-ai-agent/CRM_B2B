/**
 * logger.js
 * Centralized frontend logging utility.
 * Captures tab clicks, button clicks, API errors, unhandled exceptions,
 * and flushes them to the backend /api/v1/debug/frontend-logs/ endpoint.
 */

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, '')
  : 'http://localhost:8000';

const LOG_ENDPOINT = `${API_BASE}/api/v1/debug/frontend-logs/`;

class FrontendLogger {
  constructor() {
    this.queue = [];
    this.flushTimer = null;
    this.isFlushing = false;
    this.initialized = false;
    this.recentClicks = [];
  }

  init() {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    // 1. Global unhandled error listener
    window.addEventListener('error', (event) => {
      this.error('Uncaught Exception', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack || null,
        recentClicks: this.getRecentClicksContext(),
      });
    });

    // 2. Global unhandled promise rejection listener
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      this.error('Unhandled Promise Rejection', {
        message: typeof reason === 'object' ? reason?.message : String(reason),
        stack: reason?.stack || null,
        recentClicks: this.getRecentClicksContext(),
      });
    });

    // 3. Global click listener for tabs, buttons, links, and action elements
    window.addEventListener(
      'click',
      (event) => {
        try {
          this.handleClickEvent(event);
        } catch {
          // Prevent any logging error from interrupting UI interactions
        }
      },
      true // capture phase to intercept clicks before any component stopPropagation
    );

    // 4. Periodic flush timer (every 1 second)
    this.flushTimer = setInterval(() => {
      this.flush();
    }, 1000);

    // 5. Page unload flush (send remaining logs using sendBeacon)
    window.addEventListener('beforeunload', () => {
      this.flushSync();
    });

    this.info('Frontend logger initialized', { userAgent: navigator.userAgent });
  }

  handleClickEvent(event) {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;

    // Check for interactive elements: button, link, tab, summary, or role="tab" / "button"
    const interactive = target.closest(
      'button, a, [role="tab"], [role="button"], summary, input[type="submit"], input[type="button"], select, [data-tab]'
    );

    if (!interactive) return;

    // Extract human-readable label
    let label = (
      interactive.innerText ||
      interactive.getAttribute('aria-label') ||
      interactive.getAttribute('title') ||
      interactive.getAttribute('placeholder') ||
      interactive.getAttribute('data-tab') ||
      interactive.value ||
      interactive.getAttribute('name') ||
      interactive.id ||
      ''
    )
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 80);

    // If label is still empty (e.g. icon-only button), check child svg
    if (!label) {
      const svg = interactive.querySelector('svg');
      if (svg) {
        label = svg.getAttribute('aria-label') || svg.getAttribute('data-testid') || 'Icon Button';
      }
    }

    const tagName = interactive.tagName.toLowerCase();
    const isNav = Boolean(interactive.closest('nav, aside'));
    const isTab =
      interactive.getAttribute('role') === 'tab' ||
      interactive.hasAttribute('data-tab') ||
      (interactive.className && typeof interactive.className === 'string' && /tab/i.test(interactive.className)) ||
      Boolean(interactive.closest('[role="tablist"]')) ||
      (tagName === 'a' && isNav) ||
      (label && /^(dataset|runs|evaluation runs|orders|invoices|ai chat|interactions|owner|team)$/i.test(label));

    let action = 'Button Click';
    if (isNav) {
      action = 'Nav Tab Click';
    } else if (isTab) {
      action = 'Tab Click';
    } else if (tagName === 'a') {
      action = 'Link Click';
    }

    const clickRecord = {
      timestamp: new Date().toISOString(),
      action,
      element: tagName,
      label: label || '(unlabeled element)',
      href: interactive.getAttribute('href') || undefined,
      path: window.location.pathname,
      targetId: interactive.id || undefined,
    };

    // Keep ring buffer of recent clicks for root-cause error tracebacks (last 10)
    this.recentClicks.push(clickRecord);
    if (this.recentClicks.length > 10) {
      this.recentClicks.shift();
    }

    this.enqueue({
      level: 'info',
      message: `${clickRecord.action}: "${clickRecord.label}"`,
      payload: {
        action: clickRecord.action,
        label: clickRecord.label,
        element: clickRecord.element,
        href: clickRecord.href,
        id: clickRecord.targetId,
      },
    });
  }

  getRecentClicksContext() {
    return [...this.recentClicks];
  }

  getActionTraceback() {
    if (!this.recentClicks || this.recentClicks.length === 0) {
      return 'No user actions recorded prior to event.';
    }
    return this.recentClicks
      .map((c, i) => `[${i + 1}] ${c.action}: "${c.label}" (${c.path})`)
      .join(' -> ');
  }

  log(level, message, payload = {}) {
    this.enqueue({ level, message, payload });
  }

  info(message, payload = {}) {
    this.enqueue({ level: 'info', message, payload });
  }

  warn(message, payload = {}) {
    this.enqueue({ level: 'warn', message, payload });
  }

  error(message, payload = {}) {
    // Automatically inject recent actions traceback to identify root cause
    if (!payload.actionTraceback) {
      payload.actionTraceback = this.getActionTraceback();
    }
    if (!payload.recentActions) {
      payload.recentActions = this.getRecentClicksContext();
    }

    this.enqueue({ level: 'error', message, payload });
    // Immediately flush errors so they are logged right away
    this.flush();
  }

  debug(message, payload = {}) {
    this.enqueue({ level: 'debug', message, payload });
  }

  enqueue(entry) {
    const record = {
      timestamp: new Date().toISOString(),
      level: entry.level || 'info',
      message: entry.message || '',
      path: typeof window !== 'undefined' ? window.location.pathname : '',
      payload: entry.payload || {},
    };

    // Mirror to developer browser console for immediate visibility
    const consolePrefix = `[SalesOS Logger] [${record.level.toUpperCase()}]`;
    if (record.level === 'error') {
      console.error(consolePrefix, record.message, record.payload);
    } else if (record.level === 'warn') {
      console.warn(consolePrefix, record.message, record.payload);
    } else {
      console.log(consolePrefix, record.message, record.payload);
    }

    this.queue.push(record);
    if (this.queue.length >= 25) {
      this.flush();
    }
  }

  async flush() {
    if (this.queue.length === 0 || this.isFlushing) return;

    this.isFlushing = true;
    const batch = this.queue.splice(0, 30);

    try {
      await fetch(LOG_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
      });
    } catch (err) {
      // Re-queue events if network temporarily failed, capped at 50 to avoid memory buildup
      if (this.queue.length < 50) {
        this.queue.unshift(...batch);
      }
    } finally {
      this.isFlushing = false;
    }
  }

  flushSync() {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, 50);

    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({ events: batch })], {
          type: 'application/json',
        });
        navigator.sendBeacon(LOG_ENDPOINT, blob);
      }
    } catch {
      // Fallback ignore on unload
    }
  }
}

const logger = new FrontendLogger();
export default logger;
