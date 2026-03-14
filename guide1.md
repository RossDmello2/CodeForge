# ═══════════════════════════════════════════════════════════════════════
# CODEFORGE — COMPLETE PROJECT REFERENCE
# C++ Browser IDE with AI Assistant
# ═══════════════════════════════════════════════════════════════════════
#
# This document describes EVERY aspect of the CodeForge project.
# Read it fully before making any changes.
#
# FILES:
#   index.html  — Static HTML structure (all UI elements pre-built)
#   style.css   — Complete styling (dark/light themes, all components)
#   script.js   — All logic (editor, compilation, AI, state management)
#
# NO build tools. NO frameworks. NO npm. Pure vanilla HTML/CSS/JS.
# Runs by opening index.html in any modern browser.
# ═══════════════════════════════════════════════════════════════════════


## 1. PROJECT OVERVIEW

CodeForge is a browser-based C++ IDE that lets users:
  - Write C++ code in a Monaco editor (same editor as VS Code)
  - Compile and run code via free cloud APIs (no backend server needed)
  - Get AI-powered help via Groq's free LLM API
  - Manage multiple files, test cases, and conversation history
  - Toggle between dark and light themes

Everything runs client-side. There is NO server, NO backend, NO database.
All data is stored in the browser's localStorage.


## 2. ARCHITECTURE OVERVIEW

┌──────────────────────────────────────────────────────────┐
│                     BROWSER (Client)                     │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐ │
│  │index.html│  │style.css │  │      script.js         │ │
│  │ (static  │  │ (styling │  │ (all application logic)│ │
│  │  markup) │  │  + theme)│  │                        │ │
│  └──────────┘  └──────────┘  └────────────────────────┘ │
│                                    │                     │
│                         ┌──────────┼──────────┐          │
│                         │          │          │          │
│                         ▼          ▼          ▼          │
│                    ┌─────────┐ ┌────────┐ ┌───────┐     │
│                    │ Monaco  │ │localStorage│ │ DOM │     │
│                    │ Editor  │ │  (state)  │ │(UI) │     │
│                    │  (CDN)  │ │           │ │     │     │
│                    └─────────┘ └───────────┘ └─────┘     │
│                                                          │
└──────────────────────────────────────────────────────────┘
                         │
            ┌────────────┼────────────┐
            │            │            │
            ▼            ▼            ▼
     ┌────────────┐ ┌──────────┐ ┌─────────┐
     │ Piston API │ │ Wandbox  │ │ Groq AI │
     │ (compile/  │ │   API    │ │   API   │
     │   run C++) │ │(fallback)│ │ (LLM)   │
     │  FREE      │ │  FREE    │ │  FREE   │
     │  NO KEY    │ │  NO KEY  │ │ KEY REQ │
     └────────────┘ └──────────┘ └─────────┘


## 3. EXTERNAL DEPENDENCIES (all loaded via CDN)

### 3a. Monaco Editor
- WHAT: The same code editor used in VS Code
- CDN:  https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs/loader.min.js
- HOW:  The loader is included in <head> of index.html.
        In script.js, `require.config()` points to the CDN path,
        then `require(['vs/editor/editor.main'], callback)` loads it.
- WHERE IN CODE: Section 25 `initMonaco()` in script.js
- FALLBACK: If Monaco fails to load, Section 26 `initFallbackEditor()`
            creates a plain <textarea> with the same API surface.

### 3b. Google Fonts
- Fonts: "DM Sans" (UI text) and "JetBrains Mono" (code)
- Loaded via <link> in index.html <head>
- Referenced in CSS as var(--font-ui) and var(--font-code)

### 3c. NO other dependencies. No jQuery, no React, no bundler.


## 4. EXTERNAL APIs — HOW EACH WORKS

### 4a. PISTON API (Primary compiler/runner)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Base URL:  https://emkc.org/api/v2/piston
  Auth:      NONE required (completely free, no API key)
  Rate limit: Generous, suitable for individual use

  ENDPOINT USED: POST /execute
  REQUEST BODY:
    {
      "language": "c++",        // MUST be "c++" not "cpp"
      "version":  "*",          // latest available version
      "files": [{
        "name": "main.cpp",
        "content": "<user's C++ code>"
      }],
      "stdin": "<user input>",
      "compile_timeout": 15000,  // 15 seconds
      "run_timeout": 10000       // 10 seconds (1ms if compile-only)
    }

  RESPONSE FORMAT:
    {
      "compile": {
        "stdout": "...",   // compiler output
        "stderr": "...",   // compiler errors/warnings
        "code": 0          // exit code (0 = success)
      },
      "run": {
        "stdout": "...",   // program output
        "stderr": "...",   // runtime errors
        "code": 0          // exit code
      }
    }

  HEALTH CHECK: GET /runtimes (used in probeProviders())

  WHERE IN CODE: Section 7, function `runPiston()`

