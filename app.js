'use strict';
/* Private LLM Playground: everything runs in the browser. No backend, no analytics. */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/* ---------- Providers (must also be allowed in the CSP connect-src in index.html) ---------- */
const PROVIDERS = {
  groq:       { name: 'Groq (cloud)',        base: 'https://api.groq.com/openai/v1', env: 'GROQ_API_KEY',       needsKey: true,  local: false, model: 'llama-3.3-70b-versatile', hint: 'Fast and has a free tier. Your prompts go to Groq.' },
  openai:     { name: 'OpenAI (cloud)',      base: 'https://api.openai.com/v1',      env: 'OPENAI_API_KEY',     needsKey: true,  local: false, model: 'gpt-4o-mini',             hint: 'Your prompts go to OpenAI.' },
  openrouter: { name: 'OpenRouter (cloud)',  base: 'https://openrouter.ai/api/v1',   env: 'OPENROUTER_API_KEY', needsKey: true,  local: false, model: 'meta-llama/llama-3.3-70b-instruct', hint: 'One key, many models. Your prompts go to OpenRouter and the model host.' },
  ollama:     { name: 'Ollama (this computer)',    base: 'http://localhost:11434/v1', env: 'OLLAMA_API_KEY', needsKey: false, local: true,  model: 'llama3.2', hint: 'Most private option: nothing leaves your machine. Start Ollama with OLLAMA_ORIGINS set to this site\'s address.' },
  lmstudio:   { name: 'LM Studio (this computer)', base: 'http://localhost:1234/v1',  env: 'LMSTUDIO_API_KEY', needsKey: false, local: true,  model: '', hint: 'Most private option: nothing leaves your machine. Turn on "Enable CORS" in LM Studio\'s server settings.' },
};

const state = {
  messages: [],      // {role, content (what is sent), display (what you typed), notes}
  keys: {},          // provider -> key, memory only
  busy: false,
  ctrl: null,
  redactMap: {},     // placeholder -> original
  redactRev: {},     // original -> placeholder
  redactCount: {},   // label -> n
  netlog: [],
  lang: 'curl',
  idleTimer: null,
};

