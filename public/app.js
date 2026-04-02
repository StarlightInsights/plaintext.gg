// ============================================================
// plaintext.gg — zero-dependency vanilla JS
// ============================================================

/** @typedef {import('./shared.js').Version} Version */
/** @typedef {import('./shared.js').DocumentRecord} DocumentRecord */
/** @typedef {import('./shared.js').SessionDraft} SessionDraft */
/** @typedef {import('./shared.js').SyncMessage} SyncMessage */
/** @typedef {import('./shared.js').Theme} Theme */
/** @typedef {import('./shared.js').FontFamily} FontFamily */

import {
  STORAGE_KEYS, SESSION_KEYS, DEFAULT_FONT_SIZE, FONT_STEP,
  MIN_FONT_SIZE, MAX_FONT_SIZE, DEFAULT_FONT_WEIGHT,
  DEFAULT_FONT_FAMILY, FONT_FAMILY_WEIGHTS,
  COPY_FEEDBACK_MS, PERSIST_DELAY_MS,
  SYNC_CHANNEL, THEME_COLORS, clampFontSize, parseStoredFontSize,
  clampFontWeight, parseStoredFontWeight, parseStoredFontItalic,
  normalizeFontFamily, normalizeTheme, normalizeToolbarVisibility,
  compareVersions, isVersionNewer, toVersion, createRecord
} from './shared.js';

