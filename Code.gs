/**
 * PERPUSTAKAAN FATA - Aplikasi Web Perpustakaan (Google Apps Script)
 * File ini = SERVER (API). Tampilan ada di file Index.html / index.html.
 *
 * ======================= WAJIB DIISI =======================
 * ID spreadsheet database. Ambil dari alamat spreadsheet:
 *   https://docs.google.com/spreadsheets/d/  >>>INI-ID-NYA<<<  /edit
 */
var SPREADSHEET_ID = 'TEMPEL_ID_SPREADSHEET_DI_SINI';
/* ============================================================
 *
 * Cara pasang singkat (lengkap di README.md / Panduan Admin):
 *  1. Buat proyek Apps Script, tempel file ini ke Code.gs, isi SPREADSHEET_ID di atas.
 *  2. Tambah file HTML bernama "Index" (opsional, jika tampilan juga dibuka dari Apps Script).
 *  3. Jalankan fungsi "setup" sekali (izinkan akses). PIN admin awal muncul di sheet Petugas.
 *  4. Terapkan > Deployment baru > Aplikasi web. Jalankan sebagai: Saya. Akses: Siapa saja.
 *  5. Salin URL /exec ke API_URL di index.html, lalu terbitkan index.html di GitHub Pages.
 */

var APP_VERSION = '2.0';

var SH = {
  BUKU: 'Buku', EKS: 'Eksemplar', RAK: 'Rak', ANG: 'Anggota', PTG: 'Petugas', KUN: 'Kunjungan',
  PJM: 'Peminjaman', RES: 'Reservasi', LIB: 'Libur', SET: 'Pengaturan', LBL: 'Cetak_Label', LOG: 'Log'
};

var SCHEMA = {
  Buku: ['ID_Buku', 'Judul', 'Pengarang', 'Penerbit', 'Kota Terbit', 'Tahun', 'Edisi/Cetakan', 'ISBN', 'Kolasi', 'Bahasa',
    'Jenis Koleksi', 'No. Panggil', 'Kelas DDC', 'Subjek', 'Seri', 'Jml Eksemplar (saat migrasi)', 'Baris di Ekspor SLiMS'],
  Eksemplar: ['Barcode', 'ID_Buku', 'Judul', 'No. Panggil', 'Kode Label', 'Salinan', 'Prefix Barcode', 'Jenis Koleksi',
    'Kelas DDC', 'Lokasi Rak', 'Kondisi', 'Status', 'Asal Barcode', 'Tanggal Masuk', 'Catatan'],
  Rak: ['Kode Rak', 'Ruang/Lokasi', 'Kelas DDC Disimpan', 'Keterangan', 'Jumlah Eksemplar'],
  Anggota: ['NIM/NIP', 'Nama', 'Prodi/Unit', 'Angkatan', 'No. HP', 'Email', 'Jenis Anggota', 'Status', 'Tanggal Daftar',
    'Berlaku Sampai', 'Catatan', 'PIN (terenkripsi)'],
  Petugas: ['Username', 'Nama', 'PIN', 'Peran', 'Aktif'],
  Kunjungan: ['Waktu', 'Tanggal', 'Hari', 'NIM/NIP', 'Nama', 'Prodi/Unit', 'Keperluan'],
  Peminjaman: ['No. Transaksi', 'NIM/NIP', 'Nama', 'Barcode', 'ID_Buku', 'Judul', 'Tgl Pinjam', 'Jatuh Tempo', 'Tgl Kembali',
    'Perpanjangan', 'Terlambat (hari)', 'Denda (Rp)', 'Status Denda', 'Status', 'Kondisi Kembali', 'Petugas Pinjam', 'Petugas Kembali'],
  Reservasi: ['ID Reservasi', 'NIM/NIP', 'Nama', 'ID_Buku', 'Judul', 'Tgl Pesan', 'Status', 'Barcode Disiapkan', 'Batas Ambil'],
  Libur: ['Tanggal', 'Keterangan'],
  Cetak_Label: ['Barcode (ketik/scan)', 'Judul', 'Kode Label', 'No. Panggil', 'Salinan', 'Status'],
  Log: ['Waktu', 'Pengguna', 'Aksi', 'Detail']
};

// [kunci, label di kolom A sheet Pengaturan, nilai bawaan, keterangan]
var SETTINGS = [
  ['nama', 'Nama perpustakaan (baris 1 label)', 'Perpustakaan FATA', 'Tampil di aplikasi dan label'],
  ['instansi', 'Instansi (baris 2 label)', 'UIN Surakarta', 'Tampil di aplikasi dan label'],
  ['lama', 'Lama pinjam (hari)', 7, 'Contoh, sesuaikan tata tertib'],
  ['maks', 'Maksimal buku dipinjam', 3, 'Contoh, sesuaikan tata tertib'],
  ['maksPanjang', 'Maksimal perpanjangan', 1, 'Contoh, sesuaikan tata tertib'],
  ['denda', 'Denda per buku per hari (Rp)', 500, 'Contoh, sesuaikan tata tertib'],
  ['batasDenda', 'Batas denda sebelum diblokir (Rp)', 10000, 'Contoh, sesuaikan tata tertib'],
  ['batasAmbil', 'Batas ambil reservasi (hari)', 2, 'Contoh, sesuaikan tata tertib'],
  ['awalan', 'Awalan barcode baru (tahun)', '26', 'Pola lama: tahun 2 digit + 4 digit urut + .salinan'],
  ['nomor', 'Nomor urut barcode berikutnya', 1, 'Aplikasi menaikkan otomatis'],
  ['jenisBarcode', 'Jenis barcode', 'Code 128', 'Dapat memuat angka, huruf, dan titik'],
  ['maksPesan', 'Maksimal reservasi aktif', 2, 'Contoh, sesuaikan tata tertib'],
  ['mandiri', 'Pinjam mandiri oleh mahasiswa (Ya/Tidak)', 'Tidak', 'Ya = mahasiswa boleh scan dan pinjam sendiri lewat aplikasi'],
  ['jeda', 'Jeda presensi ganda (menit)', 60, 'NIM yang sama dalam jeda ini tidak dihitung dua kali'],
  ['minggu', 'Hari Minggu libur (Ya/Tidak)', 'Ya', 'Jatuh tempo digeser jika jatuh pada hari libur'],
  ['email', 'Kirim email pengingat (Ya/Tidak)', 'Tidak', 'Ya = email H-1 jatuh tempo dan saat terlambat (kuota Gmail 100/hari)']
];

var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
var BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/* ===================== Halaman web ===================== */

function bootData_(p) {
  var boot = { mode: p.mode === 'kiosk' ? 'kiosk' : '', page: p.page || '', v: APP_VERSION };
  try { var s = settings_(); boot.nama = s.nama; boot.instansi = s.instansi; boot.mandiri = isYa_(s.mandiri); }
  catch (err) { boot.error = String(err.message || err); }
  return boot;
}

// GET: tanpa parameter = tampilan (file Index.html); ?api=info = cek koneksi API dari browser.
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.api) return json_(api(p.api, {}, ''));
  var boot = bootData_(p), html;
  try { html = HtmlService.createHtmlOutputFromFile('Index').getContent(); }
  catch (err) {
    return HtmlService.createHtmlOutput('<p style="font-family:sans-serif">API perpustakaan aktif. Tampilan dibuka dari GitHub Pages (index.html), ' +
      'atau tambahkan file HTML bernama <b>Index</b> di proyek Apps Script ini.</p>');
  }
  html = html.replace('__BOOT__', function () { return JSON.stringify(boot).replace(/</g, '\\u003c'); });
  return HtmlService.createHtmlOutput(html)
    .setTitle((boot.nama || 'Perpustakaan') + ' - Layanan Digital')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// POST: dipanggil tampilan GitHub Pages lewat fetch(). Body JSON: {action, payload, token}.
function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_(JSON.stringify({ ok: false, error: 'Format permintaan tidak valid.' })); }
  if (body.action === 'boot') return json_(JSON.stringify({ ok: true, data: bootData_(body.payload || {}) }));
  return json_(api(body.action, body.payload || {}, body.token || ''));
}

function json_(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}

// Jalankan dari editor untuk mengecek apakah SPREADSHEET_ID benar.
function cekKoneksi() {
  var ss = ss_();
  var msg = 'Terhubung ke spreadsheet: ' + ss.getName() + '\nSheet: ' + ss.getSheets().map(function (x) { return x.getName(); }).join(', ');
  Logger.log(msg);
  return msg;
}

function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('Perpustakaan')
      .addItem('Setup / perbaiki struktur', 'setup')
      .addItem('Tampilkan alamat aplikasi', 'tampilkanUrl')
      .addItem('Jalankan tugas harian sekarang', 'harian')
      .addToUi();
  } catch (e) { /* bukan dari spreadsheet */ }
}

function tampilkanUrl() {
  var url = ScriptApp.getService().getUrl();
  var msg = url ? 'Alamat aplikasi:\n' + url + '\n\nMode kios presensi (tablet di pintu):\n' + url + '?mode=kiosk'
    : 'Aplikasi belum di-deploy. Pilih Terapkan > Deployment baru > Aplikasi web.';
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
  return msg;
}

/* ===================== Setup ===================== */

