
# 📝 **Teleprompter App — Coding Agent Implementation Instructions**

## 🔧 **Goal**

Implement a minimal, responsive, dark-mode web application that:

* uses **React** + **Vite** + **TypeScript** (latest stable versions),
* uses **TailwindCSS** + **shadcn/ui** for UI (latest stable versions),
* performs **real-time transcription** using **AssemblyAI’s Realtime WebSocket API**,
* stores the **API key entirely client-side** (backend must never see the key),
* supports **pluggable STT providers** for future extensions,
* provides a simple **teleprompter** UI with:

  * script text input
  * adjustable text size
  * full-screen view
  * responsive layout
  * always in dark mode
* keeps dependencies minimal (avoid unnecessary packages; focus on native APIs + shadcn/ui components).

No backend is required for this version.

---

# 📁 **Project Structure**

Create the following structure:

```
frontend/
  index.html
  vite.config.ts
  tailwind.config.cjs
  postcss.config.cjs
  tsconfig.json
  package.json
  src/
    main.tsx
    App.tsx
    components/
      ApiKeyManager.tsx
      ScriptEditor.tsx
      TeleprompterView.tsx
      ControlsBar.tsx
      LayoutShell.tsx
    hooks/
      useTeleprompter.ts
    stt/
      SttProvider.ts
      AssemblyAIProvider.ts
    lib/
      crypto.ts
      fullscreen.ts
```

Keep the project lean and avoid installing unnecessary libraries.

---

# 📦 **Setup Requirements**

Use **latest stable versions** of:

* React
* React DOM
* Vite
* TypeScript
* TailwindCSS
* shadcn/ui
* PostCSS / Autoprefixer

Install dependencies:

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install -D shadcn-ui@latest
npx shadcn-ui init
```

Add only required shadcn components:

```bash
npx shadcn-ui add button textarea slider toggle switch input dialog
```

Avoid any additional UI libraries.

---

# 🎨 **Tailwind & Dark Mode Setup**

Configure `tailwind.config.cjs`:

```js
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#020817",
        foreground: "#F9FAFB",
      },
    },
  },
  plugins: [],
};
```

Ensure the root `<div>` uses:
`className="dark bg-background text-foreground min-h-screen"`

---

# 🔐 **Client-Side API Key Handling**

### Requirements:

* The user manually enters their **AssemblyAI API key**.
* The key is kept in **React state** by default (session-only, safest).
* Optionally allow: “Remember my key on this device”

  * Implement encryption using the WebCrypto API (AES-GCM + PBKDF2).
  * Store only the **encrypted** key in `localStorage`.
  * Never store raw API keys on disk.

### Implement in `lib/crypto.ts`:

Provide:

* `encryptWithPassphrase(secret: string, passphrase: string): Promise<string>`
* `decryptWithPassphrase(jsonString: string, passphrase: string): Promise<string>`

Use:

* PBKDF2 (100k iterations, SHA-256)
* AES-GCM with random IV

Avoid external crypto libraries — **use only WebCrypto**.

### Implement an `ApiKeyManager` that:

* Renders:

  * API key input field (shadcn `<Input>`).
  * Checkbox “Remember this key on this device”.
  * If checked: passphrase dialog for encryption/decryption.
* After successful entry:

  * Keep key in React state.
* Never send this key to any backend.

---

# 🎤 **Realtime STT Architecture**

### Requirements:

* No backend — browser connects directly to AssemblyAI Realtime WebSocket API.
* The API key must be passed as:

  * WebSocket subprotocol, OR
  * Query parameter `?authorization=YOUR_KEY` (AssemblyAI supports this pattern)
* Use native `WebSocket` and Web Audio API — no external libraries.

### Implement a pluggable STT provider interface

**`stt/SttProvider.ts`:**

```ts
export type TranscriptEvent = {
  transcript: string;
  endOfTurn: boolean;
  raw?: any;
};

