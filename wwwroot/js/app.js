// ═══════════════════════════════════════════════
// BANK SADERAT - FRONTEND APP
// ASP.NET 8 Backend + SQLite
// ═══════════════════════════════════════════════

const API = '';
let currentUser = null;
let currentRole = 'admin';
let allAccounts = [], allTransactions = [], allLoans = [], allCards = [], allUsers = [];

const ROLES = {
  admin:    { label: 'ادمین سیستم',   avClass: 'uav-admin',   char: 'م', color: '#2D2B8F' },
  manager:  { label: 'مدیر شعبه',     avClass: 'uav-manager', char: 'ر', color: '#1B6B3A' },
  operator: { label: 'اپراتور',        avClass: 'uav-op',      char: 'ا', color: '#D35400' },
  user:     { label: 'کاربر بانکی',   avClass: 'uav-user',    char: 'ک', color: '#1565C0' },
  auditor:  { label: 'حسابرس',         avClass: 'uav-audit',   char: 'ح', color: '#6A1B9A' }
};

const PERMS = {
  admin:    ['dashboard','my-accounts','transfer','transactions','loans','cards','payments','accounts','customers','reports','audit','admin-panel','user-mgmt','settings'],
  manager:  ['dashboard','my-accounts','transfer','transactions','loans','cards','payments','accounts','customers','reports','user-mgmt','settings'],
  operator: ['dashboard','my-accounts','transfer','transactions','loans','cards','payments','accounts','customers','settings'],
  user:     ['dashboard','my-accounts','transfer','transactions','loans','cards','payments','settings'],
  auditor:  ['dashboard','transactions','reports','audit','settings']
};

const PERM_LABELS = {
  dashboard:'داشبورد','my-accounts':'حساب‌های من',transfer:'انتقال وجه',
  transactions:'تراکنش‌ها',loans:'وام‌ها',cards:'کارت‌ها',payments:'پرداخت قبوض',
  accounts:'مدیریت حساب‌ها',customers:'مشتریان',reports:'گزارشات',
  audit:'حسابرسی','admin-panel':'پنل ادمین','user-mgmt':'مدیریت کاربران',settings:'تنظیمات'
};

// ─── ROLE DESCRIPTIONS (for User Management overview) ──
const ROLE_INFO = {
  admin:    { icon:'bi-crown', desc:'دسترسی کامل به تمام بخش‌ها، پنل ادمین، کنسول SQL و مدیریت کاربران', count: 1 },
  manager:  { icon:'bi-building', desc:'تأیید وام، گزارشات مالی، مدیریت کاربران (بدون پنل ادمین)', count: 1 },
  operator: { icon:'bi-person-workspace', desc:'ثبت تراکنش، افتتاح حساب، صدور کارت، مدیریت مشتریان', count: 1 },
  user:     { icon:'bi-person', desc:'مشاهده حساب خود، انتقال وجه، درخواست وام، پرداخت قبوض', count: 2 },
  auditor:  { icon:'bi-search', desc:'دسترسی فقط‌خواندنی به تراکنش‌ها، گزارشات و لاگ حسابرسی', count: 1 }
};

// ─── CRUD-LEVEL ACTION MATRIX ───────────────────────────
// R=Read, C=Create, U=Update, D=Delete, A=Approve
const CRUD_MATRIX = {
  'حساب‌ها (Accounts)':       { admin:'RCUD',  manager:'RCU',   operator:'RCU',  user:'R',  auditor:'R' },
  'تراکنش‌ها (Transactions)':  { admin:'RCUD',  manager:'RC',    operator:'RC',   user:'RC', auditor:'R' },
  'انتقال وجه (Transfer)':     { admin:'C',     manager:'C',     operator:'C',    user:'C',  auditor:'-' },
  'وام‌ها (Loans)':            { admin:'RCUDA', manager:'RCUA',  operator:'RC',   user:'RC', auditor:'R' },
  'کارت‌ها (Cards)':           { admin:'RCUD',  manager:'RCU',   operator:'RCU',  user:'R',  auditor:'-' },
  'کاربران (Users)':           { admin:'RCUD',  manager:'RC',    operator:'-',    user:'-',  auditor:'-' },
  'گزارشات (Reports)':         { admin:'R',     manager:'R',     operator:'-',    user:'-',  auditor:'R' },
  'حسابرسی (Audit Log)':       { admin:'R',     manager:'-',     operator:'-',    user:'-',  auditor:'R' },
  'پنل ادمین (Admin Panel)':   { admin:'RCUD',  manager:'-',     operator:'-',    user:'-',  auditor:'-' },
};
const CRUD_LABELS = { R:'مشاهده', C:'ایجاد', U:'ویرایش', D:'حذف', A:'تأیید' };
const CRUD_COLORS = { R:'#1565C0', C:'#1B6B3A', U:'#D35400', D:'#C0392B', A:'#6A1B9A' };


const PAGE_TITLES = {
  dashboard:'داشبورد اصلی','my-accounts':'حساب‌های من',transfer:'انتقال وجه',
  transactions:'تراکنش‌ها',loans:'وام‌ها',cards:'کارت‌ها',payments:'پرداخت قبوض',
  accounts:'مدیریت حساب‌ها',customers:'مشتریان',reports:'گزارشات',
  audit:'حسابرسی','admin-panel':'پنل ادمین','user-mgmt':'مدیریت کاربران',settings:'تنظیمات'
};

// ─── HELPERS ────────────────────────────────────
function fmt(n)  { return Number(n || 0).toLocaleString('fa-IR'); }
function toFa(n) { return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]); }
function fmtCard(n) { return n ? n.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/, '$1-$2-****-$4') : '****-****-****-****'; }

async function apiCall(url, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include' };
  if (body) opts.body = JSON.stringify(body);
  try {
    const r = await fetch(API + url, opts);
    if (r.status === 401) { window.location.href = '/login.html'; return null; }
    if (!r.ok) {
      // 403/404/500 → null so callers can fall back to demo data
      try { return await r.json(); } catch { return null; }
    }
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('application/json')) return await r.json();
    return null;
  } catch (e) {
    return null;
  }
}

// ─── TOAST ──────────────────────────────────────
let toastT;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  const icons = { ok: 'bi-check-circle', err: 'bi-x-circle', warn: 'bi-exclamation-triangle', '': 'bi-info-circle' };
  const iconClass = icons[type] || 'bi-info-circle';
  t.innerHTML = '<i class="bi ' + iconClass + '"></i> ' + msg;
  t.className = 'show' + (type ? ' ' + type : '');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.className = '', 3500);
}

// ─── MOBILE SIDEBAR ────────────────────────────────
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sb-overlay');
  if (!sb) return;
  const open = sb.classList.toggle('open');
  if (ov) ov.classList.toggle('show', open);
  document.body.style.overflow = open ? 'hidden' : '';
}
function closeSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sb-overlay');
  if (sb) sb.classList.remove('open');
  if (ov) ov.classList.remove('show');
  document.body.style.overflow = '';
}

// ─── DARK MODE ─────────────────────────────────────
function toggleDark() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('saderat-dark', isDark ? '1' : '0');
  const icon = document.getElementById('dark-icon');
  if (icon) icon.className = isDark ? 'bi bi-sun' : 'bi bi-moon';
  showToast(isDark ? 'حالت تاریک فعال شد' : 'حالت روشن فعال شد', 'ok');
}
function initDark() {
  if (localStorage.getItem('saderat-dark') === '1') {
    document.body.classList.add('dark');
    const icon = document.getElementById('dark-icon');
    if (icon) icon.className = 'bi bi-sun';
  }
}

// ─── NOTIFICATIONS ─────────────────────────────────
const NOTIF_DATA = [
  { icon: 'bi-cash-coin', cls: 'act-blue', title: 'انتقال موفق', desc: '۱۵ میلیون تومان به حساب ACC-001 واریز شد', time: '۱۵ دقیقه پیش' },
  { icon: 'bi-exclamation-triangle', cls: 'act-gold', title: 'هشدار سقف', desc: 'تلاش برداشت بیش از سقف روزانه رد شد', time: '۱ ساعت پیش' },
  { icon: 'bi-bank', cls: 'act-green', title: 'تأیید وام', desc: 'وام LN-003 با موفقیت تأیید شد', time: '۳ ساعت پیش' },
  { icon: 'bi-shield-lock', cls: 'act-red', title: 'ورود ناموفق', desc: 'تلاش ورود از IP ناشناس: ۱۸۵.x.x.x', time: '۲ ساعت پیش' },
  { icon: 'bi-person-plus', cls: 'act-blue', title: 'حساب جدید', desc: 'حساب جاری برای مشتری جدید افتتاح شد', time: '۵ ساعت پیش' },
];

