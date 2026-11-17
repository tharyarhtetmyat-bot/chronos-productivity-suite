const NotesModule = {
  notes: [],

  async init() {
    this.notes = await StorageEngine.load('notes', [
      { id: 1, title: 'Welcome to Chronos', content: 'Chronos features AES-GCM authenticated encryption for zero-server GitHub Pages security.', updated: '2026-11-16' }
    ]);
    this.render();
    this.bindEvents();
  },

  bindEvents() {
    if (this._bound) return;
    this._bound = true;
    document.getElementById('note-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('note-title').value.trim();
      const content = document.getElementById('note-content').value.trim();
      const today = localDate();

      this.notes.unshift({ id: Date.now(), title, content, updated: today });
      document.getElementById('note-title').value = '';
      document.getElementById('note-content').value = '';

      await StorageEngine.save('notes', this.notes);
      this.render();
      showToast('Note saved securely!');
    });
  },

  async deleteNote(id) {
    this.notes = this.notes.filter(n => n.id !== id);
    await StorageEngine.save('notes', this.notes);
    this.render();
    showToast('Note deleted');
  },

  render() {
    const container = document.getElementById('notes-grid');
    if (this.notes.length === 0) {
      container.innerHTML = `<p style="color: var(--text-muted); grid-column: 1 / -1; text-align: center;">No notes saved.</p>`;
      return;
    }

    container.innerHTML = this.notes.map(n => `
      <div class="panel" style="margin-bottom: 0; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; gap: 8px;">
            <h4 style="font-size: 0.98rem; font-weight: 600;">${esc(n.title)}</h4>
            <button data-act="NotesModule.deleteNote" data-args="${n.id}" class="btn ghost" style="padding: 2px 6px; font-size: 0.72rem; color: var(--danger); min-height: 28px;">✕</button>
          </div>
          <p style="font-size: 0.88rem; color: var(--text-muted); white-space: pre-wrap; word-break: break-word; margin-bottom: 12px;">${esc(n.content)}</p>
        </div>
        <small style="font-size: 0.72rem; color: var(--text-muted); border-top: 1px solid var(--border); padding-top: 6px;">Updated: ${n.updated}</small>
      </div>
    `).join('');
  }
};