### 4b. WANDBOX API (Fallback compiler/runner)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  URL:  https://wandbox.org/api/compile.json
  Auth: NONE required (completely free)

  WHEN USED: ONLY when Piston fails (network error, timeout, HTTP error)
             The fallback is SILENT — user sees "via Wandbox" in status.

  REQUEST BODY:
    {
      "code": "<user's C++ code>",
      "compiler": "gcc-head",
      "stdin": "<user input>",
      "options": "warning",
      "compiler-option-raw": "-std=c++17\n-Wall\n-O2",  // newline-separated!
      "save": false
    }

  RESPONSE FORMAT:
    {
      "compiler_error":  "...",   // compile errors
      "compiler_output": "...",   // compile stdout
      "program_output":  "...",   // run stdout
      "program_error":   "...",   // run stderr
      "status": "0"              // exit code as string
    }

  WHERE IN CODE: Section 7, function `runWandbox()`

  NOTE: Wandbox uses compiler-option-raw with NEWLINE separators,
        not space-separated. This is built by buildFlags().join('\n')

### 4c. GROQ API (AI/LLM for ForgeAI assistant)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  URL:  https://api.groq.com/openai/v1/chat/completions
  Auth: REQUIRED — Bearer token in Authorization header
  Key:  User provides via Settings modal, stored in localStorage
        Key format: "gsk_..." (starts with "gsk_")
  Free: Yes, Groq is 100% free with generous rate limits
  Get key: https://console.groq.com

  REQUEST:
    POST /openai/v1/chat/completions
    Headers:
      Content-Type: application/json
      Authorization: Bearer gsk_xxxxx

    Body:
    {
      "model": "llama-3.3-70b-versatile",   // selected model
      "messages": [
        { "role": "system", "content": "<system prompt with code + context>" },
        { "role": "user",   "content": "..." },
        { "role": "assistant", "content": "..." },
        // ... conversation history (last 20 messages)
      ],
      "temperature": 0.1,    // low = more deterministic, less hallucination
      "max_tokens": 4096
    }

  RESPONSE:
    {
      "choices": [{
        "message": {
          "content": "AI response in markdown..."
        }
      }]
    }

  ERROR HANDLING:
    401 → Invalid API key
    429 → Rate limit (user should wait)
    Other → Generic error message shown

  AVAILABLE MODELS (user can switch in AI panel header OR settings):
    - llama-3.3-70b-versatile  (default, best quality)
    - llama-3.1-8b-instant     (fastest)
    - qwen/qwen3-32b           (good alternative)
    - meta-llama/llama-4-scout-17b-16e-instruct

  WHERE IN CODE: Section 19, function `sendAiMessage()`

  SYSTEM PROMPT (Section 18):
    Built dynamically by `buildSystemPrompt()`. Contains:
    1. The COMPLETE current code from the editor
    2. The compilation environment (GCC, std, flags)
    3. Last execution result (stdout, stderr, exit code)
    4. Strict anti-hallucination rules:
       - Must provide COMPLETE code, never placeholders
       - Must mentally verify code compiles
       - Must reference specific line numbers
       - Must match LeetCode/HackerRank patterns


## 5. EXECUTION FLOW — WHAT HAPPENS WHEN USER CLICKS "RUN"

  User clicks "Run" button (or Ctrl+Enter)
         │
         ▼
  executeCode(compileOnly=false)     [Section 7]
         │
         ├── syncEditorToFile()      // save editor content to state
         ├── clearMarkers()          // remove old red squiggles
         ├── setRunUi(true)          // show spinner, disable button
         │
         ▼
  TRY: runPiston(code, stdin)        // attempt Piston first
         │
         ├── SUCCESS → use result
         │
         └── FAIL → TRY: runWandbox(code, stdin)  // fallback
                      │
                      ├── SUCCESS → use result
                      │
                      └── FAIL → show "both unreachable" error
         │
         ▼
  setRunUi(false)                    // restore button
  showResult(result)                 // populate Output pane
  parseGccErrors(stderr)             // extract line:col:severity:message
  applyMarkers(diags)                // red/yellow squiggles in editor
  renderDiagnostics(diags)           // clickable error cards in Errors tab
  switchOutputTab(...)               // auto-switch to Errors if errors exist


