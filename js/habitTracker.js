const HabitModule = {
  habits: [],

  async init() {
    this.habits = await StorageEngine.load('habits', [
      { id: 1, name: 'Read CS Papers', category: 'Research', streak: 4, completedToday: false }
    ]);
    // Daily reset: a check-in only counts for the day it was made; a missed day breaks the streak.
    const today = localDate(), yesterday = localDate(new Date(Date.now() - 864e5));
    this.habits.forEach((h) => {
      if (h.lastDone === today) h.completedToday = true;
      else { h.completedToday = false; if (h.lastDone && h.lastDone !== yesterday) h.streak = 0; }
    });
    this.render();
    this.bindEvents();
  },

  bindEvents() {
    if (this._bound) return;
    this._bound = true;
    document.getElementById('habit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('habit-name').value.trim();
      const category = document.getElementById('habit-category').value.trim() || 'General';

      this.habits.push({ id: Date.now(), name, category, streak: 0, completedToday: false });
      document.getElementById('habit-name').value = '';
      document.getElementById('habit-category').value = '';

      await StorageEngine.save('habits', this.habits);
      this.render();
      showToast('Habit registered');
    });
  },

  async toggleHabit(id) {
    const habit = this.habits.find(h => h.id === id);
    if (habit) {
      if (!habit.completedToday) { habit.prevDone = habit.lastDone || null; habit.lastDone = localDate(); }
      else { habit.lastDone = habit.prevDone || null; }
      habit.completedToday = !habit.completedToday;
      habit.streak = habit.completedToday ? habit.streak + 1 : Math.max(0, habit.streak - 1);
      await StorageEngine.save('habits', this.habits);
      this.render();
    }
  },

  async deleteHabit(id) {
    this.habits = this.habits.filter(h => h.id !== id);
    await StorageEngine.save('habits', this.habits);
    this.render();
    showToast('Habit deleted');
  },

  render() {
    const list = document.getElementById('habit-list');
    if (this.habits.length === 0) {
      list.innerHTML = `<li style="color: var(--text-muted); justify-content: center;">No active habits tracked.</li>`;
      return;
    }

    list.innerHTML = this.habits.map(h => `
      <li>
        <div>
          <strong>${esc(h.name)}</strong> 
          <small style="color: var(--text-muted); display: block;">${esc(h.category)} • ${h.streak} day streak</small>
        </div>
        <div style="display: flex; gap: 6px; flex-shrink: 0;">
          <button data-act="HabitModule.toggleHabit" data-args="${h.id}" class="btn ${h.completedToday ? 'secondary' : 'primary'}" style="padding: 6px 12px; font-size: 0.82rem; min-height: 34px;">
            ${h.completedToday ? 'Done ✓' : 'Check In'}
          </button>
          <button data-act="HabitModule.deleteHabit" data-args="${h.id}" class="btn ghost" style="padding: 6px 10px; font-size: 0.82rem; color: var(--danger); min-height: 34px;">✕</button>
        </div>
      </li>
    `).join('');
  }
};