export interface IRealtimeSttProvider {
  connect(apiKey: string): Promise<void>;
  disconnect(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  onTranscript(cb: (event: TranscriptEvent) => void): void;
  isConnected(): boolean;
  isStreaming(): boolean;
}
```

### Provide an AssemblyAI implementation

`AssemblyAIProvider.ts`:

* On `connect(apiKey)`:

  * Open WebSocket to:

    ```
    wss://api.assemblyai.com/v3/realtime?sample_rate=16000&encoding=pcm_s16le&authorization=API_KEY
    ```
* Set `binaryType = "arraybuffer"`
* On `start()`:

  * Capture microphone audio
  * Downsample to 16 kHz mono
  * Convert Float32 → Int16 PCM
  * Send binary frames every ~30–50 ms
* Parse incoming JSON messages and call `onTranscript()`.

**Must not add unnecessary DSP libraries.
Use only built-in Web Audio API.**

---

# 📚 **Teleprompter Logic (Minimal Version)**

### Implement `useTeleprompter.ts`:

State:

* `scriptText`
* `fontSize` (default: 32 px)
* `isFullscreen`
* `currentTranscript` (optional future use)

Functions:

* `increaseFont()`
* `decreaseFont()`
* (Later: alignment logic can be plugged into this hook)

---

# 🧩 **UI Components**

Keep components minimal and dependency-free, using only shadcn and Tailwind.

### `LayoutShell.tsx`

* Header
* Responsive layout (`flex-col md:flex-row`)
* Full dark-mode background

### `ScriptEditor.tsx`

* Textarea input using shadcn `<Textarea>`
* Left sidebar on desktop, top section on mobile

### `TeleprompterView.tsx`

* Centered text with adjustable font size
* Dark background with subtle gradient overlay
* Full-screen toggle using the `fullscreen.ts` helper

### `ControlsBar.tsx`

* Buttons for:

  * Increase text size
  * Decrease text size
  * Connect STT
  * Start mic
  * Stop mic
* Use shadcn `<Button>`

---

# 🔲 **Fullscreen Helper**

`fullscreen.ts`:

```ts
export function enterFullscreen(el: HTMLElement) {
  el.requestFullscreen?.();
}
export function exitFullscreen() {
  document.exitFullscreen?.();
}
export function isFullscreenElement(el: HTMLElement | null): boolean {
  return document.fullscreenElement === el;
}
```

---

# 🧭 **App Wiring**

In `App.tsx`:

1. Render `ApiKeyManager` until an API key is available.
2. Instantiate the STT provider (`AssemblyAIProvider`).
3. Pass the API key into `provider.connect()`.
4. Wire provider state into `useTeleprompter`.
5. Render teleprompter UI and controls.
6. Always apply dark mode.

---

# 📱 **Responsiveness Requirements**

* Mobile-first layout
* On small screens:

  * ScriptEditor appears above TeleprompterView
* On medium+ screens:

  * ScriptEditor is left column
  * TeleprompterView fills rest

Use only Tailwind for responsiveness.

---

# 🚫 **Dependency Restrictions**

The coding agent **must not**:

* Add additional UI libraries
* Add DSP, audio, or crypto libraries
* Add heavy utility libraries (Lodash, Moment, etc.)
* Add state-management libraries (Redux, Zustand, etc.)

Only allowed dependencies:

* React / React DOM
* Vite
* TypeScript
* TailwindCSS
* PostCSS
* Autoprefixer
* shadcn/ui + Radix primitives
* (Optional) A minimal type helper library **only if strictly needed**

Everything else must use native Web APIs.

---

# ✔️ **Definition of Done**

The deliverable must:

1. Build successfully with Vite (latest stable).
2. Render a responsive, dark-mode teleprompter UI.
3. Accept a user-entered AssemblyAI API key and store it securely:

   * In memory by default
   * Optionally encrypted in localStorage
4. Connect to AssemblyAI Realtime WebSocket API directly from the browser.
5. Capture microphone audio and stream PCM16 frames to the API.
6. Display live transcript text (even if not yet used for alignment).
7. Support adjustable text size.
8. Support full-screen teleprompter view.
9. Use only the required minimal dependencies.
10. Be implemented using clean, modular, well-typed TypeScript.

---

If you want, I can also generate:

* A ready-to-use `/frontend` boilerplate repo
* A README for end users
* A version that includes fuzzy alignment and auto-scroll

Just let me know!
