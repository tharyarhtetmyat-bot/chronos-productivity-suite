const NotificationModule = {
  notifiedKeys: new Set(),
  checkInterval: null,

  init() {
    this.updatePermissionUI();
    this.bindEvents();
    this.startScheduler();
  },

  bindEvents() {
    if (this._bound) return;
    this._bound = true;
    const reqBtn = document.getElementById('request-notif-btn');
    const quickBtn = document.getElementById('notif-quick-btn');
    const testBtn = document.getElementById('test-notif-btn');

    if (reqBtn) reqBtn.addEventListener('click', () => this.requestPermission());
    if (quickBtn) quickBtn.addEventListener('click', () => this.requestPermission());
    if (testBtn) {
      testBtn.addEventListener('click', () => {
        this.send('Chronos Universal Alert', 'System-level background notifications are active!');
      });
    }
  },

  async requestPermission() {
    if (!('Notification' in window)) {
      showToast('Notifications are not supported by this environment.');
      return false;
    }

    if (Notification.permission === 'granted') {
      showToast('Push notifications are already enabled!');
      this.updatePermissionUI();
      return true;
    }

    if (Notification.permission === 'denied') {
      showToast('Notifications blocked in browser settings.');
      this.updatePermissionUI();
      return false;
    }

    const permission = await Notification.requestPermission();
    this.updatePermissionUI();
    if (permission === 'granted') {
      showToast('Push notifications enabled!');
      this.send('Chronos Alerts Enabled', 'You will receive background notifications.');
      return true;
    } else {
      showToast('Notification permission declined.');
      return false;
    }
  },

  updatePermissionUI() {
    const statusText = !('Notification' in window) ? 'Unsupported' : Notification.permission.toUpperCase();
    const profEl = document.getElementById('prof-notif-permission');
    const badgeEl = document.getElementById('notif-status-badge');

    if (profEl) profEl.innerText = statusText;
    if (badgeEl) {
      badgeEl.innerText = statusText === 'GRANTED' ? 'Alerts On' : 'Enable Alerts';
    }
  },

  async send(title, body) {
    showToast(`${title}: ${body}`);
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const options = {
      body: body,
      icon: 'assets/icon.png',
      badge: 'assets/icon.png',
      vibrate: [300, 100, 300],
      tag: 'chronos-' + Date.now(),
      requireInteraction: true
    };

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(title, options);
          return;
        }
      }
      new Notification(title, options);
    } catch (err) {
      console.warn('Notification error:', err);
    }
  },

  startScheduler() {
    if (this.checkInterval) clearInterval(this.checkInterval);
    this.checkInterval = setInterval(() => this.checkDueAlerts(), 30000);
  },

  async checkDueAlerts() {
    if (!StorageEngine.getCurrentUsername()) return;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = dayNames[now.getDay()];

    const events = await StorageEngine.load('events', []);
    events.forEach(ev => {
      if (ev.date === todayStr && ev.time === currentHM) {
        const key = `ev-${ev.id}-${todayStr}-${currentHM}`;
        if (!this.notifiedKeys.has(key)) {
          this.notifiedKeys.add(key);
          this.send('Chronos Calendar Reminder', `${ev.title} (${ev.time})`);
        }
      }
    });

    const schedule = await StorageEngine.load('timetable', []);
    schedule.forEach(item => {
      if (item.day === currentDay && item.start === currentHM) {
        const key = `tt-${item.id}-${todayStr}-${currentHM}`;
        if (!this.notifiedKeys.has(key)) {
          this.notifiedKeys.add(key);
          const loc = item.location ? ` @ ${item.location}` : '';
          this.send('Chronos Schedule Starting', `${item.title} (${item.start} - ${item.end})${loc}`);
        }
      }
    });
  }
};