## 6. STATE MANAGEMENT

All application state lives in the `state` object (Section 3).
State is persisted to localStorage via helper functions.

### 6a. State Object Shape:
  state = {
    monacoReady:    boolean,     // true after Monaco initializes
    editor:         object,      // Monaco editor instance (or fallback)
    theme:          'dark'|'light',
    std:            'c++17',     // selected C++ standard
    groqKey:        'gsk_...',   // Groq API key (empty = not configured)
    model:          'llama-3.3-70b-versatile',  // selected AI model
    flags:          {            // compiler flags
      wall: true, wextra: false,
      o0: false, o2: true, g: false
    },
    files:          [{           // open files
      id: 'abc123',
      name: 'main.cpp',
      content: '#include...',
      tests: [{ name, input, expected, status, actual }]
    }],
    activeId:       'abc123',    // which file is open in editor
    running:        boolean,     // prevents double-click
    aiSending:      boolean,     // prevents duplicate AI requests
    lastResult:     object|null, // last compile/run result
    conversations:  [{           // AI chat history
      id: 'xyz789',
      title: 'Fix my segfault',
      messages: [{ id, role, content, model }],
      createdAt: 1234567890
    }],
    activeConvoId:  'xyz789',    // which conversation is active
    stdinCollapsed: boolean
  }

### 6b. localStorage Keys:
  cf4_theme        → 'dark' or 'light'
  cf4_std          → 'c++17'
  cf4_groq_key     → 'gsk_...'
  cf4_model        → 'llama-3.3-70b-versatile'
  cf4_files        → JSON array of file objects
  cf4_active       → active file ID
  cf4_flags        → JSON object of compiler flags
  cf4_convos       → JSON array of conversation objects
  cf4_active_convo → active conversation ID

### 6c. How state syncs:
  - On change: state object updated → localStorage updated → DOM updated
  - On boot: localStorage read → state hydrated → DOM elements set
    (done in restoreState(), Section 28)


## 7. HTML STRUCTURE MAP (index.html)

  #app
  └── #shell [data-theme="dark"]
      ├── header.topbar
      │   ├── .topbar-left
      │   │   ├── .brand (icon + name)
      │   │   ├── #template-wrap (dropdown)
      │   │   │   ├── #template-btn
      │   │   │   └── #template-dropdown (.dropdown)
      │   │   │       └── [data-template="hello|cp|oop|stl"]
      │   │   └── #new-file-btn
      │   ├── .topbar-center
      │   │   └── #std-select (C++ standard)
      │   └── .topbar-right
      │       ├── #ai-toggle-btn
      │       ├── #compile-btn
      │       ├── #run-btn
      │       ├── #settings-btn
      │       └── #theme-btn
      │
      ├── .tabs-bar
      │   └── #editor-tabs (JS renders file tabs here)
      │
      ├── .workspace
      │   ├── .editor-col
      │   │   ├── #editor-host (Monaco mounts here)
      │   │   │   └── #editor-loading (removed when Monaco loads)
      │   │   └── #stdin-panel
      │   │       └── #stdin-input (textarea)
      │   │
      │   ├── #resize-handle (drag to resize)
      │   │
      │   └── .output-col
      │       ├── .output-header
      │       │   ├── .out-tabs [data-tab="output|errors|tests"]
      │       │   └── #exec-stats (badge + exit code + provider)
      │       └── .output-body
      │           ├── [data-pane="output"]  → #output-content
      │           ├── [data-pane="errors"]  → #errors-content
      │           └── [data-pane="tests"]   → #tests-content
      │
      ├── footer.statusbar
      │   ├── #cursor-pos
      │   ├── #status-std
      │   ├── #status-provider
      │   └── #status-ai
      │
      ├── aside#ai-panel (.collapsed = hidden via transform)
      │   ├── .ai-panel-header
      │   │   ├── .ai-panel-title
      │   │   └── .ai-header-actions
      │   │       ├── #ai-model-select (switch model mid-chat)
      │   │       ├── #ai-history-btn (toggle history panel)
      │   │       ├── #ai-new-chat-btn
      │   │       └── #ai-close-btn
      │   ├── #ai-history-panel (toggles .hidden)
      │   │   └── #ai-history-list (JS renders items)
      │   ├── .ai-quick-actions
      │   │   └── [data-qa="explain|fix|optimize|review|complexity|tests"]
      │   ├── #ai-messages (JS renders chat bubbles)
      │   └── .ai-composer
      │       ├── #ai-input (textarea)
      │       └── #ai-send-btn
      │
      ├── #settings-overlay + #settings-panel (modal)
      │   ├── #settings-groq-key (password input)
      │   ├── #settings-model (select)
      │   ├── #settings-std-field (select)
      │   ├── #flag-wall, #flag-wextra, #flag-o0, #flag-o2, #flag-g
      │   ├── #settings-cancel-btn
      │   └── #settings-save-btn
      │
      └── #nf-overlay + #nf-modal (new file modal)
          ├── #nf-name (text input)
          ├── input[name="nf-tmpl"] (radio buttons)
          ├── #nf-cancel-btn
          └── #nf-create-btn

  #toasts (outside #shell, fixed position, aria-live="polite")


