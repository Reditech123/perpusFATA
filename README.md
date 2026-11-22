# Aplikasi Perpustakaan FATA

Aplikasi perpustakaan digital untuk Perpustakaan FATA UIN Raden Mas Said Surakarta: presensi dengan NIM, katalog dengan lokasi rak, akun mahasiswa (NIM + PIN), booking, peminjaman dan pengembalian dengan scanner barcode, cetak label, serta rekap.

Pembagian kerja:

- **Google Sheets** menyimpan semua data (database).
- **Google Apps Script** (`apps-script/Code.gs`) menjadi server/API.
- **GitHub Pages** (`index.html`) menampilkan aplikasi untuk mahasiswa dan petugas.

```
perpustakaan-fata/
├── index.html              ← tampilan (diterbitkan oleh GitHub Pages). Isi API_URL.
├── .nojekyll
├── README.md
└── apps-script/
    ├── Code.gs             ← server. Isi SPREADSHEET_ID.
    ├── Index.html          ← salinan index.html (opsional, jika aplikasi juga dibuka dari alamat Apps Script)
    └── appsscript.json     ← pengaturan proyek (zona waktu Jakarta, akses web app)
```

Ada **dua isian wajib**:

| File | Isian | Contoh |
|---|---|---|
| `apps-script/Code.gs` | `SPREADSHEET_ID` | `1AbC...xyz` (dari alamat spreadsheet) |
| `index.html` | `API_URL` | `https://script.google.com/macros/s/AKfy.../exec` |

---

## Langkah 1 – Siapkan spreadsheet dan ambil ID-nya