function toggleNotif() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  const willOpen = !panel.classList.contains('open');
  panel.classList.toggle('open', willOpen);
  if (willOpen) {
    renderNotifs();
    const dot = document.getElementById('notif-dot');
    if (dot) dot.style.display = 'none';
  }
}
function renderNotifs() {
  const el = document.getElementById('notif-list');
  if (!el) return;
  el.innerHTML = NOTIF_DATA.map(n => `
    <div class="np-item" onclick="showToast('${n.title}','ok');toggleNotif()">
      <div class="np-icon ${n.cls}"><i class="bi ${n.icon}"></i></div>
      <div class="np-body">
        <div class="np-title">${n.title}</div>
        <div class="np-desc">${n.desc}</div>
        <div class="np-time">${n.time}</div>
      </div>
    </div>
  `).join('');
}
// Close notif when clicking outside
document.addEventListener('click', e => {
  const panel = document.getElementById('notif-panel');
  if (!panel || !panel.classList.contains('open')) return;
  if (!panel.contains(e.target) && !e.target.closest('[onclick*="toggleNotif"]')) {
    panel.classList.remove('open');
  }
});

// ─── FAB (Floating Action) ─────────────────────────
function fabAction() {
  const role = currentRole;
  if (['admin','manager','operator'].includes(role)) {
    openMo('mo-tx');
  } else if (role === 'user') {
    showPage('transfer');
  } else {
    showPage('reports');
  }
}

// ─── BOTTOM NAV SYNC ───────────────────────────────
function syncBottomNav(page) {
  document.querySelectorAll('#bottom-nav .bn-item').forEach(b => {
    const bp = b.getAttribute('data-page');
    b.classList.toggle('active', bp === page);
  });
}

// Close sidebar on page change (mobile)
const _origShowPage = typeof showPage === 'function' ? null : null;



// ─── TOUCH SWIPE (close sidebar) ───────────────────
(function() {
  let startX = 0;
  document.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    const sb = document.getElementById('sidebar');
    if (sb && sb.classList.contains('open') && dx > 60) closeSidebar();
  }, { passive: true });
})();


// ─── MODAL ──────────────────────────────────────
function openMo(id) {
  document.getElementById(id).classList.add('open');
  populateAccountSelects();
}
function closeMo(id) { document.getElementById(id).classList.remove('open'); }
document.addEventListener('click', e => { if (e.target.classList.contains('mo')) e.target.classList.remove('open'); });

// ─── AUTH ────────────────────────────────────────
async function checkAuth() {
  const data = await apiCall('/api/auth/me');
  if (data) {
    currentUser = data;
    currentRole = data.role;
    initUI();
  } else {
    // Demo mode — initialize without backend
    currentUser = { id: 1, name: 'مدیر ارشد', role: 'admin', email: 'admin@saderat.ir', username: 'admin' };
    currentRole = 'admin';
    initUI();
  }
}

async function logout() {
  await apiCall('/api/auth/logout', 'POST');
  window.location.href = '/login.html';
}

// ─── INIT UI ────────────────────────────────────
function initUI() {
  buildRoleTabs();
  setRole(currentRole);
  initDark();
  renderNotifs();
}

function buildRoleTabs() {
  const tabs = document.getElementById('role-tabs');
  const roleMap = { admin: 'ادمین', manager: 'مدیر', operator: 'اپراتور', user: 'کاربر', auditor: 'حسابرس' };
  tabs.innerHTML = Object.entries(roleMap).map(([r, l]) =>
    `<div class="role-tab ${r === currentRole ? 'active' : ''}" onclick="setRole('${r}')" id="rtab-${r}">${l}</div>`
  ).join('');
}

function setRole(role) {
  currentRole = role;
  const r = ROLES[role];
  // Update tabs
  document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
  const tab = document.getElementById('rtab-' + role);
  if (tab) tab.classList.add('active');
  // Topbar
  const av = document.getElementById('tb-av');
  const nameEl = document.getElementById('tb-name');
  if (av) { av.textContent = r.char; av.className = 'uav ' + r.avClass; }
  const names = { admin:'مدیر ارشد', manager:'رضا حسینی', operator:'سارا موسوی', user:'علی کریمی', auditor:'نیلوفر احمدی' };
  if (nameEl) nameEl.textContent = names[role] || r.label;
  const roleEl = document.getElementById('tb-role');
  if (roleEl) roleEl.textContent = r.label;
  // Banner
  const rb = document.getElementById('rb-role');
  if (rb) rb.textContent = r.label;
  // Nav visibility
  document.querySelectorAll('.nav-item[data-roles]').forEach(n => {
    const roles = n.getAttribute('data-roles').split(',');
    n.classList.toggle('hidden', !roles.includes(role));
  });
  // Restrict add buttons
  const canWrite = ['admin', 'manager', 'operator'].includes(role);
  const btns = ['btn-add-tx'];
  btns.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = canWrite ? '' : 'none'; });
  // Settings perms
  renderSettingsPerms();
  // Bottom nav: hide pages user can't access
  document.querySelectorAll('#bottom-nav .bn-item').forEach(b => {
    const pg = b.getAttribute('data-page');
    if (pg === 'more') { b.style.display = ''; return; }
    const allowed = PERMS[role] && PERMS[role].includes(pg);
    b.style.display = allowed ? '' : 'none';
  });
  showToast(`نقش "${r.label}" فعال شد`, 'ok');
  showPage('dashboard');
}

// ─── NAVIGATION ─────────────────────────────────
function showPage(name) {
  if (name !== 'more' && !PERMS[currentRole].includes(name)) {
    showToast('دسترسی ندارید — نقش شما این بخش را نمی‌بیند', 'err');
    return;
  }
  if (name === 'more') { toggleSidebar(); return; }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item:not(.hidden)').forEach(n => n.classList.remove('active'));
  const pg = document.getElementById('page-' + name);
  if (!pg) { showToast('صفحه یافت نشد', 'err'); return; }
  pg.classList.add('active');
  document.getElementById('page-title').textContent = PAGE_TITLES[name] || name;
  document.querySelectorAll(`.nav-item[onclick*="'${name}'"]`).forEach(n => n.classList.add('active'));
  closeSidebar();
  syncBottomNav(name);
  loadPage(name);
}

function loadPage(name) {
  if (name === 'dashboard')   loadDashboard();
  else if (name === 'my-accounts') loadMyAccounts();
  else if (name === 'transfer')    loadTransfer();
  else if (name === 'transactions') { loadTransactions(); populateAccountSelects(); }
  else if (name === 'loans')   loadLoans();
  else if (name === 'cards')   loadCards();
  else if (name === 'payments') populatePayAcc();
  else if (name === 'accounts') loadAccounts();
  else if (name === 'customers') loadCustomers();
  else if (name === 'reports') loadReports();
  else if (name === 'audit')   loadAudit();
  else if (name === 'admin-panel') loadAdminPanel();
  else if (name === 'user-mgmt')   loadUserMgmt();
  else if (name === 'settings')    renderSettingsPerms();
}

// ─── DASHBOARD ──────────────────────────────────
async function loadDashboard() {
  const data = await apiCall('/api/dashboard');
  if (data) {
    document.getElementById('ds-bal').textContent = fmt(data.totalBalance);
    document.getElementById('ds-acc').textContent = toFa(data.activeAccounts || 0);
    document.getElementById('ds-tx').textContent  = toFa(data.totalTransactions || 0);
    document.getElementById('ds-loans').textContent = toFa(data.activeLoans || 0);
    document.getElementById('tx-badge').textContent = toFa(data.totalTransactions || 0);
    renderDashTx(data.recentTransactions || []);
  } else {
    renderDashDemo();
  }
  renderMiniChart();
  renderQuickActions();
  renderActivityFeed();
}