## 8. CSS ARCHITECTURE (style.css)

### 8a. Theme System:
  - CSS custom properties defined in :root (dark theme default)
  - [data-theme="light"] selector overrides all color variables
  - Theme toggled by changing data-theme attribute on #shell
  - Monaco theme synced separately via monaco.editor.setTheme()

### 8b. Key Design Decisions:
  - NO overflow:hidden on #app, #shell, or .topbar
    (this was a BUG — it clipped the template dropdown)
  - overflow:hidden ONLY on .workspace, .editor-col, .output-col
  - AI panel uses .collapsed class (transform + visibility transition)
    NOT .hidden (which uses display:none and breaks animations)
  - Modals/overlays use .hidden (display:none) — no animation needed
  - Z-index layers:
      topbar:         100
      AI panel:       500
      overlay:        800
      modals:         900
      dropdown:      1000
      toasts:        9999

### 8c. Layout:
  - #shell is a flex column filling 100vh
  - Fixed heights: topbar (52px), tabs (36px), status (24px)
  - .workspace gets flex:1 (all remaining space)
  - Inside workspace: editor-col (flex:1) + resize-handle + output-col (400px)
  - Resize handle changes editor-col width via JS drag events


## 9. SCRIPT.JS SECTION MAP

  Section  1: Constants (URLs, templates, models)
  Section  2: Storage helpers (get, set, getJson, setJson, uid)
  Section  3: State object
  Section  4: DOM helpers ($, $$, escHtml, unescHtml)
  Section  5: File management (CRUD, sync with editor)
  Section  6: Compiler flags builder
  Section  7: Code execution (Piston + Wandbox + orchestrator)
  Section  8: Result display (output pane + status badges)
  Section  9: GCC error parser (regex extracts line:col:severity:msg)
  Section 10: Monaco markers (squiggly underlines)
  Section 11: Diagnostics panel (clickable error cards)
  Section 12: Output tab switching
  Section 13: File tab rendering
  Section 14: Test cases (add, run single, run all, delete)
  Section 15: Status bar updates
  Section 16: Toast notifications
  Section 17: Conversation management (create, switch, delete, history)
  Section 18: AI system prompt (anti-hallucination, full context)
  Section 19: AI messaging (send, receive, typing indicator)
  Section 20: Markdown renderer (code blocks, lists, links, etc.)
  Section 21: AI panel open/close with animation
  Section 22: Settings modal (open, close, save)
  Section 23: Theme toggle
  Section 24: Resize handle drag logic
  Section 25: Monaco editor initialization
  Section 26: Fallback textarea editor
  Section 27: New file modal helpers
  Section 28: State restoration (localStorage → DOM)
  Section 29: Event binding (ALL event listeners)
  Section 30: Boot sequence (initialization order)


## 10. AI SYSTEM — DETAILED EXPLANATION

### 10a. Conversation System:
  - Multiple conversations stored in state.conversations[]
  - Each conversation has: id, title, messages[], createdAt
  - Auto-titled from first user message (first 60 chars)
  - Active conversation tracked by state.activeConvoId
  - History panel shows all convos, click to switch
  - "New Chat" creates fresh conversation
  - "Clear All" deletes everything and creates a new one

