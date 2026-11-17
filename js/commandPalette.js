/** Quick Command (Ctrl/⌘+K): jump to any section or run a common action. */
const CommandPalette = {
  init(switchTab, tabMeta, actions = []) {
    const items = [
      ...Object.entries(tabMeta).map(([key, m]) => ({ label: `${m.icon} ${m.title}`, run: () => switchTab(key) })),
      ...actions
    ];
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay hidden';
    overlay.innerHTML = '<div class="modal-card auth-card palette-box" role="dialog" aria-modal="true" aria-label="Quick command">' +
      '<input type="text" placeholder="Type a command…" aria-label="Search commands" autocomplete="off"><ul class="palette-list" role="listbox"></ul></div>';
    document.body.appendChild(overlay);
    const input = overlay.querySelector('input'), list = overlay.querySelector('ul');
    let shown = [], sel = 0;

    const draw = () => {
      const q = input.value.trim().toLowerCase();
      shown = items.filter((i) => i.label.toLowerCase().includes(q));
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      list.replaceChildren(...shown.map((item, i) => {
        const li = document.createElement('li');
        li.textContent = item.label; li.setAttribute('role', 'option');
        if (i === sel) li.className = 'sel';
        li.addEventListener('click', () => run(item));
        return li;
      }));
    };
    const close = () => overlay.classList.add('hidden');
    const open = () => { input.value = ''; sel = 0; draw(); overlay.classList.remove('hidden'); input.focus(); };
    const run = (item) => { close(); item.run(); };

    input.addEventListener('input', () => { sel = 0; draw(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); draw(); }
      else if (e.key === 'Enter' && shown[sel]) { e.preventDefault(); run(shown[sel]); }
      else if (e.key === 'Escape') { e.stopPropagation(); close(); }
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.getElementById('global-search-trigger').addEventListener('click', open);
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); overlay.classList.contains('hidden') ? open() : close(); }
    });
  }
};
