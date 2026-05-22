// PIW v1 — Background Service Worker

let _stats    = { total: 0, sites: {}, recent: [] };
let _settings = { enabled: true, sensitivity: 'medium' };

chrome.storage.local.get(['stats', 'settings'], d => {
  if (d.stats)    _stats    = d.stats;
  if (d.settings) _settings = d.settings;
});

function notifyAllTabs(msg) {
  chrome.tabs.query({}, tabs => {
    tabs.forEach(t =>
      chrome.tabs.sendMessage(t.id, msg, () => void chrome.runtime.lastError)
    );
  });
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === 'finding') {
    _stats.total++;
    _stats.sites[msg.host] = (_stats.sites[msg.host] || 0) + 1;
    _stats.recent.unshift({ host: msg.host, severity: msg.severity, labels: msg.labels, ts: msg.ts });
    if (_stats.recent.length > 60) _stats.recent.pop();
    chrome.storage.local.set({ stats: _stats });
    const tabId = sender.tab?.id;
    if (tabId) {
      chrome.action.setBadgeText({ text: String(_stats.total), tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444', tabId });
    }
    return true;
  }

  if (msg.type === 'get_stats') {
    reply(_stats);
    return true;
  }

  if (msg.type === 'clear_stats') {
    _stats = { total: 0, sites: {}, recent: [] };
    chrome.storage.local.set({ stats: _stats });
    chrome.action.setBadgeText({ text: '' });
    reply({ success: true });
    return true;
  }

  if (msg.type === 'get_settings') {
    reply(_settings);
    return true;
  }

  if (msg.type === 'set_settings') {
    _settings = { enabled: msg.enabled !== false, sensitivity: msg.sensitivity || 'medium' };
    chrome.storage.local.set({ settings: _settings }, () =>
      notifyAllTabs({ type: 'settings_updated', ..._settings })
    );
    reply({ success: true });
    return true;
  }

  return true;
});