### 10b. System Prompt (what the AI sees):
  Every API call includes a system prompt built by buildSystemPrompt():

  ┌─────────────────────────────────────────────────────┐
  │ COMPILATION ENVIRONMENT                             │
  │   Compiler: GCC (latest)                            │
  │   Standard: c++17                                   │
  │   Flags: -std=c++17 -Wall -O2                       │
  │   Platform: LeetCode/HackerRank compatible          │
  │                                                     │
  │ CURRENT CODE (42 lines)                             │
  │   ```cpp                                            │
  │   <entire code from editor>                         │
  │   ```                                               │
  │                                                     │
  │ LAST EXECUTION                                      │
  │   Provider: Piston | Exit: 1 | Status: err          │
  │   stderr: main.cpp:15:5: error: ...                 │
  │                                                     │
  │ STRICT RULES                                        │
  │   1. Always provide COMPLETE code                   │
  │   2. Never use "// rest unchanged" placeholders     │
  │   3. Mentally verify code compiles                  │
  │   4. Reference specific line numbers                │
  │   5. Use bits/stdc++.h for competitive programming  │
  │   6. Don't invent problems that don't exist         │
  └─────────────────────────────────────────────────────┘

### 10c. Message Flow:
  User types → pushAiMsg('user', text) → saves to convo →
  → buildAiMessages() (system + last 20 msgs) →
  → POST to Groq API →
  → pushAiMsg('assistant', response) → renderMarkdown() →
  → "Apply to Editor" buttons on C++ code blocks

### 10d. Quick Actions:
  Each quick action button generates a specific prompt:
    explain    → "Walk through my code step by step..."
    fix        → "Fix ALL errors..." (includes stderr if available)
    optimize   → "Optimize for better time/space complexity..."
    review     → "Code review: correctness, edge cases..."
    complexity → "Analyze time and space complexity..."
    tests      → "Generate 6 test cases..."

