# Teleprompter Ultra

A minimal, dark-mode teleprompter that runs entirely in the browser. It streams microphone audio directly to AssemblyAI's Realtime WebSocket API (bring your own API key) and shows live transcripts next to your script.

## Getting started locally

1. **Install dependencies**
   ```bash
   cd frontend
   npm install
   ```
2. **Run the dev server**
   ```bash
   npm run dev
   ```
   Vite will print a local URL (typically http://localhost:5173). Open it in your browser.
3. **Enter your AssemblyAI key**
   * The app never sends your key to a backend. Paste your personal AssemblyAI API key when prompted.
   * Optional: toggle "Encrypt in this browser" to store the key in encrypted localStorage between sessions.
4. **Connect and test**
   * Click **Connect** to open the realtime WebSocket.
   * Use **Start mic** to begin streaming audio and watch the live transcript beneath your script.
   * Adjust text size with the +/- buttons or slider, and toggle fullscreen in the teleprompter view as needed.

> Note: A testing API key is available in the Codex secrets if you need to validate the flow, but the UI always expects you to provide a key at runtime.

## Project structure

The frontend lives entirely in `/frontend`:

```
frontend/
  index.html
  vite.config.ts
  tailwind.config.cjs
  postcss.config.cjs
  tsconfig.json
  tsconfig.node.json
  src/
    main.tsx
    App.tsx
    index.css
    components/
      LayoutShell.tsx
      ApiKeyManager.tsx
      ScriptEditor.tsx
      TeleprompterView.tsx
      ControlsBar.tsx
      ui/
        button.tsx
        input.tsx
        textarea.tsx
        switch.tsx
        toggle.tsx
        slider.tsx
        dialog.tsx
    hooks/
      useTeleprompter.ts
    stt/
      SttProvider.ts
      AssemblyAIProvider.ts
    lib/
      crypto.ts
      fullscreen.ts
      utils.ts
    vite-env.d.ts
```

## Notes

- Dark mode is always on (`className="dark bg-background text-foreground"`).
- Only minimal dependencies are used: React + Vite + Tailwind + shadcn-style UI primitives.
- The STT provider is pluggable; AssemblyAI is the default implementation today.