function renderDashTx(txs) {
  document.getElementById('dash-tx').innerHTML = txs.slice(0, 6).map(t => `
    <tr>
      <td style="font-size:11px">${t.transactionCode || t.TransactionCode}</td>
      <td><span class="badge ${t.type==='واریز'||t.Type==='واریز'?'bg-ok':t.type==='برداشت'||t.Type==='برداشت'?'bg-no':'bg-b'}">${t.type||t.Type}</span></td>
      <td class="${(t.type||t.Type)==='واریز'?'credit':'debit'}">${fmt(t.amount||t.Amount)}</td>
      <td><span class="badge ${(t.status||t.Status)==='موفق'?'bg-ok':(t.status||t.Status)==='در انتظار'?'bg-w':'bg-no'}">${t.status||t.Status}</span></td>
      <td style="font-size:11px">${t.date||t.Date||''}</td>
    </tr>
  `).join('');
}

function renderDashDemo() {
  document.getElementById('ds-bal').textContent = fmt(2398000000);
  document.getElementById('ds-acc').textContent = toFa(4);
  document.getElementById('ds-tx').textContent  = toFa(8);
  document.getElementById('ds-loans').textContent = toFa(3);
  document.getElementById('acc-badge').textContent = toFa(5);
  document.getElementById('tx-badge').textContent  = toFa(8);
}

function renderMiniChart() {
  const vals = [45, 72, 38, 91, 56, 83, 67];
  const mx = Math.max(...vals);
  document.getElementById('mch').innerHTML = vals.map(v =>
    `<div class="mb" style="height:${Math.round(v/mx*50)}px" title="${toFa(v)} تراکنش"></div>`
  ).join('');
}

function renderQuickActions() {
  const acts = {
    admin:   [{i:'bi-cash-coin',t:'ثبت تراکنش',a:"openMo('mo-tx')"},{i:'bi-clipboard-plus',t:'حساب جدید',a:"openMo('mo-acc')"},{i:'bi-credit-card',t:'صدور کارت',a:"openMo('mo-card')"},{i:'bi-bar-chart',t:'گزارش‌ها',a:"showPage('reports')"},{i:'bi-gear',t:'پنل ادمین',a:"showPage('admin-panel')"},{i:'bi-person-badge',t:'کاربران',a:"showPage('user-mgmt')"}],
    manager: [{i:'bi-cash-coin',t:'تراکنش',a:"openMo('mo-tx')"},{i:'bi-people',t:'مشتریان',a:"showPage('customers')"},{i:'bi-bar-chart',t:'گزارش‌ها',a:"showPage('reports')"},{i:'bi-person-badge',t:'کاربران',a:"showPage('user-mgmt')"}],
    operator:[{i:'bi-arrow-left-right',t:'تراکنش جدید',a:"openMo('mo-tx')"},{i:'bi-clipboard-data',t:'حساب‌ها',a:"showPage('accounts')"},{i:'bi-people',t:'مشتریان',a:"showPage('customers')"}],
    user:    [{i:'bi-send',t:'انتقال وجه',a:"showPage('transfer')"},{i:'bi-phone',t:'پرداخت قبوض',a:"showPage('payments')"},{i:'bi-credit-card',t:'کارت‌هایم',a:"showPage('cards')"}],
    auditor: [{i:'bi-search',t:'حسابرسی',a:"showPage('audit')"},{i:'bi-bar-chart',t:'گزارش‌ها',a:"showPage('reports')"}]
  };
  const el = document.getElementById('qa-grid');
  if (!el) return;
  el.innerHTML = (acts[currentRole] || []).map(a =>
    `<div class="qa-btn" onclick="${a.a}"><div class="qa-icon"><i class="bi ${a.i}"></i></div><div class="qa-txt">${a.t}</div></div>`
  ).join('');
}

function renderActivityFeed() {
  const items = [
    {cls:'act-blue',icon:'bi-cash-coin',txt:'انتقال ۱۵ میلیون از ACC-001',time:'۱۵ دقیقه پیش'},
    {cls:'act-green',icon:'bi-check-circle',txt:'حساب جدید افتتاح شد',time:'۳۰ دقیقه پیش'},
    {cls:'act-gold',icon:'bi-exclamation-triangle',txt:'تلاش برداشت بیش از سقف — رد شد',time:'۱ ساعت پیش'},
    {cls:'act-red',icon:'bi-shield-lock',txt:'ورود ناموفق — IP: 185.x.x.x',time:'۲ ساعت پیش'},
    {cls:'act-blue',icon:'bi-bank',txt:'وام LN-003 تأیید شد',time:'۳ ساعت پیش'},
  ];
  const el = document.getElementById('activity-feed');
  if (!el) return;
  el.innerHTML = items.map(a =>
    `<div class="act-item"><div class="act-dot ${a.cls}"><i class="bi ${a.icon}"></i></div><div style="flex:1"><div style="font-size:13px">${a.txt}</div><div style="font-size:11px;color:var(--bs-muted)">${a.time}</div></div></div>`
  ).join('');
}

// ─── MY ACCOUNTS ────────────────────────────────
async function loadMyAccounts() {
  const accs = await apiCall('/api/accounts') || getDemoAccounts();
  const myAccs = currentRole === 'user' ? accs.slice(0, 2) : accs;
  const tb = myAccs.reduce((s, a) => s + (a.balance || a.Balance || 0), 0);
  document.getElementById('my-acc-cnt').textContent = toFa(myAccs.length);
  document.getElementById('my-bal').textContent = fmt(tb);
  const pname = {admin:'مدیر ارشد',manager:'رضا حسینی',operator:'سارا موسوی',user:'علی کریمی',auditor:'نیلوفر احمدی'};
  document.getElementById('prof-name').textContent = pname[currentRole] || 'کاربر';
  document.getElementById('prof-role2').textContent = ROLES[currentRole].label;
  // Bank cards visual
  document.getElementById('my-cards').innerHTML = myAccs.slice(0,3).map((a, i) =>
    `<div class="bk-card"><div class="bc-top"><div class="bc-name">بانک صادرات ایران</div>
    <img src="/images/saderat-logo.png" alt="" style="width:20px;height:20px;object-fit:contain;filter:brightness(0) invert(1);opacity:0.85"></div>
    <div class="bc-chip"></div>
    <div class="bc-num">6037-6978-****-${toFa(String(1000 + i * 1111).slice(-4))}</div>
    <div class="bc-bot"><div><div class="bc-lbl">صاحب حساب</div><div class="bc-val">${a.ownerName || a.OwnerName || ''}</div></div><div><div class="bc-lbl">موجودی</div><div class="bc-bal">${fmt(a.balance || a.Balance)} ت</div></div></div></div>`
  ).join('');
  document.getElementById('my-accs').innerHTML = myAccs.map(a =>
    `<tr><td style="font-size:12px">${a.accountNumber||a.AccountNumber}</td><td><span class="badge bg-g">${a.accountType||a.AccountType}</span></td><td class="credit">${fmt(a.balance||a.Balance)}</td><td><span class="badge ${(a.status||a.Status)==='فعال'?'bg-ok':'bg-no'}">${a.status||a.Status}</span></td><td style="font-size:11px">${a.date||a.Date||''}</td></tr>`
  ).join('');
  const txs = await apiCall('/api/transactions') || getDemoTx();
  document.getElementById('my-txs').innerHTML = txs.slice(0, 8).map(t =>
    `<tr><td><span class="badge ${(t.type||t.Type)==='واریز'?'bg-ok':'bg-no'}">${t.type||t.Type}</span></td><td class="${(t.type||t.Type)==='واریز'?'credit':'debit'}">${fmt(t.amount||t.Amount)}</td><td>${t.description||t.Description||''}</td><td><span class="badge ${(t.status||t.Status)==='موفق'?'bg-ok':'bg-w'}">${t.status||t.Status}</span></td><td style="font-size:11px">${t.date||t.Date||''}</td></tr>`
  ).join('');
}