/* ---------- Small helpers ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };
const store = {
  get: (area, k) => safe(() => window[area].getItem(k)),
  set: (area, k, v) => safe(() => window[area].setItem(k, v)),
  del: (area, k) => safe(() => window[area].removeItem(k)),
};
const prov = () => PROVIDERS[$('#provider').value];
const baseUrl = () => $('#baseUrl').value.trim().replace(/\/+$/, '');
const num = (id, d) => { const v = parseFloat($(id).value); return Number.isFinite(v) ? v : d; };
const fmt = (n, d = 2) => (n == null || !Number.isFinite(n) ? '–' : n.toFixed(d));
const approxTokens = t => Math.ceil(t.length / 4);

/* ---------- Redaction ---------- */
const luhn = s => {
  const d = s.replace(/\D/g, '');
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0, alt = false;
  for (let i = d.length - 1; i >= 0; i--) { let n = +d[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; }
  return sum % 10 === 0;
};
const PATTERNS = [
  ['KEY',     /\b(?:sk-[A-Za-z0-9_-]{16,}|gsk_[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,})/g],
  ['EMAIL',   /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g],
  ['CARD',    /\b(?:\d[ -]?){12,18}\d\b/g, luhn],
  ['AADHAAR', /\b\d{4}\s\d{4}\s\d{4}\b/g],
  ['PAN',     /\b[A-Z]{5}\d{4}[A-Z]\b/g],
  ['IP',      /\b(?:\d{1,3}\.){3}\d{1,3}\b/g],
  ['PHONE',   /(?<![\w.])(?:\+\d{1,3}[\s-]?)?(?:\d[\s-]?){9,11}\d(?!\w|\.\d)/g],
];
function redact(text) {
  const found = {};
  for (const [label, re, check] of PATTERNS) {
    text = text.replace(re, m => {
      if (check && !check(m)) return m;
      if (!state.redactRev[m]) {
        state.redactCount[label] = (state.redactCount[label] || 0) + 1;
        const ph = `[${label}_${state.redactCount[label]}]`;
        state.redactRev[m] = ph; state.redactMap[ph] = m;
      }
      found[label] = (found[label] || 0) + 1;
      return state.redactRev[m];
    });
  }
  return { text, found };
}
const restore = t => t.replace(/\[(?:KEY|EMAIL|AADHAAR|PAN|CARD|IP|PHONE)_\d+\]/g, ph => state.redactMap[ph] ?? ph);

/* ---------- Minimal, safe markdown (escape first, then format) ---------- */
function inline(line) {
  return esc(line)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
}
function blocks(text) {
  let out = '', list = null, para = [];
  const flushP = () => { if (para.length) { out += `<p>${para.join('<br>')}</p>`; para = []; } };
  const flushL = () => { if (list) { out += `</${list}>`; list = null; } };
  for (const raw of text.split('\n')) {
    let m;
    if ((m = raw.match(/^\s*(#{1,4})\s+(.*)/))) { flushP(); flushL(); out += `<h4>${inline(m[2])}</h4>`; }
    else if ((m = raw.match(/^\s*[-*]\s+(.*)/))) { flushP(); if (list !== 'ul') { flushL(); out += '<ul>'; list = 'ul'; } out += `<li>${inline(m[1])}</li>`; }
    else if ((m = raw.match(/^\s*\d+[.)]\s+(.*)/))) { flushP(); if (list !== 'ol') { flushL(); out += '<ol>'; list = 'ol'; } out += `<li>${inline(m[1])}</li>`; }
    else if (!raw.trim()) { flushP(); flushL(); }
    else { flushL(); para.push(inline(raw)); }
  }
  flushP(); flushL();
  return out;
}
function md(src) {
  return src.split('```').map((p, i) => {
    if (i % 2 === 0) return blocks(p);
    const nl = p.indexOf('\n');
    const lang = nl >= 0 ? p.slice(0, nl).trim() : '';
    const code = (nl >= 0 ? p.slice(nl + 1) : p).replace(/\n$/, '');
    return `<div class="code"><div class="code-h"><span>${esc(lang) || 'code'}</span><button class="copy" type="button">Copy</button></div><pre><code>${esc(code)}</code></pre></div>`;
  }).join('');
}

/* ---------- Crypto for optional encrypted key storage ---------- */
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function deriveKey(pass, salt) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encryptText(plain, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deriveKey(pass, salt), new TextEncoder().encode(plain));
  return JSON.stringify({ v: 1, s: b64(salt), i: b64(iv), c: b64(ct) });
}
async function decryptText(blob, pass) {
  const o = JSON.parse(blob);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(o.i) }, await deriveKey(pass, unb64(o.s)), unb64(o.c));
  return new TextDecoder().decode(pt);
}
function askPass(title, msg) {
  return new Promise(resolve => {
    const dlg = $('#passDlg'), input = $('#passInput');
    $('#passTitle').textContent = title; $('#passMsg').textContent = msg; input.value = '';
    const done = v => { $('#passOk').onclick = $('#passCancel').onclick = input.onkeydown = null; dlg.close(); input.value = ''; resolve(v); };
    $('#passOk').onclick = () => done(input.value || null);
    $('#passCancel').onclick = () => done(null);
    input.onkeydown = e => { if (e.key === 'Enter') done(input.value || null); };
    dlg.addEventListener('cancel', () => done(null), { once: true });
    dlg.showModal(); input.focus();
  });
}

/* ---------- Key handling ---------- */
const keyMode = () => $('input[name=keymode]:checked').value;
const keyName = () => `plg.key.${$('#provider').value}`;
const getKey = () => state.keys[$('#provider').value] || '';
function setKeyStatus(msg) { $('#keyStatus').textContent = msg; }

async function onKeyInput() {
  const k = $('#apiKey').value.trim();
  state.keys[$('#provider').value] = k;
  if (keyMode() === 'session') { k ? store.set('sessionStorage', keyName(), k) : store.del('sessionStorage', keyName()); }
  refreshInfo();
}
async function saveEncrypted() {
  const k = getKey();
  if (!k) return;
  if (!window.crypto?.subtle) { setKeyStatus('Encryption needs a secure page (https or localhost).'); return; }
  const p1 = await askPass('Choose a passphrase', 'It encrypts your key on this device. If you forget it, the key cannot be recovered.');
  if (!p1) { setKeyStatus('Not saved.'); return; }
  store.set('localStorage', keyName() + '.enc', await encryptText(k, p1));
  setKeyStatus('Saved encrypted. Use "Unlock saved key" next time.');
}
async function unlockKey() {
  const name = keyName();
  const sess = store.get('sessionStorage', name);
  if (sess) { state.keys[$('#provider').value] = sess; $('#apiKey').value = sess; setKeyStatus('Loaded from this tab.'); return; }
  const blob = store.get('localStorage', name + '.enc');
  if (!blob) { setKeyStatus('No saved key for this provider.'); return; }
  const p = await askPass('Unlock key', 'Enter the passphrase you chose.');
  if (!p) return;
  try { const k = await decryptText(blob, p); state.keys[$('#provider').value] = k; $('#apiKey').value = k; setKeyStatus('Unlocked. The key is in memory only.'); }
  catch { setKeyStatus('Wrong passphrase.'); }
}
function forgetKey() {
  state.keys[$('#provider').value] = ''; $('#apiKey').value = '';
  store.del('sessionStorage', keyName()); store.del('localStorage', keyName() + '.enc');
  setKeyStatus('Key removed from memory and from this device.'); refreshInfo();
}

/* ---------- Settings persistence (non-sensitive only) ---------- */
const SAVED = ['uiLang', 'voiceLang', 'provider', 'baseUrl', 'model', 'temperature', 'topP', 'maxTokens', 'stop', 'reasoning', 'idle'];
function saveSettings() {
  const o = {}; SAVED.forEach(id => o[id] = $('#' + id).value);
  store.set('localStorage', 'plg.settings', JSON.stringify(o));
}
function loadSettings() {
  const o = safe(() => JSON.parse(store.get('localStorage', 'plg.settings')), null);
  if (!o) return;
  SAVED.forEach(id => { if (o[id] != null) $('#' + id).value = o[id]; });
}

/* ---------- Language ---------- */
const L = () => I18N.LANGS[$('#uiLang').value] || I18N.LANGS.en;
const t = k => I18N.t(k);
function langInstruction() {
  const l = L();
  return l.reply && $('#replyLang').checked ? `Reply in ${l.reply}, unless the user clearly asks for another language.` : '';
}

/* ---------- Voice input (Web Speech API) and read-aloud ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const voice = { rec: null, on: false, wanted: false, lang: '', local: false, base: '', finals: '', lastSpeech: 0, startedAt: 0, ends: [], watchdog: null, restartTimer: null };
const MAX_SILENCE_MS = 120000;   // mic switches itself off after 2 minutes with no speech at all
const MAX_SESSION_MS = 20 * 60000;
const voiceStatus = msg => { $('#voiceStatus').textContent = msg || ''; };
const voiceLocale = () => { const v = $('#voiceLang').value; return v === 'auto' ? L().speech : v; };
function updateMic() {
  const b = $('#mic');
  b.textContent = voice.wanted ? t('mic_stop') : t('mic_start');
  b.classList.toggle('recording', voice.wanted);
  b.setAttribute('aria-pressed', String(voice.wanted));
}
function rebase() {           // continue from whatever is in the box now (keeps manual edits and any pending words)
  let v = $('#prompt').value; if (v && !/\s$/.test(v)) v += ' ';
  voice.base = v; voice.finals = '';
}
function stopVoice(msg) {
  voice.wanted = false; voice.on = false;
  clearInterval(voice.watchdog); clearTimeout(voice.restartTimer);
  try { voice.rec?.stop(); } catch { /* ignore */ }
  voice.rec = null; updateMic();
  voiceStatus(msg || '');
}
function startRec() {
  if (!voice.wanted) return;
  const rec = new SR();
  rec.lang = voice.lang; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
  if ('processLocally' in rec) rec.processLocally = voice.local;
  rebase();
  rec.onresult = e => {
    voice.lastSpeech = Date.now();
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) voice.finals += r[0].transcript.trim() + ' '; else interim += r[0].transcript;
    }
    $('#prompt').value = voice.base + voice.finals + interim;
    refreshInfo();
  };
  rec.onerror = e => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;     // silence is fine, onend restarts us
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') stopVoice(t('mic_denied'));
    else if (e.error === 'language-not-supported') stopVoice(t('lang_unsupported'));
    else if (e.error === 'network') stopVoice(t('mic_network'));
    else if (e.error === 'audio-capture') stopVoice(t('mic_missing'));
    else voiceStatus(`${t('mic_err')}: ${e.error}`);
  };
  rec.onend = () => {
    voice.on = false;
    if (!voice.wanted) return;                                          // user stopped it
    const now = Date.now();
    voice.ends = voice.ends.filter(x => now - x < 4000).concat(now);
    if (voice.ends.length >= 6) { stopVoice(t('mic_flaky')); return; }  // restart loop guard
    voice.restartTimer = setTimeout(startRec, 120);                     // seamless restart after a pause
  };
  try { rec.start(); voice.rec = rec; voice.on = true; }
  catch (e) { if (!/already started/i.test(e.message)) stopVoice(`${t('mic_err')}: ${e.message}`); }
}
async function toggleVoice() {
  if (voice.wanted) { stopVoice(); return; }
  if (!SR) { voiceStatus(t('no_sr')); return; }
  const lang = voiceLocale();
  let local = false;
  const probe = new SR();
  if ('processLocally' in probe) {
    local = true;
    try {
      if (typeof SR.available === 'function') {
        const st = await SR.available({ langs: [lang], processLocally: true });
        if (st === 'unavailable') local = false;
        else if (st === 'downloadable' || st === 'downloading') { voiceStatus(t('downloading')); await SR.install({ langs: [lang], processLocally: true }); }
      }
    } catch { /* let start() report any real problem */ }
  }
  if (!local && !$('#allowCloudVoice').checked) { voiceStatus(t('cloud_blocked')); return; }
  Object.assign(voice, { wanted: true, lang, local, ends: [], lastSpeech: Date.now(), startedAt: Date.now() });
  updateMic();
  voiceStatus(local ? t('listening_local') : t('listening_cloud'));
  clearInterval(voice.watchdog);
  voice.watchdog = setInterval(() => {
    const now = Date.now();
    if (now - voice.lastSpeech > MAX_SILENCE_MS) stopVoice(t('mic_idle'));
    else if (now - voice.startedAt > MAX_SESSION_MS) stopVoice(t('mic_max'));
  }, 5000);
  startRec();
}
document.addEventListener('visibilitychange', () => { if (document.hidden && voice.wanted) stopVoice(t('mic_hidden')); });

