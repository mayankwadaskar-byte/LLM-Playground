# Private LLM Playground

A browser-only playground for chatting with LLMs, built to leak as little as possible.
No backend, no database, no analytics, no third-party scripts or fonts.

Inspired by the Newton School LLM playground, then extended with streaming, local-model support and privacy tooling.

## Features

| Area | What it does |
|---|---|
| Providers | Groq, OpenAI, OpenRouter, plus **Ollama** and **LM Studio** that run on your own computer (nothing leaves your machine) |
| Streaming | Live token-by-token output, with a Stop button (Esc) |
| Controls | Model list loader, system prompt, temperature, top-p, max tokens, stop sequences, seed, reasoning effort |
| Metrics | Time to first answer token, total time, tokens/second, input / reasoning / output tokens, rate-limit tokens left |
| Prompt analysis | Zero-shot vs few-shot vs multi-turn detection, live token estimate |
| Code export | curl, Python (OpenAI client) and JavaScript for the exact request, key read from an env var |
| Languages | Interface and replies in English, हिन्दी, मराठी, Hinglish, उत्तराखंडी (Garhwali/Kumaoni) and 中文. The model is told to reply in the chosen language |
| Voice input | Dictate into the prompt box (Alt+M). Keeps listening through long pauses, restarts itself between browser cut-offs, never sends anything until you press Send, keeps manual edits |
| Read aloud | 🔊 on every reply, using an on-device voice when one is installed |
| Thinking view | Shows reasoning tokens for models that stream them |

## Privacy design

- **Direct to provider.** Requests go from the browser to the provider you pick. No proxy of mine.
- **Enforced by the browser.** A Content-Security-Policy lets the page talk only to the listed provider hosts and localhost. Even a bug or a malicious dependency could not send data elsewhere. There are no dependencies.
- **Memory-only by default.** Chats and API keys vanish when the tab closes. Optional key storage: this tab (`sessionStorage`) or encrypted on-device (AES-GCM, key from your passphrase via PBKDF2, 310k rounds).
- **PII redaction.** Emails, phone numbers, Aadhaar, PAN, Luhn-valid card numbers, IPs and API keys are replaced with placeholders (`[EMAIL_1]`) before sending. The originals are restored in *your* view only.
- **Network transparency panel.** Every request is listed with the exact JSON body that left your browser.
- **Auto-wipe** after 5/15/30 minutes idle, and a **Wipe everything** button (`Ctrl+Shift+Backspace`).
- The system prompt and chats are never written to storage. Only harmless settings (model, sliders) are remembered.
- `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, `cache: 'no-store'` on every request.

Remember: the provider still sees what you send, under its own policy. For zero exposure use Ollama / LM Studio.

## Voice and language notes

- **Speech privacy.** Chrome/Edge can recognise speech on your device (`processLocally`) when the language pack is available, and the page asks the browser to download it. If on-device is unavailable for a language, voice stays **off** until you tick "Allow cloud speech", because online recognition sends your audio to the browser maker.
- **Pauses are fine.** Browsers end recognition after a few seconds of silence. The page restarts it within ~0.1 s and keeps every word. The mic switches itself off after 2 minutes of total silence, 20 minutes in one go, or when you leave the tab.
- **Uttarakhandi** (Garhwali/Kumaoni) has no browser speech recogniser, so voice uses Hindi, and the model is asked for simple Garhwali/Kumaoni in Devanagari (it falls back to plain Hindi when unsure). Quality for these languages is much lower than for Hindi or English. The interface itself shows in Hindi for this option.
- Status messages and errors are in English; the main interface is translated.

## Run it

It is plain HTML/CSS/JS. Do **not** open the file by double-clicking (encryption needs a secure context). Serve it:

```bash
cd private-llm-playground
python3 -m http.server 8080
# open http://localhost:8080
```

### Using Ollama locally

```bash
OLLAMA_ORIGINS="http://localhost:8080" ollama serve
ollama pull llama3.2
```
Pick "Ollama" in the page. For a deployed site, set `OLLAMA_ORIGINS` to your site's URL.

### Using LM Studio
Developer tab, start the server, turn on **Enable CORS**.

## Deploy (free)

1. Push this folder to a GitHub repo.
2. Import it on [vercel.com](https://vercel.com) (framework: "Other", no build command). `vercel.json` adds strict security headers.

## Adding another provider

1. Add an entry to `PROVIDERS` in `app.js`.
2. Add its host to `connect-src` in both `index.html` and `vercel.json`.

The provider must offer an OpenAI-compatible `/chat/completions` endpoint with CORS enabled.

## Ideas to extend (good commits for your GitHub history)

- Compare two models side by side on the same prompt
- Save chats to IndexedDB with encryption
- Prompt library with variables
- Cost estimator per provider
- Dark/light theme toggle and keyboard shortcut cheat-sheet
- Tests for `redact()` and the markdown renderer

## License

MIT
