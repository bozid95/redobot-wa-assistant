# WA RAG Chatbot

Repositori ini sekarang ditata sebagai aplikasi produk `WhatsApp RAG chatbot` berbasis:

- `NestJS` untuk backend dan logic utama
- `Vue 3 + TailAdmin` untuk dashboard admin
- `Prisma + Postgres` untuk database aplikasi
- `Evolution API` untuk transport WhatsApp
- `Qdrant` untuk vector search
- `Apache Tika` untuk ekstraksi `PDF/DOCX`
- `Docker Compose` untuk local run dan deploy di `Dokploy`

Scope v1:

- `single-user`
- `single-bisnis`
- `single-instance WhatsApp`
- fitur inti:
  - konek WhatsApp
  - pantau inbox dan histori chat
  - takeover/release
  - manual reply
  - upload knowledge
  - reindex knowledge
  - RAG auto-reply
  - fallback dan unanswered leads

## Stack Yang Disediakan
- `frontend-vue-tailadmin/`
  - `Vue 3 + TailAdmin` admin dashboard utama
- `backend/`
  - `NestJS` API, webhook, auth, inbox, takeover, knowledge, dan RAG
- `docker-compose.yml`
  - `frontend`
  - `backend`
  - `postgres`
  - `redis`
  - `qdrant`
  - `tika`
  - `evolution-api`

## Setup Lokal
1. Salin `.env.example` menjadi `.env`.
2. Isi minimal variabel ini:
   - `JWT_SECRET`
   - `COOKIE_SECRET`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `EVOLUTION_API_KEY`
   - `EVOLUTION_INSTANCE_NAME`
   - `EVOLUTION_SERVER_URL`
   - `LLM_BASE_URL`
   - `LLM_API_KEY`
   - `CHAT_MODEL`
   - `EMBEDDING_BASE_URL`
   - `EMBEDDING_API_KEY`
   - `EMBEDDING_MODEL`
3. Jalankan:

```powershell
docker compose up -d --build
```

4. Buka aplikasi:
   - Frontend: `http://localhost:3000`
   - Backend health: `http://localhost:4000/health`
   - Evolution API: `http://localhost:8080`
   - Qdrant: `http://localhost:6333/dashboard`

5. Login dengan akun admin dari `.env`:
   - email: `ADMIN_EMAIL`
   - password: `ADMIN_PASSWORD`

Catatan:
- backend akan menjalankan `prisma db push` dan `seed` saat startup
- seed akan memastikan 1 admin user dan 1 record `wa_instance` tersedia

## Webhook Evolution API
Setelah instance WhatsApp dibuat atau dikoneksikan, arahkan webhook Evolution ke backend:

```powershell
curl --request POST `
  --url http://localhost:8080/webhook/set/$env:EVOLUTION_INSTANCE_NAME `
  --header "Content-Type: application/json" `
  --header "apikey: $env:EVOLUTION_API_KEY" `
  --data "{
    ""url"": ""http://backend:4000/webhooks/evolution"",
    ""events"": [""MESSAGES_UPSERT""],
    ""webhook_by_events"": false,
    ""webhook_base64"": false
  }"
```

Untuk lingkungan Dokploy, ganti URL webhook menjadi domain backend publik Anda, misalnya `https://api.domainanda.com/webhooks/evolution`.

## Alur Aplikasi
### Inbound chat
- Evolution mengirim webhook ke `POST /webhooks/evolution`
- backend melakukan dedup ke `processed_messages`
- backend membuat atau memperbarui `conversations`
- pesan user dicatat ke `conversation_messages`
- jika takeover aktif, bot berhenti menjawab
- jika takeover tidak aktif:
  - greeting/thanks/clarify dijawab langsung
  - selain itu masuk ke pipeline RAG

### RAG
- backend membuat embedding query
- backend mencari context ke `Qdrant`
- jika context lemah atau kosong:
  - buat `unanswered_leads`
  - kirim fallback reply
- jika context ada:
  - panggil model chat
  - simpan jawaban bot
  - kirim reply melalui Evolution API

### Knowledge
- admin upload `PDF`, `DOCX`, `MD`, atau `TXT`
- file disimpan ke `/app/uploads`
- `Tika` dipakai untuk file non-plain-text
- backend melakukan chunking, embedding, dan upsert ke Qdrant
- status source dicatat di `knowledge_sources`

### Takeover
- admin aktifkan `takeover`
- pesan user tetap masuk ke inbox
- bot berhenti balas otomatis
- admin balas manual dari dashboard
- admin dapat `release` untuk mengaktifkan bot lagi

## Struktur Data Utama
- `app_users`
- `wa_instances`
- `conversations`
- `conversation_messages`
- `knowledge_sources`
- `unanswered_leads`
- `processed_messages`

Skema lengkap ada di [backend/prisma/schema.prisma](backend/prisma/schema.prisma).

## Deploy ke Dokploy
Project ini disiapkan untuk deploy `Docker Compose` di Dokploy.

Saran deploy:
- gunakan domain terpisah:
  - `app.domainanda.com` untuk frontend
  - `api.domainanda.com` untuk backend
- pastikan `VITE_API_BASE_URL` mengarah ke domain backend publik
- gunakan volume persisten untuk:
  - `postgres_data`
  - `qdrant_data`
  - `evolution_instances`
  - `uploads_data`
  - `knowledge_data`
- isi variabel `.env` melalui Dokploy environment manager

## Catatan Penting
- Dashboard admin sekarang berjalan dari `frontend-vue-tailadmin/` sebagai SPA berbasis `Vue 3 + TailAdmin`.
- Prompt dan direct reply di modul RAG masih memakai konten `kursus mengemudi mobil`; silakan sesuaikan sebelum produksi untuk bisnis Anda.
- `Tika` dibutuhkan jika Anda ingin indexing `PDF` dan `DOCX`. Untuk `MD/TXT`, backend membaca file langsung.
- `Redis` saat ini dipakai untuk kebutuhan Evolution API.

## Verifikasi
Checklist pengujian manual ada di [docs/manual-test.md](docs/manual-test.md).