// ─── TRANSFER ───────────────────────────────────
async function loadTransfer() {
  const accs = await apiCall('/api/accounts') || getDemoAccounts();
  allAccounts = accs;
  const sel = document.getElementById('tr-from');
  if (sel) {
    sel.innerHTML = accs.map(a => `<option value="${a.id||a.Id}">${a.accountNumber||a.AccountNumber} — ${a.ownerName||a.OwnerName} (${fmt(a.balance||a.Balance)})</option>`).join('');
    updateTrBal();
  }
}

async function updateTrBal() {
  const sel = document.getElementById('tr-from');
  if (!sel) return;
  const id = parseInt(sel.value);
  const acc = allAccounts.find(a => (a.id||a.Id) === id);
  const el = document.getElementById('tr-bal');
  if (el && acc) el.textContent = `<i class="bi bi-wallet2"></i> موجودی: ${fmt(acc.balance||acc.Balance)} تومان`;
}

async function doTransfer() {
  const fromId  = parseInt(document.getElementById('tr-from')?.value);
  const toNum   = document.getElementById('tr-to')?.value?.trim();
  const amount  = parseFloat(document.getElementById('tr-amt')?.value || 0);
  const desc    = document.getElementById('tr-desc')?.value || 'انتقال وجه';
  if (!toNum)   { showToast('شماره حساب مقصد را وارد کنید', 'err'); return; }
  if (!amount || amount <= 0) { showToast('مبلغ را وارد کنید', 'err'); return; }
  const res = await apiCall('/api/transfer', 'POST', { fromAccountId: fromId, toAccountNumber: toNum, amount, description: desc });
  if (res?.success) {
    showToast(`انتقال ${fmt(amount)} تومان موفق — کد: ${res.code}`, 'ok');
    document.getElementById('tr-amt').value = '';
    loadTransfer();
  } else {
    showToast(res?.message || 'خطا در انتقال', 'err');
    // Demo fallback
    if (!res) showToast(`انتقال ${fmt(amount)} تومان موفق (نمایش آزمایشی)`, 'ok');
  }
}

// ─── TRANSACTIONS ────────────────────────────────
async function loadTransactions() {
  const data = await apiCall('/api/transactions') || getDemoTx();
  allTransactions = data;
  renderTxTable(data);
}

function renderTxTable(txs) {
  const q = document.getElementById('tx-search')?.value.toLowerCase() || '';
  const f = document.getElementById('tx-filter')?.value || '';
  const rows = txs.filter(t =>
    (!q || (t.transactionCode||t.TransactionCode||'').toLowerCase().includes(q) || (t.description||t.Description||'').includes(q)) &&
    (!f || (t.type||t.Type) === f)
  );
  document.getElementById('tx-tbody').innerHTML = rows.map(t =>
    `<tr>
      <td style="font-size:11px">${t.transactionCode||t.TransactionCode}</td>
      <td style="font-size:12px">${t.accountNumber||t.AccountNumber||''}</td>
      <td><span class="badge ${(t.type||t.Type)==='واریز'?'bg-ok':(t.type||t.Type)==='برداشت'?'bg-no':'bg-b'}">${t.type||t.Type}</span></td>
      <td class="${(t.type||t.Type)==='واریز'?'credit':'debit'}">${fmt(t.amount||t.Amount)}</td>
      <td style="font-size:12px">${t.description||t.Description||''}</td>
      <td><span class="badge ${(t.status||t.Status)==='موفق'?'bg-ok':(t.status||t.Status)==='در انتظار'?'bg-w':'bg-no'}">${t.status||t.Status}</span></td>
      <td style="font-size:11px">${t.date||t.Date||''}</td>
    </tr>`
  ).join('');
}

function filterTx() { renderTxTable(allTransactions); }

async function addTx() {
  const accId = parseInt(document.getElementById('ntx-acc')?.value);
  const type  = document.getElementById('ntx-type')?.value;
  const amount= parseFloat(document.getElementById('ntx-amt')?.value || 0);
  const desc  = document.getElementById('ntx-desc')?.value || 'تراکنش';
  if (!amount || amount <= 0) { showToast('مبلغ را وارد کنید', 'err'); return; }
  const res = await apiCall('/api/transactions', 'POST', { accountId: accId, type, amount, description: desc });
  if (res?.success || !res) {
    showToast(`تراکنش ${res?.code||'TX'} ثبت شد`, 'ok');
    closeMo('mo-tx');
    loadTransactions();
    document.getElementById('ntx-amt').value = '';
  } else showToast(res.message || 'خطا', 'err');
}

// ─── LOANS ──────────────────────────────────────
async function loadLoans() {
  const data = await apiCall('/api/loans') || getDemoLoans();
  allLoans = data;
  document.getElementById('loan-tbody').innerHTML = data.map(l =>
    `<tr>
      <td>${l.loanCode||l.LoanCode}</td>
      <td>${l.userName||l.UserName||''}</td>
      <td><span class="badge bg-i">${l.loanType||l.LoanType}</span></td>
      <td><strong>${fmt(l.amount||l.Amount)}</strong></td>
      <td>${(l.interestRate||l.InterestRate)===0?'—':(l.interestRate||l.InterestRate)+'٪'}</td>
      <td>${toFa(l.installments||l.Installments)} ماه</td>
      <td><span class="badge ${(l.status||l.Status)==='جاری'?'bg-w':(l.status||l.Status)==='در بررسی'?'bg-g':'bg-ok'}">${l.status||l.Status}</span></td>
      <td>
        <button class="btn btn-xs" style="background:#E8F5E9;color:#1B5E20;border:none" onclick="loanStatus(${l.id||l.Id},'جاری')"><i class="bi bi-check-lg"></i> تأیید</button>
        <button class="btn btn-xs" style="background:#EDE7F6;color:#4A1AAF;border:none" onclick="loanStatus(${l.id||l.Id},'تسویه')"><i class="bi bi-check2-all"></i> تسویه</button>
      </td>
    </tr>`
  ).join('');
}

async function addLoan() {
  const type  = document.getElementById('nl-type')?.value;
  const amount= parseFloat(document.getElementById('nl-amt')?.value||0);
  const inst  = parseInt(document.getElementById('nl-inst')?.value||12);
  const rate  = parseFloat(document.getElementById('nl-rate')?.value||18);
  if (!amount) { showToast('مبلغ را وارد کنید','err'); return; }
  const res = await apiCall('/api/loans','POST',{loanType:type,amount,interestRate:rate,installments:inst});
  if (res?.success || !res) { showToast('وام ثبت شد','ok'); closeMo('mo-loan'); loadLoans(); }
  else showToast(res.message||'خطا','err');
}

async function loanStatus(id, status) {
  const res = await apiCall(`/api/loans/${id}/status`,'PUT',{status});
  if (res?.success || !res) { showToast('وضعیت وام تغییر کرد','ok'); loadLoans(); }
}

// ─── CARDS ──────────────────────────────────────
async function loadCards() {
  const data = await apiCall('/api/cards') || getDemoCards();
  allCards = data;
  document.getElementById('cards-display').innerHTML = data.slice(0,3).map(c =>
    `<div class="bk-card" style="${(c.status||c.Status)==='مسدود'?'opacity:0.55':''}">
      <div class="bc-top"><div class="bc-name">بانک صادرات ایران</div><div style="font-size:10px;color:rgba(255,255,255,0.6)">${c.cardType||c.CardType}</div></div>
      <div class="bc-chip"></div>
      <div class="bc-num">${fmtCard(c.cardNumber||c.CardNumber)}</div>
      <div class="bc-bot"><div><div class="bc-lbl">دارنده</div><div class="bc-val">${c.ownerName||c.OwnerName||''}</div></div><div><div class="bc-lbl">انقضا</div><div style="font-size:13px;color:var(--bs-gold-l)">${c.expiryDate||c.ExpiryDate}</div></div></div>
    </div>`
  ).join('');
  document.getElementById('card-tbody').innerHTML = data.map(c =>
    `<tr>
      <td style="font-family:monospace;font-size:12px">${fmtCard(c.cardNumber||c.CardNumber)}</td>
      <td>${c.ownerName||c.OwnerName||''}</td>
      <td><span class="badge bg-i">${c.cardType||c.CardType}</span></td>
      <td>${fmt(c.dailyLimit||c.DailyLimit)}</td>
      <td>${c.expiryDate||c.ExpiryDate}</td>
      <td><span class="badge ${(c.status||c.Status)==='فعال'?'bg-ok':'bg-no'}">${c.status||c.Status}</span></td>
      <td><button class="btn btn-outline btn-xs" onclick="toggleCard(${c.id||c.Id})">${(c.status||c.Status)==='فعال'?'<i class="bi bi-lock"></i> مسدود':'<i class="bi bi-unlock"></i> فعال'}</button></td>
    </tr>`
  ).join('');
}

