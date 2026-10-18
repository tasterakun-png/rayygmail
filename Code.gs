const SHEETS = {
  USERS: 'Users',
  SUBMISSIONS: 'Submissions',
  TRANSACTIONS: 'Transactions'
};
const HEADERS = {
  Users: ['id','createdAt','name','email','salt','passwordHash','balance','status'],
  Submissions: ['id','createdAt','userId','name','type','reference','note','status','adminNote'],
  Transactions: ['id','createdAt','userId','type','amount','description','status','adminId']
};
const SESSION_TTL = 21600; // 6 jam

function doGet(e) {
  const page = e && e.parameter && e.parameter.page === 'admin' ? 'Admin' : 'Index';
  const t = HtmlService.createTemplateFromFile(page);
  t.appUrl = ScriptApp.getService().getUrl();
  return t.evaluate()
    .setTitle(page === 'Admin' ? 'RAYYGMAIL | Admin' : 'RAYYGMAIL | Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** Jalankan sekali dari editor Apps Script setelah script dibuat dari Google Sheet. */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Buka Apps Script dari Google Sheets: Extensions > Apps Script.');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  Object.keys(HEADERS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, HEADERS[name].length).setFontWeight('bold').setBackground('#172033').setFontColor('#f6b94a');
      sh.autoResizeColumns(1, HEADERS[name].length);
    }
  });
  return 'Selesai. Sheet Users, Submissions, dan Transactions siap digunakan.';
}