function setup() {
  var ss = ss_();
  var props = PropertiesService.getScriptProperties();
  props.setProperty('SS_ID', ss.getId());
  if (!props.getProperty('SALT')) props.setProperty('SALT', Utilities.getUuid());
  var notes = [];
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) { sh = ss.insertSheet(name); notes.push('Sheet ' + name + ' dibuat'); }
    var lc = Math.max(sh.getLastColumn(), 1);
    var head = sh.getRange(1, 1, 1, lc).getValues()[0].map(function (h) { return String(h).trim(); });
    if (head.join('') === '') head = [];
    var missing = SCHEMA[name].filter(function (h) { return head.indexOf(h) < 0; });
    if (missing.length) {
      sh.getRange(1, head.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
      notes.push(name + ': kolom ditambah (' + missing.join(', ') + ')');
    }
    sh.setFrozenRows(1);
  });
  var set = ss.getSheetByName(SH.SET);
  if (!set) set = ss.insertSheet(SH.SET);
  if (set.getLastRow() < 1) set.getRange(1, 1, 1, 3).setValues([['Pengaturan', 'Nilai', 'Keterangan']]);
  var labels = set.getLastRow() > 1 ? set.getRange(2, 1, set.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]).trim(); }) : [];
  SETTINGS.forEach(function (s) {
    if (labels.indexOf(s[1]) < 0) { set.appendRow([s[1], s[2], s[3]]); notes.push('Pengaturan ditambah: ' + s[1]); }
  });
  var ptg = ss.getSheetByName(SH.PTG);
  var adminMsg = '';
  if (ptg.getLastRow() < 2) {
    var pin = String(100000 + Math.floor(Math.random() * 900000));
    ptg.appendRow(['admin', 'Administrator', "'" + pin, 'Admin', 'Ya']);
    adminMsg = 'Akun admin dibuat. Username: admin, PIN: ' + pin + ' (lihat sheet Petugas, segera ganti).';
    notes.push(adminMsg);
  }
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'harian') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('harian').timeBased().everyDays(1).atHour(6).create();
  notes.push('Tugas harian (06.00) dipasang: membatalkan booking kedaluwarsa dan email pengingat.');
  var msg = 'Setup selesai.\n- ' + (notes.length ? notes.join('\n- ') : 'Struktur sudah lengkap.');
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
  return msg;
}

/* ===================== API (dipanggil dari tampilan) ===================== */

function api(action, payload, token) {
  try {
    var a = ACTIONS[action];
    if (!a) throw new Error('Perintah tidak dikenal: ' + action);
    var sess = token ? getSess_(token) : null;
    if (a.auth === 'm' && (!sess || sess.t !== 'm')) throw new Error('SESI_HABIS');
    if ((a.auth === 'p' || a.auth === 'admin') && (!sess || sess.t !== 'p')) throw new Error('SESI_HABIS');
    if (a.auth === 'admin' && sess.role !== 'Admin') throw new Error('Hanya admin yang boleh melakukan ini.');
    var data;
    if (a.lock) {
      var lock = LockService.getScriptLock();
      if (!lock.tryLock(25000)) throw new Error('Server sedang sibuk, coba lagi beberapa detik lagi.');
      try { data = a.run(payload || {}, sess); } finally { lock.releaseLock(); }
    } else {
      data = a.run(payload || {}, sess);
    }
    return JSON.stringify({ ok: true, data: data });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e && e.message ? e.message : e) });
  }
}

var ACTIONS = {
  boot: { run: function (p) { return bootData_(p || {}); } },
  info: { run: function () { return infoPublik_(); } },
  cekNim: { run: function (p) { return cekNim_(p.nim); } },
  presensi: { lock: true, run: function (p) { return presensi_(p.nim, p.keperluan); } },
  cari: { run: function (p) { return cari_(p); } },
  detail: { run: function (p) { return detailBuku_(p.id); } },
  populer: { run: function () { return populer_(); } },
  login: { run: function (p) { return loginAnggota_(p.nim, p.pin); } },
  loginPetugas: { run: function (p) { return loginPetugas_(p.user, p.pin); } },
  logout: { run: function (p, s) { return logout_(s); } },

  akun: { auth: 'm', run: function (p, s) { return akun_(s.id); } },
  gantiPin: { auth: 'm', lock: true, run: function (p, s) { return gantiPin_(s.id, p.lama, p.baru); } },
  perpanjang: { auth: 'm', lock: true, run: function (p, s) { return perpanjang_(s.id, p.barcode, 'Mandiri'); } },
  pesan: { auth: 'm', lock: true, run: function (p, s) { return pesan_(s.id, p.id); } },
  batalPesan: { auth: 'm', lock: true, run: function (p, s) { return batalPesan_(s.id, p.rid); } },
  pinjamMandiri: { auth: 'm', lock: true, run: function (p, s) {
    if (!isYa_(settings_().mandiri)) throw new Error('Pinjam mandiri belum diaktifkan. Silakan ke meja petugas.');
    return pinjam_(s.id, p.barcode, 'Mandiri');
  } },

  anggota: { auth: 'p', run: function (p) { return kartuAnggota_(p.nim); } },
  pinjam: { auth: 'p', lock: true, run: function (p, s) { return pinjam_(p.nim, p.barcode, s.user); } },
  kembali: { auth: 'p', lock: true, run: function (p, s) { return kembali_(p.barcode, p.kondisi, s.user); } },
  perpanjangPetugas: { auth: 'p', lock: true, run: function (p, s) { return perpanjang_(p.nim, p.barcode, s.user); } },
  lunas: { auth: 'p', lock: true, run: function (p, s) { return lunas_(p.no, p.mode, s); } },
  daftarRak: { auth: 'p', run: function () { return daftarRak_(); } },
  isiRak: { auth: 'p', lock: true, run: function (p, s) { return isiRak_(p.rak, p.barcode, s.user); } },
  eksemplar: { auth: 'p', run: function (p) { return infoEksemplar_(p.barcode); } },
  ubahEksemplar: { auth: 'admin', lock: true, run: function (p, s) { return ubahEksemplar_(p, s.user); } },
  tambahBuku: { auth: 'admin', lock: true, run: function (p, s) { return tambahBuku_(p, s.user); } },
  antreanLabel: { auth: 'p', run: function () { return antreanLabel_(); } },
  tambahLabel: { auth: 'p', lock: true, run: function (p) { return tambahLabel_(p.barcodes || []); } },
  kosongkanLabel: { auth: 'p', lock: true, run: function () { return kosongkanLabel_(); } },
  labelData: { auth: 'p', run: function (p) { return labelData_(p.barcodes || []); } },
  rekap: { auth: 'p', run: function (p) { return rekap_(p); } },
  resetPin: { auth: 'admin', lock: true, run: function (p, s) { return resetPin_(p.nim, s.user); } },
  gantiPinPetugas: { auth: 'p', lock: true, run: function (p, s) { return gantiPinPetugas_(s.user, p.lama, p.baru); } }
};

/* ===================== Utilitas ===================== */

var _ss = null;
function ss_() {
  if (_ss) return _ss;
  var id = String(SPREADSHEET_ID || '').trim();
  var m = id.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m) id = m[1];
  if (id && id.indexOf('TEMPEL_') !== 0) {
    try { _ss = SpreadsheetApp.openById(id); }
    catch (e) { throw new Error('Spreadsheet dengan ID "' + id + '" tidak bisa dibuka. Periksa SPREADSHEET_ID di Code.gs dan pastikan akun pemilik skrip punya akses.'); }
    return _ss;
  }
  var prop = PropertiesService.getScriptProperties().getProperty('SS_ID');
  if (prop) { _ss = SpreadsheetApp.openById(prop); return _ss; }
  _ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!_ss) throw new Error('SPREADSHEET_ID belum diisi di Code.gs.');
  return _ss;
}
function tz_() { return Session.getScriptTimeZone() || 'Asia/Jakarta'; }
function fmt_(d, p) { return Utilities.formatDate(d, tz_(), p); }
function todayStr_() { return fmt_(new Date(), 'yyyy-MM-dd'); }
function dstr_(v) {
  if (v instanceof Date) return fmt_(v, 'yyyy-MM-dd');
  var s = String(v || '').trim();
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return '';
}
function toDate_(str) { return Utilities.parseDate(str, tz_(), 'yyyy-MM-dd'); }
function utc_(str) { var a = str.split('-'); return Date.UTC(+a[0], +a[1] - 1, +a[2]); }
function addDays_(str, n) { return new Date(utc_(str) + n * 864e5).toISOString().slice(0, 10); }
function diffDays_(a, b) { return Math.round((utc_(b) - utc_(a)) / 864e5); }
function dow_(str) { return new Date(utc_(str)).getUTCDay(); }
function tglIndo_(str) { if (!str) return ''; var a = str.split('-'); return +a[2] + ' ' + BULAN[+a[1] - 1] + ' ' + a[0]; }
function s_(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function norm_(v) { var s = s_(v); return /^\d+\.0+$/.test(s) ? s.replace(/\.0+$/, '') : s; }
function txt_(v) { var s = s_(v); return /^[0-9.,+\-eE]+$/.test(s) && s !== '' ? "'" + s : s; }
function isYa_(v) { return /^(ya|y|yes|true|1)$/i.test(s_(v)); }
function rupiah_(n) { return 'Rp' + Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

function tbl_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Sheet "' + name + '" tidak ditemukan. Admin perlu menjalankan setup.');
  var lr = sh.getLastRow(), lc = sh.getLastColumn();
  var head = lc ? sh.getRange(1, 1, 1, lc).getValues()[0].map(function (h) { return s_(h); }) : [];
  var rows = lr > 1 ? sh.getRange(2, 1, lr - 1, lc).getValues() : [];
  var idx = {};
  head.forEach(function (h, i) { idx[h] = i; });
  return {
    sh: sh, head: head, idx: idx, rows: rows,
    c: function (h) { if (!(h in idx)) throw new Error('Kolom "' + h + '" tidak ada di sheet ' + name + '. Jalankan setup.'); return idx[h]; },
    g: function (row, h) { return h in idx ? row[idx[h]] : ''; },
    set: function (i, obj) {
      var self = this;
      Object.keys(obj).forEach(function (h) {
        var v = obj[h];
        self.sh.getRange(i + 2, self.c(h) + 1).setValue(v);
        self.rows[i][self.c(h)] = v;
      });
    },
    add: function (obj) {
      var arr = head.map(function (h) { return h in obj ? obj[h] : ''; });
      this.sh.appendRow(arr);
      this.rows.push(arr);
      return this.rows.length - 1;
    },
    find: function (h, val) {
      var c = this.c(h), v = norm_(val);
      for (var i = 0; i < this.rows.length; i++) if (norm_(this.rows[i][c]) === v) return i;
      return -1;
    }
  };
}

var _settings = null;
function settings_() {
  if (_settings) return _settings;
  var sh = ss_().getSheetByName(SH.SET);
  var map = {};
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) { map[s_(r[0])] = r[1]; });
  var out = {};
  SETTINGS.forEach(function (s) { var v = map[s[1]]; out[s[0]] = (v === '' || v === undefined || v === null) ? s[2] : v; });
  ['lama', 'maks', 'maksPanjang', 'denda', 'batasDenda', 'batasAmbil', 'nomor', 'maksPesan', 'jeda'].forEach(function (k) { out[k] = Number(out[k]) || 0; });
  _settings = out;
  return out;
}
function setSetting_(key, value) {
  var label = SETTINGS.filter(function (s) { return s[0] === key; })[0][1];
  var sh = ss_().getSheetByName(SH.SET);
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) if (s_(vals[i][0]) === label) { sh.getRange(i + 2, 2).setValue(value); _settings = null; return; }
  sh.appendRow([label, value, '']); _settings = null;
}

