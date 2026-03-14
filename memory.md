# Memory System Functional Specification

This file explains how memory works in this project, how it is stored, how it is injected into model requests, how it influences different features, and how to reproduce the same subsystem in another project.

This is not written as a vague product note.

It is written as a portable engineering spec so another coder can rebuild the same memory behavior with the same rules, the same guardrails, and the same integration points.

Primary implementation sources:

- `script.js`
- `update.md`
- `guide.md`
- `verba.md`

## 0. Portability Goal

If this memory system is implemented in another project, it should behave like a reusable context subsystem rather than an ad hoc textarea that gets pasted into prompts.

The target result is:

- the host project can store long-term user context
- the host project can switch between memory packs
- the host project can inject the correct memory into different AI tasks automatically
- the host project can keep memory helpful without letting it override current truth
- the host project can restore memory as part of a saved workspace or session
- the host project can explain, in code and in prompts, why the model answered the way it did

Important principle:

- memory is background context, not ground truth

In this project, the transcript and current runtime state are treated as the source of truth for anything current or directly observed.

## 1. What The Memory System Is

The memory system in this project is a long-term context layer.

It is used to hold durable user context such as:

- preferences
- ongoing projects
- terminology
- stable background facts
- working style
- prior exported memory from another assistant

It is not a vector database in this repo.

It is not an embedding search pipeline in this repo.

It is not a hidden autonomous planner in this repo.

It is a structured, persistent, manually imported memory layer that is automatically reused by:

- AI Output tasks
- Ask Transcript
- Verba Assistant
- workspace save and restore flows

## 1.1 What It Is Not

To reproduce this system faithfully, do not describe it incorrectly.

This project does not currently implement:

- semantic retrieval over chunked memories
- embedding similarity search
- ranked retrieval from a memory corpus
- automatic extraction of memory from every conversation
- a separate machine-learning intent classifier dedicated to memory routing

Its intent behavior is simpler and more controlled:

- the app knows what task the user triggered
- the app applies task-specific memory rules
- the app injects memory into prompts only as allowed by those rules

That distinction matters.

## 2. Non-Negotiable Functional Guarantees

If another project wants the same behavior, preserve these guarantees:

- one active memory pack at a time
- at least one memory pack must always exist
- the default pack must be recoverable even when no packs were previously saved
- imported memory must be normalized before storage
- memory must persist across reloads
- memory must restore as part of workspace state
- AI tasks must use the active pack automatically
- different task types must use memory with different strength
- transcript and runtime state must override memory on conflict
- memory must be truncated before prompt injection when needed
- the user must be able to clear memory without breaking the pack system
- the user must be able to copy a built-in export prompt to fetch memory from another AI system

## 3. High-Level Architecture

Treat the memory subsystem as these modules:

- `memory-store`
  - persistent storage and restore
- `memory-pack-manager`
  - create, delete, normalize, select active pack
- `memory-normalizer`
  - sanitize imported memory text
- `memory-context-builder`
  - build prompt-ready memory context with truncation and guardrails
- `memory-policy-layer`
  - decide how strongly a task may use memory
- `memory-prompt-injector`
  - attach memory to model requests
- `memory-workspace-adapter`
  - save and restore memory inside workspace payloads
- `memory-ui-adapter`
  - connect textareas, selects, buttons, status chips, and helper text

Another project can rename these modules, but it should preserve these responsibilities.

## 4. Data Model

The current project effectively uses this shape:

```ts
type MemoryPack = {
  id: string;
  name: string;
  raw: string;
  importedAt: string;
};

type MemoryState = {
  memoryRaw: string;
  memoryImportedAt: string;
  memoryPacks: MemoryPack[];
  activeMemoryPackId: string;
  outputStyle: string;
};
```

Important behavior:

- `memoryRaw` and `memoryImportedAt` mirror the currently active pack
- `memoryPacks` is the canonical list
- `activeMemoryPackId` decides which pack is in force
- `outputStyle` is not memory itself, but it is tightly coupled to how memory-aware output is produced

## 4.1 Storage Keys

This project stores memory in browser `localStorage` using these keys:

```txt
vt_memory_raw
vt_memory_imported_at
vt_memory_packs
vt_memory_pack_active
vt_output_style
```

If you port this to another project, you may rename the keys, but keep the same separation of concerns:

- full pack list
- active pack id
- active pack mirror values
- style selection that affects downstream output