async function addCard() {
  const accId = parseInt(document.getElementById('nc-acc')?.value);
  const type  = document.getElementById('nc-type')?.value;
  const limit = parseFloat(document.getElementById('nc-limit')?.value||5000000);
  const res = await apiCall('/api/cards','POST',{accountId:accId,cardType:type,dailyLimit:limit});
  if (res?.success || !res) { showToast('کارت صادر شد','ok'); closeMo('mo-card'); loadCards(); }
}

async function toggleCard(id) {
  const res = await apiCall(`/api/cards/${id}/toggle`,'PUT');
  if (res?.success || !res) { showToast(`کارت ${res?.status||'تغییر'} شد`,'ok'); loadCards(); }
}

// ─── ACCOUNTS MGMT ──────────────────────────────
async function loadAccounts() {
  const data = await apiCall('/api/accounts') || getDemoAccounts();
  allAccounts = data;
  document.getElementById('acc-badge').textContent = toFa(data.length);
  renderAccTable(data);
}

function renderAccTable(data) {
  document.getElementById('acc-tbody').innerHTML = data.map(a =>
    `<tr>
      <td style="font-size:12px;font-family:monospace">${a.accountNumber||a.AccountNumber}</td>
      <td>${a.ownerName||a.OwnerName||''}</td>
      <td><span class="badge bg-g">${a.accountType||a.AccountType}</span></td>
      <td class="credit">${fmt(a.balance||a.Balance)}</td>
      <td><span class="badge ${(a.status||a.Status)==='فعال'?'bg-ok':(a.status||a.Status)==='مسدود'?'bg-no':'bg-w'}">${a.status||a.Status}</span></td>
      <td style="font-size:11px">${a.date||a.Date||''}</td>
      <td>
        <button class="btn btn-outline btn-xs" onclick="showToast('حساب: ${a.accountNumber||a.AccountNumber}')"><i class="bi bi-eye"></i></button>
        <button class="btn btn-xs btn-danger" onclick="delAcc(${a.id||a.Id})"><i class="bi bi-trash"></i></button>
      </td>
    </tr>`
  ).join('');
}

function filterAccs() {
  const q = document.getElementById('acc-search')?.value.toLowerCase() || '';
  renderAccTable(allAccounts.filter(a =>
    (a.ownerName||a.OwnerName||'').toLowerCase().includes(q) ||
    (a.accountNumber||a.AccountNumber||'').includes(q)
  ));
}

async function addAcc() {
  const type  = document.getElementById('na-type')?.value;
  const bal   = parseFloat(document.getElementById('na-bal')?.value||0);
  const uid   = parseInt(document.getElementById('na-uid')?.value||1);
  const status= document.getElementById('na-status')?.value;
  const res = await apiCall('/api/accounts','POST',{accountType:type,initialBalance:bal,userId:uid,status});
  if (res?.success || !res) { showToast('حساب افتتاح شد','ok'); closeMo('mo-acc'); loadAccounts(); }
}

async function delAcc(id) {
  if (!confirm('حذف این حساب؟')) return;
  const res = await apiCall(`/api/accounts/${id}`,'DELETE');
  if (res?.success || !res) { showToast('حذف شد'); loadAccounts(); }
}

// ─── CUSTOMERS ──────────────────────────────────
async function loadCustomers() {
  let data = await apiCall('/api/customers');
  if (!Array.isArray(data)) data = await apiCall('/api/users');
  if (!Array.isArray(data)) data = getDemoUsers();
  allUsers = data;
  renderCustTable(data);
}

function renderCustTable(data) {
  const roleColors = { admin:'bg-no', manager:'bg-w', operator:'bg-b', user:'bg-g', auditor:'bg-i' };
  const roleLabels = { admin:'ادمین', manager:'مدیر', operator:'اپراتور', user:'کاربر', auditor:'حسابرس' };
  document.getElementById('cust-tbody').innerHTML = data.map(u =>
    `<tr>
      <td style="font-size:12px">${u.id||u.Id}</td>
      <td><strong>${u.fullName||u.FullName}</strong><div style="font-size:11px;color:var(--bs-muted)">${u.username||u.Username}</div></td>
      <td><span class="badge ${roleColors[u.role||u.Role]||'bg-g'}">${roleLabels[u.role||u.Role]||u.role||u.Role}</span></td>
      <td style="font-size:12px">${u.email||u.Email}</td>
      <td style="font-size:11px">${u.lastLogin||u.LastLogin||'هرگز'}</td>
      <td><span class="badge ${(u.isActive||u.IsActive)?'bg-ok':'bg-no'}">${(u.isActive||u.IsActive)?'فعال':'غیرفعال'}</span></td>
    </tr>`
  ).join('');
}

function filterCusts() {
  const q = document.getElementById('cust-search')?.value.toLowerCase()||'';
  renderCustTable(allUsers.filter(u => (u.fullName||u.FullName||'').toLowerCase().includes(q)||(u.username||u.Username||'').includes(q)));
}

// ─── REPORTS ────────────────────────────────────
async function loadReports() {
  const txs = await apiCall('/api/transactions') || getDemoTx();
  const accs = await apiCall('/api/accounts') || getDemoAccounts();
  const dep = txs.filter(t=>(t.type||t.Type)==='واریز').reduce((s,t)=>s+(t.amount||t.Amount||0),0);
  const wd  = txs.filter(t=>(t.type||t.Type)==='برداشت').reduce((s,t)=>s+(t.amount||t.Amount||0),0);
  document.getElementById('rep-in').textContent  = fmt(dep);
  document.getElementById('rep-out').textContent = fmt(wd);
  document.getElementById('rep-cnt').textContent = toFa(txs.length);
  const avg = txs.length ? Math.round((dep+wd)/txs.length) : 0;
  document.getElementById('rep-avg').textContent = fmt(avg);
  const sorted = [...accs].sort((a,b)=>(b.balance||b.Balance||0)-(a.balance||a.Balance||0));
  document.getElementById('top-accs').innerHTML = sorted.slice(0,5).map((a,i)=>
    `<tr><td><span class="badge bg-b">${toFa(i+1)}</span></td><td>${a.ownerName||a.OwnerName||''}</td><td style="font-size:12px;font-family:monospace">${a.accountNumber||a.AccountNumber}</td><td><span class="badge bg-g">${a.accountType||a.AccountType}</span></td><td class="credit">${fmt(a.balance||a.Balance)}</td></tr>`
  ).join('');
}

// ─── AUDIT ──────────────────────────────────────
async function loadAudit() {
  const data = await apiCall('/api/audit') || getDemoAudit();
  const roleLabels = { admin:'ادمین', manager:'مدیر', operator:'اپراتور', user:'کاربر', auditor:'حسابرس' };
  document.getElementById('audit-tbody').innerHTML = data.map(l =>
    `<tr>
      <td style="font-size:11px">${l.date||l.Date||''}</td>
      <td><span class="badge bg-g">${l.userName||l.UserName||''}</span></td>
      <td><span class="badge bg-b">${roleLabels[l.userRole||l.UserRole]||l.userRole||''}</span></td>
      <td>${l.action||l.Action}</td>
      <td style="font-size:12px;color:var(--bs-muted)">${l.detail||l.Detail}</td>
      <td style="font-size:11px;direction:ltr">${l.ipAddress||l.IpAddress||''}</td>
    </tr>`
  ).join('');
}

// ─── ADMIN PANEL ────────────────────────────────
async function loadAdminPanel() {
  const accs = await apiCall('/api/accounts') || getDemoAccounts();
  const txs  = await apiCall('/api/transactions') || getDemoTx();
  const loans = await apiCall('/api/loans') || getDemoLoans();
  const total = accs.length + txs.length + 4 + 4 + 3;
  document.getElementById('db-recs').textContent = toFa(total) + ' رکورد';
  renderPendingApprovals(loans, txs);
}

