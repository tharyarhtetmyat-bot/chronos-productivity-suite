/** StorageEngine — encrypted per-user key/value store on top of localStorage. */
const StorageEngine = {
  KEYS: {
    USERS: 'chronos_users_v2',
    LEGACY_USERS: 'chronos_users_encrypted',
    CURRENT_USER: 'chronos_session_user',
    SESSION_KEY: 'chronos_session_key', // sessionStorage only: wiped when the tab closes
    THEME: 'chronos_theme'
  },
  DATA_KEYS: ['habits', 'budget', 'tasks', 'events', 'timetable', 'notes'],
  _dek: null,

  getUserKey: (key, username) => `chronos_${username}_${key}`,
  getCurrentUsername() { return localStorage.getItem(this.KEYS.CURRENT_USER); },

  async getDek() {
    if (this._dek) return this._dek;
    const raw = sessionStorage.getItem(this.KEYS.SESSION_KEY);
    if (!raw) return null;
    return (this._dek = await CryptoEngine.importDek(CryptoEngine.unb64(raw)));
  },

  async load(key, fallback) {
    try {
      const username = this.getCurrentUsername(), dek = await this.getDek();
      if (!username || !dek) return fallback;
      const stored = localStorage.getItem(this.getUserKey(key, username));
      if (!stored) return fallback;
      const data = await CryptoEngine.decryptData(stored, dek);
      return data !== null ? data : fallback;
    } catch (e) {
      console.error('Storage read error:', e);
      return fallback;
    }
  },

  async save(key, data) {
    try {
      const username = this.getCurrentUsername(), dek = await this.getDek();
      if (!username || !dek) return;
      localStorage.setItem(this.getUserKey(key, username), await CryptoEngine.encryptData(data, dek));
    } catch (e) {
      console.error('Storage write error:', e);
      if (typeof showToast === 'function') showToast('Could not save — browser storage may be full.');
    }
  },

  /** Plain JSON backup (portable across accounts). Keep the file private. */
  async exportAllData() {
    const username = this.getCurrentUsername();
    if (!username) return;
    const backup = { user: username, schemaVersion: '7.0', exportedAt: new Date().toISOString() };
    for (const k of this.DATA_KEYS) backup[k] = await this.load(k, []);
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `chronos_${username}_backup_${Date.now()}.json` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  async importData(jsonData) {
    try {
      const parsed = JSON.parse(jsonData);
      if (!parsed || typeof parsed !== 'object') return false;
      let restored = 0;
      for (const k of this.DATA_KEYS) {
        if (Array.isArray(parsed[k])) { await this.save(k, parsed[k]); restored++; }
      }
      return restored > 0;
    } catch { return false; }
  }
};
localStorage.removeItem('temp_master_key'); // v6 stored the plaintext password here