function speak(text) {
  if (!('speechSynthesis' in window)) { voiceStatus(t('no_sr')); return; }
  speechSynthesis.cancel();
  const lang = L().tts, prefix = lang.split('-')[0];
  const voices = speechSynthesis.getVoices().filter(v => v.lang.replace('_', '-').toLowerCase().startsWith(prefix));
  const local = voices.find(v => v.localService);
  if (!local && !$('#allowCloudVoice').checked) { voiceStatus(t('no_voice')); return; }
  const u = new SpeechSynthesisUtterance(text.replace(/```[\s\S]*?```/g, ' '));
  u.lang = lang; if (local) u.voice = local;
  speechSynthesis.speak(u);
}

/* ---------- Request building ---------- */
function buildBody(extraUser) {
  const msgs = [];
  const sys = $('#system').value.trim();
  const sysAll = [sys ? (redactOn() ? redact(sys).text : sys) : '', langInstruction()].filter(Boolean).join('\n\n');
  if (sysAll) msgs.push({ role: 'system', content: sysAll });
  state.messages.forEach(m => msgs.push({ role: m.role, content: m.content }));
  if (extraUser) msgs.push({ role: 'user', content: extraUser });
  const body = { model: $('#model').value.trim(), messages: msgs, temperature: num('#temperature', 0.7), top_p: num('#topP', 1), max_tokens: Math.max(1, Math.round(num('#maxTokens', 1024))) };
  const stop = $('#stop').value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 4);
  if (stop.length) body.stop = stop;
  const seed = $('#seed').value.trim();
  if (seed !== '' && Number.isInteger(+seed)) body.seed = +seed;
  if ($('#reasoning').value) body.reasoning_effort = $('#reasoning').value;
  return body;
}
const redactOn = () => $('#redact').checked;