(function () {
  'use strict';

  // ---- localStorage helpers ----

  /**
   * Read a value from localStorage, returning null on any error.
   * @param {string} key
   * @returns {string | null}
   */
  function loadStored(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  /**
   * Write a value to localStorage, silently swallowing errors.
   * @param {string} key
   * @param {string} value
   * @returns {void}
   */
  function saveStored(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  /**
   * Update all theme-color meta tags to the given color.
   * @param {string} color
   * @returns {void}
   */
  function updateThemeColorMeta(color) {
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (el) {
      if (el instanceof HTMLMetaElement) el.content = color;
    });
  }

  // ---- sessionStorage helpers ----

  /**
   * Read the crash-recovery draft from sessionStorage.
   * Returns null if missing, corrupt, or on any error.
   * @returns {SessionDraft | null}
   */
  function readSessionDraft() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEYS.textDraft);
      if (!raw) return null;
      var d = JSON.parse(raw);
      var v = d && d.version;
      if (typeof d.text !== 'string' || !v || typeof v.updatedAt !== 'number' ||
          typeof v.sourceTabId !== 'string' || typeof v.saveSequence !== 'number') return null;
      return { text: d.text, version: toVersion(v) };
    } catch (e) { return null; }
  }

  /**
   * Write a crash-recovery draft to sessionStorage.
   * @param {string} text
   * @param {Version} version
   * @returns {void}
   */
  function writeSessionDraft(text, version) {
    try { sessionStorage.setItem(SESSION_KEYS.textDraft, JSON.stringify({ text: text, version: version })); } catch (e) {}
  }

  /**
   * Remove the crash-recovery draft from sessionStorage.
   * @returns {void}
   */
  function clearSessionDraft() {
    try { sessionStorage.removeItem(SESSION_KEYS.textDraft); } catch (e) {}
  }

  // ---- IndexedDB persistence ----

  /** @type {string} */
  var DB_NAME = 'plaintext';
  /** @type {number} */
  var DB_VERSION = 1;
  /** @type {string} */
  var STORE_NAME = 'documents';
  /** @type {'current'} */
  var RECORD_ID = 'current';
  /** @type {Promise<IDBDatabase> | null} */
  var dbPromise = null;

  /**
   * Reset the cached database promise, cleaning up event handlers.
   * @param {IDBDatabase} [db]
   * @returns {void}
   */
  function resetDb(db) {
    if (db) { db.onclose = null; db.onversionchange = null; }
    dbPromise = null;
  }

  /**
   * Wrap an IDBRequest in a Promise.
   * @template T
   * @param {IDBRequest<T>} req
   * @returns {Promise<T>}
   */
  function wrapRequest(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('IndexedDB request failed.')); };
    });
  }

  /**
   * Open (or reuse) the IndexedDB database connection.
   * @returns {Promise<IDBDatabase>}
   */
  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = function () {
        var db = req.result;
        db.onclose = function () { resetDb(); };
        db.onversionchange = function () { resetDb(db); db.close(); };
        resolve(db);
      };
      req.onerror = function () { resetDb(); reject(req.error || new Error('Failed to open IndexedDB.')); };
      req.onblocked = function () { resetDb(); reject(new Error('IndexedDB upgrade blocked.')); };
    });
    return dbPromise;
  }

  /**
   * Read the current document record from IndexedDB.
   * Returns null if missing or malformed.
   * @returns {Promise<DocumentRecord | null>}
   */
  function readRecord() {
    return openDb().then(function (db) {
      var tx = db.transaction(STORE_NAME, 'readonly');
      var store = tx.objectStore(STORE_NAME);
      return wrapRequest(store.get(RECORD_ID));
    }).then(function (record) {
      if (!record || typeof record !== 'object') return null;
      if (typeof record.text !== 'string' || typeof record.updatedAt !== 'number' ||
          typeof record.sourceTabId !== 'string' || typeof record.saveSequence !== 'number') return null;
      return {
        id: RECORD_ID,
        text: record.text,
        updatedAt: record.updatedAt,
        sourceTabId: record.sourceTabId,
        saveSequence: record.saveSequence
      };
    });
  }

  /**
   * Write a document record to IndexedDB, resolving when the transaction completes.
   * @param {DocumentRecord} record
   * @returns {Promise<DocumentRecord>}
   */
  function writeRecord(record) {
    return openDb().then(function (db) {
      var tx = db.transaction(STORE_NAME, 'readwrite');
      var store = tx.objectStore(STORE_NAME);
      return wrapRequest(store.put(record)).then(function () {
        return new Promise(function (resolve, reject) {
          tx.oncomplete = function () { resolve(record); };
          tx.onerror = function () { reject(tx.error || new Error('IndexedDB transaction failed.')); };
          tx.onabort = function () { reject(tx.error || new Error('IndexedDB transaction aborted.')); };
        });
      });
    });
  }

  // ---- Clipboard helpers ----

  /**
   * Copy plain text to the clipboard, using the best available API.
   * Falls back to execCommand('copy') if the Clipboard API is unavailable.
   * @param {string} value - Text to copy
   * @param {HTMLTextAreaElement} [fallbackEl] - Textarea for execCommand fallback
   * @returns {Promise<boolean>} Whether the copy succeeded
   */
  function copyPlainText(value, fallbackEl) {
    if (navigator.clipboard && window.ClipboardItem && navigator.clipboard.write) {
      var item = new ClipboardItem({ 'text/plain': new Blob([value], { type: 'text/plain' }) });
      return navigator.clipboard.write([item]).then(function () { return true; });
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(value).then(function () { return true; });
    }
    if (!fallbackEl) return Promise.resolve(false);
    var ss = fallbackEl.selectionStart;
    var se = fallbackEl.selectionEnd;
    var sd = fallbackEl.selectionDirection || 'none';
    fallbackEl.focus();
    fallbackEl.select();
    var ok = document.execCommand('copy');
    fallbackEl.setSelectionRange(ss, se, sd);
    return Promise.resolve(ok);
  }

  /**
   * Download text as a .txt file via a temporary anchor element.
   * @param {string} value - Text content to download
   * @param {string} [filename='plaintext.txt'] - Filename for the download
   * @returns {void}
   */
  function downloadFile(value, filename) {
    var blob = new Blob([value], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename || 'plaintext.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ---- File upload helpers ----

  /**
   * Check if a file content appears to be binary by looking for null bytes.
   * @param {string} content
   * @returns {boolean}
   */
  function isBinaryContent(content) {
    for (var i = 0, len = Math.min(content.length, 8192); i < len; i++) {
      if (content.charCodeAt(i) === 0) return true;
    }
    return false;
  }

  /**
   * Read a single File as text. Returns a promise resolving to the text content,
   * or an error placeholder if the file is not a text file.
   * @param {File} file
   * @returns {Promise<string>}
   */
  function readFileAsText(file) {
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = /** @type {string} */ (reader.result);
        if (isBinaryContent(result)) {
          resolve(file.name + ' is not a text file');
        } else {
          resolve(result);
        }
      };
      reader.onerror = function () {
        resolve(file.name + ' is not a text file');
      };
      reader.readAsText(file);
    });
  }

  /**
   * Read multiple files and return their concatenated text content.
   * Non-text files produce a placeholder message.
   * @param {FileList | File[]} files
   * @returns {Promise<string>}
   */
  function readMultipleFiles(files) {
    var promises = [];
    for (var i = 0; i < files.length; i++) {
      promises.push(readFileAsText(files[i]));
    }
    return Promise.all(promises).then(function (results) {
      return results.join('\n');
    });
  }

  /**
   * Insert text at the current cursor position in the editor textarea.
   * Uses execCommand('insertText') to preserve the native undo stack,
   * so Ctrl+Z / Cmd+Z will remove the inserted text in one step.
   * @param {string} content
   * @returns {void}
   */
  function insertTextAtCursor(content) {
    editorEl.focus();
    document.execCommand('insertText', false, content);
  }

  // ---- BroadcastChannel helpers ----

  /**
   * Create a SyncMessage from a version vector for cross-tab broadcasting.
   * @param {Version} version
   * @returns {SyncMessage}
   */
  function createSyncMessage(version) {
    return { type: 'text-updated', updatedAt: version.updatedAt, sourceTabId: version.sourceTabId, saveSequence: version.saveSequence };
  }

  /**
   * Validate and parse a raw BroadcastChannel message into a SyncMessage.
   * Returns null if the message is invalid.
   * @param {unknown} value
   * @returns {SyncMessage | null}
   */
  function parseSyncMessage(value) {
    if (!value || typeof value !== 'object') return null;
    if (/** @type {any} */ (value).type !== 'text-updated') return null;
    var v = /** @type {any} */ (value);
    if (typeof v.updatedAt !== 'number' || typeof v.sourceTabId !== 'string' ||
        typeof v.saveSequence !== 'number') return null;
    return { type: v.type, updatedAt: v.updatedAt, sourceTabId: v.sourceTabId, saveSequence: v.saveSequence };
  }

  // ---- DOM refs ----
  // These elements are guaranteed to exist in the HTML — no null checks needed.

  var appShell = /** @type {HTMLDivElement} */ (document.getElementById('app-shell'));
  var toolbar = /** @type {HTMLElement} */ (document.getElementById('toolbar'));
  var editorEl = /** @type {HTMLTextAreaElement} */ (document.getElementById('editor'));
  var btnInfo = /** @type {HTMLButtonElement} */ (document.getElementById('btn-info'));
  var btnFontUp = /** @type {HTMLButtonElement} */ (document.getElementById('btn-font-up'));
  var btnFontDown = /** @type {HTMLButtonElement} */ (document.getElementById('btn-font-down'));
  var btnSave = /** @type {HTMLButtonElement} */ (document.getElementById('btn-save'));
  var btnCopy = /** @type {HTMLButtonElement} */ (document.getElementById('btn-copy'));
  var btnTheme = /** @type {HTMLButtonElement} */ (document.getElementById('btn-theme'));
  var btnHideMobile = /** @type {HTMLButtonElement} */ (document.getElementById('btn-hide-mobile'));
  var btnToggleDesktop = /** @type {HTMLButtonElement} */ (document.getElementById('btn-toggle-desktop'));
  var btnToggleMobile = /** @type {HTMLButtonElement} */ (document.getElementById('btn-toggle-mobile'));
  var toggleDesktop = /** @type {HTMLDivElement} */ (document.getElementById('toggle-desktop'));
  var toggleMobile = /** @type {HTMLDivElement} */ (document.getElementById('toggle-mobile'));
  var dialogInfo = /** @type {HTMLDialogElement} */ (document.getElementById('dialog-info'));
  var btnUpload = /** @type {HTMLButtonElement} */ (document.getElementById('btn-upload'));
  var fileUpload = /** @type {HTMLInputElement} */ (document.getElementById('file-upload'));
  var iconCopy = /** @type {HTMLElement} */ (document.getElementById('icon-copy'));
  var iconCopyFeedback = /** @type {HTMLElement} */ (document.getElementById('icon-copy-feedback'));
  var iconThemeLight = /** @type {HTMLElement} */ (document.getElementById('icon-theme-light'));
  var iconThemeDark = /** @type {HTMLElement} */ (document.getElementById('icon-theme-dark'));
  var iconEyeOpen = /** @type {HTMLElement} */ (document.getElementById('icon-eye-open'));
  var iconEyeClosed = /** @type {HTMLElement} */ (document.getElementById('icon-eye-closed'));
  var btnSettings = /** @type {HTMLButtonElement} */ (document.getElementById('btn-settings'));
  var dialogSettings = /** @type {HTMLDialogElement} */ (document.getElementById('dialog-settings'));
  var fontSizeValue = /** @type {HTMLElement} */ (document.getElementById('font-size-value'));
  var btnFontMono = /** @type {HTMLButtonElement} */ (document.getElementById('btn-font-mono'));
  var btnFontSans = /** @type {HTMLButtonElement} */ (document.getElementById('btn-font-sans'));
  var btnFontSerif = /** @type {HTMLButtonElement} */ (document.getElementById('btn-font-serif'));
  var btnFontDyslexic = /** @type {HTMLButtonElement} */ (document.getElementById('btn-font-dyslexic'));
  var fontButtons = [btnFontMono, btnFontSans, btnFontSerif, btnFontDyslexic];
  var btnWeightLight = /** @type {HTMLButtonElement} */ (document.getElementById('btn-weight-light'));
  var btnWeightRegular = /** @type {HTMLButtonElement} */ (document.getElementById('btn-weight-regular'));
  var btnWeightBold = /** @type {HTMLButtonElement} */ (document.getElementById('btn-weight-bold'));
  var weightButtons = [btnWeightLight, btnWeightRegular, btnWeightBold];
  var btnItalic = /** @type {HTMLButtonElement} */ (document.getElementById('btn-italic'));
  var btnReset = /** @type {HTMLButtonElement} */ (document.getElementById('btn-reset'));

  // ---- State ----

  /** @type {string} */
  var text = '';
  /** @type {Theme} */
  var theme = normalizeTheme(loadStored(STORAGE_KEYS.theme));
  /** @type {boolean} */
  var showToolbar = normalizeToolbarVisibility(loadStored(STORAGE_KEYS.toolbarIcons));
  /** @type {number} */
  var fontSize = DEFAULT_FONT_SIZE;
  /** @type {number} */
  var _storedSize = parseStoredFontSize(loadStored(STORAGE_KEYS.fontSize));
  if (Number.isFinite(_storedSize)) fontSize = clampFontSize(_storedSize);
  /** @type {number} */
  var fontWeight = parseStoredFontWeight(loadStored(STORAGE_KEYS.fontWeight));
  /** @type {boolean} */
  var fontItalic = parseStoredFontItalic(loadStored(STORAGE_KEYS.fontItalic));
  /** @type {FontFamily} */
  var fontFamily = normalizeFontFamily(loadStored(STORAGE_KEYS.fontFamily));

  /** @type {string} */
  var tabId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'tab-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  /** @type {number} */
  var localSaveSequence = 0;
  /** @type {Version | null} */
  var persistedVersion = null;
  /** @type {Version | null} */
  var pendingVersion = null;
  /** @type {boolean} */
  var hasPendingEdits = false;
  /** @type {number} */
  var persistTimeout = 0;
  /** @type {number} */
  var copyFeedbackTimeout = 0;
  /** @type {Promise<void>} */
  var persistChain = Promise.resolve();
  /** @type {BroadcastChannel | null} */
  var broadcastChannel = null;
  /** @type {boolean} */
  var enableMotion = false;

  // ---- Apply initial state ----

  /**
   * Apply the current theme to the document and update UI indicators.
   * @returns {void}
   */
  function applyTheme() {
    var root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    root.style.backgroundColor = THEME_COLORS[theme];
    updateThemeColorMeta(THEME_COLORS[theme]);

    iconThemeLight.style.display = theme === 'light' ? '' : 'none';
    iconThemeDark.style.display = theme === 'dark' ? '' : 'none';
    btnTheme.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    btnTheme.setAttribute('aria-label', 'Toggle theme. Current theme: ' + theme + '.');
  }

  /**
   * Apply the current font size to the editor and update button disabled states.
   * @returns {void}
   */
  function applyFontSize() {
    editorEl.style.fontSize = fontSize + 'px';
    btnFontUp.disabled = fontSize >= MAX_FONT_SIZE;
    btnFontDown.disabled = fontSize <= MIN_FONT_SIZE;
    fontSizeValue.textContent = fontSize + 'px';
  }

  /**
   * Apply the current font weight to the editor and update the settings UI.
   * @returns {void}
   */
  function applyFontWeight() {
    // Map abstract weight to actual CSS weight for this font
    var weightMap = FONT_WEIGHT_MAP[fontFamily] || FONT_WEIGHT_MAP['mono'];
    var slot = fontWeight === 200 ? 0 : fontWeight === 600 ? 2 : 1;
    editorEl.style.fontWeight = String(weightMap[slot]);
    for (var i = 0; i < weightButtons.length; i++) {
      var active = Number(weightButtons[i].getAttribute('data-weight')) === fontWeight;
      weightButtons[i].setAttribute('aria-checked', active ? 'true' : 'false');
    }
  }

  /**
   * Apply the current italic setting to the editor and update the settings UI.
   * @returns {void}
   */
  function applyFontItalic() {
    editorEl.style.fontStyle = fontItalic ? 'italic' : 'normal';
    btnItalic.setAttribute('aria-checked', fontItalic ? 'true' : 'false');
    btnItalic.textContent = fontItalic ? 'on' : 'off';
  }

  /**
   * Font-family CSS values for the editor textarea.
   * @type {Readonly<Record<string, string>>}
   */
  var FONT_STACK = {
    'mono': '"CommitMono", ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    'sans-serif': '"Roboto", system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
    'serif': '"EBGaramond", "Georgia", "Times New Roman", serif',
    'dyslexic': '"OpenDyslexic", "Comic Sans MS", cursive, sans-serif'
  };

  /**
   * Weight mapping: maps the abstract weight slots (light/regular/bold)
   * to the actual CSS font-weight values for each font family.
   * Index 0 = light, 1 = regular, 2 = bold.
   * @type {Readonly<Record<FontFamily, ReadonlyArray<number>>>}
   */
  var FONT_WEIGHT_MAP = {
    'mono': [200, 300, 600],
    'sans-serif': [200, 300, 400],
    'serif': [400, 400, 500],
    'dyslexic': [400, 400, 700]
  };

  /**
   * Apply the current font family to the editor and update the settings UI.
   * Also updates weight button states for fonts with limited weight support.
   * @returns {void}
   */
  function applyFontFamily() {
    editorEl.style.fontFamily = FONT_STACK[fontFamily] || FONT_STACK['mono'];

    // Update font family radio buttons
    for (var i = 0; i < fontButtons.length; i++) {
      var active = fontButtons[i].getAttribute('data-font') === fontFamily;
      fontButtons[i].setAttribute('aria-checked', active ? 'true' : 'false');
    }

    // Enable/disable weight buttons based on font family support
    var supported = FONT_FAMILY_WEIGHTS[fontFamily] || FONT_FAMILY_WEIGHTS['mono'];
    for (var j = 0; j < weightButtons.length; j++) {
      var w = Number(weightButtons[j].getAttribute('data-weight'));
      var isSupported = false;
      for (var k = 0; k < supported.length; k++) {
        if (supported[k] === w) { isSupported = true; break; }
      }
      weightButtons[j].disabled = !isSupported;
    }

    // Map abstract weight to actual CSS weight for this font
    var weightMap = FONT_WEIGHT_MAP[fontFamily] || FONT_WEIGHT_MAP['mono'];
    var slot = fontWeight === 200 ? 0 : fontWeight === 600 ? 2 : 1;
    editorEl.style.fontWeight = String(weightMap[slot]);
  }

  /**
   * Measure the current toolbar height in pixels (0 if hidden).
   * @returns {number}
   */
  function measureToolbarHeight() {
    if (showToolbar && toolbar && !toolbar.classList.contains('hidden')) {
      return Math.ceil(toolbar.getBoundingClientRect().height);
    }
    return 0;
  }

  /**
   * Adjust editor padding to account for toolbar or floating toggle.
   * @returns {void}
   */
  function applyEditorPadding() {
    if (showToolbar) {
      var h = measureToolbarHeight();
      editorEl.style.paddingTop = (h + 12) + 'px';
      editorEl.style.paddingRight = '';
    } else {
      // When toolbar hidden, leave room for the floating toggle
      editorEl.style.paddingTop = '40px';
      editorEl.style.paddingRight = '56px';
    }
  }

  /**
   * Show or hide the toolbar and update toggle icons/ARIA state.
   * @param {boolean} animate - Whether to play the slide-in animation
   * @returns {void}
   */
  function applyToolbarVisibility(animate) {
    if (showToolbar) {
      toolbar.classList.remove('hidden');
      if (animate && enableMotion) toolbar.classList.add('slide-in');
      toggleMobile.style.display = 'none';
    } else {
      toolbar.classList.add('hidden');
      toolbar.classList.remove('slide-in');
      toggleMobile.style.display = '';
    }

    // Desktop toggle icon
    iconEyeOpen.style.display = showToolbar ? '' : 'none';
    iconEyeClosed.style.display = showToolbar ? 'none' : '';

    btnToggleDesktop.setAttribute('aria-pressed', showToolbar ? 'false' : 'true');
    btnToggleDesktop.setAttribute('aria-label', showToolbar ? 'Hide navigation icons and editor controls' : 'Show navigation icons and editor controls');

    applyEditorPadding();
  }

  // ---- Text persistence logic ----

  /**
   * Create the next version vector, incrementing the local save sequence.
   * @returns {Version}
   */
  function createNextVersion() {
    return { updatedAt: Date.now(), sourceTabId: tabId, saveSequence: ++localSaveSequence };
  }

  /**
   * Cancel any pending debounced persist timer.
   * @returns {void}
   */
  function clearPersistTimer() {
    if (persistTimeout) { clearTimeout(persistTimeout); persistTimeout = 0; }
  }

  /**
   * Schedule a debounced persist of the given text after PERSIST_DELAY_MS.
   * @param {string} nextText
   * @returns {void}
   */
  function schedulePersist(nextText) {
    clearPersistTimer();
    persistTimeout = setTimeout(function () {
      persistTimeout = 0;
      persistText(nextText);
    }, PERSIST_DELAY_MS);
  }

  /**
   * Immediately flush any pending text to IndexedDB (cancels the debounce timer).
   * @returns {Promise<void>}
   */
  function flushPersistence() {
    clearPersistTimer();
    return persistText(text);
  }

  /**
   * Broadcast a version update to other tabs via BroadcastChannel.
   * @param {Version} version
   * @returns {void}
   */
  function broadcastUpdate(version) {
    if (broadcastChannel) {
      broadcastChannel.postMessage(createSyncMessage(version));
    }
  }

  /**
   * Persist text to IndexedDB and broadcast the update. Chains onto persistChain
   * to ensure writes are serialized. No-op if there are no pending edits.
   * @param {string} nextText
   * @returns {Promise<void>}
   */
  function persistText(nextText) {
    if (!hasPendingEdits) return Promise.resolve();

    var nextVersion = pendingVersion || createNextVersion();
    var nextRecord = createRecord(nextText, nextVersion);

    persistChain = persistChain.catch(function () {}).then(function () {
      return writeRecord(nextRecord).then(function (written) {
        var writtenVersion = toVersion(written);
        persistedVersion = writtenVersion;

        if (pendingVersion && compareVersions(pendingVersion, writtenVersion) <= 0) {
          pendingVersion = null;
        }

        if (text === written.text && !pendingVersion) {
          hasPendingEdits = false;
          clearSessionDraft();
        }

        broadcastUpdate(writtenVersion);
      });
    });

    return persistChain.catch(function () {});
  }

  /**
   * Update the editor text and state from a persisted record (IndexedDB or session draft).
   * Preserves cursor position if the editor is focused.
   * @param {string} nextText
   * @param {Version} nextVersion
   * @returns {void}
   */
  function updateTextFromPersistence(nextText, nextVersion) {
    hasPendingEdits = false;
    persistedVersion = nextVersion;

    if (editorEl.value === nextText) {
      text = nextText;
      return;
    }

    var isFocused = document.activeElement === editorEl;
    var ss = editorEl.selectionStart;
    var se = editorEl.selectionEnd;
    var sd = editorEl.selectionDirection || 'none';

    text = nextText;
    editorEl.value = nextText;

    if (isFocused) {
      editorEl.setSelectionRange(
        Math.min(ss, nextText.length),
        Math.min(se, nextText.length),
        sd
      );
    }
  }

  /**
   * Re-read the document from IndexedDB and update the editor if a newer version exists.
   * Skips update if there are pending local edits.
   * @param {Version} [minimumVersion] - If provided, ignore records older than this
   * @returns {Promise<void>}
   */
  function refreshFromPersistence(minimumVersion) {
    return readRecord().then(function (record) {
      if (!record) return;
      var nv = toVersion(record);
      if (minimumVersion && compareVersions(nv, minimumVersion) < 0) return;
      if (!isVersionNewer(nv, persistedVersion)) return;
      if (hasPendingEdits) return;
      clearPersistTimer();
      pendingVersion = null;
      clearSessionDraft();
      updateTextFromPersistence(record.text, nv);
    }).catch(function () {});
  }

  /**
   * Initialize text from persistence on app startup. Recovers from session draft
   * if it's newer than the IndexedDB record, or falls back to IndexedDB.
   * @returns {Promise<void>}
   */
  function initPersistence() {
    var draft = readSessionDraft();

    return readRecord().then(function (record) {
      if (draft && (!record || isVersionNewer(draft.version, record))) {
        updateTextFromPersistence(draft.text, draft.version);
        pendingVersion = draft.version;
        hasPendingEdits = true;
        schedulePersist(draft.text);
        return;
      }

      if (!record) return;

      var nv = toVersion(record);
      if (hasPendingEdits) {
        if (isVersionNewer(nv, persistedVersion)) persistedVersion = nv;
        return;
      }

      pendingVersion = null;
      clearSessionDraft();
      updateTextFromPersistence(record.text, nv);
    }).catch(function () {
      if (!draft) return;
      updateTextFromPersistence(draft.text, draft.version);
      pendingVersion = draft.version;
      hasPendingEdits = true;
      schedulePersist(draft.text);
    });
  }

  // ---- Copy feedback ----

  /**
   * Clear copy feedback styling and reset the copy button to its default state.
   * @returns {void}
   */
  function clearCopyFeedback() {
    if (copyFeedbackTimeout) { clearTimeout(copyFeedbackTimeout); copyFeedbackTimeout = 0; }
    btnCopy.classList.remove('copy-success', 'copy-error');
    btnCopy.setAttribute('aria-label', 'Copy plain text');
    iconCopy.style.display = '';
    iconCopyFeedback.style.display = 'none';
  }

  /**
   * Show copy success or error feedback on the copy button, auto-clearing after COPY_FEEDBACK_MS.
   * @param {boolean} success - Whether the copy operation succeeded
   * @returns {void}
   */
  function showCopyFeedback(success) {
    clearCopyFeedback();
    btnCopy.classList.add(success ? 'copy-success' : 'copy-error');
    btnCopy.setAttribute('aria-label', success ? 'Copied' : 'Copy failed');
    iconCopy.style.display = 'none';
    iconCopyFeedback.style.display = '';
    copyFeedbackTimeout = setTimeout(function () {
      clearCopyFeedback();
      copyFeedbackTimeout = 0;
    }, COPY_FEEDBACK_MS);
  }

  /**
   * Briefly flash the editor background to acknowledge a copy operation.
   * @returns {void}
   */
  function pulseEditor() {
    if (!editorEl.value) return;
    editorEl.classList.remove('editor-copy-feedback');
    void editorEl.offsetWidth;
    editorEl.classList.add('editor-copy-feedback');
  }

  // ---- Event handlers ----

  /**
   * Handle textarea input: update state, create a new version, save draft, and schedule persist.
   * @returns {void}
   */
  function handleInput() {
    text = editorEl.value;
    hasPendingEdits = true;
    pendingVersion = createNextVersion();
    writeSessionDraft(text, pendingVersion);
    schedulePersist(text);
  }

  /**
   * Handle cross-tab localStorage changes for theme, toolbar visibility, and font size.
   * @param {StorageEvent} e
   * @returns {void}
   */
  function handleStorage(e) {
    if (e.storageArea !== localStorage || !e.key) return;

    if (e.key === STORAGE_KEYS.theme) {
      theme = normalizeTheme(e.newValue);
      applyTheme();
      return;
    }

    if (e.key === STORAGE_KEYS.toolbarIcons) {
      showToolbar = normalizeToolbarVisibility(e.newValue);
      applyToolbarVisibility(false);
      return;
    }

    if (e.key === STORAGE_KEYS.fontFamily) {
      fontFamily = normalizeFontFamily(e.newValue);
      // Bump weight to regular if unsupported by new font
      var supported = FONT_FAMILY_WEIGHTS[fontFamily] || FONT_FAMILY_WEIGHTS['mono'];
      var weightOk = false;
      for (var _sw = 0; _sw < supported.length; _sw++) {
        if (supported[_sw] === fontWeight) { weightOk = true; break; }
      }
      if (!weightOk) {
        fontWeight = 300;
        saveStored(STORAGE_KEYS.fontWeight, String(fontWeight));
      }
      applyFontFamily();
      applyFontWeight();
      return;
    }

    if (e.key === STORAGE_KEYS.fontSize) {
      var next = parseStoredFontSize(e.newValue);
      fontSize = Number.isFinite(next) ? clampFontSize(next) : DEFAULT_FONT_SIZE;
      applyFontSize();
      return;
    }

    if (e.key === STORAGE_KEYS.fontWeight) {
      fontWeight = parseStoredFontWeight(e.newValue);
      applyFontWeight();
      return;
    }

    if (e.key === STORAGE_KEYS.fontItalic) {
      fontItalic = parseStoredFontItalic(e.newValue);
      applyFontItalic();
    }
  }

  /**
   * Handle visibility change: flush on hide, refresh on show.
   * @returns {void}
   */
  function handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      flushPersistence();
    } else {
      refreshFromPersistence();
    }
  }

  /**
   * Handle a BroadcastChannel message from another tab. Refreshes from
   * IndexedDB if the incoming version is newer than what we have.
   * @param {MessageEvent} event
   * @returns {void}
   */
  function handleBroadcast(event) {
    var msg = parseSyncMessage(event.data);
    if (!msg || msg.sourceTabId === tabId) return;
    var nv = toVersion(msg);
    if (!isVersionNewer(nv, persistedVersion)) return;
    refreshFromPersistence(nv);
  }

  // ---- Dialog handling ----

  /**
   * Open a dialog as a modal.
   * @param {HTMLDialogElement} dialog
   * @returns {void}
   */
  function openDialog(dialog) {
    dialog.showModal();
  }

  /**
   * Set up a dialog with backdrop-click-to-close and close button behavior.
   * @param {HTMLDialogElement} dialog
   * @returns {void}
   */
  function setupDialog(dialog) {
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) dialog.close();
    });

    var closeBtn = dialog.querySelector('.dialog-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () { dialog.close(); });
    }
  }

  // ---- Toolbar toggle ----

  /**
   * Toggle toolbar visibility and persist the preference to localStorage.
   * @returns {void}
   */
  function toggleToolbar() {
    showToolbar = !showToolbar;
    saveStored(STORAGE_KEYS.toolbarIcons, showToolbar ? 'visible' : 'hidden');
    applyToolbarVisibility(true);
  }

  // ---- Initialize ----

  /**
   * Initialize the application: apply state, bind events, load persisted text, and reveal UI.
   * @returns {void}
   */
  function init() {
    // Apply initial state
    applyTheme();
    applyFontFamily();
    applyFontSize();
    applyFontWeight();
    applyFontItalic();
    applyToolbarVisibility(false);

    // Setup dialogs
    setupDialog(dialogInfo);
    setupDialog(dialogSettings);

    // Button events
    btnInfo.addEventListener('click', function () { openDialog(dialogInfo); });
    btnSettings.addEventListener('click', function () { openDialog(dialogSettings); });

    /**
     * Adjust the font size by a delta and persist the new value.
     * @param {number} delta
     * @returns {void}
     */
    function changeFontSize(delta) {
      fontSize = clampFontSize(fontSize + delta);
      saveStored(STORAGE_KEYS.fontSize, String(fontSize));
      applyFontSize();
    }

    btnFontUp.addEventListener('click', function () { changeFontSize(FONT_STEP); });
    btnFontDown.addEventListener('click', function () { changeFontSize(-FONT_STEP); });

    /**
     * Set the font weight to an exact value and persist it.
     * @param {number} weight
     * @returns {void}
     */
    function setFontWeight(weight) {
      fontWeight = clampFontWeight(weight);
      saveStored(STORAGE_KEYS.fontWeight, String(fontWeight));
      applyFontWeight();
    }

    for (var _fi = 0; _fi < fontButtons.length; _fi++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          fontFamily = /** @type {FontFamily} */ (btn.getAttribute('data-font')) || DEFAULT_FONT_FAMILY;
          // If current weight is unsupported by the new font, bump to regular (300)
          var supported = FONT_FAMILY_WEIGHTS[fontFamily] || FONT_FAMILY_WEIGHTS['mono'];
          var weightSupported = false;
          for (var k = 0; k < supported.length; k++) {
            if (supported[k] === fontWeight) { weightSupported = true; break; }
          }
          if (!weightSupported) {
            fontWeight = 300;
            saveStored(STORAGE_KEYS.fontWeight, String(fontWeight));
            applyFontWeight();
          }
          saveStored(STORAGE_KEYS.fontFamily, fontFamily);
          applyFontFamily();
        });
      })(fontButtons[_fi]);
    }

    for (var _wi = 0; _wi < weightButtons.length; _wi++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          setFontWeight(Number(btn.getAttribute('data-weight')));
        });
      })(weightButtons[_wi]);
    }

    btnItalic.addEventListener('click', function () {
      fontItalic = !fontItalic;
      saveStored(STORAGE_KEYS.fontItalic, String(fontItalic));
      applyFontItalic();
    });

    btnReset.addEventListener('click', function () {
      fontFamily = DEFAULT_FONT_FAMILY;
      fontSize = DEFAULT_FONT_SIZE;
      fontWeight = DEFAULT_FONT_WEIGHT;
      fontItalic = false;
      saveStored(STORAGE_KEYS.fontFamily, fontFamily);
      saveStored(STORAGE_KEYS.fontSize, String(fontSize));
      saveStored(STORAGE_KEYS.fontWeight, String(fontWeight));
      saveStored(STORAGE_KEYS.fontItalic, String(fontItalic));
      applyFontFamily();
      applyFontSize();
      applyFontWeight();
      applyFontItalic();
    });

    btnSave.addEventListener('click', function () { downloadFile(text); });

    // Upload button: trigger hidden file input
    btnUpload.addEventListener('click', function () {
      fileUpload.value = '';
      fileUpload.click();
    });

    // File input change: read selected files and insert at cursor
    fileUpload.addEventListener('change', function () {
      if (!fileUpload.files || fileUpload.files.length === 0) return;
      readMultipleFiles(fileUpload.files).then(function (content) {
        insertTextAtCursor(content);
      });
    });

    // Drag-and-drop on editor
    var editorMain = /** @type {HTMLElement} */ (editorEl.parentElement);

    editorEl.addEventListener('dragover', function (e) {
      if (e.dataTransfer && e.dataTransfer.types.indexOf('Files') !== -1) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        editorMain.classList.add('dragover');
      }
    });

    editorEl.addEventListener('dragleave', function (e) {
      if (e.relatedTarget === null || !editorEl.contains(/** @type {Node} */ (e.relatedTarget))) {
        editorMain.classList.remove('dragover');
      }
    });

    editorEl.addEventListener('drop', function (e) {
      editorMain.classList.remove('dragover');
      if (!e.dataTransfer || !e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
      e.preventDefault();
      readMultipleFiles(e.dataTransfer.files).then(function (content) {
        insertTextAtCursor(content);
      });
    });

    btnCopy.addEventListener('click', function () {
      copyPlainText(text, editorEl).then(function (ok) {
        showCopyFeedback(ok);
        if (ok) pulseEditor();
      }).catch(function () {
        showCopyFeedback(false);
      });
    });

    btnCopy.addEventListener('pointerleave', clearCopyFeedback);

    btnTheme.addEventListener('click', function () {
      theme = theme === 'dark' ? 'light' : 'dark';
      saveStored(STORAGE_KEYS.theme, theme);
      applyTheme();
    });

    btnHideMobile.addEventListener('click', toggleToolbar);
    btnToggleDesktop.addEventListener('click', toggleToolbar);
    btnToggleMobile.addEventListener('click', toggleToolbar);

    // Textarea events
    editorEl.addEventListener('input', handleInput);

    // Window/document events
    window.addEventListener('focus', function () { refreshFromPersistence(); });
    window.addEventListener('storage', handleStorage);
    window.addEventListener('pagehide', function () { flushPersistence(); });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Toolbar slide-in animation cleanup
    toolbar.addEventListener('animationend', function () {
      toolbar.classList.remove('slide-in');
    });

    // BroadcastChannel
    if (typeof BroadcastChannel !== 'undefined') {
      broadcastChannel = new BroadcastChannel(SYNC_CHANNEL);
      broadcastChannel.onmessage = handleBroadcast;
    }

    // Toolbar resize tracking
    if (typeof ResizeObserver !== 'undefined') {
      var observer = new ResizeObserver(function () {
        applyEditorPadding();
      });
      observer.observe(toolbar);
      window.addEventListener('resize', applyEditorPadding);
    }

    // Initialize text from persistence, then reveal the UI
    initPersistence().then(function () {
      return document.fonts ? document.fonts.ready.then(function () {}) : Promise.resolve();
    }).then(function () {
      applyEditorPadding();
      requestAnimationFrame(function () {
        appShell.classList.remove('loading');
        requestAnimationFrame(function () {
          enableMotion = true;
          editorEl.classList.add('motion');
        });
      });
    }).catch(function () {
      // Reveal even if persistence fails
      appShell.classList.remove('loading');
    });

    // Service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
    }
  }

  init();
})();
