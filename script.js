/* ═══════════════════════════════════════════════════════════════
   CodeForge — script.js  (Complete rewrite)
   C++ Browser IDE · Piston + Wandbox · ForgeAI (Groq)
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     1. CONSTANTS
     ══════════════════════════════════════════════════════════════ */
  const PISTON_BASE = 'https://emkc.org/api/v2/piston';
  const WANDBOX_URL = 'https://wandbox.org/api/compile.json';
  const GROQ_URL    = 'https://api.groq.com/openai/v1/chat/completions';
  const OPENAI_URL  = 'https://api.openai.com/v1/chat/completions';
  const GEMINI_FILE_URL = 'https://generativelanguage.googleapis.com/upload/v1beta/files';
  const ASSISTANT_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
  const GEMINI_MODEL_CATALOG = [
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', rpm: 15, rpd: 1000 },
    { value: 'gemini-2.5-flash',      label: 'Gemini 2.5 Flash',      rpm: 10, rpd: 250  },
    { value: 'gemini-2.5-pro',        label: 'Gemini 2.5 Pro',        rpm: 5,  rpd: 100  }
  ];
  const ASSISTANT_MODELS = [
    { id: 'assistant:max', provider: 'smart', model: 'assistant:max', label: 'Recommended - Max', supportsImages: true, supportsPdf: true },
    { id: 'groq:meta-llama/llama-4-scout-17b-16e-instruct', provider: 'groq', model: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Groq - Llama 4 Scout', supportsImages: true, supportsPdf: false },
    { id: 'groq:openai/gpt-oss-120b', provider: 'groq', model: 'openai/gpt-oss-120b', label: 'Groq - GPT OSS 120B', supportsImages: false, supportsPdf: false },
    { id: 'groq:openai/gpt-oss-20b', provider: 'groq', model: 'openai/gpt-oss-20b', label: 'Groq - GPT OSS 20B', supportsImages: false, supportsPdf: false },
    { id: 'groq:moonshotai/kimi-k2-instruct', provider: 'groq', model: 'moonshotai/kimi-k2-instruct', label: 'Groq - Kimi K2', supportsImages: false, supportsPdf: false },
    { id: 'groq:qwen/qwen3-32b', provider: 'groq', model: 'qwen/qwen3-32b', label: 'Groq - Qwen3 32B', supportsImages: false, supportsPdf: false },
    { id: 'groq:llama-3.3-70b-versatile', provider: 'groq', model: 'llama-3.3-70b-versatile', label: 'Groq - Llama 3.3 70B Versatile', supportsImages: false, supportsPdf: false },
    { id: 'groq:llama-3.1-8b-instant', provider: 'groq', model: 'llama-3.1-8b-instant', label: 'Groq - Llama 3.1 8B Instant', supportsImages: false, supportsPdf: false },
    { id: 'openai:gpt-4.1-mini', provider: 'openai', model: 'gpt-4.1-mini', label: 'OpenAI - GPT-4.1 mini', supportsImages: true, supportsPdf: false }
  ];

  const TEMPLATES = {
    hello: {
      name: '✦ Hello World',
      code:
        '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}\n'
    },
    cp: {
      name: '⚡ Competitive',
      code:
        '#include <bits/stdc++.h>\nusing namespace std;\n\n#define ll long long\n#define pb push_back\n#define all(x) (x).begin(), (x).end()\n\nvoid solve() {\n    // Your solution here\n\n}\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n\n    int t;\n    cin >> t;\n    while (t--) {\n        solve();\n    }\n    return 0;\n}\n'
    },
    oop: {
      name: '◈ OOP / Class',
      code:
        '#include <iostream>\n#include <string>\nusing namespace std;\n\nclass Shape {\npublic:\n    virtual double area() const = 0;\n    virtual void print() const {\n        cout << "Area = " << area() << endl;\n    }\n    virtual ~Shape() = default;\n};\n\nclass Circle : public Shape {\n    double r;\npublic:\n    Circle(double radius) : r(radius) {}\n    double area() const override {\n        return 3.14159265358979 * r * r;\n    }\n};\n\nclass Rectangle : public Shape {\n    double w, h;\npublic:\n    Rectangle(double w, double h) : w(w), h(h) {}\n    double area() const override { return w * h; }\n};\n\nint main() {\n    Circle c(5.0);\n    Rectangle r(4.0, 6.0);\n    c.print();\n    r.print();\n    return 0;\n}\n'
    },
    stl: {
      name: '▤ STL / Containers',
      code:
        '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // Vector\n    vector<int> v = {5, 3, 1, 4, 2};\n    sort(v.begin(), v.end());\n    for (int x : v) cout << x << " ";\n    cout << endl;\n\n    // Map\n    map<string, int> freq;\n    freq["apple"]++;\n    freq["banana"] += 2;\n    freq["apple"]++;\n    for (auto& [k, val] : freq)\n        cout << k << ": " << val << endl;\n\n    // Set\n    set<int> s = {1, 2, 3, 2, 1};\n    cout << "Unique count: " << s.size() << endl;\n\n    return 0;\n}\n'
    }
  };

  /* ══════════════════════════════════════════════════════════════
     2. STORAGE HELPERS
     ══════════════════════════════════════════════════════════════ */
  const S = {
    theme:       'cf4_theme',
    std:         'cf4_std',
    groqKey:     'cf4_groq_key',
    model:       'cf4_model',
    files:       'cf4_files',
    active:      'cf4_active',
    flags:       'cf4_flags',
    convos:      'cf4_convos',
    activeConvo: 'cf4_active_convo',
    assistantConvos: 'cf4_assistant_conversations',
    assistantCurrent: 'cf4_assistant_current',
    assistantUi: 'cf4_assistant_ui',
    assistantThread: 'cf4_assistant_thread',
    providerVault: 'cf4_provider_keys',
    geminiModel: 'cf4_gemini_model',
    geminiUsage: 'cf4_gemini_usage',
    audioModel: 'cf4_audio_model'
  };

  function get(k, d)     { try { const v = localStorage.getItem(k); return v !== null ? v : d; } catch { return d; } }
  function set(k, v)     { try { localStorage.setItem(k, String(v)); } catch {} }
  function getJson(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }
  function setJson(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  function uid()         { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ══════════════════════════════════════════════════════════════
     3. STATE
     ══════════════════════════════════════════════════════════════ */
  const state = {
    monacoReady:   false,
    editor:        null,
    theme:         get(S.theme,   'dark'),
    std:           get(S.std,     'c++17'),
    groqKey:       get(S.groqKey, ''),
    model:         get(S.model,   'assistant:max'),
    flags:         getJson(S.flags, { wall: true, wextra: false, o0: false, o2: true, g: false }),
    files:         getJson(S.files, []),
    activeId:      get(S.active,  ''),
    running:       false,
    aiSending:     false,
    lastResult:    null,
    conversations: getJson(S.convos, []),
    activeConvoId: get(S.activeConvo, ''),
    stdinCollapsed:false,
    providerKeys:  getJson(S.providerVault, { groq: [], gemini: [], openai: [] }),
    geminiModel:   get(S.geminiModel, 'gemini-2.5-flash-lite'),
    geminiUsage:   getJson(S.geminiUsage, {}),
    audioModel:    get(S.audioModel, 'whisper-large-v3-turbo'),
    assistant: {
      isOpen: false,
      minimized: true,
      maximized: false,
      showHistory: false,
      isSending: false,
      isListening: false,
      unread: 0,
      model: get(S.model, 'assistant:max'),
      draft: (() => { try { return sessionStorage.getItem('cf4_assistant_draft') || ''; } catch { return ''; } })(),
      pendingAttachments: [],
      currentConversationId: get(S.assistantCurrent, get(S.activeConvo, '')),
      conversations: getJson(S.assistantConvos, getJson(S.convos, [])),
      ui: getJson(S.assistantUi, {}),
      thread: getJson(S.assistantThread, [])
    }
  };

  /* ══════════════════════════════════════════════════════════════
     4. DOM HELPERS
     ══════════════════════════════════════════════════════════════ */
  const $  = (id) => document.getElementById(id);
  const $$ = (s)  => document.querySelectorAll(s);

  function dispatchCodeForgeEvent(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent('codeforge:' + name, { detail: detail || {} }));
    } catch {}
  }

  function escHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function unescHtml(s) {
    const el = document.createElement('textarea');
    el.innerHTML = s;
    return el.value;
  }

  /* ══════════════════════════════════════════════════════════════
     5. FILE MANAGEMENT
     ══════════════════════════════════════════════════════════════ */
  function saveFiles() { setJson(S.files, state.files); }

  function activeFile() {
    return state.files.find(f => f.id === state.activeId) || state.files[0] || null;
  }

  function ensureFiles() {
    if (!state.files.length) {
      const f = { id: uid(), name: 'main.cpp', content: TEMPLATES.cp.code, tests: [] };
      state.files = [f];
      state.activeId = f.id;
      set(S.active, f.id);
      saveFiles();
    }
    if (!state.files.find(f => f.id === state.activeId)) {
      state.activeId = state.files[0].id;
      set(S.active, state.activeId);
    }
  }

  function syncEditorToFile() {
    if (!state.editor) return;
    const f = activeFile();
    if (f) { f.content = state.editor.getValue(); saveFiles(); }
  }

  function openFile(id) {
    syncEditorToFile();
    const f = state.files.find(x => x.id === id);
    if (!f) return;
    state.activeId = id;
    set(S.active, id);
    if (state.editor) {
      state.editor.setValue(f.content || '');
      state.editor.setScrollPosition({ scrollTop: 0 });
    }
    renderTabs();
    renderTests();
    document.title = f.name + ' — CodeForge';
  }

  function createFile(name, tmplKey) {
    syncEditorToFile();
    const t = TEMPLATES[tmplKey] || TEMPLATES.hello;
    const safeName = name.trim().endsWith('.cpp') ? name.trim() : name.trim() + '.cpp';
    const f = { id: uid(), name: safeName, content: t.code, tests: [] };
    state.files.push(f);
    state.activeId = f.id;
    set(S.active, f.id);
    if (state.editor) state.editor.setValue(f.content);
    saveFiles();
    renderTabs();
    renderTests();
    document.title = f.name + ' — CodeForge';
    return f;
  }

  function deleteFile(id) {
    if (state.files.length <= 1) { showToast('Cannot delete the last file', 'warn'); return; }
    const idx = state.files.findIndex(f => f.id === id);
    state.files.splice(idx, 1);
    if (state.activeId === id) {
      const nf = state.files[Math.min(idx, state.files.length - 1)];
      state.activeId = nf.id;
      set(S.active, nf.id);
      if (state.editor) state.editor.setValue(nf.content || '');
    }
    saveFiles();
    renderTabs();
    renderTests();
  }

  /* ══════════════════════════════════════════════════════════════
     6. COMPILER FLAGS
     ══════════════════════════════════════════════════════════════ */
  function buildFlags() {
    const f = state.flags;
    const flags = ['-std=' + state.std];
    if (f.wall)   flags.push('-Wall');
    if (f.wextra) flags.push('-Wextra');
    if (f.o0)     flags.push('-O0');
    if (f.o2)     flags.push('-O2');
    if (f.g)      flags.push('-g');
    return flags;
  }

  /* ══════════════════════════════════════════════════════════════
     7. CODE EXECUTION — Piston (primary) → Wandbox (fallback)
     ══════════════════════════════════════════════════════════════ */
  async function runPiston(code, stdin, compileOnly) {
    const res = await fetch(PISTON_BASE + '/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: 'c++',
        version: '*',
        files: [{ name: 'main.cpp', content: code }],
        stdin: stdin || '',
        compile_timeout: 15000,
        run_timeout: compileOnly ? 1 : 10000
      }),
      signal: AbortSignal.timeout(25000)
    });
    if (!res.ok) throw new Error('Piston HTTP ' + res.status);
    const d = await res.json();
    const compile = d.compile || {};
    const run     = d.run     || {};
    const stdout   = compileOnly ? (compile.stdout || '') : (run.stdout  || '');
    const stderr   = (compile.stderr || '') + (compileOnly ? '' : (run.stderr || ''));
    const exitCode = compileOnly ? (compile.code ?? 0) : (run.code ?? compile.code ?? 0);
    return { provider: 'Piston', stdout, stderr, exitCode, status: exitCode === 0 ? 'ok' : 'err' };
  }

  async function runWandbox(code, stdin, compileOnly) {
    const res = await fetch(WANDBOX_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        compiler: 'gcc-head',
        stdin: stdin || '',
        options: 'warning',
        'compiler-option-raw': buildFlags().join('\n'),
        save: false
      }),
      signal: AbortSignal.timeout(35000)
    });
    if (!res.ok) throw new Error('Wandbox HTTP ' + res.status);
    const d = await res.json();
    const compErr = d.compiler_error  || '';
    const compOut = d.compiler_output || '';
    const progOut = d.program_output  || '';
    const progErr = d.program_error   || '';
    const st      = parseInt(d.status || '0', 10);
    const hasCompileError = /error:/i.test(compErr);
    const stdout   = compileOnly ? compOut : progOut;
    const stderr   = compErr + (compileOnly ? '' : progErr);
    const exitCode = compileOnly ? (hasCompileError ? 1 : 0) : st;
    return { provider: 'Wandbox', stdout, stderr, exitCode, status: exitCode === 0 ? 'ok' : 'err' };
  }

  async function executeCode(compileOnly) {
    if (state.running) return;
    syncEditorToFile();
    const f = activeFile();
    if (!f || !(f.content || '').trim()) {
      showToast('Write some C++ code first!', 'warn');
      return;
    }
    const code  = f.content;
    const stdin = ($('stdin-input') || {}).value || '';

    state.running = true;
    setRunUi(true, compileOnly);
    clearMarkers();
    const statsEl = $('exec-stats');
    if (statsEl) statsEl.innerHTML = '';

    let result = null;
    try   { result = await runPiston(code, stdin, compileOnly); }
    catch (e) { console.warn('[CF] Piston:', e.message); }

    if (!result) {
      try   { result = await runWandbox(code, stdin, compileOnly); }
      catch (e) { console.warn('[CF] Wandbox:', e.message); }
    }

    state.running = false;
    setRunUi(false, false);

    if (!result) {
      result = {
        provider: '—', stdout: '', exitCode: -1, status: 'err',
        stderr: 'Both Piston and Wandbox are unreachable.\nCheck your internet connection and try again.'
      };
    }

    state.lastResult = result;
    showResult(result, compileOnly);
    const diags = parseGccErrors(result.stderr);
    applyMarkers(diags);
    renderDiagnostics(diags, result);
    dispatchCodeForgeEvent('run-complete', {
      compileOnly: !!compileOnly,
      success: result.exitCode === 0,
      result: JSON.parse(JSON.stringify(result))
    });
  }

  function setRunUi(running, compileOnly) {
    const btn  = $('run-btn');
    const cbtn = $('compile-btn');
    if (btn) {
      btn.disabled = running;
      btn.innerHTML = running
        ? '<span class="spinner"></span> ' + (compileOnly ? 'Compiling…' : 'Running…')
        : '<svg class="run-icon" width="11" height="11" viewBox="0 0 12 12"><polygon points="2,1 11,6 2,11" fill="currentColor"/></svg> Run';
    }
    if (cbtn) cbtn.disabled = running;
  }

  /* ══════════════════════════════════════════════════════════════
     8. RESULT DISPLAY
     ══════════════════════════════════════════════════════════════ */
  function showResult(result, compileOnly) {
    const outEl   = $('output-content');
    const statsEl = $('exec-stats');
    const isOk       = result.exitCode === 0;
    const hasStdout  = (result.stdout || '').trim().length > 0;
    const hasStderr  = (result.stderr || '').trim().length > 0;
    const isCompErr  = hasStderr && /error:/i.test(result.stderr);
    const isRteErr   = !isOk && !isCompErr && hasStderr;

    if (statsEl) {
      let label, cls;
      if (isOk && compileOnly)  { label = '✓ COMPILED';       cls = 'ok';  }
      else if (isOk)            { label = '✓ SUCCESS';         cls = 'ok';  }
      else if (isCompErr)       { label = '✗ COMPILE ERROR';   cls = 'err'; }
      else if (isRteErr)        { label = '✗ RUNTIME ERROR';   cls = 'err'; }
      else                      { label = '✗ ERROR';           cls = 'err'; }
      statsEl.innerHTML =
        '<span class="exec-badge ' + cls + '">' + label + '</span>' +
        '<span class="exec-exit">EXIT ' + escHtml(String(result.exitCode)) + '</span>' +
        '<span class="exec-provider">via ' + escHtml(result.provider) + '</span>';
    }

    if (outEl) {
      if (hasStdout) {
        outEl.innerHTML = '<pre class="terminal-out">' + escHtml(result.stdout) + '</pre>';
      } else if (isOk) {
        outEl.innerHTML = '<div class="empty-state"><p>Program ran successfully — no stdout output.</p></div>';
      } else {
        outEl.innerHTML = '<div class="empty-state"><p>No stdout output. Check the Errors tab.</p></div>';
      }
    }
    switchOutputTab(!isOk && hasStderr ? 'errors' : 'output');
  }

  /* ══════════════════════════════════════════════════════════════
     9. GCC ERROR PARSER
     ══════════════════════════════════════════════════════════════ */
  function parseGccErrors(stderr) {
    if (!stderr) return [];
    const diags = [];
    const re = /^(?:.*\/)?(?:main\.cpp|prog\.cc?|a\.cpp|[^:\s]+\.cpp):(\d+):(?:(\d+):)?\s*(error|warning|note|fatal error):\s*(.+)/gm;
    let m;
    while ((m = re.exec(stderr)) !== null) {
      diags.push({
        line:     parseInt(m[1], 10),
        col:      parseInt(m[2] || '1', 10),
        severity: m[3].includes('error') ? 'error' : m[3] === 'warning' ? 'warning' : 'info',
        message:  m[4].trim()
      });
    }
    return diags;
  }

  /* ══════════════════════════════════════════════════════════════
     10. MONACO MARKERS
     ══════════════════════════════════════════════════════════════ */
  function applyMarkers(diags) {
    if (!state.monacoReady || !state.editor || !window.monaco) return;
    const model = state.editor.getModel();
    if (!model) return;
    monaco.editor.setModelMarkers(model, 'gcc',
      diags.filter(d => d.severity !== 'info').map(d => ({
        startLineNumber: d.line, startColumn: d.col,
        endLineNumber:   d.line, endColumn:   d.col + 12,
        message:  d.message,
        severity: d.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
        source:   'GCC'
      }))
    );
  }

  function clearMarkers() {
    if (!state.monacoReady || !state.editor || !window.monaco) return;
    const model = state.editor.getModel();
    if (model) monaco.editor.setModelMarkers(model, 'gcc', []);
  }

  /* ══════════════════════════════════════════════════════════════
     11. DIAGNOSTICS PANEL
     ══════════════════════════════════════════════════════════════ */
  function renderDiagnostics(diags, result) {
    const el = $('errors-content');
    if (!el) return;
    if (!diags.length) {
      const raw = ((result && result.stderr) || '').trim();
      el.innerHTML = raw
        ? '<pre class="terminal-err">' + escHtml(raw) + '</pre>'
        : '<div class="empty-state"><p>No errors detected ✓</p></div>';
      return;
    }
    el.innerHTML = '<div class="diag-list">' +
      diags.map(d =>
        '<div class="diag-item ' + d.severity + '" data-line="' + d.line + '" data-col="' + d.col + '">' +
          '<span class="diag-loc">:' + d.line + ':' + d.col + '</span>' +
          '<span class="diag-sev-badge ' + d.severity + '">' + d.severity + '</span>' +
          '<span class="diag-msg">' + escHtml(d.message) + '</span>' +
        '</div>'
      ).join('') + '</div>';

    el.querySelectorAll('.diag-item').forEach(item => {
      item.addEventListener('click', () => {
        const ln  = parseInt(item.dataset.line, 10);
        const col = parseInt(item.dataset.col || '1', 10);
        if (state.editor && ln) {
          state.editor.revealLineInCenter(ln);
          state.editor.setPosition({ lineNumber: ln, column: col });
          state.editor.focus();
        }
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════
     12. OUTPUT TABS
     ══════════════════════════════════════════════════════════════ */
  function switchOutputTab(tab) {
    $$('.out-tab').forEach(t  => t.classList.toggle('active', t.dataset.tab  === tab));
    $$('.out-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === tab));
  }

  /* ══════════════════════════════════════════════════════════════
     13. EDITOR FILE TABS
     ══════════════════════════════════════════════════════════════ */
  function renderTabs() {
    const bar = $('editor-tabs');
    if (!bar) return;
    bar.innerHTML = state.files.map(f => {
      const active = f.id === state.activeId ? ' active' : '';
      return '<button class="tab' + active + '" data-file-id="' + f.id + '">' +
        '<span class="tab-name">' + escHtml(f.name) + '</span>' +
        (state.files.length > 1
          ? '<span class="tab-close" data-close-id="' + f.id + '" title="Close">✕</span>'
          : '') +
        '</button>';
    }).join('');
  }

  /* ══════════════════════════════════════════════════════════════
     14. TEST CASES
     ══════════════════════════════════════════════════════════════ */
  function getTests()        { const f = activeFile(); return f && f.tests ? f.tests : []; }
  function saveTests(tests)  { const f = activeFile(); if (f) { f.tests = tests; saveFiles(); } }

  function renderTests() {
    const el = $('tests-content');
    if (!el) return;
    const tests = getTests();
    const list = tests.length
      ? tests.map((t, i) => {
          const sc = t.status || 'pending';
          return '<div class="test-item ' + sc + '">' +
            '<div class="test-header">' +
              '<span class="test-name">' + escHtml(t.name) + '</span>' +
              '<div class="test-controls">' +
                '<span class="test-status-badge ' + sc + '">' + sc + '</span>' +
                '<button class="btn-micro" data-run-test="' + i + '">▶</button>' +
                '<button class="btn-micro-danger" data-del-test="' + i + '">✕</button>' +
              '</div>' +
            '</div>' +
            '<div class="test-body">' +
              '<div class="test-io-col"><span class="test-io-label">Input</span><pre class="test-io-val">' + escHtml(t.input || '(none)') + '</pre></div>' +
              '<div class="test-io-col"><span class="test-io-label">Expected</span><pre class="test-io-val">' + escHtml(t.expected || '(any)') + '</pre></div>' +
              (t.actual !== undefined
                ? '<div class="test-io-col"><span class="test-io-label">Actual</span><pre class="test-io-val' + (sc === 'failed' ? ' fail' : '') + '">' + escHtml(t.actual) + '</pre></div>'
                : '') +
            '</div></div>';
        }).join('')
      : '<div class="empty-state"><p>No test cases yet</p><p class="hint">+ Add Test to get started</p></div>';

    el.innerHTML =
      '<div class="tests-wrapper">' +
        '<div class="test-list">' + list + '</div>' +
        '<div class="tests-actions">' +
          '<button class="btn-secondary" id="add-test-btn">+ Add Test</button>' +
          '<button class="btn-secondary" id="run-tests-btn">▶ Run All</button>' +
        '</div>' +
      '</div>';

    const addBtn = $('add-test-btn');
    const runBtn = $('run-tests-btn');
    if (addBtn) addBtn.addEventListener('click', promptAddTest);
    if (runBtn) runBtn.addEventListener('click', runAllTests);
    el.querySelectorAll('[data-run-test]').forEach(b =>
      b.addEventListener('click', () => runSingleTest(+b.dataset.runTest)));
    el.querySelectorAll('[data-del-test]').forEach(b =>
      b.addEventListener('click', () => {
        const t = getTests(); t.splice(+b.dataset.delTest, 1); saveTests(t); renderTests();
      }));
  }

  function promptAddTest() {
    const name = prompt('Test name:', 'Test ' + (getTests().length + 1));
    if (name === null) return;
    const input    = prompt('Program input (stdin):', '') || '';
    const expected = prompt('Expected output (blank = skip check):', '') || '';
    const tests = getTests();
    tests.push({ name: name || 'Test ' + tests.length, input, expected, status: 'pending' });
    saveTests(tests);
    renderTests();
  }

  function norm(s) { return String(s || '').trim().replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, ''); }

  async function runSingleTest(idx) {
    const tests = getTests();
    const t = tests[idx];
    if (!t) return;
    syncEditorToFile();
    const f = activeFile();
    if (!f || !(f.content || '').trim()) { showToast('No code to run!', 'warn'); return; }
    t.status = 'running'; t.actual = undefined;
    saveTests(tests); renderTests();

    let result = null;
    try { result = await runPiston(f.content, t.input, false); } catch {}
    if (!result) { try { result = await runWandbox(f.content, t.input, false); } catch {} }

    if (!result) {
      t.status = 'error'; t.actual = 'Execution failed';
    } else {
      t.actual = result.stdout || '';
      t.status = !t.expected.trim()
        ? (result.exitCode === 0 ? 'passed' : 'failed')
        : norm(t.actual) === norm(t.expected) ? 'passed' : 'failed';
    }
    saveTests(tests); renderTests();
  }

  async function runAllTests() {
    const tests = getTests();
    if (!tests.length) { showToast('No test cases to run', 'warn'); return; }
    for (let i = 0; i < tests.length; i++) await runSingleTest(i);
    const passed = getTests().filter(t => t.status === 'passed').length;
    showToast(passed + '/' + tests.length + ' tests passed',
      passed === tests.length ? 'success' : 'warn');
  }

  /* ══════════════════════════════════════════════════════════════
     15. STATUS BAR
     ══════════════════════════════════════════════════════════════ */
  function updateStatusBar() {
    const stdEl = $('status-std');
    if (stdEl) stdEl.textContent = state.std;
    const aiEl = $('status-ai');
    if (aiEl) {
      const dot = aiEl.querySelector('.dot');
      if (dot) { dot.className = 'dot ' + (state.groqKey ? 'green' : 'gray'); }
    }
  }

  async function probeProviders() {
    const el = $('status-provider');
    if (!el) return;
    const dot = el.querySelector('.dot');
    try {
      const r = await fetch(PISTON_BASE + '/runtimes', { signal: AbortSignal.timeout(7000) });
      if (r.ok) { if (dot) dot.className = 'dot green'; el.lastChild.textContent = 'Piston'; return; }
    } catch {}
    try {
      const r = await fetch('https://wandbox.org/api/list.json', { method: 'HEAD', signal: AbortSignal.timeout(7000) });
      if (r.ok) { if (dot) dot.className = 'dot green'; el.lastChild.textContent = 'Wandbox'; return; }
    } catch {}
    if (dot) dot.className = 'dot red';
    el.lastChild.textContent = 'Offline';
  }

  /* ══════════════════════════════════════════════════════════════
     16. TOASTS
     ══════════════════════════════════════════════════════════════ */
  function showToast(msg, type, dur) {
    dur = dur || 3200;
    const c = $('toasts');
    if (!c) return;
    const t = document.createElement('div');
    t.className = 'toast ' + (type || 'info');
    t.textContent = msg;
    c.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, dur);
  }

  /* ══════════════════════════════════════════════════════════════
     17. AI — CONVERSATION MANAGEMENT
     ══════════════════════════════════════════════════════════════ */
  function getActiveConvo() {
    return state.conversations.find(c => c.id === state.activeConvoId) || null;
  }

  function saveConvos() {
    setJson(S.convos, state.conversations);
    set(S.activeConvo, state.activeConvoId);
  }

  function ensureConvo() {
    if (!state.conversations.length) { createNewConvo(true); return; }
    if (!getActiveConvo()) {
      state.activeConvoId = state.conversations[0].id;
      set(S.activeConvo, state.activeConvoId);
    }
  }

  function createNewConvo(silent) {
    const convo = {
      id: uid(),
      title: 'New conversation',
      messages: [],
      createdAt: Date.now()
    };
    state.conversations.unshift(convo);
    state.activeConvoId = convo.id;
    saveConvos();
    renderAllAiMessages();
    renderHistoryList();
    if (!silent) showToast('New conversation started', 'success');
  }

  function switchConvo(id) {
    if (id === state.activeConvoId) return;
    state.activeConvoId = id;
    set(S.activeConvo, id);
    renderAllAiMessages();
    renderHistoryList();
  }

  function deleteConvo(id) {
    state.conversations = state.conversations.filter(c => c.id !== id);
    if (state.activeConvoId === id) {
      if (state.conversations.length) {
        state.activeConvoId = state.conversations[0].id;
      } else {
        createNewConvo(true);
        return;
      }
    }
    saveConvos();
    renderAllAiMessages();
    renderHistoryList();
  }

  function clearAllConvos() {
    state.conversations = [];
    createNewConvo(true);
    showToast('All conversations cleared', 'success');
  }

  function renderHistoryList() {
    const el = $('ai-history-list');
    if (!el) return;
    if (!state.conversations.length) {
      el.innerHTML = '<div class="empty-state small"><p>No conversations yet</p></div>';
      return;
    }
    el.innerHTML = state.conversations.map(c => {
      const active = c.id === state.activeConvoId ? ' active' : '';
      const count  = c.messages.length;
      const d      = new Date(c.createdAt);
      const date   = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return '<div class="ai-history-item' + active + '" data-convo-id="' + c.id + '">' +
        '<span class="ai-history-title">' + escHtml(c.title) + '</span>' +
        '<span class="ai-history-meta">' + count + ' · ' + date + '</span>' +
        '<button class="ai-history-delete" data-delete-convo="' + c.id + '" title="Delete">✕</button>' +
      '</div>';
    }).join('');

    el.querySelectorAll('.ai-history-item').forEach(item => {
      item.addEventListener('click', e => {
        if (e.target.closest('.ai-history-delete')) return;
        switchConvo(item.dataset.convoId);
      });
    });
    el.querySelectorAll('[data-delete-convo]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        deleteConvo(btn.dataset.deleteConvo);
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════
     18. AI — SYSTEM PROMPT  (anti-hallucination, LeetCode-grade)
     ══════════════════════════════════════════════════════════════ */
  function buildSystemPrompt() {
    syncEditorToFile();
    const f     = activeFile();
    const code  = (f && f.content) || '';
    const lines = code.split('\n').length;
    const flags = buildFlags().join(' ');
    const r     = state.lastResult;

    let p =
      'You are ForgeAI, an expert C++ coding assistant embedded in CodeForge IDE.\n\n' +
      '══ COMPILATION ENVIRONMENT ══\n' +
      'Compiler: GCC (latest)\n' +
      'Standard: ' + state.std + '\n' +
      'Flags: ' + flags + '\n' +
      'Platform: Online judge (LeetCode / HackerRank / Codeforces compatible)\n\n' +
      '══ CURRENT CODE (' + lines + ' lines) ══\n```cpp\n' + code + '\n```\n\n';

    if (r) {
      p += '══ LAST EXECUTION ══\n' +
        'Provider: ' + r.provider + ' | Exit: ' + r.exitCode + ' | Status: ' + r.status + '\n';
      if ((r.stdout || '').trim())
        p += 'stdout:\n```\n' + r.stdout.slice(0, 3000) + '\n```\n';
      if ((r.stderr || '').trim())
        p += 'stderr:\n```\n' + r.stderr.slice(0, 3000) + '\n```\n';
      p += '\n';
    } else {
      p += '(Code has not been run yet.)\n\n';
    }

    p +=
      '══ STRICT RULES — YOU MUST FOLLOW ══\n' +
      '1. When providing code, give the COMPLETE file inside a ```cpp block. NEVER use "// ... rest unchanged" or "// same as before" — include EVERY line.\n' +
      '2. Before responding, mentally verify your code compiles with: ' + flags + '\n' +
      '3. If there are compiler errors, quote each error verbatim, explain it in plain English, then give the COMPLETE fixed code.\n' +
      '4. Reference specific line numbers from the code above.\n' +
      '5. For competitive programming: prefer #include <bits/stdc++.h>, use fast I/O, handle edge cases.\n' +
      '6. NEVER invent problems that don\'t exist. If the code is correct, say so clearly.\n' +
      '7. Use markdown. Be concise but thorough.\n';

    return p;
  }

  function buildAiMessages() {
    const sys   = buildSystemPrompt();
    const convo = getActiveConvo();
    const hist  = convo
      ? convo.messages.slice(-20).map(m => ({ role: m.role, content: m.content }))
      : [];
    return [{ role: 'system', content: sys }].concat(hist);
  }

  const QA = {
    explain: () =>
      'Walk through my code step by step. Explain the algorithm, key variables, ' +
      'time/space complexity, and expected output for typical input.',
    fix: () => {
      const err = state.lastResult && state.lastResult.stderr;
      return err
        ? 'My code has the following errors:\n```\n' + err.slice(0, 2000) +
          '\n```\nFix ALL errors. Provide the COMPLETE corrected code in a ```cpp block and explain each fix.'
        : 'Review my code for bugs, edge cases, and potential issues. ' +
          'If changes are needed, provide the COMPLETE fixed code in a ```cpp block.';
    },
    optimize: () =>
      'Optimize my code for better time and space complexity while keeping it correct. ' +
      'Provide the COMPLETE optimized code in a ```cpp block and explain improvements.',
    review: () =>
      'Code review: correctness, edge cases, efficiency, readability, C++ best practices. ' +
      'Reference specific line numbers. Provide COMPLETE code if changes are needed.',
    complexity: () =>
      'Analyze time complexity and space complexity of my code. ' +
      'Identify bottleneck operations and suggest Big-O improvements if possible.',
    tests: () =>
      'Generate 6 test cases for my code. For each:\n' +
      '1. Test name\n2. Exact stdin input\n3. Expected stdout output\n' +
      'Cover: normal, edge, boundary, and large inputs. Be precise.'
  };

  /* ══════════════════════════════════════════════════════════════
     19. AI — MESSAGING
     ══════════════════════════════════════════════════════════════ */
  let typingId = null;

  function pushAiMsg(role, content, model) {
    let convo = getActiveConvo();
    if (!convo) { createNewConvo(true); convo = getActiveConvo(); }

    const msg = { id: uid(), role, content, model: model || null };
    convo.messages.push(msg);

    // Auto-title from first user message
    if (role === 'user') {
      const userMsgs = convo.messages.filter(m => m.role === 'user');
      if (userMsgs.length === 1) {
        convo.title = content.slice(0, 60) + (content.length > 60 ? '…' : '');
      }
    }

    saveConvos();
    renderSingleAiMsg(msg);
    scrollAi();
    renderHistoryList();
  }

  function renderSingleAiMsg(msg) {
    const container = $('ai-messages');
    if (!container) return;
    const empty = container.querySelector('.ai-empty');
    if (empty) empty.remove();

    const div = document.createElement('div');
    div.className = 'ai-msg ' + msg.role;
    div.dataset.msgId = msg.id;

    if (msg.role === 'user') {
      div.innerHTML = '<div class="ai-bubble"><p>' + escHtml(msg.content) + '</p></div>';
    } else {
      const mdHtml     = renderMarkdown(msg.content);
      const modelLabel = msg.model
        ? '<span class="ai-model-label">via ' + escHtml(msg.model.split('/').pop()) + '</span>'
        : '';
      div.innerHTML =
        '<div class="ai-avatar">AI</div>' +
        '<div class="ai-bubble">' + mdHtml + modelLabel + '</div>';
    }

    container.appendChild(div);

    // Bind "Apply to Editor" buttons
    div.querySelectorAll('.code-apply-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const raw = unescHtml(decodeURIComponent(btn.dataset.code || ''));
        if (raw && state.editor) {
          state.editor.setValue(raw);
          syncEditorToFile();
          showToast('Code applied to editor!', 'success');
        }
      });
    });
  }

  function addTypingIndicator() {
    const id = 'typing-' + uid();
    const c  = $('ai-messages');
    if (!c) return id;
    const div = document.createElement('div');
    div.id = id;
    div.className = 'ai-msg assistant';
    div.innerHTML =
      '<div class="ai-avatar">AI</div>' +
      '<div class="ai-bubble"><div class="dot-typing"><span></span><span></span><span></span></div></div>';
    c.appendChild(div);
    scrollAi();
    return id;
  }

  function removeTypingIndicator(id) { const el = $(id); if (el) el.remove(); }
  function scrollAi() { const el = $('ai-messages'); if (el) el.scrollTop = el.scrollHeight; }

  function renderAllAiMessages() {
    const c = $('ai-messages');
    if (!c) return;
    c.innerHTML = '';
    const convo = getActiveConvo();
    if (!convo || !convo.messages.length) {
      c.innerHTML =
        '<div class="ai-empty">' +
          '<div class="ai-empty-icon">⚡</div>' +
          '<h3>ForgeAI</h3>' +
          '<p>Your C++ coding assistant.<br>I can see your code and last run output.</p>' +
          '<span class="ai-empty-hint">Use quick actions ↑ or ask anything below</span>' +
        '</div>';
      return;
    }
    convo.messages.forEach(m => renderSingleAiMsg(m));
    scrollAi();
  }

  async function sendAiMessage(userMsg) {
    if (!userMsg.trim()) return;
    if (state.aiSending) return;

    if (!state.groqKey) {
      pushAiMsg('assistant',
        '⚙ **No Groq API key configured.**\n\n' +
        'Open **Settings** (⚙) and paste your free Groq key.\n\n' +
        'Get one at [console.groq.com](https://console.groq.com) — completely free, no credit card.');
      return;
    }

    pushAiMsg('user', userMsg);
    state.aiSending = true;
    typingId = addTypingIndicator();

    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + state.groqKey
        },
        body: JSON.stringify({
          model:       state.model,
          messages:    buildAiMessages(),
          temperature: 0.1,
          max_tokens:  4096
        }),
        signal: AbortSignal.timeout(60000)
      });

      removeTypingIndicator(typingId); typingId = null;

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = (err.error && err.error.message) || 'HTTP ' + res.status;
        if (res.status === 401) throw new Error('Invalid API key. Check Settings → Groq API Key.');
        if (res.status === 429) throw new Error('Rate limit reached. Wait a moment and try again.');
        throw new Error(msg);
      }

      const data  = await res.json();
      const reply = data.choices?.[0]?.message?.content || 'No response received.';
      pushAiMsg('assistant', reply, state.model);
    } catch (e) {
      removeTypingIndicator(typingId); typingId = null;
      pushAiMsg('assistant', '❌ **Error:** ' + e.message);
    } finally {
      state.aiSending = false;
    }
  }

  /* ══════════════════════════════════════════════════════════════
     20. MARKDOWN RENDERER
     ══════════════════════════════════════════════════════════════ */
  function renderMarkdown(text) {
    if (!text) return '';
    let h = escHtml(text);

    // Fenced code blocks
    h = h.replace(/```([\w+#.\-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const isCpp = /^(cpp|c\+\+|cxx|c)$/i.test(lang.trim());
      const label = lang.trim() || 'code';
      // Unescape for data attribute so Apply works correctly
      const raw = code.trim()
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      const enc = encodeURIComponent(raw);
      const applyBtn = isCpp
        ? '<button class="code-apply-btn" data-code="' + enc + '">↳ Apply to Editor</button>'
        : '';
      return '<div class="code-block-wrap">' +
        '<div class="code-block-header"><span>' + label + '</span>' + applyBtn + '</div>' +
        '<pre class="code-block"><code>' + code + '</code></pre></div>';
    });

    // Inline code
    h = h.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');

    // Bold + italic
    h = h.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    h = h.replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>');
    h = h.replace(/\*([^*\n]+?)\*/g,    '<em>$1</em>');

    // Headers
    h = h.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    h = h.replace(/^### (.+)$/gm,  '<h4>$1</h4>');
    h = h.replace(/^## (.+)$/gm,   '<h3>$1</h3>');
    h = h.replace(/^# (.+)$/gm,    '<h3>$1</h3>');

    // HR
    h = h.replace(/^---+$/gm, '<hr>');

    // Lists
    h = h.replace(/^[-*] (.+)$/gm,  '<li>$1</li>');
    h = h.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    h = h.replace(/((?:<li>[\s\S]*?<\/li>\n?)+)/g, '<ul>$1</ul>');

    // Links
    h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Paragraphs
    h = h.split(/\n{2,}/).map(para => {
      para = para.trim();
      if (!para) return '';
      if (/^<(h[2-4]|hr|ul|ol|div|pre)/.test(para)) return para;
      return '<p>' + para.replace(/\n/g, '<br>') + '</p>';
    }).filter(Boolean).join('\n');

    return h;
  }

  /* ══════════════════════════════════════════════════════════════
     21. AI PANEL TOGGLE
     ══════════════════════════════════════════════════════════════ */
  function openAiPanel() {
    const panel = $('ai-panel');
    const btn   = $('ai-toggle-btn');
    if (panel) panel.classList.remove('collapsed');
    if (btn)   btn.classList.add('ai-active');
    ensureConvo();
    renderAllAiMessages();
    renderHistoryList();
    setTimeout(() => { const inp = $('ai-input'); if (inp) inp.focus(); }, 120);
  }

  function closeAiPanel() {
    const panel = $('ai-panel');
    const btn   = $('ai-toggle-btn');
    if (panel) panel.classList.add('collapsed');
    if (btn)   btn.classList.remove('ai-active');
  }

  function toggleAiPanel() {
    const panel = $('ai-panel');
    if (!panel) return;
    if (panel.classList.contains('collapsed')) openAiPanel();
    else closeAiPanel();
  }

  /* ══════════════════════════════════════════════════════════════
     22. SETTINGS
     ══════════════════════════════════════════════════════════════ */
  function openSettings() {
    const ov = $('settings-overlay');
    const pn = $('settings-panel');
    if (!ov || !pn) return;
    ov.classList.remove('hidden');
    pn.classList.remove('hidden');
    // Populate fields with current state
    const keyEl = $('settings-groq-key');  if (keyEl) keyEl.value = state.groqKey;
    const modEl = $('settings-model');     if (modEl) modEl.value = state.model;
    const stdEl = $('settings-std-field'); if (stdEl) stdEl.value = state.std;
    ['wall','wextra','o0','o2','g'].forEach(k => {
      const cb = $('flag-' + k); if (cb) cb.checked = !!state.flags[k];
    });
    setTimeout(() => {
      if (window.CodeForgeAssistant && typeof window.CodeForgeAssistant.syncSettingsFields === 'function') {
        window.CodeForgeAssistant.syncSettingsFields();
      }
    }, 0);
  }

  function closeSettings() {
    const ov = $('settings-overlay');
    const pn = $('settings-panel');
    if (ov) ov.classList.add('hidden');
    if (pn) pn.classList.add('hidden');
  }

  function saveSettings() {
    const keyEl = $('settings-groq-key');
    const modEl = $('settings-model');
    const stdEl = $('settings-std-field');

    if (keyEl) { state.groqKey = keyEl.value.trim(); set(S.groqKey, state.groqKey); }
    if (modEl) { state.model   = modEl.value;        set(S.model,   state.model); }
    if (stdEl) { state.std     = stdEl.value;        set(S.std,     state.std); }

    ['wall','wextra','o0','o2','g'].forEach(k => {
      const cb = $('flag-' + k); if (cb) state.flags[k] = cb.checked;
    });
    setJson(S.flags, state.flags);

    if (window.CodeForgeAssistant && typeof window.CodeForgeAssistant.saveSettings === 'function') {
      window.CodeForgeAssistant.saveSettings({ silent: true });
      state.model = get(S.model, state.model);
      state.groqKey = get(S.groqKey, state.groqKey);
      state.providerKeys = getJson(S.providerVault, state.providerKeys);
      state.geminiModel = get(S.geminiModel, state.geminiModel);
      state.audioModel = get(S.audioModel, state.audioModel);
    }

    // Sync all UI elements
    const stdSel     = $('std-select');      if (stdSel) stdSel.value = state.std;
    const aiModelSel = $('ai-model-select'); if (aiModelSel) aiModelSel.value = state.model;
    const aiDot      = $('ai-btn-dot');      if (aiDot) aiDot.classList.toggle('on', !!state.groqKey);

    updateStatusBar();
    closeSettings();
    showToast('Settings saved!', 'success');
  }

  /* ══════════════════════════════════════════════════════════════
     23. THEME TOGGLE
     ══════════════════════════════════════════════════════════════ */
  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    set(S.theme, state.theme);
    const shell = $('shell');
    if (shell) shell.dataset.theme = state.theme;
    if (state.monacoReady && window.monaco) {
      monaco.editor.setTheme(state.theme === 'light' ? 'vs' : 'codeforge-dark');
    }
  }

  /* ══════════════════════════════════════════════════════════════
     24. RESIZE HANDLE
     ══════════════════════════════════════════════════════════════ */
  function initResize() {
    const handle = $('resize-handle');
    const edCol  = $('editor-col');
    const outCol = $('output-col');
    const ws     = $('workspace');
    if (!handle || !edCol || !outCol || !ws) return;

    let dragging = false, startX = 0, startW = 0;

    handle.addEventListener('mousedown', e => {
      dragging = true;
      startX   = e.clientX;
      startW   = edCol.getBoundingClientRect().width;
      document.body.style.cursor     = 'col-resize';
      document.body.style.userSelect = 'none';
      handle.classList.add('dragging');
    });

    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const wsW  = ws.getBoundingClientRect().width;
      const newW = Math.min(Math.max(startW + e.clientX - startX, 300), wsW - 280);
      edCol.style.flex  = 'none';
      edCol.style.width = newW + 'px';
      outCol.style.flex = '1';
      if (state.editor) state.editor.layout();
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
      handle.classList.remove('dragging');
    });
  }

  /* ══════════════════════════════════════════════════════════════
     25. MONACO EDITOR
     ══════════════════════════════════════════════════════════════ */
  function initMonaco() {
    return new Promise((resolve, reject) => {
      if (!window.require) { reject(new Error('Monaco loader not found')); return; }

      require.config({
        paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs' }
      });

      require(['vs/editor/editor.main'], () => {
        const host = $('editor-host');
        if (!host) { reject(new Error('editor-host missing')); return; }

        // Remove loading spinner
        const loadingEl = $('editor-loading');
        if (loadingEl) loadingEl.remove();

        // Custom dark theme
        monaco.editor.defineTheme('codeforge-dark', {
          base: 'vs-dark', inherit: true,
          rules: [
            { token: 'comment',    foreground: '6e7681', fontStyle: 'italic' },
            { token: 'keyword',    foreground: 'ff7b72' },
            { token: 'string',     foreground: 'a5d6ff' },
            { token: 'number',     foreground: 'f2cc60' },
            { token: 'type',       foreground: 'ffa657' },
            { token: 'identifier', foreground: 'e6edf3' },
            { token: 'delimiter',  foreground: '8b949e' }
          ],
          colors: {
            'editor.background':                '#0d1117',
            'editor.foreground':                '#e6edf3',
            'editorLineNumber.foreground':      '#484f58',
            'editorLineNumber.activeForeground':'#8b949e',
            'editor.selectionBackground':       '#264f78',
            'editor.lineHighlightBackground':   '#161b22',
            'editorCursor.foreground':          '#58a6ff',
            'editorWidget.background':          '#161b22',
            'editorWidget.border':              '#30363d',
            'editorSuggestWidget.background':   '#1c2128',
            'editorSuggestWidget.border':       '#30363d',
            'editorSuggestWidget.selectedBackground':'#264f78',
            'input.background':                 '#0d1117',
            'input.border':                     '#30363d'
          }
        });

        const f = activeFile();
        state.editor = monaco.editor.create(host, {
          value:       f ? (f.content || '') : '',
          language:    'cpp',
          theme:       state.theme === 'light' ? 'vs' : 'codeforge-dark',
          fontSize:    14,
          fontFamily:  '"JetBrains Mono", "Fira Code", Consolas, monospace',
          fontLigatures:          true,
          lineNumbers:            'on',
          glyphMargin:            true,
          minimap:                { enabled: true, scale: 1, showSlider: 'mouseover' },
          scrollBeyondLastLine:   false,
          automaticLayout:        true,
          bracketPairColorization:{ enabled: true },
          autoClosingBrackets:    'always',
          autoClosingQuotes:      'always',
          tabSize:                4,
          insertSpaces:           true,
          wordWrap:               'off',
          renderWhitespace:       'selection',
          smoothScrolling:        true,
          cursorBlinking:         'smooth',
          cursorSmoothCaretAnimation: 'on',
          padding:                { top: 10, bottom: 10 },
          suggest:                { preview: true },
          inlineSuggest:          { enabled: true },
          formatOnPaste:          true,
          renderLineHighlight:    'all',
          overviewRulerLanes:     2
        });

        // Cursor position in status bar
        state.editor.onDidChangeCursorPosition(e => {
          const el = $('cursor-pos');
          if (el) el.textContent = 'Ln ' + e.position.lineNumber + ', Col ' + e.position.column;
        });

        // Auto-save debounce
        let saveTimer;
        state.editor.onDidChangeModelContent(() => {
          clearTimeout(saveTimer);
          saveTimer = setTimeout(() => {
            const af = activeFile();
            if (af) {
              af.content = state.editor.getValue();
              saveFiles();
              dispatchCodeForgeEvent('workspace-change', {
                reason: 'editor-idle',
                activeFileId: state.activeId
              });
            }
          }, 800);
        });

        // Ctrl+Enter to run
        state.editor.addAction({
          id: 'codeforge-run',
          label: 'Run Code',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
          run: () => executeCode(false)
        });

        // Ctrl+Shift+B to compile
        state.editor.addAction({
          id: 'codeforge-compile',
          label: 'Compile Only',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyB],
          run: () => executeCode(true)
        });

        state.monacoReady = true;
        resolve();
      }, reject);
    });
  }

  /* ══════════════════════════════════════════════════════════════
     26. FALLBACK TEXTAREA EDITOR
     ══════════════════════════════════════════════════════════════ */
  function initFallbackEditor() {
    const host = $('editor-host');
    if (!host) return;
    const f = activeFile();
    host.innerHTML =
      '<div style="height:100%;display:flex;flex-direction:column">' +
        '<div class="fallback-banner">⚠ Monaco failed to load — using basic textarea</div>' +
        '<textarea id="fallback-ta" class="fallback-editor" spellcheck="false">' +
          escHtml(f ? f.content || '' : '') +
        '</textarea>' +
      '</div>';

    const ta = $('fallback-ta');
    state.editor = {
      getValue:              () => ta ? ta.value : '',
      setValue:              (v) => { if (ta) ta.value = v; },
      setScrollPosition:    ()  => {},
      setPosition:          ()  => {},
      revealLineInCenter:   ()  => {},
      focus:                ()  => { if (ta) ta.focus(); },
      layout:               ()  => {},
      getModel:             ()  => null,
      onDidChangeCursorPosition: () => ({ dispose() {} }),
      onDidChangeModelContent:   (cb) => { if (ta) ta.addEventListener('input', cb); return { dispose() {} }; },
      addAction:            ()  => {}
    };
    state.monacoReady = false;

    if (ta) {
      let fallbackSaveTimer;
      ta.addEventListener('input', () => {
        clearTimeout(fallbackSaveTimer);
        fallbackSaveTimer = setTimeout(() => {
          const af = activeFile();
          if (af) {
            af.content = ta.value;
            saveFiles();
            dispatchCodeForgeEvent('workspace-change', {
              reason: 'editor-idle',
              activeFileId: state.activeId
            });
          }
        }, 800);
      });
      ta.addEventListener('keydown', e => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const s = ta.selectionStart;
          ta.value = ta.value.slice(0, s) + '    ' + ta.value.slice(ta.selectionEnd);
          ta.selectionStart = ta.selectionEnd = s + 4;
        }
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════
     27. MODAL HELPERS
     ══════════════════════════════════════════════════════════════ */
  function openNewFileModal() {
    const ov = $('nf-overlay');
    const md = $('nf-modal');
    if (ov) ov.classList.remove('hidden');
    if (md) md.classList.remove('hidden');
    const n = $('nf-name');
    if (n) { n.value = 'solution.cpp'; n.focus(); n.select(); }
  }

  function closeNewFileModal() {
    const ov = $('nf-overlay');
    const md = $('nf-modal');
    if (ov) ov.classList.add('hidden');
    if (md) md.classList.add('hidden');
  }

  /* ══════════════════════════════════════════════════════════════
     28. STATE RESTORATION (sync HTML ← localStorage)
     ══════════════════════════════════════════════════════════════ */
  function restoreState() {
    // Theme
    const shell = $('shell');
    if (shell) shell.dataset.theme = state.theme;

    // C++ Standard selects
    const stdSel     = $('std-select');
    const settingsStd = $('settings-std-field');
    if (stdSel)      stdSel.value = state.std;
    if (settingsStd) settingsStd.value = state.std;

    // Model selects
    const aiModelSel  = $('ai-model-select');
    const settingsMod = $('settings-model');
    if (aiModelSel)  aiModelSel.value = state.model;
    if (settingsMod) settingsMod.value = state.model;

    // Flags
    ['wall','wextra','o0','o2','g'].forEach(k => {
      const cb = $('flag-' + k);
      if (cb) cb.checked = !!state.flags[k];
    });

    // AI indicator
    const aiDot = $('ai-btn-dot');
    if (aiDot) aiDot.classList.toggle('on', !!state.groqKey);

    // Document title
    const f = activeFile();
    if (f) document.title = f.name + ' — CodeForge';
  }

  /* ══════════════════════════════════════════════════════════════
     29. EVENT BINDING
     ══════════════════════════════════════════════════════════════ */
  function bindEvents() {

    /* ── Run / Compile ──────────────────────────── */
    const runBtn     = $('run-btn');
    const compileBtn = $('compile-btn');
    if (runBtn)     runBtn.addEventListener('click',     () => executeCode(false));
    if (compileBtn) compileBtn.addEventListener('click', () => executeCode(true));

    /* ── Settings ───────────────────────────────── */
    const settingsBtn    = $('settings-btn');
    const settingsClose  = $('settings-close-btn');
    const settingsCancel = $('settings-cancel-btn');
    const settingsSave   = $('settings-save-btn');
    const settingsOv     = $('settings-overlay');
    if (settingsBtn)    settingsBtn.addEventListener('click',    openSettings);
    if (settingsClose)  settingsClose.addEventListener('click',  closeSettings);
    if (settingsCancel) settingsCancel.addEventListener('click', closeSettings);
    if (settingsSave)   settingsSave.addEventListener('click',   saveSettings);
    if (settingsOv)     settingsOv.addEventListener('click',     closeSettings);

    /* ── Theme ──────────────────────────────────── */
    const themeBtn = $('theme-btn');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    /* ── C++ Standard select (topbar) ───────────── */
    const stdSel = $('std-select');
    if (stdSel) stdSel.addEventListener('change', e => {
      state.std = e.target.value;
      set(S.std, state.std);
      const el  = $('status-std');         if (el) el.textContent = state.std;
      const sf  = $('settings-std-field'); if (sf) sf.value = state.std;
    });

    /* ── Output tabs ────────────────────────────── */
    $$('.out-tab').forEach(b =>
      b.addEventListener('click', () => switchOutputTab(b.dataset.tab)));

    /* ── Clear / Copy output ────────────────────── */
    const clearOutBtn = $('clear-out-btn');
    const copyOutBtn  = $('copy-out-btn');
    if (clearOutBtn) clearOutBtn.addEventListener('click', () => {
      const oe = $('output-content');
      const ee = $('errors-content');
      const se = $('exec-stats');
      if (oe) oe.innerHTML = '<div class="empty-state"><div class="empty-icon">▶</div><p>Output cleared</p></div>';
      if (ee) ee.innerHTML = '<div class="empty-state"><p>No errors</p></div>';
      if (se) se.innerHTML = '';
      state.lastResult = null;
      clearMarkers();
    });
    if (copyOutBtn) copyOutBtn.addEventListener('click', () => {
      const pane = document.querySelector('.out-pane.active');
      const text = pane ? pane.textContent.trim() : '';
      navigator.clipboard.writeText(text)
        .then(() => showToast('Copied!', 'success'))
        .catch(() => showToast('Copy failed', 'error'));
    });

    /* ── Stdin ──────────────────────────────────── */
    const stdinClearBtn  = $('stdin-clear-btn');
    const stdinToggleBtn = $('stdin-toggle-btn');
    if (stdinClearBtn) stdinClearBtn.addEventListener('click', () => {
      const e = $('stdin-input'); if (e) e.value = '';
    });
    if (stdinToggleBtn) stdinToggleBtn.addEventListener('click', () => {
      state.stdinCollapsed = !state.stdinCollapsed;
      const panel = $('stdin-panel');
      const btn   = $('stdin-toggle-btn');
      if (panel) panel.classList.toggle('collapsed', state.stdinCollapsed);
      if (btn)   btn.textContent = state.stdinCollapsed ? '+' : '−';
      if (state.editor) setTimeout(() => state.editor.layout(), 60);
    });

    /* ── Template dropdown ──────────────────────── */
    const tmplBtn = $('template-btn');
    if (tmplBtn) tmplBtn.addEventListener('click', e => {
      const dd = $('template-dropdown');
      if (dd) dd.classList.toggle('hidden');
      e.stopPropagation();
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('#template-wrap')) {
        const dd = $('template-dropdown');
        if (dd) dd.classList.add('hidden');
      }
    });
    $$('[data-template]').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = TEMPLATES[btn.dataset.template];
        if (!t) return;
        const cur = activeFile();
        if (cur && (cur.content || '').trim() && !confirm('Replace current code with "' + t.name + '"?'))
          return;
        if (state.editor) state.editor.setValue(t.code);
        syncEditorToFile();
        const dd = $('template-dropdown');
        if (dd) dd.classList.add('hidden');
        showToast('Template loaded: ' + t.name, 'success');
        dispatchCodeForgeEvent('workspace-change', {
          reason: 'template-loaded',
          activeFileId: state.activeId
        });
      });
    });

    /* ── New file ───────────────────────────────── */
    const newFileBtn = $('new-file-btn');
    const nfCloseBtn = $('nf-close-btn');
    const nfCancelBtn= $('nf-cancel-btn');
    const nfOv       = $('nf-overlay');
    const nfCreateBtn= $('nf-create-btn');
    const nfNameEl   = $('nf-name');

    if (newFileBtn)  newFileBtn.addEventListener('click',  openNewFileModal);
    if (nfCloseBtn)  nfCloseBtn.addEventListener('click',  closeNewFileModal);
    if (nfCancelBtn) nfCancelBtn.addEventListener('click', closeNewFileModal);
    if (nfOv)        nfOv.addEventListener('click',        closeNewFileModal);
    if (nfCreateBtn) nfCreateBtn.addEventListener('click', () => {
      const nameEl = $('nf-name');
      const tmplEl = document.querySelector('input[name="nf-tmpl"]:checked');
      const name   = (nameEl && nameEl.value.trim()) || 'main.cpp';
      const tmplK  = tmplEl ? tmplEl.value : 'hello';
      createFile(name, tmplK);
      closeNewFileModal();
      showToast('Created ' + name, 'success');
      dispatchCodeForgeEvent('workspace-change', {
        reason: 'file-created',
        activeFileId: state.activeId
      });
    });
    if (nfNameEl) nfNameEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); if (nfCreateBtn) nfCreateBtn.click(); }
    });

    /* ── Editor file tabs ───────────────────────── */
    const editorTabs = $('editor-tabs');
    if (editorTabs) editorTabs.addEventListener('click', e => {
      const closeBtn = e.target.closest('[data-close-id]');
      const tabBtn   = e.target.closest('[data-file-id]');
      if (closeBtn) { e.stopPropagation(); deleteFile(closeBtn.dataset.closeId); }
      else if (tabBtn) openFile(tabBtn.dataset.fileId);
    });

    /* ── AI panel ───────────────────────────────── */
    const aiToggleBtn = $('ai-toggle-btn');
    const aiCloseBtn  = $('ai-close-btn');
    const aiNewBtn    = $('ai-new-chat-btn');
    const aiHistBtn   = $('ai-history-btn');
    const aiClearHist = $('ai-clear-history-btn');
    const aiModelSel  = $('ai-model-select');
    const aiInput     = $('ai-input');
    const aiSendBtn   = $('ai-send-btn');

    if (aiToggleBtn) aiToggleBtn.addEventListener('click', toggleAiPanel);
    if (aiCloseBtn)  aiCloseBtn.addEventListener('click',  closeAiPanel);

    if (aiNewBtn) aiNewBtn.addEventListener('click', () => createNewConvo(false));

    if (aiHistBtn) aiHistBtn.addEventListener('click', () => {
      const panel = $('ai-history-panel');
      if (panel) {
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) renderHistoryList();
      }
    });

    if (aiClearHist) aiClearHist.addEventListener('click', () => {
      if (confirm('Delete ALL conversations?')) clearAllConvos();
    });

    // Model selector in AI panel → immediate effect + sync settings
    if (aiModelSel) aiModelSel.addEventListener('change', e => {
      state.model = e.target.value;
      set(S.model, state.model);
      const sm = $('settings-model');
      if (sm) sm.value = state.model;
    });

    // Send message
    function doSend() {
      if (!aiInput) return;
      const msg = aiInput.value.trim();
      if (!msg) return;
      aiInput.value = '';
      aiInput.style.height = 'auto';
      sendAiMessage(msg);
    }

    if (aiSendBtn) aiSendBtn.addEventListener('click', doSend);
    if (aiInput) {
      aiInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
      });
      aiInput.addEventListener('input', () => {
        aiInput.style.height = 'auto';
        aiInput.style.height = Math.min(150, aiInput.scrollHeight) + 'px';
      });
    }

    // Quick actions
    $$('[data-qa]').forEach(btn => {
      btn.addEventListener('click', () => {
        const fn = QA[btn.dataset.qa];
        if (!fn) return;
        const panel = $('ai-panel');
        if (panel && panel.classList.contains('collapsed')) openAiPanel();
        sendAiMessage(fn());
      });
    });

    /* ── Global keyboard shortcuts ──────────────── */
    document.addEventListener('keydown', e => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 'Enter')                    { e.preventDefault(); executeCode(false); }
      else if (ctrl && e.shiftKey && (e.key === 'B' || e.key === 'b'))
                                                         { e.preventDefault(); executeCode(true); }
      else if (ctrl && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        if (window.CodeForgeAssistant && typeof window.CodeForgeAssistant.toggle === 'function') {
          window.CodeForgeAssistant.toggle();
        } else {
          toggleAiPanel();
        }
      }
      else if (ctrl && (e.key === 'n' || e.key === 'N')){ e.preventDefault(); openNewFileModal(); }
      else if (ctrl && e.key === ',')                    { e.preventDefault(); openSettings(); }
      else if (e.key === 'Escape') {
        closeSettings();
        closeNewFileModal();
        const hist = $('ai-history-panel');
        if (hist && !hist.classList.contains('hidden')) hist.classList.add('hidden');
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════
     30. BOOT SEQUENCE
     ══════════════════════════════════════════════════════════════ */
  async function boot() {
    ensureFiles();
    ensureConvo();
    restoreState();
    renderTabs();
    renderTests();
    updateStatusBar();
    bindEvents();
    initResize();

    window.CodeForgeBridge = {
      getActiveFile() {
        syncEditorToFile();
        return activeFile();
      },
      getCode() {
        syncEditorToFile();
        const f = activeFile();
        return f ? f.content || '' : '';
      },
      getStd() {
        return state.std;
      },
      getFlags() {
        return buildFlags().slice();
      },
      getLastResult() {
        return state.lastResult ? JSON.parse(JSON.stringify(state.lastResult)) : null;
      },
      getTheme() {
        return state.theme;
      },
      getTests() {
        const f = activeFile();
        return f && Array.isArray(f.tests) ? JSON.parse(JSON.stringify(f.tests)) : [];
      },
      listWorkspaceFiles() {
        syncEditorToFile();
        return state.files.map(file => ({
          id: file.id,
          name: file.name,
          testsCount: Array.isArray(file.tests) ? file.tests.length : 0,
          isActive: file.id === state.activeId
        }));
      },
      getWorkspaceFiles(fileIds) {
        syncEditorToFile();
        const wanted = Array.isArray(fileIds) && fileIds.length
          ? new Set(fileIds.map(id => String(id)))
          : null;
        return state.files
          .filter(file => !wanted || wanted.has(String(file.id)))
          .map(file => ({
            id: file.id,
            name: file.name,
            content: file.content || '',
            tests: Array.isArray(file.tests) ? JSON.parse(JSON.stringify(file.tests)) : [],
            isActive: file.id === state.activeId
          }));
      },
      applyCode(code) {
        if (!state.editor) return false;
        state.editor.setValue(String(code || ''));
        syncEditorToFile();
        dispatchCodeForgeEvent('apply-code', {
          reason: 'assistant-apply',
          activeFileId: state.activeId
        });
        return true;
      },
      applyMemoryWorkspaceDraft(draft) {
        if (window.CodeForgeMemory && typeof window.CodeForgeMemory.applyWorkspaceDraft === 'function') {
          return window.CodeForgeMemory.applyWorkspaceDraft(draft);
        }
        return false;
      },
      showToast(message, type, duration) {
        showToast(message, type, duration);
      }
    };
    dispatchCodeForgeEvent('bridge-ready', {});

    // Init Monaco (with fallback)
    try {
      await initMonaco();
    } catch (e) {
      console.warn('[CodeForge] Monaco failed:', e.message);
      initFallbackEditor();
    }

    // Background API probe
    probeProviders().catch(() => {});
  }

  /* ── Entry ────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
