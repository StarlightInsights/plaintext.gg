// ============================================================
// plaintext.gg — zero-dependency vanilla JS
// ============================================================

(function () {
  'use strict';

  // ---- Constants ----

  var STORAGE_KEYS = {
    theme: 'plaintext:theme',
    fontSize: 'plaintext:fontSize',
    toolbarIcons: 'plaintext:toolbarIcons'
  };

  var SESSION_KEYS = {
    textDraft: 'plaintext:textDraft'
  };

  var DEFAULT_FONT_SIZE = 14;
  var FONT_STEP = 2;
  var MIN_FONT_SIZE = 10;
  var MAX_FONT_SIZE = 34;
  var COPY_FEEDBACK_MS = 400;
  var PERSIST_DELAY_MS = 300;
  var SYNC_CHANNEL = 'plaintext:text-sync';
  var THEME_COLORS = { light: '#fffdf7', dark: '#38342e' };

  // ---- Utility functions ----

  function clampFontSize(n) {
    return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, n));
  }

  function parseStoredFontSize(v) {
    return v === null ? NaN : Number(v);
  }

  function normalizeTheme(v) {
    return v === 'dark' ? 'dark' : 'light';
  }

  function normalizeToolbarVisibility(v) {
    return v === 'visible';
  }

  function compareVersions(a, b) {
    if (!a && !b) return 0;
    if (!a) return -1;
    if (!b) return 1;
    if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt;
    if (a.sourceTabId !== b.sourceTabId) return a.sourceTabId.localeCompare(b.sourceTabId);
    return a.saveSequence - b.saveSequence;
  }

  function isVersionNewer(candidate, current) {
    return compareVersions(candidate, current) > 0;
  }

  function toVersion(v) {
    return { updatedAt: v.updatedAt, sourceTabId: v.sourceTabId, saveSequence: v.saveSequence };
  }

  // ---- localStorage helpers ----

  function loadStored(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function saveStored(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  function updateThemeColorMeta(color) {
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (el) {
      if (el instanceof HTMLMetaElement) el.content = color;
    });
  }

  // ---- sessionStorage helpers ----

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

  function writeSessionDraft(text, version) {
    try { sessionStorage.setItem(SESSION_KEYS.textDraft, JSON.stringify({ text: text, version: version })); } catch (e) {}
  }

  function clearSessionDraft() {
    try { sessionStorage.removeItem(SESSION_KEYS.textDraft); } catch (e) {}
  }

  // ---- IndexedDB persistence ----

  var DB_NAME = 'plaintext';
  var DB_VERSION = 1;
  var STORE_NAME = 'documents';
  var RECORD_ID = 'current';
  var dbPromise = null;

  function resetDb(db) {
    if (db) { db.onclose = null; db.onversionchange = null; }
    dbPromise = null;
  }

  function wrapRequest(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('IndexedDB request failed.')); };
    });
  }

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

  function createRecord(text, version) {
    return {
      id: RECORD_ID,
      text: text,
      updatedAt: version.updatedAt,
      sourceTabId: version.sourceTabId,
      saveSequence: version.saveSequence
    };
  }

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

  // ---- BroadcastChannel helpers ----

  function createSyncMessage(version) {
    return { type: 'text-updated', updatedAt: version.updatedAt, sourceTabId: version.sourceTabId, saveSequence: version.saveSequence };
  }

  function parseSyncMessage(value) {
    if (!value || typeof value !== 'object') return null;
    if (value.type !== 'text-updated') return null;
    if (typeof value.updatedAt !== 'number' || typeof value.sourceTabId !== 'string' ||
        typeof value.saveSequence !== 'number') return null;
    return { type: value.type, updatedAt: value.updatedAt, sourceTabId: value.sourceTabId, saveSequence: value.saveSequence };
  }

  // ---- DOM refs ----

  var appShell = document.getElementById('app-shell');
  var toolbar = document.getElementById('toolbar');
  var editorEl = document.getElementById('editor');
  var btnInfo = document.getElementById('btn-info');
  var btnPrivacy = document.getElementById('btn-privacy');
  var btnThanks = document.getElementById('btn-thanks');
  var btnFontUp = document.getElementById('btn-font-up');
  var btnFontDown = document.getElementById('btn-font-down');
  var btnSave = document.getElementById('btn-save');
  var btnCopy = document.getElementById('btn-copy');
  var btnTheme = document.getElementById('btn-theme');
  var btnHideMobile = document.getElementById('btn-hide-mobile');
  var btnToggleDesktop = document.getElementById('btn-toggle-desktop');
  var btnToggleMobile = document.getElementById('btn-toggle-mobile');
  var toggleDesktop = document.getElementById('toggle-desktop');
  var toggleMobile = document.getElementById('toggle-mobile');
  var dialogInfo = document.getElementById('dialog-info');
  var dialogPrivacy = document.getElementById('dialog-privacy');
  var dialogThanks = document.getElementById('dialog-thanks');
  var iconCopy = document.getElementById('icon-copy');
  var iconCopyFeedback = document.getElementById('icon-copy-feedback');
  var iconThemeLight = document.getElementById('icon-theme-light');
  var iconThemeDark = document.getElementById('icon-theme-dark');
  var iconEyeOpen = document.getElementById('icon-eye-open');
  var iconEyeClosed = document.getElementById('icon-eye-closed');

  // ---- State ----

  var text = '';
  var theme = normalizeTheme(loadStored(STORAGE_KEYS.theme));
  var showToolbar = normalizeToolbarVisibility(loadStored(STORAGE_KEYS.toolbarIcons));
  var fontSize = DEFAULT_FONT_SIZE;
  var _storedSize = parseStoredFontSize(loadStored(STORAGE_KEYS.fontSize));
  if (Number.isFinite(_storedSize)) fontSize = clampFontSize(_storedSize);

  var tabId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'tab-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  var localSaveSequence = 0;
  var persistedVersion = null;
  var pendingVersion = null;
  var hasPendingEdits = false;
  var persistTimeout = 0;
  var copyFeedbackTimeout = 0;
  var persistChain = Promise.resolve();
  var broadcastChannel = null;
  var enableMotion = false;

  // ---- Apply initial state ----

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

  function applyFontSize() {
    editorEl.style.fontSize = fontSize + 'px';
    btnFontUp.disabled = fontSize >= MAX_FONT_SIZE;
    btnFontDown.disabled = fontSize <= MIN_FONT_SIZE;
  }

  function measureToolbarHeight() {
    if (showToolbar && toolbar && !toolbar.classList.contains('hidden')) {
      return Math.ceil(toolbar.getBoundingClientRect().height);
    }
    return 0;
  }

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

  function createNextVersion() {
    return { updatedAt: Date.now(), sourceTabId: tabId, saveSequence: ++localSaveSequence };
  }

  function clearPersistTimer() {
    if (persistTimeout) { clearTimeout(persistTimeout); persistTimeout = 0; }
  }

  function schedulePersist(nextText) {
    clearPersistTimer();
    persistTimeout = setTimeout(function () {
      persistTimeout = 0;
      persistText(nextText);
    }, PERSIST_DELAY_MS);
  }

  function flushPersistence() {
    clearPersistTimer();
    return persistText(text);
  }

  function broadcastUpdate(version) {
    if (broadcastChannel) {
      broadcastChannel.postMessage(createSyncMessage(version));
    }
  }

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

  function clearCopyFeedback() {
    if (copyFeedbackTimeout) { clearTimeout(copyFeedbackTimeout); copyFeedbackTimeout = 0; }
    btnCopy.classList.remove('copy-success', 'copy-error');
    btnCopy.setAttribute('aria-label', 'Copy plain text');
    iconCopy.style.display = '';
    iconCopyFeedback.style.display = 'none';
  }

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

  function pulseEditor() {
    if (!editorEl.value) return;
    editorEl.classList.remove('editor-copy-feedback');
    void editorEl.offsetWidth;
    editorEl.classList.add('editor-copy-feedback');
  }

  // ---- Event handlers ----

  function handleInput() {
    text = editorEl.value;
    hasPendingEdits = true;
    pendingVersion = createNextVersion();
    writeSessionDraft(text, pendingVersion);
    schedulePersist(text);
  }

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

    if (e.key === STORAGE_KEYS.fontSize) {
      var next = parseStoredFontSize(e.newValue);
      fontSize = Number.isFinite(next) ? clampFontSize(next) : DEFAULT_FONT_SIZE;
      applyFontSize();
    }
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      flushPersistence();
    } else {
      refreshFromPersistence();
    }
  }

  function handleBroadcast(event) {
    var msg = parseSyncMessage(event.data);
    if (!msg || msg.sourceTabId === tabId) return;
    var nv = toVersion(msg);
    if (!isVersionNewer(nv, persistedVersion)) return;
    refreshFromPersistence(nv);
  }

  // ---- Dialog handling ----

  function openDialog(dialog) {
    dialog.showModal();
  }

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

  function toggleToolbar() {
    showToolbar = !showToolbar;
    saveStored(STORAGE_KEYS.toolbarIcons, showToolbar ? 'visible' : 'hidden');
    applyToolbarVisibility(true);
  }

  // ---- Initialize ----

  function init() {
    // Apply initial state
    applyTheme();
    applyFontSize();
    applyToolbarVisibility(false);

    // Setup dialogs
    setupDialog(dialogInfo);
    setupDialog(dialogPrivacy);
    setupDialog(dialogThanks);

    // Button events
    btnInfo.addEventListener('click', function () { openDialog(dialogInfo); });
    btnPrivacy.addEventListener('click', function () { openDialog(dialogPrivacy); });
    btnThanks.addEventListener('click', function () { openDialog(dialogThanks); });

    btnFontUp.addEventListener('click', function () {
      fontSize = clampFontSize(fontSize + FONT_STEP);
      saveStored(STORAGE_KEYS.fontSize, String(fontSize));
      applyFontSize();
    });

    btnFontDown.addEventListener('click', function () {
      fontSize = clampFontSize(fontSize - FONT_STEP);
      saveStored(STORAGE_KEYS.fontSize, String(fontSize));
      applyFontSize();
    });

    btnSave.addEventListener('click', function () { downloadFile(text); });

    btnCopy.addEventListener('click', function () {
      copyPlainText(text, editorEl).then(function (ok) {
        showCopyFeedback(ok);
        if (ok) pulseEditor();
      }).catch(function () {
        showCopyFeedback(false);
      });
    });

    btnCopy.addEventListener('mouseleave', clearCopyFeedback);

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
      return document.fonts ? document.fonts.ready : Promise.resolve();
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
      navigator.serviceWorker.register('/sw.js');
    }
  }

  init();
})();