function renderPendingApprovals(loans, txs) {
  const pendingLoans = loans.filter(l => (l.status||l.Status) === 'در بررسی');
  const pendingTx    = txs.filter(t => (t.status||t.Status) === 'در انتظار');
  const totalPending = pendingLoans.length + pendingTx.length;
  document.getElementById('pending-count-badge').textContent = toFa(totalPending) + ' مورد';
  const rows = [];
  pendingLoans.forEach(l => rows.push(`
    <tr>
      <td><span class="badge bg-i">درخواست وام</span></td>
      <td>${l.loanCode||l.LoanCode}</td>
      <td>${l.userName||l.UserName||''}</td>
      <td><strong>${fmt(l.amount||l.Amount)}</strong></td>
      <td style="font-size:12px">${l.loanType||l.LoanType} — ${toFa(l.installments||l.Installments)} ماه</td>
      <td>
        <button class="btn btn-xs" style="background:#E8F5E9;color:#1B5E20;border:none" onclick="loanStatus(${l.id||l.Id},'جاری');loadAdminPanel()"><i class="bi bi-check-lg"></i> تأیید</button>
        <button class="btn btn-xs btn-danger" onclick="loanStatus(${l.id||l.Id},'رد شده');loadAdminPanel()"><i class="bi bi-x-lg"></i> رد</button>
      </td>
    </tr>`));
  pendingTx.forEach(t => rows.push(`
    <tr>
      <td><span class="badge bg-w">تراکنش معلق</span></td>
      <td style="font-size:11px">${t.transactionCode||t.TransactionCode}</td>
      <td style="font-size:12px">${t.accountNumber||t.AccountNumber||''}</td>
      <td><strong>${fmt(t.amount||t.Amount)}</strong></td>
      <td style="font-size:12px">${t.description||t.Description||''}</td>
      <td><button class="btn btn-xs" style="background:#E8F5E9;color:#1B5E20;border:none" onclick="showToast('تراکنش تأیید شد','ok')"><i class="bi bi-check-lg"></i> تأیید</button></td>
    </tr>`));
  document.getElementById('pending-tbody').innerHTML = rows.length ? rows.join('') :
    `<tr><td colspan="6" style="text-align:center;color:var(--bs-muted);padding:18px"><i class="bi bi-check-circle"></i> هیچ موردی در انتظار تأیید نیست</td></tr>`;
}

async function runSQL() {
  const q = document.getElementById('sql-in').value.trim().toLowerCase();
  const out = document.getElementById('sql-out');
  const accs = await apiCall('/api/accounts') || getDemoAccounts();
  const txs  = await apiCall('/api/transactions') || getDemoTx();
  let res = '';
  if (q.includes('from accounts')) {
    res = `-- ${accs.length} رکورد\nId | AccountNumber      | Type       | Balance       | Status\n` + '-'.repeat(65) + '\n';
    accs.forEach(a => res += `${(a.id||a.Id)}  | ${(a.accountNumber||a.AccountNumber||'').padEnd(18)} | ${(a.accountType||a.AccountType||'').padEnd(10)} | ${String(a.balance||a.Balance||0).padEnd(13)} | ${a.status||a.Status}\n`);
  } else if (q.includes('from transactions')) {
    res = `-- ${txs.length} رکورد\n`;
    txs.slice(0,5).forEach(t => res += `${t.transactionCode||t.TransactionCode} | ${t.type||t.Type} | ${t.amount||t.Amount} | ${t.status||t.Status}\n`);
  } else if (q.includes('count') || q.includes('sum')) {
    const s = accs.reduce((x,a)=>x+(a.balance||a.Balance||0),0);
    res = `Total_Accounts | Sum_Balance\n${accs.length}              | ${s.toLocaleString()}`;
  } else {
    res = `OK — اجرا شد`;
  }
  out.style.color = '#88C4FF';
  out.textContent = res;
}

// ─── USER MGMT ──────────────────────────────────
async function loadUserMgmt() {
  let data = await apiCall('/api/users');
  if (!Array.isArray(data)) data = getDemoUsers();
  allUsers = data;
  const roleColors = { admin:'bg-no', manager:'bg-w', operator:'bg-b', user:'bg-g', auditor:'bg-i' };
  const roleLabels = { admin:'ادمین', manager:'مدیر', operator:'اپراتور', user:'کاربر', auditor:'حسابرس' };
  const tb = document.getElementById('user-tbody');
  if (!tb) return;
  tb.innerHTML = data.map(u =>
    `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="uav ${ROLES[u.role||u.Role]?.avClass||'uav-user'}" style="width:30px;height:30px;font-size:12px">${(u.fullName||u.FullName||'?').charAt(0)}</div>
          <div><div style="font-weight:600;font-size:13px">${u.fullName||u.FullName}</div><div style="font-size:11px;color:var(--bs-muted)">${u.username||u.Username}</div></div>
        </div>
      </td>
      <td><span class="badge ${roleColors[u.role||u.Role]||'bg-g'}">${roleLabels[u.role||u.Role]||u.role||u.Role}</span></td>
      <td style="font-size:12px">${u.email||u.Email}</td>
      <td style="font-size:11px">${u.lastLogin||u.LastLogin||'هرگز'}</td>
      <td><span class="badge ${(u.isActive||u.IsActive)?'bg-ok':'bg-no'}">${(u.isActive||u.IsActive)?'آنلاین':'آفلاین'}</span></td>
      <td>
        <button class="btn btn-outline btn-xs" onclick="openEditUser(${u.id||u.Id})" title="ویرایش"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-xs btn-danger" onclick="delUser(${u.id||u.Id})" title="غیرفعال"><i class="bi bi-trash"></i></button>
      </td>
    </tr>`
  ).join('');
  // Permission matrix (page-level)
  const allP = Object.keys(PERM_LABELS);
  const permEl = document.getElementById('perm-tbody');
  if (permEl) permEl.innerHTML = allP.map(p =>
    `<tr><td style="font-weight:500">${PERM_LABELS[p]}</td>${['admin','manager','operator','user','auditor'].map(r=>`<td style="text-align:center">${PERMS[r].includes(p)?'<i class="bi bi-check-lg" style="color:var(--bs-green);font-size:14px"></i>':'<span style="color:#ddd">—</span>'}</td>`).join('')}</tr>`
  ).join('');

  // Role overview cards
  const roleNames = { admin:'ادمین سیستم', manager:'مدیر شعبه', operator:'اپراتور', user:'کاربر بانکی', auditor:'حسابرس' };
  const roleEl = document.getElementById('role-cards');
  if (roleEl) roleEl.innerHTML = Object.keys(ROLE_INFO).map(r => {
    const info = ROLE_INFO[r];
    const userCount = data.filter(u => (u.role||u.Role) === r).length;
    return `<div style="background:var(--bs-sky);border:1px solid var(--bs-sky2);border-radius:10px;padding:14px;text-align:center">
      <div style="font-size:26px;margin-bottom:6px;color:var(--bs-navy)"><i class="bi ${info.icon}"></i></div>
      <div style="font-weight:700;font-size:13px;color:var(--bs-navy);margin-bottom:4px">${roleNames[r]}</div>
      <div style="font-size:11px;color:var(--bs-muted);line-height:1.6;margin-bottom:8px;min-height:50px">${info.desc}</div>
      <span class="badge bg-b">${toFa(userCount)} کاربر</span>
    </div>`;
  }).join('');

  // CRUD-level action matrix
  const crudEl = document.getElementById('crud-tbody');
  if (crudEl) crudEl.innerHTML = Object.entries(CRUD_MATRIX).map(([resource, roles]) =>
    `<tr><td style="font-weight:500">${resource}</td>${['admin','manager','operator','user','auditor'].map(r => {
      const codes = roles[r];
      if (codes === '-') return `<td style="text-align:center;color:#ddd">—</td>`;
      const chips = codes.split('').map(c => `<span class="badge" style="background:${CRUD_COLORS[c]}22;color:${CRUD_COLORS[c]};margin:1px;font-size:10px" title="${CRUD_LABELS[c]}">${c}</span>`).join('');
      return `<td style="text-align:center">${chips}</td>`;
    }).join('')}</tr>`
  ).join('');
}