function log_(user, aksi, detail) {
  try { ss_().getSheetByName(SH.LOG).appendRow([new Date(), user, aksi, detail]); } catch (e) { /* log tidak wajib */ }
}

function hash_(text) {
  var salt = PropertiesService.getScriptProperties().getProperty('SALT');
  if (!salt) { salt = Utilities.getUuid(); PropertiesService.getScriptProperties().setProperty('SALT', salt); }
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + text, Utilities.Charset.UTF_8);
  return 'h:' + bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}

function newSess_(obj) {
  var token = Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put('S:' + token, JSON.stringify(obj), 21600);
  return token;
}
function getSess_(token) {
  var v = CacheService.getScriptCache().get('S:' + token);
  return v ? JSON.parse(v) : null;
}
function logout_() { return true; }

function cekGagal_(key) {
  var c = CacheService.getScriptCache(), n = Number(c.get('F:' + key) || 0);
  if (n >= 5) throw new Error('Terlalu banyak percobaan salah. Coba lagi 15 menit lagi.');
  return n;
}
function catatGagal_(key, n) { CacheService.getScriptCache().put('F:' + key, String(n + 1), 900); }

function holiday_() {
  var set = {};
  try { tbl_(SH.LIB).rows.forEach(function (r) { var d = dstr_(r[0]); if (d) set[d] = true; }); } catch (e) { /* opsional */ }
  return set;
}
function jatuhTempo_(fromStr, days) {
  var s = settings_(), lib = holiday_();
  var d = addDays_(fromStr, days), guard = 0;
  while ((lib[d] || (isYa_(s.minggu) && dow_(d) === 0)) && guard++ < 60) d = addDays_(d, 1);
  return d;
}

/* ===================== Anggota ===================== */

function member_(t, nim) {
  var i = t.find('NIM/NIP', nim);
  if (i < 0) return null;
  var r = t.rows[i];
  return {
    i: i, nim: norm_(t.g(r, 'NIM/NIP')), nama: s_(t.g(r, 'Nama')), prodi: s_(t.g(r, 'Prodi/Unit')),
    jenis: s_(t.g(r, 'Jenis Anggota')) || 'Mahasiswa', status: s_(t.g(r, 'Status')) || 'Aktif',
    berlaku: dstr_(t.g(r, 'Berlaku Sampai')), email: s_(t.g(r, 'Email')), pin: s_(t.g(r, 'PIN (terenkripsi)'))
  };
}
function defaultPin_(nim) { var d = String(nim).replace(/\D/g, ''); return d.slice(-6); }
function cleanNim_(nim) { var n = norm_(nim).replace(/\s+/g, ''); if (!n) throw new Error('NIM belum diisi.'); return n; }

function cekNim_(nim) {
  nim = cleanNim_(nim);
  var m = member_(tbl_(SH.ANG), nim);
  if (!m) throw new Error('NIM ' + nim + ' belum terdaftar. Silakan hubungi petugas perpustakaan.');
  return { nim: m.nim, nama: m.nama, prodi: m.prodi, status: m.status };
}

function presensi_(nim, keperluan) {
  nim = cleanNim_(nim);
  var m = member_(tbl_(SH.ANG), nim);
  if (!m) throw new Error('NIM ' + nim + ' belum terdaftar. Silakan hubungi petugas perpustakaan.');
  var s = settings_(), now = new Date(), today = todayStr_(), year = today.slice(0, 4);
  var t = tbl_(SH.KUN), cN = t.c('NIM/NIP'), cW = t.c('Waktu'), cT = t.c('Tanggal');
  var tahunIni = 0, total = 0, last = null;
  t.rows.forEach(function (r) {
    if (norm_(r[cN]) !== nim) return;
    total++;
    if (dstr_(r[cT]).slice(0, 4) === year) tahunIni++;
    if (r[cW] instanceof Date) last = r[cW];
  });
  if (last && (now - last) < s.jeda * 60000) {
    return { nama: m.nama, prodi: m.prodi, sudah: true, tahunIni: tahunIni, total: total, jam: fmt_(last, 'HH:mm') };
  }
  t.add({ 'Waktu': now, 'Tanggal': toDate_(today), 'Hari': HARI[dow_(today)], 'NIM/NIP': txt_(nim), 'Nama': m.nama,
    'Prodi/Unit': m.prodi, 'Keperluan': s_(keperluan) || 'Membaca' });
  return { nama: m.nama, prodi: m.prodi, sudah: false, tahunIni: tahunIni + 1, total: total + 1, jam: fmt_(now, 'HH:mm') };
}

function loginAnggota_(nim, pin) {
  nim = cleanNim_(nim);
  var n = cekGagal_('m' + nim);
  var m = member_(tbl_(SH.ANG), nim);
  var ok = m && (m.pin ? hash_(m.nim + '|' + s_(pin)) === m.pin : s_(pin) === defaultPin_(m.nim));
  if (!ok) { catatGagal_('m' + nim, n); throw new Error('NIM atau PIN salah.'); }
  CacheService.getScriptCache().remove('F:m' + nim);
  return { token: newSess_({ t: 'm', id: m.nim }), nama: m.nama, nim: m.nim, harusGanti: !m.pin };
}

function gantiPin_(nim, lama, baru) {
  var t = tbl_(SH.ANG), m = member_(t, nim);
  if (!m) throw new Error('Akun tidak ditemukan.');
  var ok = m.pin ? hash_(m.nim + '|' + s_(lama)) === m.pin : s_(lama) === defaultPin_(m.nim);
  if (!ok) throw new Error('PIN lama salah.');
  baru = s_(baru);
  if (!/^\d{6}$/.test(baru)) throw new Error('PIN baru harus 6 digit angka.');
  if (baru === defaultPin_(m.nim)) throw new Error('PIN baru tidak boleh sama dengan 6 digit terakhir NIM.');
  if (/^(\d)\1{5}$/.test(baru) || baru === '123456' || baru === '654321') throw new Error('PIN terlalu mudah ditebak. Pilih kombinasi lain.');
  t.set(m.i, { 'PIN (terenkripsi)': hash_(m.nim + '|' + baru) });
  log_(m.nim, 'Ganti PIN', m.nama);
  return true;
}

function resetPin_(nim, user) {
  nim = cleanNim_(nim);
  var t = tbl_(SH.ANG), m = member_(t, nim);
  if (!m) throw new Error('NIM ' + nim + ' tidak ditemukan.');
  t.set(m.i, { 'PIN (terenkripsi)': '' });
  log_(user, 'Reset PIN', m.nim + ' ' + m.nama);
  return { nama: m.nama, pin: defaultPin_(m.nim) };
}

function loginPetugas_(user, pin) {
  user = s_(user).toLowerCase();
  var n = cekGagal_('p' + user);
  var t = tbl_(SH.PTG), found = null;
  t.rows.forEach(function (r) {
    if (s_(t.g(r, 'Username')).toLowerCase() === user && s_(t.g(r, 'PIN')) === s_(pin) && s_(t.g(r, 'Aktif')) !== 'Tidak') found = r;
  });
  if (!found || !user) { catatGagal_('p' + user, n); throw new Error('Username atau PIN salah.'); }
  var role = s_(t.g(found, 'Peran')) === 'Admin' ? 'Admin' : 'Petugas';
  log_(user, 'Login petugas', role);
  return { token: newSess_({ t: 'p', user: user, role: role, nama: s_(t.g(found, 'Nama')) }), nama: s_(t.g(found, 'Nama')) || user, peran: role };
}