### 10e. "Apply to Editor" Button:
  When AI returns a ```cpp code block:
    1. Markdown renderer detects language = cpp/c++/cxx/c
    2. Code is encoded via encodeURIComponent and stored in data-code attr
    3. "↳ Apply to Editor" button is added to code block header
    4. On click: decodeURIComponent → unescHtml → editor.setValue()
    5. File is synced to localStorage via syncEditorToFile()


## 11. GCC ERROR PARSING — HOW COMPILER ERRORS ARE HANDLED

  1. User runs code → Piston/Wandbox returns stderr
  2. parseGccErrors(stderr) uses this regex:
     /main.cpp:LINE:COL: (error|warning|note): MESSAGE/
  3. Each match becomes a diagnostic object:
     { line: 15, col: 5, severity: 'error', message: '...' }
  4. applyMarkers(diags) → Monaco red/yellow squiggles in editor
  5. renderDiagnostics(diags) → Clickable cards in Errors tab
  6. Clicking a diagnostic card → editor jumps to that line


## 12. TEST CASE SYSTEM

  - Each file has its own tests[] array
  - Test structure: { name, input, expected, status, actual }
  - Status: 'pending' | 'running' | 'passed' | 'failed' | 'error'
  - "Run" a test: execute code with test.input as stdin,
    compare stdout with test.expected (trimmed, normalized)
  - "Run All": sequential execution of all tests
  - If expected is empty: pass if exit code = 0
  - Tests stored inside file objects in localStorage


## 13. KEYBOARD SHORTCUTS

  Ctrl+Enter       → Run code
  Ctrl+Shift+B     → Compile only
  Ctrl+I           → Toggle AI panel
  Ctrl+N           → New file modal
  Ctrl+,           → Open settings
  Escape           → Close any open modal/panel
  Enter (in AI)    → Send message (Shift+Enter for newline)
  Enter (in modal) → Confirm action


## 14. BOOT SEQUENCE (what happens on page load)

  1. ensureFiles()     — create default file if none exist
  2. ensureConvo()     — create default conversation if none exist
  3. restoreState()    — sync localStorage values to HTML elements
  4. renderTabs()      — draw file tabs
  5. renderTests()     — draw test cases for active file
  6. updateStatusBar() — set std, AI status indicators
  7. bindEvents()      — attach ALL event listeners
  8. initResize()      — setup drag handle
  9. initMonaco()      — load Monaco editor (async)
     └── on fail: initFallbackEditor() — plain textarea
  10. probeProviders()  — background check: Piston/Wandbox alive?


## 15. COMMON MODIFICATIONS GUIDE

### To add a new AI model:
  1. In index.html: add <option> to BOTH #ai-model-select AND #settings-model
  2. That's it — the JS reads the value from the <select> dynamically

### To add a new C++ template:
  1. In script.js Section 1: add entry to TEMPLATES object
  2. In index.html: add <button class="dropdown-item" data-template="KEY">
     inside #template-dropdown
  3. In index.html: add <label class="template-option"> with matching
     radio value inside #nf-modal .template-picker

### To add a new compiler flag:
  1. In index.html: add checkbox inside .flags-grid:
     <label class="flag-toggle"><input type="checkbox" id="flag-NAME"><span>-FLAG</span></label>
  2. In script.js Section 6 buildFlags(): add if (f.NAME) flags.push('-FLAG');
  3. In script.js Section 3: add NAME to default flags object
  4. In script.js Sections 22+28: add NAME to the forEach(['wall',...]) arrays

### To change default C++ standard:
  1. In index.html: change which <option> has "selected" in #std-select
     and #settings-std-field
  2. In script.js Section 3: change default in get(S.std, 'c++XX')

### To change the AI provider (e.g., switch from Groq to OpenAI):
  1. Change GROQ_URL constant to new endpoint
  2. Update Authorization header format if different
  3. Update response parsing in sendAiMessage() if response shape differs
  4. The rest (system prompt, conversation management) stays the same

### To add a new quick action:
  1. In index.html: add <button class="qa-btn" data-qa="KEY">Label</button>
     inside .ai-quick-actions
  2. In script.js Section 18: add KEY to QA object:
     KEY: () => 'Your prompt text here...'

### To change the theme colors:
  1. In style.css: modify :root { } for dark theme
  2. Modify [data-theme="light"] { } for light theme
  3. For Monaco editor colors: modify codeforge-dark theme in Section 25

### To add a new localStorage key:
  1. Add to S object in Section 2
  2. Initialize in state object in Section 3
  3. Save with set() or setJson() when value changes
  4. Load with get() or getJson() in state initialization


## 16. IMPORTANT IMPLEMENTATION DETAILS

### Why Piston uses "c++" not "cpp":
  The Piston API at emkc.org requires the language field to be "c++"
  (with the plus signs). Using "cpp" returns a language-not-found error.

### Why Wandbox flags use newlines:
  Wandbox's "compiler-option-raw" field expects flags separated by
  newline characters (\n), NOT spaces. buildFlags().join('\n') handles this.

### Why the AI panel uses "collapsed" not "hidden":
  The .hidden utility class uses display:none which instantly removes
  the element — no animation possible. The AI panel needs a slide-in
  animation, so it uses:
    .collapsed { transform: translateX(420px+10px); visibility: hidden; }
  With CSS transition on both transform and visibility (with delay).

### Why overflow:hidden was removed from #shell and .topbar:
  The template dropdown menu is absolutely positioned inside .topbar.
  If .topbar has overflow:hidden, the dropdown is clipped and invisible.
  overflow:hidden is kept ONLY on .workspace (to contain the editor).

### Why temperature is 0.1 for AI:
  Lower temperature = more deterministic responses = less hallucination.
  This is critical for code generation where creative/random outputs
  cause compilation errors.

### Why the markdown renderer unescapes HTML for code blocks:
  The code has already been HTML-escaped by escHtml(). But when storing
  code in data-code attribute for "Apply to Editor", it needs to be
  decoded back to raw C++. The flow is:
    Original code → escHtml() → displayed safely
    For data-code: unescaped → encodeURIComponent → stored in attribute
    On click: decodeURIComponent → unescHtml → editor.setValue()

### Why files have their own test arrays:
  Each file object contains a tests[] array so that test cases are
  specific to each file. When switching files, renderTests() shows
  only the tests for the active file.


## 17. ERROR HANDLING STRATEGY

  - API calls: try/catch with AbortSignal.timeout()
  - Piston fail → silent fallback to Wandbox
  - Wandbox fail → show "both unreachable" message
  - Groq 401 → "Invalid API key" toast
  - Groq 429 → "Rate limit" toast
  - Monaco load fail → fallback textarea editor
  - localStorage fail → silently use defaults
  - All errors shown via showToast() or inline in AI chat


## 18. SECURITY NOTES

  - Groq API key stored in localStorage (client-side only)
  - Key never sent anywhere except Groq's API endpoint
  - No analytics, no tracking, no telemetry
  - All code execution happens on Piston/Wandbox servers
  - User code is sent to third-party APIs for compilation
    (this is inherent to browser-based IDEs with no backend)