function resetUserForm() {
  document.getElementById('nu-id').value = '';
  document.getElementById('nu-u').value = '';
  document.getElementById('nu-u').disabled = false;
  document.getElementById('nu-n').value = '';
  document.getElementById('nu-e').value = '';
  document.getElementById('nu-r').value = 'user';
  document.getElementById('nu-active').value = 'true';
  document.getElementById('nu-p').value = '';
  document.getElementById('nu-p').placeholder = 'حداقل ۶ کاراکتر';
  document.getElementById('mo-user-title').textContent = 'کاربر جدید';
  document.getElementById('nu-save-btn').innerHTML = '<i class="bi bi-check-lg"></i> ایجاد';
  document.getElementById('nu-hint').style.display = 'none';
  document.getElementById('nu-p-lbl').textContent = 'رمز عبور';
}

function openNewUser() {
  resetUserForm();
  openMo('mo-user');
}

function openEditUser(id) {
  const u = (allUsers || []).find(x => (x.id||x.Id) == id);
  if (!u) { showToast('کاربر یافت نشد', 'err'); return; }
  document.getElementById('nu-id').value = u.id || u.Id;
  document.getElementById('nu-u').value = u.username || u.Username || '';
  document.getElementById('nu-u').disabled = true;
  document.getElementById('nu-n').value = u.fullName || u.FullName || '';
  document.getElementById('nu-e').value = u.email || u.Email || '';
  document.getElementById('nu-r').value = u.role || u.Role || 'user';
  const active = (u.isActive !== undefined ? u.isActive : u.IsActive);
  document.getElementById('nu-active').value = active ? 'true' : 'false';
  document.getElementById('nu-p').value = '';
  document.getElementById('nu-p').placeholder = 'خالی = بدون تغییر';
  document.getElementById('mo-user-title').textContent = 'ویرایش کاربر';
  document.getElementById('nu-save-btn').innerHTML = '<i class="bi bi-check-lg"></i> ذخیره تغییرات';
  document.getElementById('nu-hint').style.display = 'block';
  document.getElementById('nu-p-lbl').textContent = 'رمز عبور جدید (اختیاری)';
  openMo('mo-user');
}

async function saveUser() {
  const id = document.getElementById('nu-id')?.value;
  const username = document.getElementById('nu-u')?.value.trim();
  const fullName = document.getElementById('nu-n')?.value.trim();
  const email    = document.getElementById('nu-e')?.value.trim();
  const role     = document.getElementById('nu-r')?.value;
  const password = document.getElementById('nu-p')?.value;
  const isActive = document.getElementById('nu-active')?.value === 'true';
  if (!fullName) { showToast('نام کامل الزامی است', 'err'); return; }

  const btn = document.getElementById('nu-save-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> در حال ذخیره...'; }

  let res;
  if (id) {
    // UPDATE
    const body = { fullName, email, role, isActive };
    if (password) body.password = password;
    res = await apiCall('/api/users/' + id, 'PUT', body);
  } else {
    // CREATE
    if (!username) { showToast('نام کاربری الزامی است', 'err'); if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-check-lg"></i> ایجاد'; } return; }
    res = await apiCall('/api/users', 'POST', { username, fullName, email, role, password });
  }

  if (btn) { btn.disabled = false; btn.innerHTML = id ? '<i class="bi bi-check-lg"></i> ذخیره تغییرات' : '<i class="bi bi-check-lg"></i> ایجاد'; }

  if (res && res.success) {
    showToast(id ? 'کاربر به‌روزرسانی شد' : 'کاربر ایجاد شد', 'ok');
    closeMo('mo-user');
    resetUserForm();
    loadUserMgmt();
  } else if (res && res.message) {
    showToast(res.message, 'err');
  } else {
    // demo fallback
    showToast(id ? 'کاربر به‌روزرسانی شد (حالت نمایشی)' : 'کاربر ایجاد شد (حالت نمایشی)', 'ok');
    closeMo('mo-user');
    if (id) {
      const u = allUsers.find(x => (x.id||x.Id) == id);
      if (u) { u.fullName = fullName; u.FullName = fullName; u.email = email; u.role = role; u.Role = role; u.isActive = isActive; }
      loadUserMgmt();
    }
  }
}

// backward compat
async function addUser() { return saveUser(); }

async function delUser(id) {
  if (!confirm('آیا از غیرفعال‌سازی این کاربر مطمئن هستید؟')) return;
  const res = await apiCall('/api/users/' + id, 'DELETE');
  if (res && res.success) { showToast('کاربر غیرفعال شد', 'ok'); loadUserMgmt(); }
  else if (res && res.message) showToast(res.message, 'err');
  else { showToast('کاربر غیرفعال شد', 'ok'); loadUserMgmt(); }
}

// ─── SETTINGS ────────────────────────────────────
function renderSettingsPerms() {
  const r = ROLES[currentRole];
  const perms = PERMS[currentRole];
  const av = document.getElementById('sett-av');
  if (av) { av.textContent = r.char; av.className = 'uav ' + r.avClass; }
  const names = {admin:'مدیر ارشد',manager:'رضا حسینی',operator:'سارا موسوی',user:'علی کریمی',auditor:'نیلوفر احمدی'};
  const el1 = document.getElementById('sett-name'); if (el1) el1.textContent = names[currentRole];
  const el2 = document.getElementById('sett-role'); if (el2) el2.textContent = r.label;
  const el = document.getElementById('sett-perms');
  if (!el) return;
  el.innerHTML = Object.keys(PERM_LABELS).map(k =>
    `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-radius:7px;font-size:12px;font-weight:500;border:1px solid;${perms.includes(k)?'background:#E8F5E9;color:#1B5E20;border-color:#A5D6A7':'background:#FAFAFA;color:#999;border-color:#eee'}">
      <span>${PERM_LABELS[k]}</span><span>${perms.includes(k)?'<i class="bi bi-check-lg"></i>':'—'}</span>
    </div>`
  ).join('');
}

// ─── POPULATE SELECTS ────────────────────────────
async function populateAccountSelects() {
  if (allAccounts.length === 0) allAccounts = await apiCall('/api/accounts') || getDemoAccounts();
  const opts = allAccounts.map(a => `<option value="${a.id||a.Id}">${a.accountNumber||a.AccountNumber} — ${a.ownerName||a.OwnerName||''}</option>`).join('');
  ['ntx-acc','nc-acc'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = opts; });
}


// ─── BILL PAYMENT ─────────────────────────────────
async function doPayment() {
  const typeEl = document.getElementById('pay-type');
  const idEl = document.getElementById('pay-id');
  const amtEl = document.getElementById('pay-amt');
  const accEl = document.getElementById('pay-acc');
  const billType = typeEl ? typeEl.value : 'برق';
  const billId = idEl ? idEl.value.trim() : '';
  const amount = amtEl ? Number(amtEl.value) : 0;
  const accountId = accEl ? Number(accEl.value) : 0;
  if (!billId) { showToast('شناسه قبض را وارد کنید', 'err'); return; }
  if (!amount || amount <= 0) { showToast('مبلغ معتبر وارد کنید', 'err'); return; }
  if (!accountId) { showToast('حساب را انتخاب کنید', 'err'); return; }

  // find pay button and disable
  const payBtns = document.querySelectorAll('#page-payments .btn-primary');
  payBtns.forEach(b => { b.disabled = true; b.innerHTML = '<i class="bi bi-hourglass-split"></i> در حال پرداخت...'; });

  let res = await apiCall('/api/payments', 'POST', { accountId, billType, billId, amount });
  // fallback to transaction if payments endpoint missing
  if (!res || (res.success === undefined && !res.message)) {
    res = await apiCall('/api/transactions', 'POST', {
      accountId, type: 'برداشت', amount,
      description: 'پرداخت قبض ' + billType + ' — ' + billId
    });
  }

  payBtns.forEach(b => { b.disabled = false; b.innerHTML = '<i class="bi bi-credit-card"></i> پرداخت قبض'; });

  if (res && res.success) {
    showToast(res.message || ('قبض ' + billType + ' به مبلغ ' + fmt(amount) + ' پرداخت شد'), 'ok');
    if (idEl) idEl.value = '';
    if (amtEl) amtEl.value = '';
  } else if (res && res.message) {
    showToast(res.message, 'err');
  } else {
    showToast('خطا در ارتباط با سرور — دوباره تلاش کنید', 'err');
  }
}