function gantiPinPetugas_(user, lama, baru) {
  var t = tbl_(SH.PTG);
  for (var i = 0; i < t.rows.length; i++) {
    if (s_(t.g(t.rows[i], 'Username')).toLowerCase() === user) {
      if (s_(t.g(t.rows[i], 'PIN')) !== s_(lama)) throw new Error('PIN lama salah.');
      if (s_(baru).length < 6) throw new Error('PIN baru minimal 6 karakter.');
      t.set(i, { 'PIN': "'" + s_(baru) });
      log_(user, 'Ganti PIN petugas', '');
      return true;
    }
  }
  throw new Error('Akun petugas tidak ditemukan.');
}

/* ===================== Katalog ===================== */

function infoPublik_() {
  var s = settings_();
  return { nama: s.nama, instansi: s.instansi, mandiri: isYa_(s.mandiri), lama: s.lama, maks: s.maks, v: APP_VERSION };
}

function stokMap_(e) {
  var cId = e.c('ID_Buku'), cS = e.c('Status'), cR = e.c('Lokasi Rak');
  var map = {};
  e.rows.forEach(function (r) {
    var id = s_(r[cId]); if (!id) return;
    var st = s_(r[cS]) || 'Tersedia';
    if (st === 'Dihapus') return;
    var o = map[id] || (map[id] = { total: 0, tersedia: 0, rak: {} });
    o.total++;
    if (st === 'Tersedia' || st === 'Baca di tempat') { o.tersedia++; if (s_(r[cR])) o.rak[s_(r[cR])] = true; }
    else if (s_(r[cR])) o.rak[s_(r[cR])] = o.rak[s_(r[cR])] || false;
  });
  return map;
}

function bukuObj_(b, r, st) {
  st = st || { total: 0, tersedia: 0, rak: {} };
  var rakTersedia = Object.keys(st.rak).filter(function (k) { return st.rak[k]; });
  return {
    id: s_(b.g(r, 'ID_Buku')), judul: s_(b.g(r, 'Judul')), pengarang: s_(b.g(r, 'Pengarang')), penerbit: s_(b.g(r, 'Penerbit')),
    tahun: s_(b.g(r, 'Tahun')), call: s_(b.g(r, 'No. Panggil')), jenis: s_(b.g(r, 'Jenis Koleksi')), isbn: s_(b.g(r, 'ISBN')),
    subjek: s_(b.g(r, 'Subjek')), kelas: s_(b.g(r, 'Kelas DDC')),
    total: st.total, tersedia: st.tersedia, rak: rakTersedia.length ? rakTersedia : Object.keys(st.rak)
  };
}

function cari_(p) {
  var q = s_(p.q).toLowerCase();
  var terms = q.split(/\s+/).filter(function (x) { return x; });
  if (!terms.length) throw new Error('Ketik judul, pengarang, subjek, atau ISBN.');
  var b = tbl_(SH.BUKU), st = stokMap_(tbl_(SH.EKS));
  var cols = ['ID_Buku', 'Judul', 'Pengarang', 'Subjek', 'ISBN', 'No. Panggil', 'Penerbit'].filter(function (h) { return h in b.idx; }).map(function (h) { return b.idx[h]; });
  var cJ = b.c('Judul'), cK = b.idx['Jenis Koleksi'];
  var qDigits = q.replace(/[^0-9x]/g, '');
  var hits = [];
  b.rows.forEach(function (r) {
    if (p.jenis && cK !== undefined && s_(r[cK]) !== p.jenis) return;
    var hay = cols.map(function (c) { return s_(r[c]); }).join(' | ').toLowerCase();
    var ok = terms.every(function (t) { return hay.indexOf(t) >= 0; });
    if (!ok && qDigits.length >= 10 && s_(r[b.idx['ISBN']]).toLowerCase() === qDigits) ok = true;
    if (!ok) return;
    var id = s_(r[b.c('ID_Buku')]), s = st[id];
    if (p.tersedia && !(s && s.tersedia > 0)) return;
    var judul = s_(r[cJ]).toLowerCase(), score = 0;
    if (judul.indexOf(q) === 0) score += 3; else if (judul.indexOf(q) >= 0) score += 2;
    if (s && s.tersedia) score += 1;
    hits.push({ score: score, r: r, id: id });
  });
  hits.sort(function (a, c) { return c.score - a.score; });
  return { jumlah: hits.length, hasil: hits.slice(0, 60).map(function (h) { return bukuObj_(b, h.r, st[h.id]); }) };
}

function detailBuku_(id) {
  var b = tbl_(SH.BUKU), i = b.find('ID_Buku', id);
  if (i < 0) throw new Error('Buku tidak ditemukan.');
  var e = tbl_(SH.EKS), pj = tbl_(SH.PJM), rs = tbl_(SH.RES);
  var due = {};
  pj.rows.forEach(function (r) { if (s_(pj.g(r, 'Status')) === 'Dipinjam') due[norm_(pj.g(r, 'Barcode'))] = dstr_(pj.g(r, 'Jatuh Tempo')); });
  var eks = [];
  e.rows.forEach(function (r) {
    if (s_(e.g(r, 'ID_Buku')) !== s_(id)) return;
    var st = s_(e.g(r, 'Status')) || 'Tersedia';
    if (st === 'Dihapus') return;
    var bc = norm_(e.g(r, 'Barcode'));
    eks.push({ barcode: bc, salinan: s_(e.g(r, 'Salinan')), rak: s_(e.g(r, 'Lokasi Rak')), status: st,
      kondisi: s_(e.g(r, 'Kondisi')), kembali: due[bc] ? tglIndo_(due[bc]) : '' });
  });
  var antre = rs.rows.filter(function (r) { return s_(rs.g(r, 'ID_Buku')) === s_(id) && /Menunggu|Siap diambil/.test(s_(rs.g(r, 'Status'))); }).length;
  var o = bukuObj_(b, b.rows[i], stokMap_(e)[s_(id)]);
  o.kota = s_(b.g(b.rows[i], 'Kota Terbit')); o.edisi = s_(b.g(b.rows[i], 'Edisi/Cetakan')); o.kolasi = s_(b.g(b.rows[i], 'Kolasi'));
  o.bahasa = s_(b.g(b.rows[i], 'Bahasa')); o.eksemplar = eks; o.antrean = antre;
  try {
    var ab = ss_().getSheetByName('Abstrak');
    if (ab) {
      var f = ab.getRange('A:A').createTextFinder(s_(id)).matchEntireCell(true).findNext();
      if (f) o.abstrak = String(ab.getRange(f.getRow(), 3).getValue()).slice(0, 3000);
    }
  } catch (err) { /* abstrak opsional */ }
  return o;
}

function populer_() {
  var pj = tbl_(SH.PJM), from = addDays_(todayStr_(), -365), cnt = {}, jud = {};
  pj.rows.forEach(function (r) {
    if (dstr_(pj.g(r, 'Tgl Pinjam')) < from) return;
    var id = s_(pj.g(r, 'ID_Buku')); if (!id) return;
    cnt[id] = (cnt[id] || 0) + 1; jud[id] = s_(pj.g(r, 'Judul'));
  });
  return Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }).slice(0, 10)
    .map(function (id) { return { id: id, judul: jud[id], kali: cnt[id] }; });
}

/* ===================== Akun mahasiswa ===================== */

function pinjamanAktif_(pj, nim) {
  var today = todayStr_(), s = settings_(), out = [];
  pj.rows.forEach(function (r, i) {
    if (norm_(pj.g(r, 'NIM/NIP')) !== nim || s_(pj.g(r, 'Status')) !== 'Dipinjam') return;
    var due = dstr_(pj.g(r, 'Jatuh Tempo')), late = Math.max(0, diffDays_(due, today));
    out.push({ i: i, no: s_(pj.g(r, 'No. Transaksi')), barcode: norm_(pj.g(r, 'Barcode')), id: s_(pj.g(r, 'ID_Buku')),
      judul: s_(pj.g(r, 'Judul')), pinjam: tglIndo_(dstr_(pj.g(r, 'Tgl Pinjam'))), tempo: tglIndo_(due), tempoIso: due,
      terlambat: late, denda: late * s.denda, panjang: Number(pj.g(r, 'Perpanjangan')) || 0 });
  });
  return out;
}

function dendaBelumLunas_(pj, nim) {
  var list = [];
  pj.rows.forEach(function (r) {
    if (norm_(pj.g(r, 'NIM/NIP')) === nim && s_(pj.g(r, 'Status Denda')) === 'Belum lunas')
      list.push({ no: s_(pj.g(r, 'No. Transaksi')), judul: s_(pj.g(r, 'Judul')), denda: Number(pj.g(r, 'Denda (Rp)')) || 0 });
  });
  return list;
}

