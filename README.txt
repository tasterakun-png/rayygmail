RAYYGMAIL — HTML/CSS/JavaScript + Google Sheets via Google Apps Script

FILE:
- Code.gs      Backend Google Apps Script, Google Sheets, sesi pengguna/admin
- Index.html   Website publik dan dashboard pengguna
- Admin.html   Dashboard admin terpisah (?page=admin)
- Styles.html  CSS tema dark premium responsif
- App.js.html  JavaScript frontend pengguna

PEMASANGAN:
1. Buat Google Spreadsheet baru, misalnya bernama RAYYGMAIL Database.
2. Dari spreadsheet pilih Extensions > Apps Script.
3. Pada Apps Script, rename file Code.gs dan tempel isi Code.gs dari paket ini.
4. Tambahkan file HTML bernama Index, Admin, Styles, dan App.js (nama file di Apps Script tanpa ekstensi .html), lalu tempel konten file masing-masing.
5. Simpan semua file.
6. Jalankan fungsi setupSheets dari dropdown fungsi di editor. Setujui izin yang diminta. Fungsi ini membuat sheet Users, Submissions, Transactions.
7. Buka Project Settings (ikon roda gigi) > Script Properties > Add script property:
   Property: ADMIN_PASSWORD
   Value: kata sandi admin panjang dan unik
   Jangan masukkan password ini di file HTML atau membagikannya.
8. Klik Deploy > New deployment > pilih tipe Web app.
   Execute as: Me
   Who has access: Anyone (jika ingin publik; pilihan dapat berbeda tergantung akun/organisasi).
9. Klik Deploy, setujui izin, lalu salin URL Web app berakhiran /exec.
10. URL utama untuk pengunjung adalah URL /exec.
11. URL dashboard admin adalah URL /exec?page=admin.
12. Setelah mengubah kode, buka Deploy > Manage deployments > Edit > pilih New version > Deploy.

CATATAN PENTING:
- Buat Apps Script dari spreadsheet melalui Extensions > Apps Script agar SpreadsheetApp.getActiveSpreadsheet() terhubung ke database.
- Jangan pernah meminta password Gmail, OTP, atau kode pemulihan. Form pengajuan hanya menerima referensi/kontak dan catatan.
- Saldo hanyalah catatan internal yang diubah admin dan dicatat dalam Transactions; ini tidak terhubung ke bank/QRIS otomatis.
- Sesi disimpan di CacheService selama maksimal 6 jam dan dapat berakhir lebih cepat.
- Ini adalah starter project. Untuk penggunaan dengan data sensitif/volume besar, gunakan autentikasi dan penyimpanan sesi yang lebih kuat, batasi akses deployment sesuai kebutuhan, serta buat backup spreadsheet.
- Google Apps Script memiliki kuota penggunaan dan batas layanan; ini bukan hosting tanpa batas.
