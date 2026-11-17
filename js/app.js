/* Shared helpers */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function showToast(message) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

function closeEditModal() {
  document.getElementById('edit-modal-overlay').classList.add('hidden');
}

const tabMeta = {
  dashboard: { title: 'Home', icon: '🏠' },
  calendar: { title: 'Calendar & Milestone Planner', icon: '📅' },
  timetable: { title: 'Weekly Schedule Matrix', icon: '🗓️' },
  habits: { title: 'Habits', icon: '⚡' },
  budget: { title: 'Financial Tracker & Splitter', icon: '💳' },
  tasks: { title: 'Tasks & Focus Timer', icon: '🎯' },
  notes: { title: 'Notes & Scratchpad', icon: '📝' },
  analytics: { title: 'Analytics', icon: '📊' },
  profile: { title: 'Profile & Security', icon: '👤' }
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      console.log('Service Worker registered:', reg.scope);
    }).catch(err => console.warn('SW registration skipped:', err));
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  document.documentElement.setAttribute('data-theme', localStorage.getItem(StorageEngine.KEYS.THEME) || 'light');
  document.querySelectorAll('.brand-logo-img').forEach((img) => img.addEventListener('error', () => {
    img.style.display = 'none'; if (img.nextElementSibling) img.nextElementSibling.style.display = 'flex';
  }));
  await AuthEngine.initUI();
  if (!await AuthEngine.getCurrentUser()) return;

  const sidebar = document.getElementById('app-sidebar');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
  const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
  const navItems = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');

  function isMobile() {
    return window.innerWidth <= 768;
  }

  function openMobileSidebar() {
    sidebar.classList.add('mobile-open');
    sidebarBackdrop.classList.remove('hidden');
  }

  function closeMobileSidebar() {
    sidebar.classList.remove('mobile-open');
    sidebarBackdrop.classList.add('hidden');
  }

  sidebarToggleBtn.addEventListener('click', () => {
    if (isMobile()) {
      if (sidebar.classList.contains('mobile-open')) closeMobileSidebar();
      else openMobileSidebar();
    } else {
      sidebar.classList.toggle('collapsed');
    }
  });

  if (sidebarCloseBtn) sidebarCloseBtn.addEventListener('click', closeMobileSidebar);
  if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeMobileSidebar);
  window.addEventListener('resize', () => { if (!isMobile()) closeMobileSidebar(); });

  const closeEditBtn = document.getElementById('close-edit-modal-btn');
  const editOverlay = document.getElementById('edit-modal-overlay');
  if (closeEditBtn) closeEditBtn.addEventListener('click', closeEditModal);
  if (editOverlay) {
    editOverlay.addEventListener('click', (e) => {
      if (e.target === editOverlay) closeEditModal();
    });
  }

  async function switchTab(tabKey) {
    navItems.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    const activeNav = document.querySelector(`.nav-item[data-tab="${tabKey}"]`);
    const activeContent = document.getElementById(`tab-${tabKey}`);
    if (activeNav && activeContent) {
      activeNav.classList.add('active');
      activeContent.classList.add('active');

      const meta = tabMeta[tabKey] || { title: 'Chronos', icon: '📄' };
      document.getElementById('top-bar-icon').innerText = meta.icon;
      document.getElementById('top-bar-title').innerText = meta.title;

      if (tabKey === 'dashboard') await updateDashboardMetrics();
      if (tabKey === 'analytics') await AnalyticsModule.render();
      if (tabKey === 'profile') NotificationModule.updatePermissionUI();

      navItems.forEach((b) => b.removeAttribute('aria-current'));
      activeNav.setAttribute('aria-current', 'page');
      if (isMobile()) closeMobileSidebar();
    }
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => switchTab(item.dataset.tab));
  });

  const profileBadge = document.getElementById('user-profile-badge');
  if (profileBadge) {
    profileBadge.addEventListener('click', () => switchTab('profile'));
  }

  async function updateDashboardMetrics() {
    const tasks = await StorageEngine.load('tasks', []);
    const habits = await StorageEngine.load('habits', []);
    const budget = await StorageEngine.load('budget', []);

    const pendingTasks = tasks.filter(t => t.status !== 'done').length;
    const activeHabits = habits.length;
    const income = budget.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expenses = budget.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    const balance = income - expenses;

    document.getElementById('dash-tasks-count').innerText = pendingTasks;
    document.getElementById('dash-habits-count').innerText = activeHabits;
    document.getElementById('dash-balance').innerText = `$${balance.toFixed(2)}`;

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('current-date-display').innerText = new Date().toLocaleDateString(undefined, options);

    const agendaList = document.getElementById('dash-agenda-list');
    const upcomingTasks = tasks.filter(t => t.status !== 'done').slice(0, 3);
    if (agendaList) {
      agendaList.innerHTML = upcomingTasks.length > 0 
        ? upcomingTasks.map(t => `<li><span>📌 ${esc(t.title)}</span><small style="color:var(--text-muted);">${t.status}</small></li>`).join('')
        : '<li style="color: var(--text-muted);">No urgent tasks pending.</li>';
    }

    const activityLog = document.getElementById('dash-activity-log');
    if (activityLog) {
      activityLog.innerHTML = `
        <li><span>⚡ Chronos workspace active</span><small style="color:var(--text-muted);">Just now</small></li>
        <li><span>🔒 AES-GCM Encrypted Storage</span><small style="color:var(--text-muted);">Secure</small></li>
      `;
    }
  }

  const themeBtn = document.getElementById('theme-toggle-btn');
  const currentTheme = localStorage.getItem(StorageEngine.KEYS.THEME) || 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
  themeBtn.innerHTML = currentTheme === 'dark' ? '☀️ Light' : '🌙 Dark';

  themeBtn.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem(StorageEngine.KEYS.THEME, newTheme);
    themeBtn.innerHTML = newTheme === 'dark' ? '☀️ Light' : '🌙 Dark';
    showToast(`Switched to ${newTheme} mode`);
  });

  document.getElementById('export-data-btn').addEventListener('click', async () => {
    await StorageEngine.exportAllData();
    showToast('Backup downloaded — it is plain JSON, keep it private.');
  });

  document.getElementById('import-data-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      if (await StorageEngine.importData(event.target.result)) {
        showToast('Workspace restored!');
        await CalendarModule.init();
        await TimetableModule.init();
        await HabitModule.init();
        await BudgetModule.init();
        await TaskModule.init();
        await NotesModule.init();
        await AnalyticsModule.init();
        await updateDashboardMetrics();
      } else {
        showToast('Invalid backup file!');
      }
    };
    reader.readAsText(file);
  });

  document.addEventListener('keydown', async (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'].includes(e.target.tagName) || e.ctrlKey || e.metaKey) return;

    const order = ['dashboard', 'calendar', 'timetable', 'habits', 'budget', 'tasks', 'notes', 'analytics', 'profile'];
    if (e.altKey && /^Digit[0-8]$/.test(e.code)) { e.preventDefault(); await switchTab(order[Number(e.code.slice(5))]); }

    if (e.code === 'Space') {
      const tasksTab = document.getElementById('tab-tasks');
      if (tasksTab && tasksTab.classList.contains('active')) {
        e.preventDefault();
        if (TaskModule.timerInterval) {
          TaskModule.pauseTimer();
          showToast('Timer paused');
        } else {
          TaskModule.startTimer();
          showToast('Timer started');
        }
      }
    }
  });

  const paletteActions = [
    { label: '🌙 Toggle theme', run: () => themeBtn.click() },
    { label: '💾 Download backup', run: () => document.getElementById('export-data-btn').click() }
  ];
  CommandPalette.init(switchTab, tabMeta, paletteActions);

  // Event delegation replaces inline onclick handlers (keeps the page compatible with a strict CSP).
  const modules = { CalendarModule, TimetableModule, HabitModule, BudgetModule, TaskModule, NotesModule };
  const parseArg = (a) => { a = a.trim().replace(/^'|'$/g, ''); return a !== '' && !isNaN(a) ? Number(a) : a; };
  const dispatch = (el) => {
    const [mod, fn] = el.dataset.act.split('.');
    if (modules[mod] && typeof modules[mod][fn] === 'function') {
      modules[mod][fn](...(el.dataset.args ? el.dataset.args.split(',').map(parseArg) : []));
    }
  };
  document.addEventListener('click', (e) => { const el = e.target.closest('[data-act]'); if (el) dispatch(el); });
  document.addEventListener('keydown', (e) => {
    const el = e.target.closest && e.target.closest('[data-act][role="button"]');
    if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); dispatch(el); }
    if (e.key === 'Escape') { closeEditModal(); closeMobileSidebar(); }
  });

  const fieldLabels = { 'event-date': 'Event date', 'event-time': 'Reminder time', 'tt-day': 'Day of week', 'tt-start': 'Start time',
    'tt-end': 'End time', 'trans-type': 'Transaction type' };
  document.querySelectorAll('input, select, textarea').forEach((el) => {
    if (el.labels && el.labels.length) return;
    const text = el.getAttribute('aria-label') || fieldLabels[el.id] || el.placeholder || el.title;
    if (text) el.setAttribute('aria-label', text);
  });

  NotificationModule.init();
  await CalendarModule.init();
  await TimetableModule.init();
  await HabitModule.init();
  await BudgetModule.init();
  await TaskModule.init();
  await NotesModule.init();
  await AnalyticsModule.init();
  await updateDashboardMetrics();
});