function akun_(nim) {
  var m = member_(tbl_(SH.ANG), nim);
  if (!m) throw new Error('SESI_HABIS');
  var pj = tbl_(SH.PJM), rs = tbl_(SH.RES), kn = tbl_(SH.KUN), s = settings_();
  var aktif = pinjamanAktif_(pj, nim), today = todayStr_();
  var riwayat = [], totalPinjam = 0;
  pj.rows.forEach(function (r) {
    if (norm_(pj.g(r, 'NIM/NIP')) !== nim) return;
    totalPinjam++;
    if (s_(pj.g(r, 'Status')) === 'Kembali') riwayat.push({ judul: s_(pj.g(r, 'Judul')), pinjam: tglIndo_(dstr_(pj.g(r, 'Tgl Pinjam'))),
      kembali: tglIndo_(dstr_(pj.g(r, 'Tgl Kembali'))), denda: Number(pj.g(r, 'Denda (Rp)')) || 0, statusDenda: s_(pj.g(r, 'Status Denda')) });
  });
  var pesan = [];
  rs.rows.forEach(function (r) {
    if (norm_(rs.g(r, 'NIM/NIP')) !== nim) return;
    var st = s_(rs.g(r, 'Status'));
    if (!/Menunggu|Siap diambil/.test(st)) return;
    pesan.push({ rid: s_(rs.g(r, 'ID Reservasi')), id: s_(rs.g(r, 'ID_Buku')), judul: s_(rs.g(r, 'Judul')), status: st,
      batas: tglIndo_(dstr_(rs.g(r, 'Batas Ambil'))), urutan: st === 'Menunggu' ? antreanKe_(rs, r) : 0 });
  });
  var kunj = 0, kunjBulan = 0, terakhir = '';
  kn.rows.forEach(function (r) {
    if (norm_(kn.g(r, 'NIM/NIP')) !== nim) return;
    kunj++; var d = dstr_(kn.g(r, 'Tanggal'));
    if (d.slice(0, 7) === today.slice(0, 7)) kunjBulan++;
    if (d > terakhir) terakhir = d;
  });
  var denda = dendaBelumLunas_(pj, nim);
  var totalDenda = denda.reduce(function (a, x) { return a + x.denda; }, 0) + aktif.reduce(function (a, x) { return a + x.denda; }, 0);
  aktif.forEach(function (x) {
    var waiting = rs.rows.some(function (r) { return s_(rs.g(r, 'ID_Buku')) === x.id && s_(rs.g(r, 'Status')) === 'Menunggu'; });
    x.bisaPanjang = !x.terlambat && x.panjang < s.maksPanjang && !waiting;
    x.alasan = x.terlambat ? 'Sudah terlambat' : x.panjang >= s.maksPanjang ? 'Batas perpanjangan habis' : waiting ? 'Ada yang mengantre' : '';
    delete x.i;
  });
  return {
    profil: { nim: m.nim, nama: m.nama, prodi: m.prodi, jenis: m.jenis, status: m.status, berlaku: tglIndo_(m.berlaku), pinDefault: !m.pin },
    aktif: aktif, riwayat: riwayat.reverse().slice(0, 30), pesan: pesan, denda: denda,
    statistik: { kunjungan: kunj, kunjunganBulanIni: kunjBulan, terakhir: tglIndo_(terakhir), totalPinjam: totalPinjam, totalDenda: totalDenda },
    aturan: { lama: s.lama, maks: s.maks, maksPanjang: s.maksPanjang, denda: s.denda, mandiri: isYa_(s.mandiri), maksPesan: s.maksPesan }
  };
}

function antreanKe_(rs, row) {
  var id = s_(rs.g(row, 'ID_Buku')), mine = s_(rs.g(row, 'ID Reservasi')), n = 0;
  for (var i = 0; i < rs.rows.length; i++) {
    var r = rs.rows[i];
    if (s_(rs.g(r, 'ID_Buku')) === id && s_(rs.g(r, 'Status')) === 'Menunggu') { n++; if (s_(rs.g(r, 'ID Reservasi')) === mine) return n; }
  }
  return n;
}

/* ===================== Sirkulasi ===================== */

function kelayakan_(m, pj) {
  var s = settings_(), today = todayStr_(), alasan = [];
  if (!m) return ['NIM tidak terdaftar'];
  if (!/^aktif$/i.test(m.status)) alasan.push('Status anggota: ' + m.status);
  if (m.berlaku && m.berlaku < today) alasan.push('Keanggotaan berakhir ' + tglIndo_(m.berlaku));
  var aktif = pinjamanAktif_(pj, m.nim);
  var telat = aktif.filter(function (x) { return x.terlambat > 0; });
  if (telat.length) alasan.push(telat.length + ' buku terlambat dikembalikan');
  var denda = dendaBelumLunas_(pj, m.nim).reduce(function (a, x) { return a + x.denda; }, 0);
  if (s.batasDenda > 0 && denda >= s.batasDenda) alasan.push('Denda belum lunas ' + rupiah_(denda));
  if (aktif.length >= s.maks) alasan.push('Sudah meminjam ' + aktif.length + ' dari maksimal ' + s.maks + ' buku');
  return alasan;
}

function kartuAnggota_(nim) {
  nim = cleanNim_(nim);
  var m = member_(tbl_(SH.ANG), nim);
  if (!m) throw new Error('NIM ' + nim + ' belum terdaftar. Tambahkan dulu di sheet Anggota.');
  var pj = tbl_(SH.PJM), rs = tbl_(SH.RES);
  var pesan = rs.rows.filter(function (r) { return norm_(rs.g(r, 'NIM/NIP')) === nim && s_(rs.g(r, 'Status')) === 'Siap diambil'; })
    .map(function (r) { return { judul: s_(rs.g(r, 'Judul')), barcode: norm_(rs.g(r, 'Barcode Disiapkan')), batas: tglIndo_(dstr_(rs.g(r, 'Batas Ambil'))) }; });
  var aktif = pinjamanAktif_(pj, nim); aktif.forEach(function (x) { delete x.i; });
  return { nim: m.nim, nama: m.nama, prodi: m.prodi, jenis: m.jenis, status: m.status, alasan: kelayakan_(m, pj),
    aktif: aktif, denda: dendaBelumLunas_(pj, nim), pesan: pesan };
}

function noTransaksi_(pj, prefix, col) {
  var p = prefix + fmt_(new Date(), 'yyMMdd'), n = 0, c = pj.c(col || 'No. Transaksi');
  pj.rows.forEach(function (r) { var v = s_(r[c]); if (v.indexOf(p) === 0) n = Math.max(n, Number(v.slice(p.length)) || 0); });
  return p + ('000' + (n + 1)).slice(-4);
}

function pinjam_(nim, barcode, petugas) {
  nim = cleanNim_(nim);
  var bc = norm_(barcode);
  if (!bc) throw new Error('Barcode buku belum di-scan.');
  var ang = tbl_(SH.ANG), m = member_(ang, nim);
  if (!m) throw new Error('NIM ' + nim + ' belum terdaftar.');
  var pj = tbl_(SH.PJM), e = tbl_(SH.EKS), rs = tbl_(SH.RES), s = settings_();
  var alasan = kelayakan_(m, pj);
  if (alasan.length) throw new Error('Tidak dapat meminjam: ' + alasan.join('; ') + '.');
  var ei = e.find('Barcode', bc);
  if (ei < 0) throw new Error('Barcode ' + bc + ' tidak ditemukan di sheet Eksemplar.');
  var er = e.rows[ei], st = s_(e.g(er, 'Status')) || 'Tersedia', idb = s_(e.g(er, 'ID_Buku'));
  var hold = -1;
  if (st === 'Dipesan') {
    for (var k = 0; k < rs.rows.length; k++) {
      var r = rs.rows[k];
      if (norm_(rs.g(r, 'Barcode Disiapkan')) === bc && s_(rs.g(r, 'Status')) === 'Siap diambil') { hold = k; break; }
    }
    if (hold < 0 || norm_(rs.g(rs.rows[hold], 'NIM/NIP')) !== nim) throw new Error('Buku ini sedang disiapkan untuk pemesan lain.');
  } else if (st !== 'Tersedia') {
    var pesanStatus = { 'Dipinjam': 'sedang dipinjam. Kembalikan dulu sebelum dipinjam lagi', 'Baca di tempat': 'hanya untuk dibaca di tempat',
      'Hilang': 'tercatat hilang', 'Dihapus': 'sudah dihapus dari koleksi', 'Perbaikan': 'sedang diperbaiki' };
    throw new Error('Buku ' + bc + ' ' + (pesanStatus[st] || ('berstatus ' + st)) + '.');
  }
  var today = todayStr_(), due = jatuhTempo_(today, s.lama), judul = s_(e.g(er, 'Judul'));
  var no = noTransaksi_(pj, 'PJ');
  pj.add({ 'No. Transaksi': no, 'NIM/NIP': txt_(nim), 'Nama': m.nama, 'Barcode': txt_(bc), 'ID_Buku': idb, 'Judul': judul,
    'Tgl Pinjam': new Date(), 'Jatuh Tempo': toDate_(due), 'Perpanjangan': 0, 'Status': 'Dipinjam', 'Petugas Pinjam': petugas });
  e.set(ei, { 'Status': 'Dipinjam' });
  if (hold >= 0) rs.set(hold, { 'Status': 'Selesai' });
  log_(petugas, 'Pinjam', no + ' ' + nim + ' ' + bc);
  return { no: no, nama: m.nama, judul: judul, barcode: bc, tempo: tglIndo_(due), rak: s_(e.g(er, 'Lokasi Rak')) };
}