/* ---------- Code export ---------- */
function buildCode(lang) {
  const p = prov(), url = baseUrl() + '/chat/completions';
  const preview = $('#prompt').value.trim();
  const body = buildBody(preview ? (redactOn() ? redactPreview(preview) : preview) : null);
  const json = JSON.stringify(body, null, 2);
  const auth = p.needsKey ? `  -H "Authorization: Bearer $${p.env}" \\\n` : '';
  if (lang === 'curl') {
    return `curl ${url} \\\n${auth}  -H "Content-Type: application/json" \\\n  -d '${json.replace(/'/g, "'\\''")}'`;
  }
  if (lang === 'python') {
    const { model, messages, ...rest } = body;
    const extra = Object.entries(rest).map(([k, v]) => `    ${k}=${JSON.stringify(v).replace(/\btrue\b/g, 'True')},`).join('\n');
    return `import os\nfrom openai import OpenAI\n\nclient = OpenAI(\n    base_url="${baseUrl()}",\n    api_key=${p.needsKey ? `os.environ["${p.env}"]` : '"not-needed"'},\n)\n\nresp = client.chat.completions.create(\n    model=${JSON.stringify(model)},\n    messages=${JSON.stringify(messages, null, 4).replace(/\n/g, '\n    ')},\n${extra}\n)\nprint(resp.choices[0].message.content)`;
  }
  return `const res = await fetch("${url}", {\n  method: "POST",\n  headers: {\n${p.needsKey ? `    Authorization: \`Bearer \${process.env.${p.env}}\`,\n` : ''}    "Content-Type": "application/json",\n  },\n  body: JSON.stringify(${json.replace(/\n/g, '\n  ')}),\n});\nconsole.log((await res.json()).choices[0].message.content);`;
}
// preview only: does not add to the permanent placeholder map
function redactPreview(t) {
  const snap = [state.redactMap, state.redactRev, state.redactCount].map(o => ({ ...o }));
  const out = redact(t).text;
  [state.redactMap, state.redactRev, state.redactCount] = snap;
  return out;
}
function refreshCode() { $('#codeOut').textContent = buildCode(state.lang); $('#codeLang').textContent = state.lang; }

/* ---------- Rendering ---------- */
function addMsg(role, html, cls = '') {
  $('#empty')?.remove();
  const el = document.createElement('div');
  el.className = `msg ${role} ${cls}`.trim();
  el.innerHTML = `<div class="who">${role === 'user' ? 'You' : role === 'assistant' ? 'Model <button class="speak" type="button" aria-label="Read aloud">🔊</button>' : 'Error'}</div><div class="body">${html}</div>`;
  $('#log').appendChild(el); $('#log').scrollTop = 1e9;
  return el;
}
function renderLog() {
  $('#log').innerHTML = '';
  if (!state.messages.length) {
    $('#log').innerHTML = `<div class="empty" id="empty"><p>${esc(t('empty'))}</p></div>`;
  }
  state.messages.forEach(m => {
    const el = addMsg(m.role, m.role === 'user' ? `<p>${esc(m.display).replace(/\n/g, '<br>')}</p>` : md(restore(m.content)));
    if (m.notes) el.querySelector('.body').insertAdjacentHTML('beforeend', `<div class="redacted-note">${esc(m.notes)}</div>`);
  });
}
function refreshInfo() {
  const p = prov();
  $('#providerHint').textContent = p.hint;
  const badge = $('#badge');
  badge.textContent = p.local ? 'LOCAL · stays on your computer' : 'LIVE · real API calls';
  badge.className = 'badge ' + (p.local ? 'local' : 'live');
  $('#apiKey').placeholder = p.needsKey ? 'paste key here' : 'not needed for local models';
  $('#apiKey').disabled = !p.needsKey;
  // prompt analysis
  const sysTxt = $('#system').value;
  const shots = state.messages.filter(m => m.role === 'assistant').length + (/\b(example|input:|output:)/i.test(sysTxt) ? 1 : 0);
  $('#shotLabel').textContent = shots === 0 ? 'ZERO-SHOT' : (state.messages.length ? 'MULTI-TURN' : 'FEW-SHOT');
  $('#shotNote').textContent = shots === 0 ? 'No examples in context.' : `${shots} example${shots > 1 ? 's' : ''} / prior replies in context.`;
  const est = approxTokens(JSON.stringify(buildBody($('#prompt').value)));
  $('#promptInfo').textContent = `~${est} input tokens next request`;
  refreshCode();
}

/* ---------- Network log ---------- */
function logNet(method, url, body) {
  state.netlog.unshift({ t: new Date().toLocaleTimeString(), method, url, body });
  state.netlog = state.netlog.slice(0, 15);
  const box = $('#netlog'); box.innerHTML = '';
  state.netlog.forEach(r => {
    const d = document.createElement('details');
    const bytes = r.body ? new Blob([r.body]).size : 0;
    d.innerHTML = `<summary>${esc(r.t)} &middot; ${esc(r.method)} ${esc(new URL(r.url).host)} &middot; ${bytes} bytes sent</summary><pre>${esc(r.url)}\n\n${esc(r.body ? JSON.stringify(JSON.parse(r.body), null, 2) : '(no body)')}</pre>`;
    box.appendChild(d);
  });
}

/* ---------- Sending ---------- */
function setBusy(b) { state.busy = b; $('#send').disabled = b; $('#stop-btn').hidden = !b; }
function resetMetrics() { ['mTtft', 'mTotal', 'mTps', 'uIn', 'uReason', 'uOut', 'uTotal', 'uLeft'].forEach(id => $('#' + id).textContent = '–'); }

async function send() {
  const raw = $('#prompt').value.trim();
  if (!raw || state.busy) return;
  stopVoice(); window.speechSynthesis?.cancel();
  const p = prov();
  if (p.needsKey && !getKey()) { addMsg('error', 'Add your API key first.', 'error'); return; }
  if (!$('#model').value.trim()) { addMsg('error', 'Choose a model name first.', 'error'); return; }

  let sent = raw, notes = '';
  if (redactOn()) {
    const r = redact(raw); sent = r.text;
    const parts = Object.entries(r.found).map(([k, n]) => `${n} ${k.toLowerCase()}`);
    if (parts.length) notes = `Hidden from the model: ${parts.join(', ')}.`;
  }
  const body = buildBody(sent);
  state.messages.push({ role: 'user', content: sent, display: raw, notes });
  const uel = addMsg('user', `<p>${esc(raw).replace(/\n/g, '<br>')}</p>`);
  if (notes) uel.querySelector('.body').insertAdjacentHTML('beforeend', `<div class="redacted-note">${esc(notes)}</div>`);
  $('#prompt').value = '';

  body.stream = true; body.stream_options = { include_usage: true };

  const el = addMsg('assistant', '', 'assistant');
  const bodyEl = el.querySelector('.body');
  bodyEl.classList.add('cursor');
  setBusy(true); resetMetrics();
  state.ctrl = new AbortController();

  const url = baseUrl() + '/chat/completions';
  const payload = JSON.stringify(body);
  logNet('POST', url, payload);
  const headers = { 'Content-Type': 'application/json' };
  if (p.needsKey) headers.Authorization = `Bearer ${getKey()}`;

  let text = '', thinking = '', usage = null, tStart = performance.now(), tFirst = null, tAnswer = null, left = null, aborted = false;
  const draw = () => {
    bodyEl.innerHTML = (thinking ? `<details class="think" open><summary>Thinking</summary><div class="t">${esc(restore(thinking))}</div></details>` : '') + md(restore(text));
    $('#log').scrollTop = 1e9;
  };
  try {
    const res = await fetch(url, { method: 'POST', headers, body: payload, signal: state.ctrl.signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
    left = res.headers.get('x-ratelimit-remaining-tokens');
    if (!res.ok) {
      let msg = await res.text(); try { msg = JSON.parse(msg).error?.message || msg; } catch { /* keep text */ }
      throw new Error(`${res.status}: ${msg}`);
    }
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const d = line.slice(5).trim();
        if (d === '[DONE]') continue;
        let j; try { j = JSON.parse(d); } catch { continue; }
        if (j.error) throw new Error(j.error.message || 'Stream error');
        const delta = j.choices?.[0]?.delta || {};
        const th = delta.reasoning_content ?? delta.reasoning;
        if (th) { tFirst ??= performance.now(); thinking += th; }
        if (delta.content) { tFirst ??= performance.now(); tAnswer ??= performance.now(); text += delta.content; }
        if (j.usage || j.x_groq?.usage) usage = j.usage || j.x_groq.usage;
        if (th || delta.content) draw();
      }
    }
  } catch (e) {
    if (e.name === 'AbortError') aborted = true;
    else {
      const hint = e instanceof TypeError ? ' Could not reach the server. Check the URL, your connection, and (for local models) that CORS is enabled.' : '';
      el.remove(); addMsg('error', esc(e.message) + hint, 'error');
      if (!text) { state.messages.pop(); setBusy(false); bodyEl.classList.remove('cursor'); return; }
    }
  }
  bodyEl.classList.remove('cursor');
  const tEnd = performance.now();
  if (text || thinking) { draw(); state.messages.push({ role: 'assistant', content: text }); }
  else if (aborted) { el.remove(); state.messages.pop(); $('#prompt').value = raw; }
  else { el.remove(); state.messages.pop(); }

  // metrics
  const out = usage?.completion_tokens ?? approxTokens(text + thinking);
  const inp = usage?.prompt_tokens ?? approxTokens(payload);
  const reason = usage?.completion_tokens_details?.reasoning_tokens ?? (thinking ? approxTokens(thinking) : 0);
  const genSecs = tFirst ? (tEnd - tFirst) / 1000 : 0;
  $('#mTtft').textContent = tAnswer ? `${((tAnswer - tStart) / 1000).toFixed(2)} s` : '–';
  $('#mTotal').textContent = `${((tEnd - tStart) / 1000).toFixed(2)} s`;
  $('#mTps').textContent = genSecs > 0.05 ? fmt(out / genSecs, 1) : '–';
  $('#uIn').textContent = inp + (usage ? '' : ' (est.)');
  $('#uReason').textContent = reason;
  $('#uOut').textContent = out;
  $('#uTotal').textContent = inp + out;
  $('#uLeft').textContent = left ?? 'n/a';
  state.ctrl = null; setBusy(false); refreshInfo();
}

/* ---------- Models list ---------- */
async function loadModels() {
  const p = prov();
  const url = baseUrl() + '/models';
  if (p.needsKey && !getKey()) { setKeyStatus('Add a key first to load the list.'); return; }
  try {
    logNet('GET', url, null);
    const res = await fetch(url, { headers: p.needsKey ? { Authorization: `Bearer ${getKey()}` } : {}, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!res.ok) throw new Error(res.status);
    const j = await res.json();
    const ids = (j.data || j.models || []).map(m => m.id || m.name).filter(Boolean).sort();
    $('#modelList').innerHTML = ids.map(id => `<option value="${esc(id)}">`).join('');
    setKeyStatus(`${ids.length} models loaded. Click the model box to choose.`);
  } catch (e) { setKeyStatus('Could not load models: ' + (e.message || e)); }
}

/* ---------- Wipe + idle ---------- */
function wipeSession(full) {
  state.ctrl?.abort(); stopVoice(); voiceStatus('');
  state.messages = []; state.keys = {}; state.redactMap = {}; state.redactRev = {}; state.redactCount = {}; state.netlog = [];
  $('#apiKey').value = ''; $('#prompt').value = ''; $('#system').value = '';
  $('#netlog').innerHTML = '<p class="hint">No requests yet.</p>';
  renderLog(); resetMetrics(); setBusy(false);
  if (full) {
    try { Object.keys(localStorage).filter(k => k.startsWith('plg.')).forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }
    try { Object.keys(sessionStorage).filter(k => k.startsWith('plg.')).forEach(k => sessionStorage.removeItem(k)); } catch { /* ignore */ }
  }
  setKeyStatus(full ? 'Everything wiped, including saved keys and settings.' : 'Session wiped after inactivity.');
  refreshInfo();
}
function armIdle() {
  clearTimeout(state.idleTimer);
  const m = +$('#idle').value;
  if (m > 0) state.idleTimer = setTimeout(() => wipeSession(false), m * 60000);
}

/* ---------- Export ---------- */
function exportChat() {
  const lines = state.messages.map(m => `### ${m.role === 'user' ? 'You' : 'Model'}\n\n${m.role === 'user' ? m.display : restore(m.content)}\n`);
  const blob = new Blob([`# Chat export\n\n${lines.join('\n')}`], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'chat.md'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- Init ---------- */
function init() {
  $('#provider').innerHTML = Object.entries(PROVIDERS).map(([k, v]) => `<option value="${k}">${esc(v.name)}</option>`).join('');
  $('#provider').value = 'groq';
  $('#baseUrl').value = PROVIDERS.groq.base; $('#model').value = PROVIDERS.groq.model;
  $('#uiLang').innerHTML = Object.entries(I18N.LANGS).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('');
  $('#uiLang').value = 'en';
  loadSettings();
  if (!PROVIDERS[$('#provider').value]) $('#provider').value = 'groq';
  if (!I18N.LANGS[$('#uiLang').value]) $('#uiLang').value = 'en';
  I18N.apply($('#uiLang').value); updateMic();
  $('#uiLang').addEventListener('change', () => { I18N.apply($('#uiLang').value); updateMic(); renderLog(); saveSettings(); refreshInfo(); });
  $('#mic').addEventListener('click', toggleVoice);
  $('#prompt').addEventListener('input', e => { if (voice.wanted && e.isTrusted) rebase(); });
  document.addEventListener('keydown', e => { if (e.altKey && e.key.toLowerCase() === 'm') { e.preventDefault(); toggleVoice(); } });
  if (!SR) { $('#mic').title = t('no_sr'); }

  $('#provider').addEventListener('change', () => {
    const p = prov(); $('#baseUrl').value = p.base; $('#model').value = p.model;
    $('#apiKey').value = getKey(); $('#modelList').innerHTML = ''; setKeyStatus(''); saveSettings(); refreshInfo();
  });
  $('#apiKey').addEventListener('input', onKeyInput);
  $('#toggleKey').addEventListener('click', e => { const k = $('#apiKey'); const show = k.type === 'password'; k.type = show ? 'text' : 'password'; e.target.textContent = show ? t('hide') : t('show'); });
  $$('input[name=keymode]').forEach(r => r.addEventListener('change', async () => {
    store.del('sessionStorage', keyName());
    if (keyMode() === 'session' && getKey()) { store.set('sessionStorage', keyName(), getKey()); setKeyStatus('Key kept for this tab only.'); }
    else if (keyMode() === 'encrypted') await saveEncrypted();
    else setKeyStatus('Key kept in memory only.');
  }));
  $('#unlockKey').addEventListener('click', unlockKey);
  $('#forgetKey').addEventListener('click', forgetKey);
  $('#loadModels').addEventListener('click', loadModels);

  ['temperature', 'topP'].forEach(id => $('#' + id).addEventListener('input', () => { $('#' + id + 'Out').textContent = $('#' + id).value; }));
  $$('.settings input,.settings select,.settings textarea,#prompt').forEach(el => el.addEventListener('input', () => { saveSettings(); refreshInfo(); }));
  $('#idle').addEventListener('change', armIdle);

  $('#send').addEventListener('click', send);
  $('#stop-btn').addEventListener('click', () => state.ctrl?.abort());
  $('#prompt').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.busy) state.ctrl?.abort();
    if (e.key === 'Backspace' && e.ctrlKey && e.shiftKey) { e.preventDefault(); wipeSession(true); }
  });
  $('#undo').addEventListener('click', () => { if (state.busy) return; while (state.messages.length && state.messages.pop().role !== 'user'); renderLog(); refreshInfo(); });
  $('#reset').addEventListener('click', () => { if (state.busy) return; state.messages = []; state.redactMap = {}; state.redactRev = {}; state.redactCount = {}; renderLog(); resetMetrics(); refreshInfo(); });
  $('#export').addEventListener('click', exportChat);
  $('#wipeAll').addEventListener('click', () => wipeSession(true));

  $$('.tab').forEach(t => t.addEventListener('click', () => {
    $$('.tab').forEach(x => x.classList.toggle('active', x === t)); state.lang = t.dataset.lang; refreshCode();
  }));
  $('#copyCode').addEventListener('click', e => copy(e.target, $('#codeOut').textContent));
  $('#log').addEventListener('click', e => {
    if (e.target.classList.contains('copy')) copy(e.target, e.target.closest('.code').querySelector('code').textContent);
    if (e.target.classList.contains('speak')) speak(e.target.closest('.msg').querySelector('.body').innerText);
  });

  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, armIdle, { passive: true }));
  armIdle();
  $('#temperatureOut').textContent = $('#temperature').value; $('#topPOut').textContent = $('#topP').value;
  const sess = store.get('sessionStorage', keyName());
  if (sess) { state.keys[$('#provider').value] = sess; $('#apiKey').value = sess; setKeyStatus('Key restored for this tab.'); }
  else if (store.get('localStorage', keyName() + '.enc')) setKeyStatus('An encrypted key is saved. Click "Unlock saved key".');
  refreshInfo();
}
async function copy(btn, text) {
  try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied'; } catch { btn.textContent = 'Press Ctrl+C'; }
  setTimeout(() => { btn.textContent = 'Copy'; }, 1200);
}
init();