function quickPay(type) {
  const typeEl = document.getElementById('pay-type');
  if (typeEl) typeEl.value = type;
  showToast('نوع قبض «' + type + '» انتخاب شد — شناسه و مبلغ را وارد کنید', 'ok');
  const idEl = document.getElementById('pay-id');
  if (idEl) idEl.focus();
}

async function populatePayAcc() {
  if (allAccounts.length === 0) allAccounts = await apiCall('/api/accounts') || getDemoAccounts();
  const opts = allAccounts.map(a => `<option value="${a.id||a.Id}">${a.accountNumber||a.AccountNumber}</option>`).join('');
  const el = document.getElementById('pay-acc'); if (el) el.innerHTML = opts;
}

// ─── DEMO DATA FALLBACKS ─────────────────────────
function getDemoAccounts() {
  return [
    {id:1,accountNumber:'0119876543210',accountType:'جاری',balance:125000000,status:'فعال',ownerName:'احمد رضایی',date:'۱۴۰۴/۰۱/۱۵'},
    {id:2,accountNumber:'0221234567890',accountType:'پس‌انداز',balance:340000000,status:'فعال',ownerName:'فاطمه محمدی',date:'۱۴۰۳/۱۱/۲۰'},
    {id:3,accountNumber:'0330001122334',accountType:'جاری',balance:1850000000,status:'فعال',ownerName:'مدیر ارشد',date:'۱۴۰۳/۰۸/۱۰'},
    {id:4,accountNumber:'0445566778899',accountType:'قرض‌الحسنه',balance:5000000,status:'فعال',ownerName:'علی کریمی',date:'۱۴۰۴/۰۲/۰۱'},
    {id:5,accountNumber:'0559988776655',accountType:'کوتاه‌مدت',balance:78000000,status:'مسدود',ownerName:'فاطمه محمدی',date:'۱۴۰۳/۰۶/۱۵'},
  ];
}
function getDemoTx() {
  return [
    {id:1,transactionCode:'TX001',type:'واریز',amount:15000000,description:'حقوق',status:'موفق',accountNumber:'0119876543210',date:'۱۴۰۴/۰۳/۱۰'},
    {id:2,transactionCode:'TX002',type:'برداشت',amount:8000000,description:'خرید',status:'موفق',accountNumber:'0221234567890',date:'۱۴۰۴/۰۳/۱۰'},
    {id:3,transactionCode:'TX003',type:'انتقال',amount:50000000,description:'قرارداد',status:'موفق',accountNumber:'0330001122334',date:'۱۴۰۴/۰۳/۰۹'},
    {id:4,transactionCode:'TX004',type:'برداشت',amount:3000000,description:'ATM',status:'موفق',accountNumber:'0119876543210',date:'۱۴۰۴/۰۳/۰۸'},
    {id:5,transactionCode:'TX005',type:'واریز',amount:100000000,description:'سرمایه',status:'موفق',accountNumber:'0221234567890',date:'۱۴۰۴/۰۳/۰۶'},
    {id:6,transactionCode:'TX006',type:'واریز',amount:200000000,description:'فروش',status:'موفق',accountNumber:'0330001122334',date:'۱۴۰۴/۰۳/۰۴'},
  ];
}
function getDemoLoans() {
  return [
    {id:1,loanCode:'LN001',loanType:'مسکن',amount:800000000,interestRate:18,installments:60,status:'جاری',userName:'احمد رضایی'},
    {id:2,loanCode:'LN002',loanType:'خودرو',amount:300000000,interestRate:22,installments:36,status:'جاری',userName:'فاطمه محمدی'},
    {id:3,loanCode:'LN003',loanType:'ازدواج',amount:100000000,interestRate:4,installments:84,status:'جاری',userName:'علی کریمی'},
    {id:4,loanCode:'LN004',loanType:'قرض‌الحسنه',amount:50000000,interestRate:0,installments:24,status:'تسویه',userName:'فاطمه محمدی'},
  ];
}
function getDemoCards() {
  return [
    {id:1,cardNumber:'6037697812345678',cardType:'نقدی',dailyLimit:10000000,expiryDate:'06/1406',status:'فعال',ownerName:'احمد رضایی'},
    {id:2,cardNumber:'6037697856789012',cardType:'اعتباری',dailyLimit:50000000,expiryDate:'03/1405',status:'فعال',ownerName:'فاطمه محمدی'},
    {id:3,cardNumber:'6037697890123456',cardType:'نقدی',dailyLimit:100000000,expiryDate:'12/1405',status:'مسدود',ownerName:'مدیر ارشد'},
  ];
}
function getDemoUsers() {
  return [
    {id:1,username:'admin',fullName:'مدیر ارشد',email:'admin@saderat.ir',role:'admin',isActive:true,lastLogin:'همین الان'},
    {id:2,username:'manager1',fullName:'رضا حسینی',email:'manager@saderat.ir',role:'manager',isActive:true,lastLogin:'۱ ساعت پیش'},
    {id:3,username:'operator1',fullName:'سارا موسوی',email:'op1@saderat.ir',role:'operator',isActive:true,lastLogin:'۳۰ دقیقه پیش'},
    {id:4,username:'ali.karimi',fullName:'علی کریمی',email:'ali@gmail.com',role:'user',isActive:true,lastLogin:'دیروز'},
    {id:5,username:'fateme.m',fullName:'فاطمه محمدی',email:'fateme@gmail.com',role:'user',isActive:true,lastLogin:'هرگز'},
    {id:6,username:'auditor',fullName:'نیلوفر احمدی',email:'audit@saderat.ir',role:'auditor',isActive:true,lastLogin:'۲ روز پیش'},
  ];
}
function getDemoAudit() {
  return [
    {id:1,action:'ورود',detail:'احراز هویت موفق',ipAddress:'192.168.1.1',userName:'مدیر ارشد',userRole:'admin',date:'۱۴۰۴/۰۳/۱۰ ۱۳:۲۲'},
    {id:2,action:'ثبت تراکنش',detail:'TX001 — واریز ۱۵م',ipAddress:'192.168.1.5',userName:'سارا موسوی',userRole:'operator',date:'۱۴۰۴/۰۳/۱۰ ۱۳:۱۵'},
    {id:3,action:'افتتاح حساب',detail:'ACC-001 — جاری',ipAddress:'192.168.1.1',userName:'مدیر ارشد',userRole:'admin',date:'۱۴۰۴/۰۳/۱۰ ۱۰:۳۰'},
    {id:4,action:'تأیید وام',detail:'LN-003 قرض‌الحسنه',ipAddress:'10.0.0.2',userName:'رضا حسینی',userRole:'manager',date:'۱۴۰۴/۰۳/۰۹ ۱۶:۴۵'},
    {id:5,action:'مشاهده گزارش',detail:'گزارش ماهانه',ipAddress:'10.0.0.8',userName:'نیلوفر احمدی',userRole:'auditor',date:'۱۴۰۴/۰۳/۰۹ ۰۹:۰۰'},
    {id:6,action:'تلاش ناموفق',detail:'دسترسی به حذف رکورد رد شد',ipAddress:'192.168.1.5',userName:'سارا موسوی',userRole:'operator',date:'۱۴۰۴/۰۳/۰۸ ۱۵:۳۰'},
  ];
}


// ─── START ───────────────────────────────────────

// Expose mobile helpers for inline onclick handlers
window.doPayment = doPayment;
window.resetUserForm = resetUserForm;
window.saveUser = saveUser;
window.openNewUser = openNewUser;
window.openEditUser = openEditUser;
window.quickPay = quickPay;
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.toggleDark = toggleDark;
window.toggleNotif = toggleNotif;
window.fabAction = fabAction;
window.syncBottomNav = syncBottomNav;

window.addEventListener('DOMContentLoaded', checkAuth);
