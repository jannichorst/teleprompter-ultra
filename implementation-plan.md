# Implementation Plan

## Overview
This plan outlines how to build the Teleprompter App as described in `project.md`, covering setup, feature development, integration points, and validation steps.

## Milestones & Tasks

### 1) Project Scaffolding & Tooling
- Scaffold Vite + React + TypeScript app in `frontend/` using the latest stable versions.
- Install TailwindCSS, PostCSS, Autoprefixer, and initialize Tailwind with dark mode enabled per spec.
- Initialize shadcn/ui with required components: button, textarea, slider, toggle, switch, input, dialog.
- Configure `tsconfig`, `vite.config`, and project scripts for development/build.

### 2) Styling & Theming
- Apply Tailwind configuration from `project.md` (dark mode class strategy, custom background/foreground colors, content globs).
- Ensure root layout (`App` or layout shell) applies `className="dark bg-background text-foreground min-h-screen"`.
- Set up global styles to ensure full dark-mode experience and responsive typography.

### 3) Core Layout & Components
- Create component scaffold under `src/components/`:
  - `LayoutShell`: Handles responsive split layout (column on mobile, row on md+), padding, and background.
  - `ApiKeyManager`: UI for entering/storing API key; supports in-memory and optional encrypted localStorage using helper.
  - `ScriptEditor`: Textarea for script content; positioned top on mobile, left on desktop.
  - `TeleprompterView`: Displays script/transcript text with adjustable font size, centered, gradient overlay, and fullscreen toggle using helper.
  - `ControlsBar`: Buttons for size adjustments, connect STT, start/stop mic; wired to hooks/provider.
- Wire components together in `App.tsx` to show `ApiKeyManager` until key exists, then render teleprompter UI.

### 4) Hooks & State Management
- Implement `useTeleprompter` hook to manage script text, transcript text, font size, provider connection state, and microphone lifecycle.
- Expose actions for size increase/decrease, connect/disconnect, start/stop mic, and updating script.
- Keep state lean and typed; rely on React hooks without external state libraries.

### 5) STT Provider Abstraction
- Define `SttProvider` interface in `src/stt/SttProvider.ts` covering connect/disconnect, streaming audio, and transcript event callbacks.
- Implement `AssemblyAIProvider` to handle client-side WebSocket connection with the provided API key, including:
  - Building websocket URL with auth key passed client-side only.
  - Handling ready/connecting/error states and emitting transcript updates.
  - Sending PCM16 audio frames to the API.
- Keep design pluggable for future STT providers by isolating provider-specific logic.

### 6) Audio Capture & Streaming
- Use native `MediaDevices.getUserMedia` to capture microphone audio.
- Convert audio to PCM16 frames (minimal, browser-native approach) and stream via provider.
- Provide start/stop mic controls and clean up audio tracks on teardown.

### 7) Crypto & Fullscreen Helpers
- Implement `lib/crypto.ts` for optional localStorage encryption/decryption of API key (using Web Crypto SubtleCrypto; avoid external libraries).
- Implement `lib/fullscreen.ts` helper exactly as specified for enter/exit/fullscreen checks.

### 8) UX & Responsiveness
- Ensure mobile-first layout with `flex-col md:flex-row`; ScriptEditor above TeleprompterView on small screens, left column on desktop.
- Teleprompter text centered with adjustable font size; ensure focus on legibility and dark theme.
- Provide fullscreen toggle and accessible controls (ARIA labels where appropriate).

### 9) Validation & QA
- Run `npm run build` to verify Vite build success.
- Exercise UI manually: API key entry, connect STT flow (mocking or dry-run connection if necessary), mic start/stop, text size adjustments, fullscreen toggle.
- Confirm dependency list remains minimal per restrictions.

## Definition of Done
- Vite project builds successfully (`npm run build`).
- Responsive dark-mode teleprompter UI renders with script editor, teleprompter view, and controls.
- User can enter AssemblyAI API key; key is kept client-side with optional encrypted localStorage storage.
- App connects to AssemblyAI Realtime WebSocket API from the browser and streams PCM16 audio captured from the microphone.
- Live transcript text is displayed while streaming.
- Text size can be adjusted via controls.
- Teleprompter view supports fullscreen toggling using the provided helper.
- Codebase uses only allowed minimal dependencies and is implemented with clean, modular, well-typed TypeScript.
