const TimetableModule = {
  schedule: [],

  async init() {
    this.schedule = await StorageEngine.load('timetable', [
      { id: 1, title: 'Calculus I', day: 'Monday', start: '09:00', end: '10:30', location: 'Hall A' },
      { id: 2, title: 'Data Structures Lab', day: 'Wednesday', start: '13:00', end: '15:00', location: 'Lab 302' }
    ]);
    this.render();
    this.bindEvents();
  },

  bindEvents() {
    if (this._bound) return;
    this._bound = true;
    document.getElementById('timetable-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('tt-title').value.trim();
      const day = document.getElementById('tt-day').value;
      const start = document.getElementById('tt-start').value;
      const end = document.getElementById('tt-end').value;
      const location = document.getElementById('tt-location').value.trim();
      if (end <= start) { showToast('End time must be after start time'); return; }

      this.schedule.push({ id: Date.now(), title, day, start, end, location });
      document.getElementById('tt-title').value = '';
      document.getElementById('tt-location').value = '';

      await StorageEngine.save('timetable', this.schedule);
      this.render();
      showToast('Schedule block added securely!');
    });

    document.getElementById('edit-timetable-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = Number(document.getElementById('edit-tt-id').value);
      const title = document.getElementById('edit-tt-title').value.trim();
      const day = document.getElementById('edit-tt-day').value;
      const start = document.getElementById('edit-tt-start').value;
      const end = document.getElementById('edit-tt-end').value;
      const location = document.getElementById('edit-tt-location').value.trim();
      if (end <= start) { showToast('End time must be after start time'); return; }

      const idx = this.schedule.findIndex(item => item.id === id);
      if (idx !== -1) {
        this.schedule[idx] = { ...this.schedule[idx], title, day, start, end, location };
        await StorageEngine.save('timetable', this.schedule);
        this.render();
        closeEditModal();
        showToast('Schedule block updated!');
      }
    });
  },

  openEditModal(id) {
    const item = this.schedule.find(i => i.id === id);
    if (!item) return;

    document.getElementById('edit-modal-title').innerText = 'Edit Schedule Block';
    document.getElementById('edit-event-form').classList.add('hidden');
    document.getElementById('edit-timetable-form').classList.remove('hidden');

    document.getElementById('edit-tt-id').value = item.id;
    document.getElementById('edit-tt-title').value = item.title;
    document.getElementById('edit-tt-day').value = item.day;
    document.getElementById('edit-tt-start').value = item.start;
    document.getElementById('edit-tt-end').value = item.end;
    document.getElementById('edit-tt-location').value = item.location || '';

    document.getElementById('edit-modal-overlay').classList.remove('hidden');
  },

  async deleteItem(id) {
    this.schedule = this.schedule.filter(item => item.id !== id);
    await StorageEngine.save('timetable', this.schedule);
    this.render();
    showToast('Schedule block deleted');
  },

  render() {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const matrix = document.getElementById('timetable-matrix');

    matrix.innerHTML = days.map(day => {
      const dayItems = this.schedule
        .filter(item => item.day === day)
        .sort((a, b) => a.start.localeCompare(b.start));

      return `
        <div class="tt-day-col">
          <h5>${day}</h5>
          ${dayItems.length === 0 ? `<div style="color: var(--text-muted); font-size: 0.78rem; text-align: center; padding: 10px;">Free</div>` : ''}
          ${dayItems.map(item => `
            <div class="tt-card">
              <div style="display: flex; justify-content: space-between; align-items: start; gap: 4px;">
                <strong style="word-break: break-word; flex: 1;">${esc(item.title)}</strong>
                <div style="display: flex; gap: 3px; flex-shrink: 0;">
                  <button data-act="TimetableModule.openEditModal" data-args="${item.id}" class="btn ghost" style="padding: 2px 5px; font-size: 0.72rem; min-height: 24px;" title="Edit Block">✎</button>
                  <button data-act="TimetableModule.deleteItem" data-args="${item.id}" class="btn ghost" style="padding: 2px 5px; font-size: 0.72rem; color: var(--danger); min-height: 24px;" title="Delete Block">✕</button>
                </div>
              </div>
              <small style="color: var(--text-muted); display: block; margin-top: 2px;">⏰ ${item.start} - ${item.end}</small>
              ${item.location ? `<small style="color: var(--text-muted); display: block;">📍 ${esc(item.location)}</small>` : ''}
            </div>
          `).join('')}
        </div>
      `;
    }).join('');
  }
};