function kembali_(barcode, kondisi, petugas) {
  var bc = norm_(barcode);
  if (!bc) throw new Error('Barcode buku belum di-scan.');
  var pj = tbl_(SH.PJM), e = tbl_(SH.EKS), s = settings_();
  var pi = -1;
  for (var i = pj.rows.length - 1; i >= 0; i--) {
    if (norm_(pj.g(pj.rows[i], 'Barcode')) === bc && s_(pj.g(pj.rows[i], 'Status')) === 'Dipinjam') { pi = i; break; }
  }
  if (pi < 0) throw new Error('Tidak ada peminjaman aktif untuk barcode ' + bc + '. Periksa apakah buku ini memang dipinjam.');
  var r = pj.rows[pi], today = todayStr_(), due = dstr_(pj.g(r, 'Jatuh Tempo'));
  var late = Math.max(0, diffDays_(due, today)), denda = late * s.denda;
  kondisi = kondisi || 'Baik';
  pj.set(pi, { 'Tgl Kembali': new Date(), 'Terlambat (hari)': late, 'Denda (Rp)': denda, 'Status Denda': denda > 0 ? 'Belum lunas' : '',
    'Status': 'Kembali', 'Kondisi Kembali': kondisi, 'Petugas Kembali': petugas });
  var ei = e.find('Barcode', bc), untuk = null;
  if (ei >= 0) {
    if (kondisi === 'Rusak berat') e.set(ei, { 'Status': 'Perbaikan', 'Kondisi': kondisi });
    else {
      if (kondisi !== 'Baik') e.set(ei, { 'Kondisi': kondisi });
      untuk = lepasEksemplar_(e, ei);
    }
  }
  log_(petugas, 'Kembali', s_(pj.g(r, 'No. Transaksi')) + ' ' + bc + (denda ? ' denda ' + denda : ''));
  return { nama: s_(pj.g(r, 'Nama')), nim: norm_(pj.g(r, 'NIM/NIP')), judul: s_(pj.g(r, 'Judul')), barcode: bc, terlambat: late,
    denda: denda, dendaTeks: rupiah_(denda), rak: ei >= 0 ? s_(e.g(e.rows[ei], 'Lokasi Rak')) : '', untuk: untuk };
}

// Eksemplar kembali tersedia: berikan ke antrean booking pertama bila ada.
function lepasEksemplar_(e, ei) {
  var rs = tbl_(SH.RES), idb = s_(e.g(e.rows[ei], 'ID_Buku')), s = settings_();
  for (var k = 0; k < rs.rows.length; k++) {
    var r = rs.rows[k];
    if (s_(rs.g(r, 'ID_Buku')) === idb && s_(rs.g(r, 'Status')) === 'Menunggu') {
      var batas = addDays_(todayStr_(), s.batasAmbil);
      rs.set(k, { 'Status': 'Siap diambil', 'Barcode Disiapkan': txt_(norm_(e.g(e.rows[ei], 'Barcode'))), 'Batas Ambil': toDate_(batas) });
      e.set(ei, { 'Status': 'Dipesan' });
      return { nama: s_(rs.g(r, 'Nama')), nim: norm_(rs.g(r, 'NIM/NIP')), batas: tglIndo_(batas) };
    }
  }
  e.set(ei, { 'Status': 'Tersedia' });
  return null;
}

function perpanjang_(nim, barcode, oleh) {
  nim = cleanNim_(nim);
  var bc = norm_(barcode), pj = tbl_(SH.PJM), rs = tbl_(SH.RES), s = settings_();
  var pi = -1;
  for (var i = pj.rows.length - 1; i >= 0; i--) {
    var r = pj.rows[i];
    if (norm_(pj.g(r, 'Barcode')) === bc && s_(pj.g(r, 'Status')) === 'Dipinjam' && norm_(pj.g(r, 'NIM/NIP')) === nim) { pi = i; break; }
  }
  if (pi < 0) throw new Error('Peminjaman tidak ditemukan.');
  var row = pj.rows[pi], due = dstr_(pj.g(row, 'Jatuh Tempo')), today = todayStr_();
  var n = Number(pj.g(row, 'Perpanjangan')) || 0;
  if (diffDays_(due, today) > 0) throw new Error('Buku sudah terlambat. Kembalikan ke perpustakaan dan selesaikan denda.');
  if (n >= s.maksPanjang) throw new Error('Batas perpanjangan (' + s.maksPanjang + ' kali) sudah habis.');
  var idb = s_(pj.g(row, 'ID_Buku'));
  if (rs.rows.some(function (r) { return s_(rs.g(r, 'ID_Buku')) === idb && s_(rs.g(r, 'Status')) === 'Menunggu'; }))
    throw new Error('Tidak bisa diperpanjang karena ada anggota lain yang mengantre buku ini.');
  var baru = jatuhTempo_(due, s.lama);
  pj.set(pi, { 'Jatuh Tempo': toDate_(baru), 'Perpanjangan': n + 1 });
  log_(oleh, 'Perpanjang', s_(pj.g(row, 'No. Transaksi')) + ' sampai ' + baru);
  return { judul: s_(pj.g(row, 'Judul')), tempo: tglIndo_(baru) };
}

function lunas_(no, mode, sess) {
  mode = mode === 'Dibebaskan' ? 'Dibebaskan' : 'Lunas';
  if (mode === 'Dibebaskan' && sess.role !== 'Admin') throw new Error('Hanya admin yang boleh membebaskan denda.');
  var pj = tbl_(SH.PJM), i = pj.find('No. Transaksi', no);
  if (i < 0) throw new Error('Transaksi tidak ditemukan.');
  pj.set(i, { 'Status Denda': mode });
  log_(sess.user, 'Denda ' + mode, no + ' ' + pj.g(pj.rows[i], 'Denda (Rp)'));
  return true;
}

/* ===================== Booking / reservasi ===================== */

function pesan_(nim, id) {
  var m = member_(tbl_(SH.ANG), nim);
  if (!m) throw new Error('SESI_HABIS');
  if (!/^aktif$/i.test(m.status)) throw new Error('Status keanggotaan ' + m.status + '. Hubungi petugas.');
  var b = tbl_(SH.BUKU), bi = b.find('ID_Buku', id);
  if (bi < 0) throw new Error('Buku tidak ditemukan.');
  var rs = tbl_(SH.RES), e = tbl_(SH.EKS), pj = tbl_(SH.PJM), s = settings_();
  var aktifPesan = rs.rows.filter(function (r) { return norm_(rs.g(r, 'NIM/NIP')) === nim && /Menunggu|Siap diambil/.test(s_(rs.g(r, 'Status'))); });
  if (aktifPesan.some(function (r) { return s_(rs.g(r, 'ID_Buku')) === s_(id); })) throw new Error('Anda sudah memesan buku ini.');
  if (aktifPesan.length >= s.maksPesan) throw new Error('Maksimal ' + s.maksPesan + ' booking aktif. Batalkan salah satu dulu.');
  if (pinjamanAktif_(pj, nim).some(function (x) { return x.id === s_(id); })) throw new Error('Anda sedang meminjam buku ini.');
  var cand = -1, punya = 0;
  e.rows.forEach(function (r, i) {
    if (s_(e.g(r, 'ID_Buku')) !== s_(id)) return;
    var st = s_(e.g(r, 'Status')) || 'Tersedia';
    if (/Dihapus|Hilang|Baca di tempat/.test(st)) return;
    punya++;
    if (st === 'Tersedia' && cand < 0) cand = i;
  });
  if (!punya) throw new Error('Buku ini tidak bisa dipesan (tidak ada eksemplar yang dapat dipinjam).');
  var rid = noTransaksi_(rs, 'RS', 'ID Reservasi');
  var judul = s_(b.g(b.rows[bi], 'Judul')), obj = { 'ID Reservasi': rid, 'NIM/NIP': txt_(nim), 'Nama': m.nama, 'ID_Buku': s_(id), 'Judul': judul, 'Tgl Pesan': new Date() };
  var hasil;
  if (cand >= 0) {
    var batas = addDays_(todayStr_(), s.batasAmbil);
    obj['Status'] = 'Siap diambil'; obj['Barcode Disiapkan'] = txt_(norm_(e.g(e.rows[cand], 'Barcode'))); obj['Batas Ambil'] = toDate_(batas);
    e.set(cand, { 'Status': 'Dipesan' });
    hasil = { status: 'Siap diambil', batas: tglIndo_(batas), rak: s_(e.g(e.rows[cand], 'Lokasi Rak')) };
  } else {
    obj['Status'] = 'Menunggu';
    var urut = rs.rows.filter(function (r) { return s_(rs.g(r, 'ID_Buku')) === s_(id) && s_(rs.g(r, 'Status')) === 'Menunggu'; }).length + 1;
    hasil = { status: 'Menunggu', urutan: urut };
  }
  rs.add(obj);
  log_(nim, 'Booking', rid + ' ' + id + ' ' + obj['Status']);
  hasil.rid = rid; hasil.judul = judul;
  return hasil;
}

function batalPesan_(nim, rid) {
  var rs = tbl_(SH.RES), i = rs.find('ID Reservasi', rid);
  if (i < 0 || norm_(rs.g(rs.rows[i], 'NIM/NIP')) !== nim) throw new Error('Booking tidak ditemukan.');
  var st = s_(rs.g(rs.rows[i], 'Status'));
  if (!/Menunggu|Siap diambil/.test(st)) throw new Error('Booking ini sudah tidak aktif.');
  rs.set(i, { 'Status': 'Dibatalkan' });
  if (st === 'Siap diambil') {
    var e = tbl_(SH.EKS), ei = e.find('Barcode', rs.g(rs.rows[i], 'Barcode Disiapkan'));
    if (ei >= 0 && s_(e.g(e.rows[ei], 'Status')) === 'Dipesan') lepasEksemplar_(e, ei);
  }
  log_(nim, 'Batal booking', rid);
  return true;
}

