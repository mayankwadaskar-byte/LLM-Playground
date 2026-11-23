'use strict';
/* Interface languages, reply languages and speech settings. */
(() => {
  // reply = instruction given to the model; speech = voice-input locale; tts = read-aloud locale
  const LANGS = {
    en:   { label: 'English',    ui: 'en',   speech: 'en-IN', tts: 'en-IN', reply: null },
    hi:   { label: 'हिन्दी',      ui: 'hi',   speech: 'hi-IN', tts: 'hi-IN', reply: 'Hindi, written in Devanagari script' },
    mr:   { label: 'मराठी',      ui: 'mr',   speech: 'mr-IN', tts: 'mr-IN', reply: 'Marathi, written in Devanagari script' },
    hing: { label: 'Hinglish',   ui: 'hing', speech: 'hi-IN', tts: 'en-IN', reply: 'Hinglish: Hindi written in the Roman (English) alphabet, mixing in common English words the way people text in India' },
    pah:  { label: 'उत्तराखंडी (गढ़वाली / कुमाऊँनी)', ui: 'hi', speech: 'hi-IN', tts: 'hi-IN', reply: 'Garhwali or Kumaoni (the Pahari languages of Uttarakhand) in Devanagari script. Keep sentences simple. If you are not sure of a word, use plain Hindi instead of inventing one' },
    zh:   { label: '中文（简体）',  ui: 'zh',   speech: 'zh-CN', tts: 'zh-CN', reply: 'Simplified Chinese' },
  };

  const STR = {
    en: {
      sub: 'Talk to a model straight from your browser. No backend, no accounts, no analytics.', wipe: 'Wipe everything', l_uilang: 'Language',
      h_provider: 'Provider', l_provider: 'Where to send requests', l_baseurl: 'Base URL', l_key: 'API key', show: 'Show', hide: 'Hide',
      unlock: 'Unlock saved key', forget: 'Forget key', h_model: 'Model', l_model: 'Model name', load: 'Load list', l_system: 'System prompt',
      h_params: 'Parameters', l_temp: 'Temperature', l_topp: 'Top-p', l_maxtok: 'Max tokens',
      h_voice: 'Language & voice', l_voicelang: 'Voice input language', reply_in: 'Make the model reply in the chosen language',
      allow_cloud: "Allow cloud speech if on-device isn't available",
      h_privacy: 'Privacy controls', redact: 'Redact personal data before sending', l_idle: 'Auto-wipe after inactivity',
      h_conv: 'Conversation', undo: 'Undo last turn', reset: 'Reset', export: 'Export', send: 'Send', stop: 'Stop',
      prompt_ph: 'Write a prompt…  (Ctrl/Cmd + Enter to send, Esc to stop)',
      h_analysis: 'Prompt analysis', h_speed: 'Speed', h_usage: 'Token usage', h_net: 'Network transparency', h_code: 'Code for this request',
      dt: ['First answer token', 'Total time', 'Tokens / second', 'Input', 'Reasoning', 'Output', 'Total', 'Left this minute'],
      empty: "Nothing is stored. Your messages live in this tab's memory and disappear when you close it.",
      mic_start: '🎤 Speak', mic_stop: '⏹ Stop',
      no_sr: "This browser has no speech recognition. Try Chrome or Edge, or just type.",
      cloud_blocked: "On-device speech isn't available for this language here. Tick “Allow cloud speech” to use your browser's online service (your audio would leave your device).",
      listening_local: 'Listening. Take your time, pauses are fine. Audio stays on this device.', listening_cloud: 'Listening. Take your time, pauses are fine. Your browser may send audio to its speech service.',
      lang_unsupported: "This browser can't recognise that language.", mic_network: 'Speech service unreachable (needs internet for online speech).', mic_missing: 'No microphone found.',
      mic_flaky: 'The microphone keeps stopping. Check it and try again.', mic_idle: 'Mic switched off after 2 minutes of silence.', mic_max: 'Mic switched off after 20 minutes. Click it to continue.', mic_hidden: 'Mic switched off because you left this tab.',
      downloading: 'Downloading the on-device speech pack…', mic_denied: 'Microphone permission was denied.', mic_err: 'Voice error',
      no_voice: 'No on-device voice installed for this language. Tick “Allow cloud speech” to use an online voice.',
    },
    hi: {
      sub: 'सीधे अपने ब्राउज़र से मॉडल से बात करें। कोई बैकएंड नहीं, कोई अकाउंट नहीं, कोई एनालिटिक्स नहीं।', wipe: 'सब कुछ मिटाएँ', l_uilang: 'भाषा',
      h_provider: 'प्रदाता', l_provider: 'अनुरोध कहाँ भेजें', l_baseurl: 'बेस URL', l_key: 'API कुंजी', show: 'दिखाएँ', hide: 'छिपाएँ',
      unlock: 'सेव की गई कुंजी खोलें', forget: 'कुंजी भूलें', h_model: 'मॉडल', l_model: 'मॉडल का नाम', load: 'सूची लोड करें', l_system: 'सिस्टम प्रॉम्प्ट',
      h_params: 'पैरामीटर', l_temp: 'टेम्परेचर', l_topp: 'Top-p', l_maxtok: 'अधिकतम टोकन',
      h_voice: 'भाषा और आवाज़', l_voicelang: 'वॉइस इनपुट की भाषा', reply_in: 'मॉडल चुनी हुई भाषा में जवाब दे',
      allow_cloud: 'ऑन-डिवाइस उपलब्ध न हो तो क्लाउड स्पीच की अनुमति दें',
      h_privacy: 'प्राइवेसी नियंत्रण', redact: 'भेजने से पहले निजी जानकारी छिपाएँ', l_idle: 'निष्क्रिय रहने पर ऑटो-वाइप',
      h_conv: 'बातचीत', undo: 'पिछला टर्न हटाएँ', reset: 'रीसेट', export: 'एक्सपोर्ट', send: 'भेजें', stop: 'रोकें',
      prompt_ph: 'अपना प्रॉम्प्ट लिखें… (भेजने के लिए Ctrl/Cmd + Enter, रोकने के लिए Esc)',
      h_analysis: 'प्रॉम्प्ट विश्लेषण', h_speed: 'गति', h_usage: 'टोकन उपयोग', h_net: 'नेटवर्क पारदर्शिता', h_code: 'इस अनुरोध का कोड',
      dt: ['पहला उत्तर टोकन', 'कुल समय', 'टोकन / सेकंड', 'इनपुट', 'रीज़निंग', 'आउटपुट', 'कुल', 'इस मिनट बचे'],
      empty: 'कुछ भी सेव नहीं होता। आपके संदेश सिर्फ़ इस टैब की मेमोरी में रहते हैं और टैब बंद होते ही मिट जाते हैं।',
      mic_start: '🎤 बोलें', mic_stop: '⏹ रुकें',
    },
    mr: {
      sub: 'थेट तुमच्या ब्राउझरमधून मॉडेलशी बोला. कोणताही बॅकएंड नाही, अकाउंट नाही, अॅनालिटिक्स नाही.', wipe: 'सर्व काही पुसा', l_uilang: 'भाषा',
      h_provider: 'प्रदाता', l_provider: 'विनंत्या कुठे पाठवायच्या', l_baseurl: 'बेस URL', l_key: 'API की', show: 'दाखवा', hide: 'लपवा',
      unlock: 'सेव्ह केलेली की उघडा', forget: 'की विसरा', h_model: 'मॉडेल', l_model: 'मॉडेलचे नाव', load: 'यादी लोड करा', l_system: 'सिस्टम प्रॉम्प्ट',
      h_params: 'पॅरामीटर्स', l_temp: 'टेम्परेचर', l_topp: 'Top-p', l_maxtok: 'कमाल टोकन',
      h_voice: 'भाषा आणि आवाज', l_voicelang: 'व्हॉइस इनपुटची भाषा', reply_in: 'मॉडेलने निवडलेल्या भाषेत उत्तर द्यावे',
      allow_cloud: 'ऑन-डिव्हाइस उपलब्ध नसल्यास क्लाउड स्पीचला परवानगी द्या',
      h_privacy: 'गोपनीयता नियंत्रणे', redact: 'पाठवण्यापूर्वी वैयक्तिक माहिती लपवा', l_idle: 'निष्क्रिय राहिल्यावर ऑटो-वाइप',
      h_conv: 'संभाषण', undo: 'मागील फेरी काढा', reset: 'रीसेट', export: 'एक्सपोर्ट', send: 'पाठवा', stop: 'थांबवा',
      prompt_ph: 'तुमचा प्रॉम्प्ट लिहा… (पाठवण्यासाठी Ctrl/Cmd + Enter, थांबवण्यासाठी Esc)',
      h_analysis: 'प्रॉम्प्ट विश्लेषण', h_speed: 'वेग', h_usage: 'टोकन वापर', h_net: 'नेटवर्क पारदर्शकता', h_code: 'या विनंतीचा कोड',
      dt: ['पहिले उत्तर टोकन', 'एकूण वेळ', 'टोकन / सेकंद', 'इनपुट', 'रीझनिंग', 'आउटपुट', 'एकूण', 'या मिनिटात उरलेले'],
      empty: 'काहीही साठवले जात नाही. तुमचे संदेश फक्त या टॅबच्या मेमरीत राहतात आणि टॅब बंद केल्यावर नष्ट होतात.',
      mic_start: '🎤 बोला', mic_stop: '⏹ थांबा',
    },
    hing: {
      sub: 'Seedha apne browser se model se baat karo. Na backend, na account, na analytics.', wipe: 'Sab kuch mita do', l_uilang: 'Language',
      h_provider: 'Provider', l_provider: 'Requests kahan bhejni hain', l_baseurl: 'Base URL', l_key: 'API key', show: 'Dikhao', hide: 'Chhupao',
      unlock: 'Saved key kholo', forget: 'Key bhool jao', h_model: 'Model', l_model: 'Model ka naam', load: 'List load karo', l_system: 'System prompt',
      h_params: 'Parameters', l_temp: 'Temperature', l_topp: 'Top-p', l_maxtok: 'Max tokens',
      h_voice: 'Language aur voice', l_voicelang: 'Voice input ki language', reply_in: 'Model chuni hui language mein jawab de',
      allow_cloud: 'On-device na ho to cloud speech allow karo',
      h_privacy: 'Privacy controls', redact: 'Bhejne se pehle personal data chhupao', l_idle: 'Idle hone par auto-wipe',
      h_conv: 'Conversation', undo: 'Last turn hatao', reset: 'Reset', export: 'Export', send: 'Bhejo', stop: 'Roko',
      prompt_ph: 'Apna prompt likho… (bhejne ke liye Ctrl/Cmd + Enter, rokne ke liye Esc)',
      h_analysis: 'Prompt analysis', h_speed: 'Speed', h_usage: 'Token usage', h_net: 'Network transparency', h_code: 'Is request ka code',
      dt: ['Pehla answer token', 'Total time', 'Tokens / second', 'Input', 'Reasoning', 'Output', 'Total', 'Is minute mein bache'],
      empty: 'Kuch bhi store nahi hota. Tumhare messages sirf is tab ki memory mein rehte hain aur tab band hote hi mit jaate hain.',
      mic_start: '🎤 Bolo', mic_stop: '⏹ Ruko',
    },
    zh: {
      sub: '直接在浏览器中与模型对话。没有后端、没有账号、没有统计分析。', wipe: '清除所有内容', l_uilang: '语言',
      h_provider: '服务商', l_provider: '请求发送到哪里', l_baseurl: '基础 URL', l_key: 'API 密钥', show: '显示', hide: '隐藏',
      unlock: '解锁已保存的密钥', forget: '忘记密钥', h_model: '模型', l_model: '模型名称', load: '加载列表', l_system: '系统提示词',
      h_params: '参数', l_temp: '温度', l_topp: 'Top-p', l_maxtok: '最大 token 数',
      h_voice: '语言与语音', l_voicelang: '语音输入语言', reply_in: '让模型用所选语言回复',
      allow_cloud: '设备端不可用时允许使用云端语音',
      h_privacy: '隐私控制', redact: '发送前隐去个人信息', l_idle: '闲置后自动清除',
      h_conv: '对话', undo: '撤销上一轮', reset: '重置', export: '导出', send: '发送', stop: '停止',
      prompt_ph: '输入提示词…（Ctrl/Cmd + Enter 发送，Esc 停止）',
      h_analysis: '提示词分析', h_speed: '速度', h_usage: 'Token 用量', h_net: '网络透明度', h_code: '本次请求的代码',
      dt: ['首个回答 token', '总耗时', '每秒 token 数', '输入', '推理', '输出', '总计', '本分钟剩余'],
      empty: '不会保存任何内容。你的消息只存在于此标签页的内存中，关闭标签页即消失。',
      mic_start: '🎤 说话', mic_stop: '⏹ 停止',
    },
  };

  // element selector -> string key (the first text node of the element is replaced, children are kept)
  const MAP = [
    ['.brand .sub', 'sub'], ['#wipeAll', 'wipe'], ['#langLbl', 'l_uilang'],
    ['.settings > section:nth-of-type(1) > h2', 'h_provider'], ['label[for=provider]', 'l_provider'], ['label[for=baseUrl]', 'l_baseurl'], ['label[for=apiKey]', 'l_key'],
    ['#toggleKey', 'show'], ['#unlockKey', 'unlock'], ['#forgetKey', 'forget'],
    ['.settings > section:nth-of-type(2) > h2', 'h_model'], ['label[for=model]', 'l_model'], ['#loadModels', 'load'], ['label[for=system]', 'l_system'],
    ['.settings > section:nth-of-type(3) > h2', 'h_params'], ['label[for=temperature]', 'l_temp'], ['label[for=topP]', 'l_topp'], ['label[for=maxTokens]', 'l_maxtok'],
    ['.settings > section:nth-of-type(4) > h2', 'h_voice'], ['label[for=voiceLang]', 'l_voicelang'], ['#replyLangLbl', 'reply_in'], ['#allowCloudLbl', 'allow_cloud'],
    ['.settings > section:nth-of-type(5) > h2', 'h_privacy'], ['#redactLbl', 'redact'], ['label[for=idle]', 'l_idle'],
    ['#chatHead', 'h_conv'], ['#undo', 'undo'], ['#reset', 'reset'], ['#export', 'export'], ['#send', 'send'], ['#stop-btn', 'stop'],
    ['.grid3 .card:nth-child(1) h2', 'h_analysis'], ['.grid3 .card:nth-child(2) h2', 'h_speed'], ['.grid3 .card:nth-child(3) h2', 'h_usage'],
    ['#netHead', 'h_net'], ['#codeHead', 'h_code'],
  ];

  let current = 'en';
  const t = key => (STR[LANGS[current].ui] && STR[LANGS[current].ui][key]) ?? STR.en[key] ?? key;

  function setText(el, text) {
    const node = [...el.childNodes].find(n => n.nodeType === 3 && n.nodeValue.trim());
    if (node) node.nodeValue = text + (/\s$/.test(node.nodeValue) ? ' ' : '');
    else if (!el.children.length) el.textContent = text;
    else el.insertBefore(document.createTextNode(text + ' '), el.firstChild);
  }

  function apply(lang) {
    if (!LANGS[lang]) lang = 'en';
    current = lang;
    document.documentElement.lang = LANGS[lang].ui === 'hing' ? 'hi-Latn' : (LANGS[lang].ui === 'zh' ? 'zh-CN' : LANGS[lang].ui);
    for (const [sel, key] of MAP) document.querySelectorAll(sel).forEach(el => setText(el, t(key)));
    document.querySelectorAll('.grid3 .kv dt').forEach((el, i) => { el.textContent = t('dt')[i]; });
    const p = document.getElementById('prompt'); if (p) p.placeholder = t('prompt_ph');
    const e = document.getElementById('empty'); if (e) { e.textContent = ''; const q = document.createElement('p'); q.textContent = t('empty'); e.appendChild(q); }
    const tk = document.getElementById('toggleKey'); const k = document.getElementById('apiKey');
    if (tk && k) tk.textContent = k.type === 'password' ? t('show') : t('hide');
  }

  window.I18N = { LANGS, t, apply, get lang() { return current; } };
})();
