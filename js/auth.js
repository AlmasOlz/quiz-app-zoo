// ================================================================
// AUTH HELPERS
// ================================================================

function getBasePath() {
    return window.location.pathname.includes('/admin/') ? '../' : '';
}

function requireAuth(callback) {
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = getBasePath() + 'login.html';
            return;
        }
        try {
            const ref = db.collection('users').doc(user.uid);
            const doc = await ref.get();
            let userData = {};
            if (doc.exists) {
                userData = doc.data();
            } else {
                // Auto-create user doc if missing (e.g. Firestore was created after registration)
                userData = {
                    uid: user.uid,
                    email: user.email,
                    name: user.displayName || user.email,
                    role: 'user',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                };
                await ref.set(userData);
            }
            if (callback) callback(user, userData);
        } catch (err) {
            console.error('requireAuth error:', err);
            if (callback) callback(user, {});
        }
    });
}

function requireAdmin(callback) {
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = getBasePath() + 'login.html';
            return;
        }
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            const userData = doc.exists ? doc.data() : null;
            if (!userData || userData.role !== 'admin') {
                window.location.href = getBasePath() + 'index.html';
                return;
            }
            if (callback) callback(user, userData);
        } catch (err) {
            console.error('requireAdmin error:', err);
            window.location.href = getBasePath() + 'index.html';
        }
    });
}

async function registerUser(email, password, name) {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await db.collection('users').doc(cred.user.uid).set({
        uid: cred.user.uid,
        email: email,
        name: name,
        role: 'user',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    });
    return cred.user;
}

async function loginUser(email, password) {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    await db.collection('users').doc(cred.user.uid).update({
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});
    return cred.user;
}

async function logoutUser() {
    await auth.signOut();
    window.location.href = getBasePath() + 'login.html';
}

// ── Toast notifications ────────────────────────────────────────

function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    const icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle' };
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas fa-${icons[type] || 'info-circle'}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ── Helpers ────────────────────────────────────────────────────

function formatTime(seconds) {
    if (!seconds && seconds !== 0) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}с`;
    return `${m}м ${s.toString().padStart(2, '0')}с`;
}

function formatDate(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function getAuthErrorMessage(code) {
    const msgs = {
        'auth/user-not-found': 'Пайдаланушы табылмады',
        'auth/wrong-password': 'Қате құпия сөз',
        'auth/email-already-in-use': 'Бұл email тіркелген',
        'auth/weak-password': 'Құпия сөз кем дегенде 6 таңба болуы керек',
        'auth/invalid-email': 'Қате email форматы',
        'auth/too-many-requests': 'Тым көп сұраныс. Кейінірек қайталаңыз',
        'auth/invalid-credential': 'Email немесе құпия сөз қате',
        'auth/network-request-failed': 'Желі қатесі. Интернетті тексеріңіз'
    };
    return msgs[code] || 'Қате орын алды. Қайталап көріңіз.';
}