/* ===================== Rak & eksemplar ===================== */

function daftarRak_() {
  var r = tbl_(SH.RAK), e = tbl_(SH.EKS), cnt = {}, cR = e.c('Lokasi Rak');
  e.rows.forEach(function (x) { var k = s_(x[cR]); if (k) cnt[k] = (cnt[k] || 0) + 1; });
  var list = r.rows.filter(function (x) { return s_(r.g(x, 'Kode Rak')); }).map(function (x) {
    var k = s_(r.g(x, 'Kode Rak'));
    return { kode: k, lokasi: s_(r.g(x, 'Ruang/Lokasi')), kelas: s_(r.g(x, 'Kelas DDC Disimpan')), jumlah: cnt[k] || 0 };
  });
  var tanpa = e.rows.filter(function (x) { return !s_(x[cR]) && s_(e.g(x, 'Status')) !== 'Dihapus'; }).length;
  return { rak: list, tanpaRak: tanpa };
}

function isiRak_(rak, barcode, user) {
  rak = s_(rak).toUpperCase();
  var bc = norm_(barcode);
  if (!rak) throw new Error('Pilih atau scan kode rak dulu.');
  if (!bc) throw new Error('Barcode buku kosong.');
  var r = tbl_(SH.RAK), ada = r.rows.some(function (x) { return s_(r.g(x, 'Kode Rak')).toUpperCase() === rak; });
  if (!ada) throw new Error('Kode rak ' + rak + ' belum ada di sheet Rak. Tambahkan dulu.');
  if (r.find('Kode Rak', bc) >= 0) throw new Error('Yang di-scan adalah label rak, bukan buku.');
  var e = tbl_(SH.EKS), ei = e.find('Barcode', bc);
  if (ei < 0) throw new Error('Barcode ' + bc + ' tidak ditemukan.');
  var lama = s_(e.g(e.rows[ei], 'Lokasi Rak'));
  if (lama !== rak) e.set(ei, { 'Lokasi Rak': rak });
  if (lama && lama !== rak) log_(user, 'Pindah rak', bc + ' ' + lama + ' -> ' + rak);
  return { barcode: bc, judul: s_(e.g(e.rows[ei], 'Judul')), call: s_(e.g(e.rows[ei], 'No. Panggil')), lama: lama, rak: rak,
    status: s_(e.g(e.rows[ei], 'Status')) };
}

function infoEksemplar_(barcode) {
  var bc = norm_(barcode), e = tbl_(SH.EKS), ei = e.find('Barcode', bc);
  if (ei < 0) throw new Error('Barcode ' + bc + ' tidak ditemukan.');
  var r = e.rows[ei], o = {};
  e.head.forEach(function (h, i) { o[h] = r[i] instanceof Date ? tglIndo_(dstr_(r[i])) : s_(r[i]); });
  o.Barcode = bc;
  var pj = tbl_(SH.PJM);
  for (var i = pj.rows.length - 1; i >= 0; i--) {
    var x = pj.rows[i];
    if (norm_(pj.g(x, 'Barcode')) === bc && s_(pj.g(x, 'Status')) === 'Dipinjam') {
      o.peminjam = norm_(pj.g(x, 'NIM/NIP')) + ' - ' + s_(pj.g(x, 'Nama')); o.tempo = tglIndo_(dstr_(pj.g(x, 'Jatuh Tempo'))); break;
    }
  }
  return o;
}

function ubahEksemplar_(p, user) {
  var bc = norm_(p.barcode), e = tbl_(SH.EKS), ei = e.find('Barcode', bc);
  if (ei < 0) throw new Error('Barcode ' + bc + ' tidak ditemukan.');
  var now = s_(e.g(e.rows[ei], 'Status')) || 'Tersedia';
  var allowed = ['Tersedia', 'Perbaikan', 'Hilang', 'Dihapus', 'Baca di tempat'];
  if (allowed.indexOf(p.status) < 0) throw new Error('Status tidak valid.');
  if (now === 'Dipinjam' && p.status !== 'Hilang') throw new Error('Buku sedang dipinjam. Proses pengembalian dulu, atau tandai Hilang.');
  if (now === 'Dipesan') throw new Error('Buku sedang disiapkan untuk booking. Selesaikan atau batalkan booking dulu.');
  var upd = { 'Status': p.status };
  if (p.kondisi) upd['Kondisi'] = p.kondisi;
  if (p.catatan) upd['Catatan'] = s_(p.catatan);
  e.set(ei, upd);
  if (p.status === 'Hilang' && now === 'Dipinjam') {
    var pj = tbl_(SH.PJM);
    for (var i = pj.rows.length - 1; i >= 0; i--) {
      if (norm_(pj.g(pj.rows[i], 'Barcode')) === bc && s_(pj.g(pj.rows[i], 'Status')) === 'Dipinjam') {
        pj.set(i, { 'Status': 'Hilang', 'Tgl Kembali': new Date(), 'Petugas Kembali': user }); break;
      }
    }
  }
  if (p.status === 'Tersedia' && now !== 'Tersedia') lepasEksemplar_(e, ei);
  log_(user, 'Ubah eksemplar', bc + ': ' + now + ' -> ' + p.status + (p.catatan ? ' (' + p.catatan + ')' : ''));
  return { barcode: bc, status: s_(e.g(e.rows[ei], 'Status')) };
}

function ddcKelas_(call) {
  var tok = s_(call).split(' ')[0];
  if (!tok) return '';
  if (/^2x/i.test(tok)) return '2X0 Islam';
  var map = { '0': '000 Karya Umum', '1': '100 Filsafat & Psikologi', '2': '200 Agama', '3': '300 Ilmu Sosial', '4': '400 Bahasa',
    '5': '500 Sains & Matematika', '6': '600 Teknologi', '7': '700 Seni & Olahraga', '8': '800 Sastra', '9': '900 Sejarah & Geografi' };
  return map[tok.charAt(0)] || 'Lainnya';
}

function tambahBuku_(p, user) {
  var b = tbl_(SH.BUKU), e = tbl_(SH.EKS), s = settings_();
  var jumlah = Math.max(1, Math.min(50, Number(p.jumlah) || 1));
  var id = s_(p.id), bi = id ? b.find('ID_Buku', id) : -1;
  var d = p.data || {};
  if (id && bi < 0) throw new Error('ID buku ' + id + ' tidak ditemukan.');
  if (!id) {
    if (!s_(d.judul)) throw new Error('Judul wajib diisi.');
    if (!s_(d.call)) throw new Error('Nomor panggil wajib diisi (contoh: 371.3 JOE k).');
    var maxN = 0, cId = b.c('ID_Buku');
    b.rows.forEach(function (r) { var m = s_(r[cId]).match(/^BK(\d+)$/); if (m) maxN = Math.max(maxN, +m[1]); });
    id = 'BK' + ('00000' + (maxN + 1)).slice(-5);
    var isbn = s_(d.isbn).replace(/[^0-9Xx]/g, '').toUpperCase();
    bi = b.add({ 'ID_Buku': id, 'Judul': s_(d.judul), 'Pengarang': s_(d.pengarang), 'Penerbit': s_(d.penerbit), 'Kota Terbit': s_(d.kota),
      'Tahun': s_(d.tahun) ? Number(d.tahun) : '', 'Edisi/Cetakan': s_(d.edisi), 'ISBN': txt_(isbn), 'Bahasa': s_(d.bahasa) || 'Indonesia',
      'Jenis Koleksi': s_(d.jenis) || 'Buku', 'No. Panggil': s_(d.call), 'Kelas DDC': ddcKelas_(d.call), 'Subjek': s_(d.subjek),
      'Jml Eksemplar (saat migrasi)': 0 });
  }
  var br = b.rows[bi], call = s_(b.g(br, 'No. Panggil')), jenis = s_(b.g(br, 'Jenis Koleksi')) || 'Buku', judul = s_(b.g(br, 'Judul'));
  var yy = fmt_(new Date(), 'yy'), awal = s_(s.awalan), nomor = s.nomor || 1;
  if (awal !== yy) { awal = yy; nomor = 1; }
  var exist = {}; e.rows.forEach(function (r) { exist[norm_(e.g(r, 'Barcode'))] = true; });
  var base;
  while (true) { base = awal + ('0000' + nomor).slice(-4); if (!exist[base + '.1']) break; nomor++; }
  var kodeLabel = s_(p.kodeLabel) || (jenis === 'Buku' ? 'B' : '');
  var codes = [];
  for (var k = 1; k <= jumlah; k++) {
    var code = base + '.' + k;
    e.add({ 'Barcode': txt_(code), 'ID_Buku': id, 'Judul': judul, 'No. Panggil': call, 'Kode Label': kodeLabel, 'Salinan': 'c.' + k,
      'Prefix Barcode': '', 'Jenis Koleksi': jenis, 'Kelas DDC': ddcKelas_(call), 'Lokasi Rak': s_(p.rak).toUpperCase(), 'Kondisi': 'Baik',
      'Status': 'Tersedia', 'Asal Barcode': 'Baru', 'Tanggal Masuk': toDate_(todayStr_()), 'Catatan': s_(p.sumber) });
    codes.push(code);
  }
  setSetting_('awalan', "'" + awal);
  setSetting_('nomor', nomor + 1);
  tambahLabel_(codes);
  log_(user, 'Tambah eksemplar', id + ' ' + codes.join(', '));
  return { id: id, judul: judul, barcodes: codes };
}

