const isDebugEnabled = import.meta.env.DEV || import.meta.env.VITE_CRM_DEBUG === 'true';
const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000/api/v1/';
const LOG_ENDPOINT = new URL('debug/frontend-logs/', API_BASE).toString();
const MAX_QUEUE_SIZE = 200;
const MAX_BATCH_SIZE = 50;
let logQueue = [];
let flushTimerId = null;

function normalizePayload(payload) {
  if (payload === undefined) {
    return undefined;
  }

  try {
    const serialized = JSON.stringify(payload);
    if (serialized.length > 8000) {
      return { truncated: true, preview: serialized.slice(0, 8000) };
    }

    return JSON.parse(serialized);
  } catch {
    return { value: String(payload).slice(0, 1000) };
  }
}

function flushQueue() {
  flushTimerId = null;

  if (!isDebugEnabled || logQueue.length === 0) {
    return;
  }

  const events = logQueue.splice(0, MAX_BATCH_SIZE);

  void fetch(LOG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
    keepalive: true,
  }).catch((error) => {
    console.warn('[CRM Customer Directory] Could not write frontend diagnostics', error);
  });

  if (logQueue.length > 0) {
    flushTimerId = window.setTimeout(flushQueue, 250);
  }
}

function queueLog(level, message, payload) {
  if (!isDebugEnabled) {
    return;
  }

  if (logQueue.length >= MAX_QUEUE_SIZE) {
    logQueue.shift();
  }

  logQueue.push({
    timestamp: new Date().toISOString(),
    level,
    message,
    path: window.location.pathname,
    payload: normalizePayload(payload),
  });

  if (flushTimerId === null) {
    flushTimerId = window.setTimeout(flushQueue, 250);
  }
}

function emit(level, message, payload) {
  if (!isDebugEnabled) {
    return;
  }

  const prefix = '[CRM Customer Directory]';

  if (payload === undefined) {
    console[level](`${prefix} ${message}`);
    queueLog(level, message);
    return;
  }

  console[level](`${prefix} ${message}`, payload);
  queueLog(level, message, payload);
}

export function logCustomerRequest(stage, payload) {
  emit('info', `${stage} request`, payload);
}

export function logCustomerResponse(stage, payload) {
  emit('info', `${stage} response`, payload);
}

export function logCustomerWarning(stage, payload) {
  emit('warn', `${stage} warning`, payload);
}

export function logCustomerError(stage, payload) {
  emit('error', `${stage} error`, payload);
}

export function logFrontendEvent(event, payload) {
  emit('info', event, payload);
}

// Capture high-level browser interactions without serializing customer records.
export function initializeFrontendLogging() {
  if (!isDebugEnabled || window.__crmFrontendLoggingInitialized) {
    return;
  }

  window.__crmFrontendLoggingInitialized = true;
  logFrontendEvent('Application started', { path: window.location.pathname });

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const target = event.target.closest('button, a, [data-log-action]');

    if (!target) {
      return;
    }

    logFrontendEvent('UI click', {
      action: target.dataset.logAction || target.textContent?.trim().slice(0, 80),
      element: target.tagName.toLowerCase(),
      id: target.id || undefined,
    });
  });

  document.addEventListener('change', (event) => {
    const target = event.target;

    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
      return;
    }

    logFrontendEvent('UI field changed', {
      id: target.id || undefined,
      type: target.type || target.tagName.toLowerCase(),
      valueLength: String(target.value || '').length,
      value: target instanceof HTMLSelectElement ? target.value : undefined,
    });
  });

  window.addEventListener('error', (event) => {
    logCustomerError('window.error', {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logCustomerError('window.unhandledrejection', {
      message: event.reason?.message || String(event.reason),
    });
  });

  window.addEventListener('pagehide', flushQueue);
}
