/**
 * AuthEngine — accounts, sessions and recovery.
 * No password or secret word is stored: each is only used to unwrap the
 * account's data key, and a successful AES-GCM unwrap *is* the verification.
 */
const AuthEngine = {
  pendingSignupData: null,
  LEGACY_APP_KEY: 'ChronosMasterAppKey_2026!secure', // only to read pre-v7 accounts once, for migration

  norm: (s) => s.trim().toLowerCase(),

  async getUsers() {
    try { return JSON.parse(localStorage.getItem(StorageEngine.KEYS.USERS) || '[]'); } catch { return []; }
  },
  saveUsers(users) { localStorage.setItem(StorageEngine.KEYS.USERS, JSON.stringify(users)); },
  async updateUser(user) {
    const users = await this.getUsers();
    const i = users.findIndex((u) => u.username === user.username);
    if (i === -1) return false;
    users[i] = user; this.saveUsers(users); return true;
  },

  async buildUser(name, username, bio, raw, password, question, secret) {
    return {
      name: name.trim(), username, bio: bio || '', securityQuestion: question.trim(),
      pwWrap: await CryptoEngine.wrap(raw, password),
      secretWrap: await CryptoEngine.wrap(raw, this.norm(secret)),
      createdAt: new Date().toISOString()
    };
  },

  startSession(user, raw) {
    localStorage.setItem(StorageEngine.KEYS.CURRENT_USER, user.username);
    sessionStorage.setItem(StorageEngine.KEYS.SESSION_KEY, CryptoEngine.b64(raw));
    StorageEngine._dek = null;
  },

  /** One-time upgrade of v6 accounts: re-encrypt their data under a fresh data key. */
  async migrateLegacy(username, password) {
    const raw = localStorage.getItem(StorageEngine.KEYS.LEGACY_USERS);
    if (!raw) return null;
    const legacy = (await CryptoEngine.legacyDecrypt(raw, this.LEGACY_APP_KEY)) || [];
    if (!legacy.some((u) => u.username === username && u.password === password)) return null;
    const users = await this.getUsers();
    for (const old of legacy) {
      if (users.some((u) => u.username === old.username)) continue;
      const key = CryptoEngine.rand(32), dek = await CryptoEngine.importDek(key);
      for (const k of StorageEngine.DATA_KEYS) {
        const lk = StorageEngine.getUserKey(k, old.username), enc = localStorage.getItem(lk);
        const data = enc && await CryptoEngine.legacyDecrypt(enc, old.password);
        if (data) localStorage.setItem(lk, await CryptoEngine.encryptData(data, dek));
      }
      users.push(await this.buildUser(old.name, old.username, old.bio, key, old.password, old.securityQuestion || '', old.secretWord || ''));
    }
    this.saveUsers(users);
    localStorage.removeItem(StorageEngine.KEYS.LEGACY_USERS); // it held every password in recoverable form
    return users.find((u) => u.username === username) || null;
  },

  async registerFinal(name, username, password, hintQuestion, secretWord) {
    const clean = this.norm(username), users = await this.getUsers();
    if (users.some((u) => u.username === clean)) return { success: false, message: 'Username already exists!' };
    const key = CryptoEngine.rand(32);
    const user = await this.buildUser(name, clean, '', key, password, hintQuestion, secretWord);
    users.push(user); this.saveUsers(users);
    this.startSession(user, key);
    return { success: true, user };
  },

  async login(username, password) {
    const clean = this.norm(username), fail = { success: false, message: 'Invalid username or password!' };
    let user = (await this.getUsers()).find((u) => u.username === clean) || await this.migrateLegacy(clean, password);
    if (!user) return fail;
    const key = await CryptoEngine.unwrap(user.pwWrap, password);
    if (!key) return fail;
    this.startSession(user, key);
    return { success: true, user };
  },

  logout() {
    localStorage.removeItem(StorageEngine.KEYS.CURRENT_USER);
    sessionStorage.removeItem(StorageEngine.KEYS.SESSION_KEY);
    StorageEngine._dek = null;
    window.location.reload();
  },

  async getCurrentUser() {
    const username = localStorage.getItem(StorageEngine.KEYS.CURRENT_USER);
    if (!username || !sessionStorage.getItem(StorageEngine.KEYS.SESSION_KEY)) return null;
    return (await this.getUsers()).find((u) => u.username === username) || null;
  },

  async updateProfile(newName, newBio) {
    const user = await this.getCurrentUser();
    if (!user || !newName.trim()) return false;
    user.name = newName.trim(); user.bio = newBio.trim();
    await this.updateUser(user); this.updateProfileUI(user);
    return true;
  },

  async verifyPassword(password) {
    const user = await this.getCurrentUser();
    return !!user && !!(await CryptoEngine.unwrap(user.pwWrap, password));
  },

  async changePassword(currentPassword, newPassword) {
    const user = await this.getCurrentUser();
    if (!user) return { success: false, message: 'Not signed in.' };
    const key = await CryptoEngine.unwrap(user.pwWrap, currentPassword);
    if (!key) return { success: false, message: 'Current password is incorrect.' };
    user.pwWrap = await CryptoEngine.wrap(key, newPassword);
    await this.updateUser(user);
    return { success: true };
  },

  async updateSecurityQuestion(hintQuestion, secretWord) {
    const user = await this.getCurrentUser(), raw = sessionStorage.getItem(StorageEngine.KEYS.SESSION_KEY);
    if (!user || !raw) return false;
    user.securityQuestion = hintQuestion.trim();
    user.secretWrap = await CryptoEngine.wrap(CryptoEngine.unb64(raw), this.norm(secretWord));
    return this.updateUser(user);
  },

  async getHintByUsername(username) {
    const user = (await this.getUsers()).find((u) => u.username === this.norm(username));
    if (!user) return { success: false, message: 'Username not found.' };
    if (!user.securityQuestion) return { success: false, message: 'No security question configured.' };
    return { success: true, hint: user.securityQuestion };
  },

  async resetPasswordWithSecret(username, secretWord, newPassword) {
    const user = (await this.getUsers()).find((u) => u.username === this.norm(username));
    if (!user) return { success: false, message: 'Username not found.' };
    const key = await CryptoEngine.unwrap(user.secretWrap, this.norm(secretWord));
    if (!key) return { success: false, message: 'Incorrect secret word!' };
    user.pwWrap = await CryptoEngine.wrap(key, newPassword); // data key unchanged => data preserved
    await this.updateUser(user);
    return { success: true };
  },

  async initUI() {
    const authModal = document.getElementById('auth-modal-overlay');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const signupSecurityPopup = document.getElementById('signup-security-popup-form');
    const forgotForm = document.getElementById('forgot-form');

    const currentUser = await this.getCurrentUser();

    if (!currentUser) {
      authModal.classList.remove('hidden');
    } else {
      authModal.classList.add('hidden');
      this.updateProfileUI(currentUser);
      this.populateProfileSettings(currentUser);
    }

    document.getElementById('show-signup-btn').addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.classList.add('hidden');
      forgotForm.classList.add('hidden');
      signupSecurityPopup.classList.add('hidden');
      signupForm.classList.remove('hidden');
      document.getElementById('auth-title').innerText = 'Create Chronos Account';
      document.getElementById('auth-subtitle').innerText = 'Set up your credentials';
    });

    document.getElementById('show-login-btn').addEventListener('click', (e) => {
      e.preventDefault();
      signupForm.classList.add('hidden');
      signupSecurityPopup.classList.add('hidden');
      forgotForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
      document.getElementById('auth-title').innerText = 'Welcome Back';
      document.getElementById('auth-subtitle').innerText = 'Sign in to access encrypted workspace';
    });

    document.getElementById('show-forgot-btn').addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.classList.add('hidden');
      signupForm.classList.add('hidden');
      signupSecurityPopup.classList.add('hidden');
      forgotForm.classList.remove('hidden');
      document.getElementById('auth-title').innerText = 'Reset Password';
      document.getElementById('auth-subtitle').innerText = 'Verify security hint & secret word';
    });

    document.getElementById('back-to-login-btn').addEventListener('click', (e) => {
      e.preventDefault();
      forgotForm.classList.add('hidden');
      signupForm.classList.add('hidden');
      signupSecurityPopup.classList.add('hidden');
      loginForm.classList.remove('hidden');
      document.getElementById('auth-title').innerText = 'Welcome Back';
    });

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = document.getElementById('login-username').value;
      const p = document.getElementById('login-password').value;
      const res = await this.login(u, p);
      if (res.success) {
        authModal.classList.add('hidden');
        window.location.reload();
      } else {
        showToast(res.message);
      }
    });

    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('signup-name').value;
      const username = document.getElementById('signup-username').value;
      const password = document.getElementById('signup-password').value;

      const users = await this.getUsers();
      if (users.find(u => u.username === username.trim().toLowerCase())) {
        showToast('Username already exists!');
        return;
      }

      this.pendingSignupData = { name, username, password };
      signupForm.classList.add('hidden');
      signupSecurityPopup.classList.remove('hidden');
      document.getElementById('auth-title').innerText = 'Security Setup';
      document.getElementById('auth-subtitle').innerText = 'Required step: Configure recovery hint & secret word';
    });

    signupSecurityPopup.addEventListener('submit', async (e) => {
      e.preventDefault();
      const hint = document.getElementById('popup-signup-hint').value;
      const secret = document.getElementById('popup-signup-secret').value;

      if (!this.pendingSignupData) {
        showToast('Session expired. Please restart signup.');
        signupSecurityPopup.classList.add('hidden');
        signupForm.classList.remove('hidden');
        return;
      }

      const { name, username, password } = this.pendingSignupData;
      const res = await this.registerFinal(name, username, password, hint, secret);
      if (res.success) {
        showToast(`Account created securely for ${res.user.name}!`);
        authModal.classList.add('hidden');
        window.location.reload();
      } else {
        showToast(res.message);
      }
    });

    document.getElementById('load-hint-btn').addEventListener('click', async () => {
      const u = document.getElementById('forgot-username').value;
      if (!u.trim()) {
        showToast('Enter your username first.');
        return;
      }
      const res = await this.getHintByUsername(u);
      if (res.success) {
        document.getElementById('forgot-hint-text').innerText = res.hint;
        document.getElementById('forgot-hint-box').classList.remove('hidden');
        document.getElementById('forgot-step-2').classList.remove('hidden');
      } else {
        showToast(res.message);
      }
    });

    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = document.getElementById('forgot-username').value;
      const secret = document.getElementById('forgot-secret').value;
      const newPass = document.getElementById('forgot-new-password').value;

      const res = await this.resetPasswordWithSecret(u, secret, newPass);
      if (res.success) {
        showToast('Password reset successfully! Please sign in.');
        forgotForm.reset();
        document.getElementById('forgot-hint-box').classList.add('hidden');
        document.getElementById('forgot-step-2').classList.add('hidden');
        forgotForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
      } else {
        showToast(res.message);
      }
    });

    const profForm = document.getElementById('profile-update-form');
    if (profForm) {
      profForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('prof-name').value;
        const bio = document.getElementById('prof-bio').value;
        if (await this.updateProfile(name, bio)) {
          showToast('Profile updated!');
        }
      });
    }

    const cpForm = document.getElementById('change-password-form');
    if (cpForm) {
      cpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const curr = document.getElementById('cp-current').value;
        const next = document.getElementById('cp-new').value;
        const conf = document.getElementById('cp-confirm').value;

        if (next !== conf) {
          showToast('New passwords do not match!');
          return;
        }
        const res = await this.changePassword(curr, next);
        if (res.success) {
          cpForm.reset();
          showToast('Password updated successfully!');
        } else {
          showToast(res.message);
        }
      });
    }

    const sqForm = document.getElementById('security-question-form');
    const pwdPromptModal = document.getElementById('password-prompt-modal-overlay');
    const pwdPromptForm = document.getElementById('password-prompt-form');
    const closePwdPromptBtn = document.getElementById('close-password-prompt-btn');

    if (sqForm) {
      sqForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const hint = document.getElementById('sq-hint').value.trim();
        const secret = document.getElementById('sq-secret').value.trim();

        if (!hint || !secret) {
          showToast('Please fill in both the hint question and secret word.');
          return;
        }

        document.getElementById('prompt-password-input').value = '';
        pwdPromptModal.classList.remove('hidden');
      });
    }

    if (closePwdPromptBtn) {
      closePwdPromptBtn.addEventListener('click', () => {
        pwdPromptModal.classList.add('hidden');
      });
    }

    if (pwdPromptForm) {
      pwdPromptForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pwdInput = document.getElementById('prompt-password-input').value;

        if (!await this.verifyPassword(pwdInput)) {
          showToast('Incorrect password! Authorization failed.');
          return;
        }

        const hint = document.getElementById('sq-hint').value;
        const secret = document.getElementById('sq-secret').value;

        if (await this.updateSecurityQuestion(hint, secret)) {
          pwdPromptModal.classList.add('hidden');
          document.getElementById('sq-secret').value = '';
          showToast('Security question updated successfully!');
        } else {
          showToast('Failed to update security question.');
        }
      });
    }

    document.getElementById('logout-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.logout();
    });
  },

  updateProfileUI(user) {
    const nameEl = document.getElementById('user-display-name');
    const statusEl = document.getElementById('user-status-text');
    const initialsEl = document.getElementById('user-avatar-initials');

    if (nameEl) nameEl.innerText = user.name;
    if (statusEl) statusEl.innerText = user.bio ? user.bio : '● Active';
    if (initialsEl) {
      const parts = user.name.trim().split(' ');
      const initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]) : user.name.slice(0, 2);
      initialsEl.innerText = initials.toUpperCase();
    }
  },

  populateProfileSettings(user) {
    const uEl = document.getElementById('prof-username');
    const nEl = document.getElementById('prof-name');
    const bEl = document.getElementById('prof-bio');
    const hEl = document.getElementById('sq-hint');

    if (uEl) uEl.value = user.username;
    if (nEl) nEl.value = user.name;
    if (bEl) bEl.value = user.bio || '';
    if (hEl) hEl.value = user.securityQuestion || '';
  }
};