/* ===================== Label ===================== */

function antreanLabel_() {
  var sh = ss_().getSheetByName(SH.LBL), lr = sh.getLastRow();
  var codes = lr > 1 ? sh.getRange(2, 1, lr - 1, 1).getValues().map(function (r) { return norm_(r[0]); }).filter(function (x) { return x; }) : [];
  return labelData_(codes);
}
function tambahLabel_(codes) {
  var sh = ss_().getSheetByName(SH.LBL), lr = Math.max(sh.getLastRow(), 1);
  var col = lr > 1 ? sh.getRange(2, 1, lr - 1, 1).getValues() : [];
  var have = {}; col.forEach(function (r) { if (norm_(r[0])) have[norm_(r[0])] = true; });
  var q = codes.map(norm_).filter(function (c) { if (!c || have[c]) return false; have[c] = true; return true; }), added = 0;
  for (var i = 0; i < col.length && q.length; i++) {
    if (!norm_(col[i][0])) { sh.getRange(i + 2, 1).setValue(txt_(q.shift())); added++; }
  }
  while (q.length) { sh.getRange(sh.getLastRow() + 1, 1).setValue(txt_(q.shift())); added++; }
  return { ditambah: added };
}
function kosongkanLabel_() {
  var sh = ss_().getSheetByName(SH.LBL), lr = sh.getLastRow();
  if (lr > 1) sh.getRange(2, 1, lr - 1, 1).clearContent();
  return true;
}
function labelData_(codes) {
  var e = tbl_(SH.EKS), s = settings_(), idx = {};
  e.rows.forEach(function (r, i) { idx[norm_(e.g(r, 'Barcode'))] = i; });
  var out = [], missing = [];
  codes.map(norm_).forEach(function (c) {
    if (!c) return;
    if (!(c in idx)) { missing.push(c); return; }
    var r = e.rows[idx[c]];
    out.push({ barcode: c, judul: s_(e.g(r, 'Judul')), kode: s_(e.g(r, 'Kode Label')), call: s_(e.g(r, 'No. Panggil')), salinan: s_(e.g(r, 'Salinan')) });
  });
  return { nama: s.nama, instansi: s.instansi, label: out, tidakDitemukan: missing };
}

/* ===================== Rekap ===================== */

function rekap_(p) {
  var periode = p.periode || 'bulanan', today = todayStr_();
  var tahun = String(p.tahun || today.slice(0, 4)), bulan = ('0' + (p.bulan || today.slice(5, 7))).slice(-2);
  var kn = tbl_(SH.KUN), pj = tbl_(SH.PJM);
  var keys = [], labels = [], keyOf;
  if (periode === 'harian') {
    var nd = new Date(Date.UTC(+tahun, +bulan, 0)).getUTCDate();
    for (var d = 1; d <= nd; d++) { keys.push(tahun + '-' + bulan + '-' + ('0' + d).slice(-2)); labels.push(String(d)); }
    keyOf = function (s) { return s; };
  } else if (periode === 'tahunan') {
    var ys = {};
    kn.rows.forEach(function (r) { var x = dstr_(kn.g(r, 'Tanggal')).slice(0, 4); if (x) ys[x] = 1; });
    pj.rows.forEach(function (r) { var x = dstr_(pj.g(r, 'Tgl Pinjam')).slice(0, 4); if (x) ys[x] = 1; });
    ys[today.slice(0, 4)] = 1;
    keys = Object.keys(ys).sort(); labels = keys.slice();
    keyOf = function (s) { return s.slice(0, 4); };
  } else {
    for (var mth = 1; mth <= 12; mth++) { keys.push(tahun + '-' + ('0' + mth).slice(-2)); labels.push(BULAN[mth - 1]); }
    keyOf = function (s) { return s.slice(0, 7); };
  }
  var inSet = {}; keys.forEach(function (k, i) { inSet[k] = i; });
  var vis = keys.map(function () { return 0; }), loan = keys.map(function () { return 0; });
  var topBuku = {}, topVis = {}, topLoan = {}, kep = {}, prodi = {}, judul = {}, nama = {};
  kn.rows.forEach(function (r) {
    var d = dstr_(kn.g(r, 'Tanggal')); if (!d) return;
    var k = keyOf(d); if (!(k in inSet)) return;
    vis[inSet[k]]++;
    var n = norm_(kn.g(r, 'NIM/NIP')); topVis[n] = (topVis[n] || 0) + 1; nama[n] = s_(kn.g(r, 'Nama'));
    var kp = s_(kn.g(r, 'Keperluan')) || 'Lainnya'; kep[kp] = (kep[kp] || 0) + 1;
    var pr = s_(kn.g(r, 'Prodi/Unit')) || '-'; prodi[pr] = (prodi[pr] || 0) + 1;
  });
  var denda = 0, dendaLunas = 0;
  pj.rows.forEach(function (r) {
    var d = dstr_(pj.g(r, 'Tgl Pinjam')); if (!d) return;
    var k = keyOf(d); if (!(k in inSet)) return;
    loan[inSet[k]]++;
    var id = s_(pj.g(r, 'ID_Buku')); topBuku[id] = (topBuku[id] || 0) + 1; judul[id] = s_(pj.g(r, 'Judul'));
    var n = norm_(pj.g(r, 'NIM/NIP')); topLoan[n] = (topLoan[n] || 0) + 1; nama[n] = s_(pj.g(r, 'Nama'));
    var dn = Number(pj.g(r, 'Denda (Rp)')) || 0; denda += dn; if (s_(pj.g(r, 'Status Denda')) === 'Lunas') dendaLunas += dn;
  });
  function top(obj, lab, n) {
    return Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; }).slice(0, n || 10)
      .map(function (k) { return { kode: k, nama: lab ? (lab[k] || k) : k, jumlah: obj[k] }; });
  }
  var terlambat = [];
  pj.rows.forEach(function (r) {
    if (s_(pj.g(r, 'Status')) !== 'Dipinjam') return;
    var due = dstr_(pj.g(r, 'Jatuh Tempo')), late = diffDays_(due, today);
    if (late > 0) terlambat.push({ nim: norm_(pj.g(r, 'NIM/NIP')), nama: s_(pj.g(r, 'Nama')), judul: s_(pj.g(r, 'Judul')),
      barcode: norm_(pj.g(r, 'Barcode')), tempo: tglIndo_(due), hari: late });
  });
  terlambat.sort(function (a, b) { return b.hari - a.hari; });
  var sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
  return {
    periode: periode, tahun: tahun, bulan: bulan, labels: labels, kunjungan: vis, peminjaman: loan,
    total: { kunjungan: sum(vis), peminjaman: sum(loan), pengunjungUnik: Object.keys(topVis).length, denda: denda, dendaLunas: dendaLunas },
    bukuTerpopuler: top(topBuku, judul), pengunjungTeraktif: top(topVis, nama), peminjamTeraktif: top(topLoan, nama),
    keperluan: top(kep, null, 10), prodi: top(prodi, null, 15), terlambat: terlambat.slice(0, 100), jumlahTerlambat: terlambat.length
  };
}

/* ===================== Tugas harian (pemicu waktu) ===================== */

function harian() {
  var s = settings_(), today = todayStr_(), rs = tbl_(SH.RES), e = tbl_(SH.EKS), n = 0;
  rs.rows.forEach(function (r, i) {
    if (s_(rs.g(r, 'Status')) !== 'Siap diambil') return;
    var batas = dstr_(rs.g(r, 'Batas Ambil'));
    if (batas && batas < today) {
      rs.set(i, { 'Status': 'Kedaluwarsa' });
      var ei = e.find('Barcode', rs.g(r, 'Barcode Disiapkan'));
      if (ei >= 0 && s_(e.g(e.rows[ei], 'Status')) === 'Dipesan') lepasEksemplar_(e, ei);
      n++;
    }
  });
  var mails = 0;
  if (isYa_(s.email)) {
    var pj = tbl_(SH.PJM), ang = tbl_(SH.ANG), besok = addDays_(today, 1), per = {};
    pj.rows.forEach(function (r) {
      if (s_(pj.g(r, 'Status')) !== 'Dipinjam') return;
      var due = dstr_(pj.g(r, 'Jatuh Tempo'));
      if (due === besok || (due < today && diffDays_(due, today) % 3 === 1)) {
        var nim = norm_(pj.g(r, 'NIM/NIP'));
        (per[nim] = per[nim] || []).push('- ' + s_(pj.g(r, 'Judul')) + ' (jatuh tempo ' + tglIndo_(due) + ')');
      }
    });
    Object.keys(per).forEach(function (nim) {
      var m = member_(ang, nim);
      if (!m || !m.email || MailApp.getRemainingDailyQuota() < 1) return;
      MailApp.sendEmail(m.email, 'Pengingat pengembalian buku - ' + s.nama,
        'Halo ' + m.nama + ',\n\nBuku berikut perlu segera dikembalikan:\n' + per[nim].join('\n') +
        '\n\nDenda keterlambatan ' + rupiah_(s.denda) + ' per buku per hari.\n\n' + s.nama + ' ' + s.instansi);
      mails++;
    });
  }
  log_('sistem', 'Tugas harian', n + ' booking kedaluwarsa, ' + mails + ' email');
  return { kedaluwarsa: n, email: mails };
}
