# Manual Test Checklist

## Setup
- Salin `.env.example` menjadi `.env`.
- Isi secret dan kredensial admin.
- Jalankan `docker compose up -d --build`.
- Pastikan endpoint ini hidup:
  - `http://localhost:3000`
  - `http://localhost:4000/health`
  - `http://localhost:8080`
- Login ke dashboard dengan `ADMIN_EMAIL` dan `ADMIN_PASSWORD`.

## Auth dan Overview
- Buka halaman `/login`.
- Login berhasil dan diarahkan ke `/`.
- Halaman overview menampilkan:
  - status instance
  - chat hari ini
  - fallback hari ini
  - takeover aktif
  - open leads
- Klik `Logout` dan pastikan sesi berakhir.

## WhatsApp Connection
- Buka halaman `/connection`.
- Klik `Connect Instance`.
- Pastikan status instance berubah atau QR/pairing state muncul jika Evolution mengembalikan data pairing.
- Konfigurasikan webhook Evolution API ke:
  - `http://localhost:4000/webhooks/evolution`
- Pastikan webhook tersimpan di Evolution untuk event `MESSAGES_UPSERT`.

## Inbox dan Histori Chat
- Kirim 1 pesan personal dari nomor uji ke WhatsApp instance.
- Pastikan percakapan baru muncul di `/inbox`.
- Buka detail percakapan dan verifikasi:
  - pesan user tercatat
  - nomor tampil benar
  - status percakapan masih `open` bila belum takeover
- Kirim ulang payload webhook yang sama dan pastikan tidak ada duplikat karena `processed_messages`.

## Routing Cepat
- Kirim pesan seperti `halo`.
- Pastikan bot menjawab direct reply greeting.
- Kirim pesan seperti `makasih`.
- Pastikan bot menjawab direct reply thanks.
- Kirim pesan singkat ambigu seperti `harga`.
- Pastikan bot mengirim pertanyaan klarifikasi.

## RAG
- Upload minimal 1 file `PDF` atau `DOCX`.
- Upload juga 1 file `MD` atau `TXT`.
- Jalankan `Reindex`.
- Pastikan status source berubah menjadi `indexed`.
- Verifikasi collection `wa_kb` terisi di Qdrant.
- Tanyakan sesuatu yang memang ada di dokumen.
- Pastikan jawaban relevan dan tercatat sebagai message `assistant`.

## Fallback dan Leads
- Tanyakan sesuatu yang tidak ada di knowledge.
- Pastikan bot mengirim fallback reply.
- Pastikan record baru muncul di halaman `/leads`.
- Tutup salah satu lead dan pastikan status berubah menjadi `closed`.

## Takeover dan Manual Reply
- Pada thread percakapan, klik `Takeover`.
- Kirim pesan baru dari user.
- Pastikan pesan user tetap masuk ke inbox tetapi bot tidak auto-reply.
- Balas manual dari dashboard.
- Pastikan pesan terkirim ke WhatsApp dan tercatat sebagai `role=admin`, `source=manual_reply`.
- Klik `Release`.
- Kirim pesan baru lagi dan pastikan bot aktif kembali.

## Persistensi
- Restart container:
  - `docker compose restart backend frontend postgres qdrant evolution-api`
- Pastikan:
  - login masih bisa
  - histori chat tetap ada
  - knowledge source tetap ada
  - vector di Qdrant tetap ada
  - status instance tetap terbaca dari database
