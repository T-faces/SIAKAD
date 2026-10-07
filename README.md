# SIAKAD + LMS — Google Sheet

Aplikasi SIAKAD dan LMS berbasis **GitHub Pages + Google Apps Script + Google Sheets**.

## Modul
- Dashboard statistik
- Manajemen siswa, guru, kelas, mata pelajaran
- Nilai
- Presensi
- Kelas LMS
- Materi
- Tugas
- Pengumpulan tugas
- Pengumuman
- CRUD tambah, edit, hapus
- Pencarian data
- Role Admin, Guru, Siswa
- Responsive desktop/tablet/HP

## Struktur
```
T-faces/SIAKAD
├── index.html
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── config.js
│       ├── api.js
│       └── app.js
├── apps-script/Code.gs
└── docs/
```

## Instalasi database
1. Buat Google Spreadsheet baru.
2. Buka **Extensions → Apps Script**.
3. Salin `apps-script/Code.gs`.
4. Ganti `SPREADSHEET_ID` dengan ID spreadsheet.
5. Jalankan fungsi `setupDatabase()` sekali.
6. Deploy → New deployment → Web app.
7. Execute as **Me**.
8. Who has access: **Anyone**.
9. Salin URL Web App.
10. Masukkan URL ke `frontend/js/config.js`.

## GitHub Pages
Aktifkan GitHub Pages pada branch **Master** dan folder **/ (root)**. Halaman root akan membuka frontend SIAKAD.

## Akun demo
- Admin: `admin / admin123`
- Guru: `guru / guru123`
- Siswa: `siswa / siswa123`

Segera ganti password demo sebelum digunakan di lingkungan sekolah.

## Catatan penting
GitHub Pages tidak dapat menjadi database. Semua data permanen berada di Google Sheets melalui Apps Script API.

Untuk penggunaan produksi, tambahkan hashing password/token session, pembatasan akses server-side, audit log, backup spreadsheet, validasi input dan Google OAuth.