// ═══════════════════════════════════════════════════════════════
// PIW v1 — Prompt Injection Warning · by Kerr
// Intercepts paste on AI chat sites and warns on injection patterns.
// Zero telemetry. All processing local.
// ═══════════════════════════════════════════════════════════════

// ── Detection patterns ─────────────────────────────────────────
const PATTERNS = [
  {
    id: 'instruction_override', severity: 'high', label: 'Instruction Override',
    re: /\b(?:ignore|disregard|override|forget)\b.{0,40}\b(?:previous|prior|above|all)\b.{0,40}\b(?:instructions?|prompts?|context|guidelines?|rules?)/i,
  },
  {
    id: 'role_hijack', severity: 'high', label: 'Role Hijack',
    re: /\b(?:you are now|act as(?: if)?|pretend (?:you are|to be)|imagine you(?:'?re| are))\b.{0,60}\b(?:unrestricted|uncensored|jailbroken|evil|without (?:restrictions|filters|rules|limits)|no (?:restrictions|rules|filters))/i,
  },
  {
    id: 'system_injection', severity: 'high', label: 'System Prompt Injection',
    re: /\[SYSTEM\]|<\/?system>|###\s*(?:SYSTEM|INSTRUCTIONS?)\s*[:：]|SYSTEM\s*PROMPT\s*[:：]|\[INST\]|\[\/?SYS\]/i,
  },
  {
    id: 'jailbreak', severity: 'high', label: 'Known Jailbreak',
    re: /\bDAN\b.{0,20}\b(?:do anything now|mode)\b|\bdo anything now\b|\bjailbreak(?:ed)?\s*(?:mode|prompt)\b|\bdeveloper mode\b/i,
  },
  {
    id: 'hidden_instruction', severity: 'medium', label: 'Hidden Instruction',
    re: /(?:translate|summarize|repeat|echo|print|output)\s+.{0,60}(?:but\s+)?(?:ignore|disregard)\s+(?:the\s+)?(?:above|previous|following)/i,
  },
  {
    id: 'exfiltration', severity: 'medium', label: 'Exfiltration Attempt',
    re: /(?:reveal|output|print|leak|expose|repeat back)\s+.{0,40}(?:your\s+)?(?:system\s+prompt|initial\s+instructions?|confidential|secret\s+(?:data|info))/i,
  },
  {
    id: 'context_escape', severity: 'medium', label: 'Context Escape',
    re: /(?:-{5,}|={5,}|\[{3,}|\]{3,})\s*(?:NEW|DIFFERENT|OVERRIDE|IGNORE|END)?\s*(?:INSTRUCTIONS?|CONTEXT|SYSTEM|PROMPT)/i,
  },
];

let _enabled = true;
let _sensitivity = 'medium'; // 'high' | 'medium' | 'low'

function activePatterns() {
  if (_sensitivity === 'high')   return PATTERNS;
  if (_sensitivity === 'medium') return PATTERNS.filter(p => p.severity !== 'low');
  return PATTERNS.filter(p => p.severity === 'high');
}

function scan(text) {
  const hits = [];
  for (const p of activePatterns()) {
    const m = text.match(p.re);
    if (m) hits.push({ label: p.label, severity: p.severity, excerpt: m[0].slice(0, 80) });
  }
  return hits;
}

// ── Warning banner (Shadow DOM) ────────────────────────────────
let _host = null;
let _autoDismiss = null;

function removeBanner() {
  if (_host) { _host.remove(); _host = null; }
  if (_autoDismiss) { clearTimeout(_autoDismiss); _autoDismiss = null; }
}

function showBanner(hits) {
  removeBanner();

  const top  = hits[0];
  const high = top.severity === 'high';
  const col  = high ? '#ef4444' : '#f59e0b';
  const dim  = high ? '#3f0a0a' : '#3b1f00';
  const bdr  = high ? '#7f1d1d' : '#92400e';
  const txt  = high ? '#fca5a5' : '#fcd34d';
  const allLabels = [...new Set(hits.map(h => h.label))].join(' · ');

  _host = document.createElement('div');
  _host.id = '__piw__';
  _host.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;pointer-events:none';
  document.documentElement.appendChild(_host);

  const shadow = _host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .bar {
        position:fixed; top:0; left:0; right:0; height:3px;
        background:${col}; box-shadow:0 0 8px ${col}88; z-index:2147483647;
      }
      .card {
        position:fixed; top:10px; left:50%; transform:translateX(-50%);
        background:${dim}; border:1.5px solid ${bdr}; border-radius:10px;
        padding:10px 14px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        font-size:13px; color:${txt}; box-shadow:0 4px 20px rgba(0,0,0,.55);
        pointer-events:auto; max-width:520px; width:calc(100vw - 40px);
        z-index:2147483647; animation:drop .18s ease;
      }
      @keyframes drop {
        from { opacity:0; transform:translateX(-50%) translateY(-10px); }
        to   { opacity:1; transform:translateX(-50%) translateY(0); }
      }
      .row { display:flex; align-items:center; gap:8px; margin-bottom:5px; }
      .icon { font-size:15px; flex-shrink:0; }
      .title { font-weight:700; flex:1; }
      .sev {
        font-size:10px; font-weight:700; padding:1px 7px; border-radius:10px;
        background:${bdr}; color:${txt}; text-transform:uppercase; flex-shrink:0;
      }
      .close {
        background:none; border:none; color:${txt}; cursor:pointer;
        font-size:15px; padding:0 0 0 2px; opacity:.6; flex-shrink:0;
      }
      .close:hover { opacity:1; }
      .excerpt {
        font-family:monospace; font-size:11px; opacity:.7;
        background:rgba(0,0,0,.25); border-radius:4px;
        padding:3px 8px; margin-bottom:5px;
        overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
      }
      .meta { font-size:10px; opacity:.55; }
    </style>
    <div class="bar"></div>
    <div class="card">
      <div class="row">
        <span class="icon">⚡</span>
        <span class="title">Prompt Injection Detected</span>
        <span class="sev">${top.severity}</span>
        <button class="close" id="x">✕</button>
      </div>
      <div class="excerpt">"${top.excerpt}${top.excerpt.length >= 80 ? '…' : ''}"</div>
      <div class="meta">${allLabels}${hits.length > 1 ? ` · ${hits.length} patterns` : ''}</div>
    </div>
  `;

  shadow.getElementById('x').onclick = removeBanner;
  if (!high) _autoDismiss = setTimeout(removeBanner, 8000);
}

// ── Paste interception ─────────────────────────────────────────
function handlePaste(e) {
  if (!_enabled) return;
  const text = (e.clipboardData || window.clipboardData)?.getData('text/plain') || '';
  if (text.length < 8) return;

  const hits = scan(text);
  if (!hits.length) return;

  showBanner(hits);
  chrome.runtime.sendMessage({
    type: 'finding',
    host: location.hostname,
    count: hits.length,
    severity: hits[0].severity,
    labels: hits.map(h => h.label),
    ts: Date.now(),
  }, () => void chrome.runtime.lastError);
}

document.addEventListener('paste', handlePaste, true);

// ── Load settings from background ─────────────────────────────
async function loadSettings() {
  let data;
  try {
    data = await chrome.runtime.sendMessage({ type: 'get_settings' });
  } catch {
    await new Promise(r => setTimeout(r, 150));
    try { data = await chrome.runtime.sendMessage({ type: 'get_settings' }); } catch {}
  }
  if (data) { _enabled = data.enabled !== false; _sensitivity = data.sensitivity || 'medium'; }
}
loadSettings();

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === 'settings_updated') {
    _enabled = msg.enabled !== false;
    _sensitivity = msg.sensitivity || 'medium';
    return false;
  }
  if (msg.type === 'get_status') {
    reply({ enabled: _enabled, sensitivity: _sensitivity });
    return false;
  }
  return false;
});