1. Buka [drive.google.com](https://drive.google.com), pilih **Baru > Upload file**, lalu unggah `Database_Perpustakaan_FATA.xlsx`.
2. Buka file tersebut, lalu pilih **File > Simpan sebagai Google Spreadsheet**.
3. Di spreadsheet baru (yang tanpa label .XLSX), salin **ID** dari alamatnya:

   ```
   https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit#gid=0
                                          └──────────── ini SPREADSHEET_ID ─────────┘
   ```

## Langkah 2 – Pasang server di Apps Script

1. Buka [script.google.com](https://script.google.com) lalu pilih **Proyek baru**. Cara lain: dari spreadsheet, pilih **Ekstensi > Apps Script**.
2. Ganti nama proyek menjadi `Perpustakaan FATA API`.
3. Hapus isi `Code.gs`, tempel isi file `apps-script/Code.gs` dari repo ini, lalu isi baris berikut:

   ```js
   var SPREADSHEET_ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789';
   ```

   Anda juga boleh menempel alamat spreadsheet utuh; ID-nya akan diambil otomatis.
4. **(Opsional)** Klik **+ > HTML**, beri nama `Index` (tanpa .html), lalu tempel isi `apps-script/Index.html`. File ini membuat aplikasi bisa dibuka langsung dari alamat Apps Script, sebagai cadangan GitHub Pages.
5. Buka **Setelan project** (ikon roda gigi), lalu atur **Zona waktu** ke **(GMT+07:00) Jakarta**.
6. Simpan dengan **Ctrl+S**.
7. Di bilah atas, pilih fungsi **cekKoneksi** lalu klik **Jalankan**. Izinkan akses jika diminta (pilih *Lanjutan > Buka … (tidak aman) > Izinkan*). Log harus menampilkan `Terhubung ke spreadsheet: …`.
8. Pilih fungsi **setup** lalu klik **Jalankan**. Setup melengkapi struktur sheet, membuat akun **admin** dengan PIN acak (lihat sheet **Petugas**), dan memasang tugas harian pukul 06.00.

## Langkah 3 – Terbitkan Web App (API)

1. Klik **Terapkan > Deployment baru**.
2. Klik ikon roda gigi, lalu pilih **Aplikasi web**.
3. **Jalankan sebagai: Saya**.
4. **Siapa yang memiliki akses: Siapa saja**. Jangan pilih "Siapa saja yang memiliki Akun Google", karena GitHub Pages tidak akan bisa terhubung.
5. Klik **Terapkan**, lalu salin **URL aplikasi web** yang berakhiran `/exec`.
6. Uji URL tersebut di browser dengan menambahkan `?api=info` di ujungnya, contoh `https://script.google.com/macros/s/AKfy.../exec?api=info`. Hasilnya harus berupa teks JSON berisi `"ok":true`.

## Langkah 4 – Terbitkan tampilan di GitHub Pages

1. Masuk ke [github.com](https://github.com), lalu klik **New repository**. Beri nama `perpustakaan-fata` dan pilih **Public**. GitHub Pages gratis untuk repositori publik.
2. Klik **Add file > Upload files**, seret semua isi folder repo ini (`index.html`, `.nojekyll`, `README.md`, folder `apps-script`), lalu klik **Commit changes**.
3. Buka `index.html` di GitHub, klik ikon pensil (**Edit**), lalu isi:

   ```js
   window.API_URL = 'https://script.google.com/macros/s/AKfy.../exec';
   ```

   Klik **Commit changes**.
4. Buka **Settings > Pages**. Pada **Source** pilih **Deploy from a branch**, Branch **main**, folder **/ (root)**, lalu klik **Save**.
5. Tunggu 1–2 menit. Alamat aplikasi akan muncul, misalnya `https://NAMA-AKUN.github.io/perpustakaan-fata/`.
6. Buka alamat tersebut di HP. Coba **Presensi**, **Cari buku**, **Akun saya** (NIM + PIN awal 6 digit terakhir NIM), dan **Petugas** (username `admin` + PIN dari sheet Petugas).

> **Keamanan:** repositori publik bisa dilihat siapa saja. Biarkan `SPREADSHEET_ID` di `apps-script/Code.gs` versi GitHub tetap berisi tulisan contoh; ID asli cukup diisi di editor Apps Script. Data tetap aman karena spreadsheet tidak dibagikan, dan semua akses lewat API memerlukan aturan di Code.gs (PIN, token sesi, peran petugas/admin).

## Alamat yang dibagikan

| Untuk | Alamat |
|---|---|
| Mahasiswa dan petugas | `https://NAMA-AKUN.github.io/perpustakaan-fata/` |
| Tablet presensi di pintu (mode kios) | `https://NAMA-AKUN.github.io/perpustakaan-fata/?mode=kiosk` |
| Cadangan (jika file Index ditambahkan) | `https://script.google.com/macros/s/AKfy.../exec` |

Kamera live dan zoom 1×–4× lebih andal di alamat GitHub Pages karena halaman tidak berada di dalam bingkai Google. Mode foto dan scanner USB/Bluetooth tetap tersedia sebagai cadangan.

## Memperbarui aplikasi

- **Ubah tampilan (`index.html`):** edit di GitHub lalu commit. GitHub Pages memperbarui otomatis dalam 1–2 menit.
- **Ubah server (`Code.gs`):** tempel kode baru di editor Apps Script, lalu buka **Terapkan > Kelola deployment**, klik ikon pensil, pilih **Versi: Versi baru**, dan klik **Terapkan**. URL `/exec` tidak berubah sehingga `API_URL` tidak perlu diganti.
  Jangan memilih "Deployment baru", karena itu membuat URL baru.
- Setelah pembaruan yang menambah kolom, jalankan **setup** sekali lagi. Data lama tidak terhapus.

## Pemecahan masalah

| Pesan / gejala | Penyebab | Solusi |
|---|---|---|
| "API_URL belum diisi di file index.html" | `API_URL` masih berisi tulisan contoh | Isi `API_URL` (Langkah 4.3) |
| "Gagal terhubung ke server" | `API_URL` salah, atau Web App belum diterbitkan | Cek URL berakhiran `/exec`, uji `?api=info` |
| "Respons server tidak valid" | Akses Web App bukan **Siapa saja**, sehingga Google mengirim halaman login | Kelola deployment, ubah akses ke **Siapa saja**, pilih Versi baru |
| "SPREADSHEET_ID belum diisi" / "tidak bisa dibuka" | ID kosong/salah, atau akun pemilik skrip tidak punya akses | Isi ID yang benar, jalankan `cekKoneksi` |
| "Sheet … tidak ditemukan" / "Kolom … tidak ada" | Nama sheet/kolom diubah, atau setup belum dijalankan | Kembalikan nama, jalankan `setup` |
| Perubahan Code.gs tidak terasa | Belum membuat versi baru deployment | Kelola deployment > Versi baru |
| Tanggal bergeser satu hari | Zona waktu proyek bukan Jakarta | Setelan project > Zona waktu |
| Menu tidak berpindah atau halaman keluar ke Google | Masih memakai kode versi 1.0 | Pakai `index.html` dan `Code.gs` versi 2.0 dari repo ini |

## Kapasitas

Untuk akun Gmail biasa, Google membatasi 30 eksekusi bersamaan per pengguna, 6 menit per eksekusi, dan 100 penerima email per hari ([kuota Apps Script](https://developers.google.com/apps-script/guides/services/quotas)). Setiap aksi aplikasi biasanya selesai dalam 1–3 detik, cukup untuk layanan perpustakaan fakultas.

## (Lanjutan) Sinkron otomatis Code.gs dari GitHub

Bila nanti ingin agar setiap commit ke `apps-script/` langsung terkirim ke Apps Script, gunakan [clasp](https://github.com/google/clasp) (`clasp push`), bisa juga lewat GitHub Actions. Langkah ini opsional; cara tempel manual di atas sudah cukup.