function getDb_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Database tidak ditemukan. Buka Apps Script dari Google Sheets lalu jalankan setupSheets().');
  return ss;
}
function rows_(sheetName) {
  const sh = getDb_().getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  const headers = values.shift().map(String);
  return values.map(row => {
    const o = {};
    headers.forEach((h, i) => o[h] = row[i] instanceof Date ? row[i].toISOString() : row[i]);
    return o;
  });
}
function append_(sheetName, obj) {
  const sh = getDb_().getSheetByName(sheetName);
  if (!sh) throw new Error('Sheet ' + sheetName + ' belum ada. Jalankan setupSheets().');
  const headers = HEADERS[sheetName];
  sh.appendRow(headers.map(h => obj[h] !== undefined ? obj[h] : ''));
}
function updateRow_(sheetName, id, changes) {
  const sh = getDb_().getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) throw new Error('Data tidak ditemukan.');
  const values = sh.getDataRange().getValues();
  const headers = values[0].map(String);
  const idCol = headers.indexOf('id');
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(id)) {
      Object.keys(changes).forEach(key => {
        const c = headers.indexOf(key);
        if (c >= 0) sh.getRange(r + 1, c + 1).setValue(changes[key]);
      });
      return true;
    }
  }
  throw new Error('Data tidak ditemukan.');
}
function id_() { return Utilities.getUuid(); }
function now_() { return new Date().toISOString(); }
function clean_(value, max) { return String(value == null ? '' : value).trim().slice(0, max || 500); }
function emailValid_(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function hashPassword_(password, salt) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + password, Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}
function newSession_(payload) {
  const token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put('session_' + token, JSON.stringify(payload), SESSION_TTL);
  return token;
}
function session_(token) {
  token = clean_(token, 200);
  if (!token) throw new Error('Sesi berakhir. Silakan masuk kembali.');
  const raw = CacheService.getScriptCache().get('session_' + token);
  if (!raw) throw new Error('Sesi berakhir. Silakan masuk kembali.');
  return JSON.parse(raw);
}
function requireUser_(token) {
  const s = session_(token);
  if (s.role !== 'user') throw new Error('Akses pengguna tidak valid.');
  const u = rows_(SHEETS.USERS).find(x => String(x.id) === String(s.userId));
  if (!u || u.status !== 'Aktif') throw new Error('Akun tidak aktif.');
  return u;
}
function requireAdmin_(token) {
  const s = session_(token);
  if (s.role !== 'admin') throw new Error('Akses admin ditolak.');
  return s;
}
function registerUser(form) {
  form = form || {};
  const name = clean_(form.name, 80);
  const email = clean_(form.email, 150).toLowerCase();
  const password = String(form.password || '');
  if (name.length < 2) throw new Error('Nama minimal 2 karakter.');
  if (!emailValid_(email)) throw new Error('Format email tidak valid.');
  if (password.length < 8) throw new Error('Kata sandi akun RAYYGMAIL minimal 8 karakter.');
  const users = rows_(SHEETS.USERS);
  if (users.some(u => String(u.email).toLowerCase() === email)) throw new Error('Email sudah terdaftar.');
  const salt = id_();
  const user = { id: id_(), createdAt: now_(), name, email, salt, passwordHash: hashPassword_(password, salt), balance: 0, status: 'Aktif' };
  append_(SHEETS.USERS, user);
  const token = newSession_({ role: 'user', userId: user.id });
  return { token, user: publicUser_(user) };
}
function loginUser(form) {
  form = form || {};
  const email = clean_(form.email, 150).toLowerCase();
  const password = String(form.password || '');
  const user = rows_(SHEETS.USERS).find(u => String(u.email).toLowerCase() === email);
  if (!user || user.passwordHash !== hashPassword_(password, String(user.salt))) throw new Error('Email atau kata sandi salah.');
  if (user.status !== 'Aktif') throw new Error('Akun sedang dinonaktifkan.');
  const token = newSession_({ role: 'user', userId: user.id });
  return { token, user: publicUser_(user) };
}
function publicUser_(u) { return { id: u.id, name: u.name, email: u.email, balance: Number(u.balance) || 0, status: u.status }; }
function logout(token) { CacheService.getScriptCache().remove('session_' + clean_(token, 200)); return true; }
function getUserDashboard(token) {
  const u = requireUser_(token);
  const submissions = rows_(SHEETS.SUBMISSIONS).filter(x => String(x.userId) === String(u.id)).reverse();
  const transactions = rows_(SHEETS.TRANSACTIONS).filter(x => String(x.userId) === String(u.id)).reverse();
  return { user: publicUser_(u), submissions, transactions };
}
function createSubmission(token, form) {
  const u = requireUser_(token);
  form = form || {};
  const type = clean_(form.type, 40);
  const reference = clean_(form.reference, 180);
  const note = clean_(form.note, 500);
  if (!['Setoran Gmail', 'Pertanyaan layanan'].includes(type)) throw new Error('Jenis pengajuan tidak valid.');
  if (reference.length < 3) throw new Error('Isi ID referensi atau email kontak yang diperlukan.');
  if (/password|passwd|otp|kode pemulihan|recovery code/i.test(reference + ' ' + note)) throw new Error('Jangan masukkan kata sandi, OTP, atau kode pemulihan.');
  const today = new Date(); today.setHours(0,0,0,0);
  const countToday = rows_(SHEETS.SUBMISSIONS).filter(x => String(x.userId) === String(u.id) && x.type === 'Setoran Gmail' && new Date(x.createdAt).getTime() >= today.getTime()).length;
  if (type === 'Setoran Gmail' && countToday >= 1) throw new Error('Batas pengajuan Setoran Gmail hari ini sudah tercapai.');
  const item = { id: id_(), createdAt: now_(), userId: u.id, name: u.name, type, reference, note, status: 'Pending', adminNote: '' };
  append_(SHEETS.SUBMISSIONS, item);
  return { ok: true, message: 'Pengajuan berhasil dikirim dan menunggu pemeriksaan admin.' };
}
function getAdminData(token) {
  requireAdmin_(token);
  const users = rows_(SHEETS.USERS).map(publicUser_).reverse();
  const submissions = rows_(SHEETS.SUBMISSIONS).reverse();
  const transactions = rows_(SHEETS.TRANSACTIONS).reverse();
  return { users, submissions, transactions, stats: { users: users.length, pending: submissions.filter(x => x.status === 'Pending').length, approved: submissions.filter(x => x.status === 'Disetujui').length, transactions: transactions.length } };
}
function adminLogin(password) {
  const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!expected) throw new Error('ADMIN_PASSWORD belum diatur di Project Settings > Script Properties.');
  if (String(password || '') !== expected) throw new Error('Kata sandi admin salah.');
  return { token: newSession_({ role: 'admin', adminId: 'owner' }) };
}
function adminUpdateSubmission(token, id, status, adminNote) {
  requireAdmin_(token);
  if (!['Pending', 'Disetujui', 'Ditolak'].includes(status)) throw new Error('Status tidak valid.');
  updateRow_(SHEETS.SUBMISSIONS, clean_(id, 100), { status, adminNote: clean_(adminNote, 500) });
  return { ok: true };
}
function adminSetUserStatus(token, userId, status) {
  requireAdmin_(token);
  if (!['Aktif', 'Nonaktif'].includes(status)) throw new Error('Status pengguna tidak valid.');
  updateRow_(SHEETS.USERS, clean_(userId, 100), { status });
  return { ok: true };
}
function adminAdjustBalance(token, userId, amount, description) {
  requireAdmin_(token);
  const n = Number(amount);
  if (!Number.isFinite(n) || n === 0 || Math.abs(n) > 100000000) throw new Error('Nominal tidak valid.');
  const u = rows_(SHEETS.USERS).find(x => String(x.id) === String(userId));
  if (!u) throw new Error('Pengguna tidak ditemukan.');
  const current = Number(u.balance) || 0;
  if (current + n < 0) throw new Error('Saldo tidak boleh menjadi negatif.');
  updateRow_(SHEETS.USERS, userId, { balance: current + n });
  append_(SHEETS.TRANSACTIONS, { id: id_(), createdAt: now_(), userId: u.id, type: n > 0 ? 'Kredit admin' : 'Debit admin', amount: n, description: clean_(description, 250) || 'Penyesuaian saldo oleh admin', status: 'Selesai', adminId: 'owner' });
  return { ok: true, balance: current + n };
}
