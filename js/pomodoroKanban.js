const TaskModule = {
  tasks: [],
  timerInterval: null,
  timeLeft: 25 * 60,

  async init() {
    this.tasks = await StorageEngine.load('tasks', [
      { id: 1, title: 'Draft Statement of Purpose Essay', status: 'todo' },
      { id: 2, title: 'Finalize Chronos GitHub Deployment', status: 'inprogress' }
    ]);
    this.renderTasks();
    this.bindEvents();
  },

  bindEvents() {
    if (this._bound) return;
    this._bound = true;
    document.getElementById('task-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('task-title');
      this.tasks.push({ id: Date.now(), title: input.value.trim(), status: 'todo' });
      input.value = '';
      await this.saveAndRender();
    });

    document.getElementById('start-timer-btn').addEventListener('click', () => this.startTimer());
    document.getElementById('pause-timer-btn').addEventListener('click', () => this.pauseTimer());
    document.getElementById('reset-timer-btn').addEventListener('click', () => this.resetTimer());
  },

  startTimer() {
    if (this.timerInterval) return;
    const endAt = Date.now() + this.timeLeft * 1000;
    this.timerInterval = setInterval(() => {
      this.timeLeft = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      this.updateTimerDisplay();
      if (this.timeLeft === 0) {
        this.pauseTimer();
        NotificationModule.send('Chronos Focus Complete!', 'Your 25-minute Pomodoro sprint has finished.');
      }
    }, 250);
  },

  pauseTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
  },

  resetTimer() {
    this.pauseTimer();
    this.timeLeft = 25 * 60;
    this.updateTimerDisplay();
  },

  updateTimerDisplay() {
    const mins = String(Math.floor(this.timeLeft / 60)).padStart(2, '0');
    const secs = String(this.timeLeft % 60).padStart(2, '0');
    document.getElementById('timer-display').innerText = `${mins}:${secs}`;
    document.title = this.timerInterval ? `${mins}:${secs} · Chronos` : 'Chronos — Personal Productivity Suite';
  },

  async moveTask(id, newStatus) {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      task.status = newStatus;
      await this.saveAndRender();
    }
  },

  async deleteTask(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    await this.saveAndRender();
  },

  async saveAndRender() {
    await StorageEngine.save('tasks', this.tasks);
    this.renderTasks();
  },

  renderTasks() {
    ['todo', 'inprogress', 'done'].forEach(status => {
      const col = document.getElementById(`col-${status}`);
      const filtered = this.tasks.filter(t => t.status === status);
      
      if (filtered.length === 0) {
        col.innerHTML = `<div style="color: var(--text-muted); font-size: 0.8rem; text-align: center; padding: 12px;">Empty</div>`;
        return;
      }

      col.innerHTML = filtered.map(t => `
        <div class="task-card">
          <div style="display: flex; justify-content: space-between; align-items: start; gap: 8px;">
            <p style="word-break: break-word; flex: 1;">${esc(t.title)}</p>
            <button data-act="TaskModule.deleteTask" data-args="${t.id}" class="btn ghost" style="padding: 2px 6px; font-size: 0.72rem; color: var(--danger); min-height: 28px;">✕</button>
          </div>
          <div style="margin-top:10px; display:flex; gap:6px; flex-wrap:wrap;">
            ${status !== 'todo' ? `<button data-act="TaskModule.moveTask" data-args="${t.id}, 'todo'" class="btn ghost" style="padding: 4px 8px; font-size: 0.74rem; min-height: 30px;">← To Do</button>` : ''}
            ${status !== 'inprogress' ? `<button data-act="TaskModule.moveTask" data-args="${t.id}, 'inprogress'" class="btn ghost" style="padding: 4px 8px; font-size: 0.74rem; min-height: 30px;">In Progress</button>` : ''}
            ${status !== 'done' ? `<button data-act="TaskModule.moveTask" data-args="${t.id}, 'done'" class="btn ghost" style="padding: 4px 8px; font-size: 0.74rem; min-height: 30px;">Done →</button>` : ''}
          </div>
        </div>
      `).join('');
    });
  }
};