# SIAKAD + LMS — Google Sheets

SIAKAD & LMS berbasis **GitHub Pages + Google Apps Script + Google Sheets**.

## Fitur saat ini
- Dashboard statistik
- Data Siswa, Guru, Kelas, Mata Pelajaran
- Nilai dan Presensi
- Kelas LMS, Materi, Tugas, Pengumpulan
- Pengumuman
- CRUD tambah, edit, hapus
- Pencarian data
- Role **Admin, Guru, Siswa**
- Session token server-side
- Audit log aktivitas
- Responsive desktop, tablet, dan HP

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

## Setup Google Sheets
1. Buat Google Spreadsheet.
2. Buka **Extensions → Apps Script**.
3. Salin isi `apps-script/Code.gs`.
4. Pastikan `SPREADSHEET_ID` sesuai ID spreadsheet.
5. Jalankan `setupDatabase()` sekali dan izinkan akses.
6. Deploy → **New deployment** → **Web app**.
7. Execute as: **Me**.
8. Who has access: **Anyone**.
9. Salin URL Web App ke `frontend/js/config.js`.
10. Jika Apps Script sudah pernah di-deploy, buat **deployment version baru** setelah perubahan Code.gs.

## Akun demo
- Admin: `admin / admin123`
- Guru: `guru / guru123`
- Siswa: `siswa / siswa123`

Segera ganti password demo sebelum digunakan untuk data sekolah sebenarnya.

## Catatan keamanan
Frontend tidak lagi mengirim role sebagai sumber otorisasi. Setelah login, Apps Script memberikan session token dan setiap request API memvalidasi token tersebut. Aktivitas create/update/delete dicatat ke sheet `ActivityLog`.

Untuk produksi, disarankan mengganti password plaintext dengan password hashing, menambahkan pengaturan akun/password dari panel Admin, validasi field yang lebih ketat, backup spreadsheet berkala, dan Google OAuth bila diperlukan.

## GitHub Pages
Aktifkan GitHub Pages pada branch **Master** dan folder **/ (root)**. File root akan mengarahkan pengguna ke `frontend/`.