## 4.2 Minimum Persistent Contract

A faithful port should persist:

- all packs
- active pack id
- active pack text
- active pack import time
- output style

If any of these are omitted, the behavior becomes only partially compatible with this project.

## 5. Pack Lifecycle

The memory system is pack-based.

The user can maintain separate context sets for different workstreams, for example:

- Client A
- Startup
- Personal
- Research
- Hiring

But only one pack is active at a time.

That is deliberate.

The app does not merge multiple packs into a single prompt.

This keeps the prompt smaller, easier to reason about, and less likely to contaminate one context with another.

## 5.1 Default Pack

When the app normalizes packs and none exist, it creates:

```ts
{
  id: "memory_primary",
  name: "Primary",
  raw: normalizedExistingMemoryRaw,
  importedAt: existingImportedAt
}
```

This means the system never truly operates without a pack container.

Even when memory is empty, there is still a valid primary pack.

## 5.2 Pack Normalization Rules

When loading packs, the project normalizes:

- `id`
  - forced to string
- `name`
  - forced to string, trimmed, and given a fallback name
- `raw`
  - normalized through memory text cleanup
- `importedAt`
  - forced to string

If you port this, preserve normalization on load, not only on write.

That protects the app from malformed saved state.

## 5.3 Active Pack Synchronization

The app mirrors the active pack into top-level state.

Conceptually:

```ts
function syncActiveMemoryPackState() {
  const active = getActiveMemoryPack();
  if (!active) {
    state.memoryRaw = "";
    state.memoryImportedAt = "";
    return;
  }
  state.activeMemoryPackId = active.id;
  state.memoryRaw = normalizeImportedMemory(active.raw || "");
  state.memoryImportedAt = active.importedAt || "";
}
```

This matters because downstream consumers can read `state.memoryRaw` without repeatedly resolving the active pack object.

## 5.4 Create Pack

Creating a pack:

- requires a non-empty name
- generates a unique id
- adds a new empty pack
- makes it active immediately
- syncs top-level memory state
- persists the store
- rerenders memory UI
- rerenders assistant messages
- schedules workspace save

This design ensures the new pack is immediately live everywhere.

## 5.5 Delete Pack

Delete behavior is intentionally defensive.

If more than one pack exists:

- remove the active pack
- fall back to the first remaining pack
- sync and persist

If only one pack exists:

- do not remove the final pack container
- clear its `raw`
- clear its `importedAt`
- keep the pack alive as `Primary`

This is an important portability rule:

- deleting the last pack should clear it, not destroy the memory system structure

## 6. Import Workflow

The memory system is designed around importing exported user memory from another assistant or system.

The user does not need to rebuild all preferences manually.

Instead, the app ships a built-in export prompt that can be copied and used elsewhere.

## 6.1 Built-In Export Prompt

The project contains a constant called `MEMORY_IMPORT_PROMPT`.

Its job is to ask another assistant to export stored memory in a consistent format.

The prompt requests categories in this order:

- Instructions
- Identity
- Career
- Projects
- Preferences

It also requests:

- one entry per line
- oldest first
- a dated line format
- `[unknown]` when the date is missing
- the entire export wrapped in one code block
- a note after the block saying whether the export is complete

This prompt is part of the product workflow and should be preserved in another implementation.

## 6.2 Import Entry Point

When the user clicks import:

1. the app reads the memory textarea
2. it normalizes the text
3. it rejects empty input
4. it writes the normalized text into the active pack
5. it stamps `importedAt` with the current ISO timestamp
6. it syncs active memory state
7. it persists the store
8. it rerenders memory UI
9. it rerenders assistant messages
10. it schedules workspace save

That means import is not just a visual save.

It immediately changes the context used by the application.

## 6.3 Clear Entry Point

Clear memory:

- empties the visible textarea
- calls the same setter with an empty string
- clears the active pack content
- clears the timestamp
- persists and rerenders

This preserves the pack, but removes the imported memory payload.

## 7. Memory Text Normalization

Imported memory is cleaned before being stored.

The normalizer currently does three important things:

- converts Windows line endings to `\n`
- trims outer whitespace
- removes surrounding fenced code block markers if the export was wrapped in triple backticks

Conceptually:

```ts
function normalizeImportedMemory(text = "") {
  let value = String(text || "").replace(/\r\n/g, "\n").trim();
  value = value
    .replace(/^```[a-zA-Z0-9_-]*\s*/m, "")
    .replace(/\s*```$/m, "")
    .trim();
  return value;
}
```

This is important because the export prompt explicitly asks another system to wrap the output in a code block.

Without normalization, those wrappers would pollute the actual memory payload.

## 8. How Memory Is Turned Into Model Context

The project does not send raw memory blindly.

It builds a prompt-ready memory block with:

- active pack name
- instructions on how memory should be used
- conflict-precedence rules
- the memory content itself
- truncation when needed

Conceptually:

```ts
function getImportedMemoryContext({ maxChars = 9000 } = {}) {
  ensureMemoryPackStore();
  const raw = normalizeImportedMemory(state.memoryRaw || "");
  if (!raw) return "";

  const compact =
    raw.length > maxChars
      ? `${raw.slice(0, maxChars).trim()}\n\n[Imported memory truncated for token control]`
      : raw;

  const activePack = getActiveMemoryPack();
  return [
    `Imported user memory from pack: ${activePack?.name || "Primary"}`,
    "Use this for preferences, ongoing projects, terminology, and stable background context.",
    "If transcript or runtime state conflicts with memory, trust the transcript/runtime state first.",
    "",
    compact
  ].join("\n");
}
```

This small wrapper is one of the most important parts of the system.

It prevents memory from acting like unrestricted truth.

## 8.1 Truncation And Token Control

Memory is capped before prompt injection.

Current behavior:

- `AI Output` and `Ask Transcript` use up to `9000` characters
- `Verba Assistant` uses up to `7000` characters

If memory exceeds the limit:

- only the front portion is sent
- a truncation note is appended

This means the system optimizes for stable context retention while guarding total prompt size.

A faithful port should preserve:

- deterministic truncation
- explicit truncation notice
- different limits for different surfaces when needed

## 9. How Intent Understanding Actually Works

The user asked how the app is able to detect and understand intent accurately.

In this project, intent is not primarily inferred through a separate memory intelligence engine.

Instead, intent comes from the combination of:

- the UI action the user triggered
- the named task that action maps to
- the transcript or message content
- the selected output style
- task-specific memory guidance
- runtime state

So the logic is closer to controlled task routing than to free-form hidden inference.

## 9.1 Intent Inputs

These are the main signals:

- `task.name`
  - for example `ai-clean`, `summary`, `action-items`, or `prompt-pack*`
- transcript content
- assistant thread content
- active memory pack
- output style
- runtime app settings

## 9.2 Task-Specific Memory Policy

The project contains a dedicated function for memory usage policy:

```ts
function getTaskMemoryGuidance(taskName = "") {
  if (taskName === "ai-clean") {
    return "Use memory lightly for terminology, proper nouns, and writing preferences. Do not inject unrelated facts.";
  }
  if (taskName === "summary") {
    return "Use memory strongly to prioritize what matters most to this user, their projects, and their preferred output style.";
  }
  if (taskName === "action-items") {
    return "Use memory to interpret project context and likely priorities, but only derive action items from what the transcript supports.";
  }
  if (String(taskName || "").startsWith("prompt-pack")) {
    return "Use memory strongly to tailor the prompt structure, requirements, context, and examples to the user's actual goals.";
  }
  return "Use memory when it improves relevance, but do not let it override transcript facts or invent missing information.";
}
```

This is the clearest answer to how intent and memory are combined:

- the app already knows the current task
- each task has an explicit policy for how memory may influence the answer

That is why the system stays more accurate than a loose "always stuff memory into the prompt" approach.

## 9.3 Why This Improves Accuracy

Memory improves accuracy here by helping the model:

- recognize the user’s recurring terminology
- understand which projects are relevant
- format answers in the user’s preferred style
- prioritize likely important details
- avoid misreading domain-specific names

But accuracy is protected by limiting memory’s authority:

- transcript facts win
- runtime state wins
- action items must still be transcript-supported
- cleanup should not invent facts

## 10. Where Memory Is Used

The active memory pack is automatically reused across multiple surfaces.

## 10.1 AI Output

`AI Output` tasks call the chat model with:

- the task system prompt
- the current output style instruction
- task-specific memory guidance
- imported memory context when available
- the transcript

The key structure is:

```ts
messages: [
  { role: "system", content: task.system },
  { role: "system", content: `Current output style: ${styleInstruction}` },
  ...(importedMemory ? [{
    role: "system",
    content: `${getTaskMemoryGuidance(task?.name)}\n\n${importedMemory}`
  }] : []),
  { role: "user", content: `${task.user}\n\nTranscript:\n${text}` }
]
```

This means memory is never the only system instruction.

It is layered under:

- the task definition
- the output style definition

That ordering is intentional.

## 10.2 Ask Transcript

The transcript-question flow is even stricter.

Its system instruction says, in effect:

- answer questions about a transcript
- use the transcript as current truth
- use imported memory only as background context

Then it adds the active memory pack as a separate system message only if memory exists.

This is one of the most important trust rules in the project.

A faithful port should preserve the phrasing intent even if wording changes:

- transcript first
- memory second

## 10.3 Verba Assistant

The embedded assistant also consumes memory automatically.

Its prompt context includes:

- assistant knowledge base
- runtime summary
- preferred output style
- imported memory, if present

The memory injection is explicit:

- use imported memory as long-term context
- use it for preferences, projects, terminology, and stable background facts
- do not let it override transcript text or current runtime state when they conflict

This makes the assistant feel personalized without letting it drift away from the actual current workspace state.

## 10.4 Runtime Summary

The assistant runtime summary also exposes memory state:

- whether memory is loaded
- which memory pack is active
- what output style is selected

This gives the assistant two useful forms of grounding:

- raw imported memory content
- current app memory status

Both are important.

The first tells it what the user tends to care about.

The second tells it what is active right now.

## 10.5 Workspace Save And Restore

Memory is part of the workspace payload.

This is critical for portability.

If another project ports memory but does not include it in saved workspaces, the behavior will feel incomplete.

The workspace payload includes:

- `memoryRaw`
- `memoryImportedAt`
- `memoryPacks`
- `activeMemoryPackId`
- `outputStyle`

During restore, the app:

1. reads saved workspace data
2. restores pack list
3. restores active pack id
4. restores output style
5. normalizes packs
6. syncs the active pack into top-level state
7. rerenders memory UI

That makes the memory system portable across sessions, not just persistent inside one tab.

## 11. Output Style And Memory

Output style is not identical to memory, but it is part of the same context-control layer.

Current style options are:

- `default`
- `concise`
- `executive`
- `technical`
- `founder`
- `client-ready`
- `meeting-notes`

The app converts the selected style into a system instruction such as:

- balanced and practical
- compact and low-fluff
- executive-oriented
- precise and implementation-aware
- founder/operator brief
- polished client-facing output
- meeting-note structure

Memory and output style work together:

- memory tells the model what matters to the user
- style tells the model how to express the answer

That separation is one reason the system stays understandable.

## 12. UI Behavior

The memory UI is not only decorative.

It communicates actual system state.

The memory area includes:

- memory pack selector
- memory textarea
- import button
- clear button
- new pack name input
- create pack button
- delete pack button
- export prompt textarea
- copy prompt button
- output style select
- helper/status text

UI status includes:

- whether memory is loaded
- active pack name
- relative import time
- imported character count
- reminder that AI Output and Verba Assistant use the active pack automatically

These signals matter because they make the memory system auditable by the user.

## 12.1 Event Logic

Current event wiring is functionally:

- pack selector change
  - activate selected pack
- create pack click
  - create and activate new pack
- delete pack click
  - delete or clear according to pack-count rules
- copy prompt click
  - copy built-in export prompt
- import click
  - normalize and persist imported memory
- clear click
  - clear active pack memory
- output style change
  - persist style and refresh assistant/memory UI

Another project does not need the same HTML, but it should preserve these state transitions.

## 13. Conflict Resolution Rules

This is the single most important correctness policy in the subsystem.

Priority order is:

1. transcript or directly observed current content
2. runtime state and current app settings
3. active memory pack
4. generic assistant knowledge base and model prior knowledge

Memory should never be allowed to override:

- the actual transcript text
- the current selected mode
- current provider/model settings
- current uploaded files or attachments
- current conversation messages

This rule is stated in multiple prompt layers in the current project and should remain explicit in a port.

## 14. How The System Tries To Make Sense

The user asked how the system "tries to combine the logic to make sense."

The answer is that it combines three different kinds of context:

- immediate evidence
  - transcript, attachments, current chat message, current runtime state
- durable user background
  - imported memory pack
- formatting and decision framing
  - output style plus task instructions

The system does not treat all context equally.

Instead it uses a controlled hierarchy:

- first understand the immediate task
- then ground on current evidence
- then use memory to interpret terminology, priorities, and preferences
- then shape the answer in the selected style

This layered approach is what makes the behavior coherent.

## 15. Recommended Portable Implementation

If this subsystem is being moved into another project, implement it as a memory service with a narrow API.

Example interface:

```ts
type MemoryContextRequest = {
  surface: "assistant" | "ai-output" | "ask-transcript";
  taskName?: string;
  maxChars?: number;
};

type MemoryService = {
  ensureStore(): void;
  listPacks(): MemoryPack[];
  getActivePack(): MemoryPack | null;
  setActivePack(id: string): void;
  createPack(name: string): MemoryPack;
  deleteActivePack(): void;
  setImportedMemory(rawText: string): void;
  clearImportedMemory(): void;
  getPromptContext(input: MemoryContextRequest): string;
  getTaskPolicy(taskName?: string): string;
  serialize(): MemoryState;
  restore(payload: Partial<MemoryState>): void;
};
```

This is a better long-term design than scattering memory logic through UI handlers.

## 15.1 Host Project Binding Contract

For the feature to bind cleanly into another project, the host app should provide:

- a durable storage adapter
- a task router or named task registry
- a prompt builder for each AI surface
- a workspace/session serializer
- a UI or settings layer for pack management
- a way to rerender dependent surfaces when memory changes

Without those bindings, the subsystem will exist but will not behave like it does here.

## 15.2 Minimum Integration Points

To match this project closely, memory should be injected into:

- transcript cleanup and transformation tasks
- summarization
- action item extraction
- prompt generation flows
- assistant conversation prompts
- saved workspace state

## 16. Reliability And Failure Handling

A portable version should define expected failures explicitly.

### 16.1 Empty Memory

If there is no imported memory:

- do not inject a memory system message
- do not fail the task
- continue with transcript, runtime state, and task instructions only

### 16.2 Corrupt Stored Packs

If saved packs are malformed:

- normalize them on load
- restore at least one valid default pack
- recover active pack selection automatically

### 16.3 Oversized Memory

If memory is too large:

- truncate deterministically
- append a truncation note
- avoid silent overflow

### 16.4 Wrong Active Pack

If the stored active pack id is missing or invalid:

- fall back to the first normalized pack
- sync mirrors
- persist the corrected state

## 17. Security And Privacy Notes

This repo stores memory locally in the browser.

That means:

- imported memory may contain highly sensitive user context
- anyone with access to the same browser profile may be able to inspect it
- prompts sent to providers may include memory content

A production port should consider:

- encrypted local storage
- server-side secrets handling if moved off client-only architecture
- redaction options
- memory retention controls
- provider-specific privacy policies

Those improvements are not fully implemented in this repo, but they matter for a serious deployment.

## 18. Acceptance Checklist For A Faithful Port

Another project should be considered memory-compatible with this one only if all of these are true:

- it supports multiple named memory packs
- exactly one pack is active at a time
- it always preserves at least one valid pack
- it normalizes imported memory text
- it stores import timestamps
- it persists memory and active pack selection
- it injects memory into AI Output automatically
- it injects memory into transcript QA automatically
- it injects memory into the assistant automatically
- it keeps transcript/runtime state above memory in precedence
- it supports task-specific memory policies
- it includes output-style interaction
- it restores memory through workspace/session restore
- it exposes enough UI or API state for the user to know what memory is active

## 19. Test Matrix

Before calling another implementation complete, test at least these cases:

- import valid memory into an empty default pack
- create multiple packs and switch between them
- delete a non-primary active pack
- delete when only one pack exists
- restore from saved workspace with multiple packs
- use summary task with memory present
- use action-items task with memory present and verify transcript facts still dominate
- use assistant replies with memory present
- use assistant replies with memory absent
- import memory wrapped in a code block and confirm wrappers are removed
- import oversized memory and confirm truncation note appears in prompt context
- save output style, reload, and verify it is still applied
- restore invalid active pack id and verify fallback recovery

## 20. Bottom-Line Design Rule

If another coder needs one sentence that captures this subsystem, it is this:

The memory system is a persistent, pack-based long-term context layer that personalizes AI behavior across the app, while remaining explicitly subordinate to current transcript evidence and runtime state.

