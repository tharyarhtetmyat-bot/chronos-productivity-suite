const CalendarModule = {
  events: [],
  currentDate: new Date(),

  async init() {
    this.events = await StorageEngine.load('events', [
      { id: 1, title: 'KMUTT CS Application Deadline', date: '2026-10-30', time: '09:00' }
    ]);
    this.render();
    this.bindEvents();
  },

  bindEvents() {
    if (this._bound) return;
    this._bound = true;
    document.getElementById('cal-prev').addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      this.render();
    });

    document.getElementById('cal-next').addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      this.render();
    });

    document.getElementById('cal-today').addEventListener('click', () => {
      this.currentDate = new Date();
      this.render();
    });

    document.getElementById('event-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('event-title').value.trim();
      const date = document.getElementById('event-date').value;
      const time = document.getElementById('event-time').value;

      if (!title || !date) return;

      this.events.push({ id: Date.now(), title, date, time: time || '' });
      document.getElementById('event-title').value = '';
      document.getElementById('event-date').value = '';
      document.getElementById('event-time').value = '';

      await StorageEngine.save('events', this.events);
      this.render();
      showToast('Calendar event added securely');
    });

    document.getElementById('edit-event-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = Number(document.getElementById('edit-event-id').value);
      const title = document.getElementById('edit-event-title').value.trim();
      const date = document.getElementById('edit-event-date').value;
      const time = document.getElementById('edit-event-time').value;

      const idx = this.events.findIndex(ev => ev.id === id);
      if (idx !== -1) {
        this.events[idx] = { ...this.events[idx], title, date, time: time || '' };
        await StorageEngine.save('events', this.events);
        this.render();
        closeEditModal();
        showToast('Event updated!');
      }
    });
  },

  openEditModal(id) {
    const ev = this.events.find(e => e.id === id);
    if (!ev) return;

    document.getElementById('edit-modal-title').innerText = 'Edit Calendar Event';
    document.getElementById('edit-timetable-form').classList.add('hidden');
    document.getElementById('edit-event-form').classList.remove('hidden');

    document.getElementById('edit-event-id').value = ev.id;
    document.getElementById('edit-event-title').value = ev.title;
    document.getElementById('edit-event-date').value = ev.date;
    document.getElementById('edit-event-time').value = ev.time || '';

    document.getElementById('edit-modal-overlay').classList.remove('hidden');
  },

  handleDayClick(dateStr) {
    const dateInput = document.getElementById('event-date');
    const titleInput = document.getElementById('event-title');
    const formPanel = document.getElementById('event-form-panel');

    if (dateInput) dateInput.value = dateStr;
    if (formPanel && window.innerWidth <= 768) {
      formPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (titleInput) titleInput.focus();
    showToast(`Selected date: ${dateStr}`);
  },

  async deleteEvent(id) {
    this.events = this.events.filter(ev => ev.id !== id);
    await StorageEngine.save('events', this.events);
    this.render();
    showToast('Event removed');
  },

  render() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById('cal-month-year').innerText = `${monthNames[month]} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const grid = document.getElementById('calendar-grid');
    let cellsHTML = '';

    for (let i = 0; i < firstDayIndex; i++) {
      cellsHTML += `<div class="cal-cell empty"></div>`;
    }

    const todayStr = localDate();

    for (let day = 1; day <= totalDays; day++) {
      const formattedMonth = String(month + 1).padStart(2, '0');
      const formattedDay = String(day).padStart(2, '0');
      const dateStr = `${year}-${formattedMonth}-${formattedDay}`;

      const dayEvents = this.events.filter(ev => ev.date === dateStr);
      const isToday = dateStr === todayStr;

      cellsHTML += `
        <div class="cal-cell ${isToday ? 'today' : ''}" role="button" tabindex="0" aria-label="${monthNames[month]} ${day}, ${year}" data-act="CalendarModule.handleDayClick" data-args="'${dateStr}'">
          <strong>${day}</strong>
          <div class="cal-events">
            ${dayEvents.map(ev => `<span class="cal-event-tag" title="${esc(ev.title)}">${esc(ev.title)}</span>`).join('')}
          </div>
        </div>
      `;
    }

    grid.innerHTML = cellsHTML;

    const eventList = document.getElementById('event-list');
    if (this.events.length === 0) {
      eventList.innerHTML = `<li style="color: var(--text-muted); justify-content: center;">No scheduled milestones.</li>`;
      return;
    }

    eventList.innerHTML = this.events.sort((a,b) => a.date.localeCompare(b.date)).map(ev => `
      <li>
        <div>
          <strong>${esc(ev.title)}</strong>
          <small style="color: var(--text-muted); display: block;">${ev.date}${ev.time ? ` • 🔔 ${ev.time}` : ''}</small>
        </div>
        <div style="display: flex; gap: 6px; flex-shrink: 0;">
          <button data-act="CalendarModule.openEditModal" data-args="${ev.id}" class="btn ghost" style="padding: 4px 8px; font-size: 0.78rem; min-height: 30px;" title="Edit Event">✎</button>
          <button data-act="CalendarModule.deleteEvent" data-args="${ev.id}" class="btn ghost" style="padding: 4px 8px; font-size: 0.78rem; color: var(--danger); min-height: 30px;" title="Delete Event">✕</button>
        </div>
      </li>
    `).join('');
  }
};