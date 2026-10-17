# IC MDR & Antibiogram — Hackathon MVP

ระบบสาธิตสำหรับงานควบคุมการติดเชื้อ (IC) โรงพยาบาล ครอบคลุม flow
**บันทึกข้อมูล → Dashboard → Antibiogram → AI Consult**

> ⚠️ **demo เท่านั้น ไม่ใช่ระบบใช้งานจริง** — ข้อมูลทั้งหมดเป็นข้อมูลสังเคราะห์ ไม่มีข้อมูลผู้ป่วยจริง
> ข้อมูลและคำตอบ AI ใช้ประกอบการพิจารณา ไม่ใช่คำสั่งการรักษา
> กฎ phenotype และตาราง SDD/intrinsic เป็นฉบับร่าง `[J]` รอ ICN/จุลชีววิทยารับรอง

Spec: `.kiro/specs/mdr-mvp/` (requirements.md · design.md · tasks.md)

ความปลอดภัย: **[SECURITY.md](SECURITY.md)** — มาตรการที่ทำแล้ว, OWASP/ASVS mapping, checklist ก่อน deploy และสิ่งที่ต้องให้ฝ่ายความมั่นคงปลอดภัย/DPO อนุมัติก่อนใช้ข้อมูลจริง
(นี่คือระบบสาธิต ไม่ได้รับการรับรองว่าเป็นไปตาม พ.ร.บ.ไซเบอร์ / PDPA / นโยบายโรงพยาบาล)

> โฟลเดอร์นี้ (`MdrAI-vercel`) คือ **เวอร์ชันสำหรับ deploy บน Vercel ใช้ PostgreSQL** (Neon บน Vercel / Docker ในเครื่อง)
> เวอร์ชันรันในเครื่องแบบ SQLite ไม่ต้องติดตั้งฐานข้อมูล อยู่ที่โฟลเดอร์ `MdrAI` — หน้าจอ ตรรกะ และ test เหมือนกันทุกอย่าง

## เริ่มใช้งานในเครื่อง (PostgreSQL)

ต้องมี Node.js 20.9+ (ทดสอบกับ Node 24) และ PostgreSQL 1 ฐาน เลือกอย่างใดอย่างหนึ่ง:

**ก. Docker (แนะนำ)** — สร้าง Postgres ที่ `127.0.0.1:54329` (รหัสผ่าน `devpass` ใช้ในเครื่องเท่านั้น)

```bash
docker run -d --name mdr-pg -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=mdr -p 127.0.0.1:54329:5432 postgres:18
```

**ข. Neon (ฐานข้อมูล dev บนคลาวด์ ฟรี)** — สร้างโปรเจกต์ที่ console.neon.tech (หรือสร้าง branch `dev` แยกจาก production)
→ ปุ่ม **Connect** → คัดลอก connection string แบบ *pooled* (host มี `-pooler`) ไปใส่ `DATABASE_URL`
และปิดสวิตช์ *Connection pooling* เพื่อคัดลอกแบบ *direct* ไปใส่ `DATABASE_URL_UNPOOLED`
(ถ้าเชื่อมต่อครั้งแรกแล้ว timeout เพราะ compute กำลังตื่น ให้ต่อท้าย `&connect_timeout=15`)

จากนั้นสร้างไฟล์ `.env` ที่ root ของโปรเจกต์ (**อยู่ใน `.gitignore` ห้าม commit**) — ตัวอย่างสำหรับ Docker:

```bash
DATABASE_URL=postgresql://postgres:devpass@127.0.0.1:54329/mdr
DATABASE_URL_UNPOOLED=postgresql://postgres:devpass@127.0.0.1:54329/mdr
```

(ในเครื่องใส่ URL เดียวกันทั้งสองตัวได้ ; ดูตัวแปรอื่นใน `.env.example`)

```bash
npm ci                      # ติดตั้ง + prisma generate อัตโนมัติ
npx prisma migrate deploy   # สร้างตาราง (ครั้งแรก และทุกครั้งที่มี migration ใหม่)
npm run seed                # ข้อมูลสังเคราะห์ 1,000 isolates / 637 ผู้ป่วย (~2–5 วินาที)
npm run dev                 # http://localhost:3000
```

โหมด production (แนะนำตอนขึ้นเวที — เร็วกว่า dev):

```bash
npm run build
npx next start --port 3200       # ระบุ port ได้ ; ใน PowerShell อย่าใช้ npm run start -- --port (PowerShell ตัด -- ทิ้ง)
```

รีเซ็ตข้อมูลสาธิตระหว่าง demo: ปุ่ม **"โหลดข้อมูลสาธิต"** ในหน้า `/isolates` (บทบาท ICN) หรือ `POST /api/seed` (ICN เท่านั้น, ~2–4 วินาที) — ข้อมูลที่บันทึกเพิ่มจะถูกลบ

## หน้าจอ

| หน้า | URL | ทำอะไร |
|---|---|---|
| แดชบอร์ด | `/dashboard` | KPI + % เปลี่ยนแปลง, กราฟ 5 แบบ, เชื้อดื้อยาล่าสุด, suspected cluster |
| Antibiogram | `/antibiogram` | %S / %SDD / n, สลับสูตร %S, min N, แยกตามกลุ่มเชื้อดื้อยา + ป้าย 4 ระดับ |
| บันทึกข้อมูล | `/entry` | Upload ใบผล (AI อ่าน) หรือ Key in → ตรวจ → ยืนยัน |
| รายการ isolate | `/isolates` | ค้น/กรอง, ยืนยัน/ลบ (ICN), ปรึกษา AI |
| ปรึกษา AI | `/consult` | คำตอบ 3 ส่วน ข้อเท็จจริง / การวิเคราะห์ / ดุลยพินิจแพทย์ ผ่าน `verify()` |

บทบาท (ตัวสลับมุมขวาบน เก็บใน cookie `demo_role` — **อุปกรณ์สาธิต ไม่ใช่การยืนยันตัวตน** ; การเข้าถึงคุมด้วย Vercel Authentication + Basic Auth ดู SECURITY.md):
`ICN` ทุกหน้า ยืนยัน/ลบได้ · `DOCTOR` ดู Dashboard/Antibiogram/AI (เห็น HN) · `EXECUTIVE` Dashboard แบบรวม — **HN ถูกตัดที่ชั้น API**

## ตัวแปรสภาพแวดล้อม

ต้องตั้งเฉพาะตัวแปรฐานข้อมูล ; ที่เหลือมีค่าเริ่มต้น (โหมด `cached` ไม่ต้องใช้อินเทอร์เน็ตหรือ API key)
ดูตัวอย่างทั้งหมดใน `.env.example`

| ตัวแปร | ค่า | ค่าเริ่มต้น |
|---|---|---|
| `DATABASE_URL` | connection string ที่แอปใช้ตอนรัน (Neon: แบบ pooled) | — (ต้องมี) |
| `DATABASE_URL_UNPOOLED` | connection string แบบ direct ที่ `prisma migrate` ใช้ (ในเครื่องใช้ค่าเดียวกับ `DATABASE_URL`) | — (ต้องมีตอน migrate) |
| `SITE_ACCESS_USER` / `SITE_ACCESS_PASSWORD` | HTTP Basic Auth ของทั้งไซต์ (`proxy.ts`) ; รหัส ≥ 12 ตัวอักษร (แนะนำสุ่ม ≥ 16) ; บน Vercel ตั้งเป็น **Sensitive** | ในเครื่อง: ไม่ตั้ง = ปิด gate · **บน Vercel: ต้องตั้ง** ไม่งั้นทุก request ได้ 503 |
| `UPLOAD_DIR` | โฟลเดอร์เก็บไฟล์ใบผลที่อัปโหลด | `./uploads` ในเครื่อง · `os.tmpdir()/mdr-uploads` บน Vercel |
| `EXTRACT_MODE` | `cached` \| `live` — การอ่านใบผลแล็บ | `cached` |
| `AI_MODE` | `cached` \| `live` — AI Consult | `cached` |
| `LLM_PROVIDER` | `gemini` \| `anthropic` \| `bedrock` | `gemini` |
| `LLM_API_KEY` | API key ของ provider (หรือ `GEMINI_API_KEY` / `ANTHROPIC_API_KEY`) | — |
| `LLM_MODEL` | ชื่อรุ่นที่บัญชีของคุณใช้ได้ | gemini `gemini-2.5-flash` · anthropic `claude-sonnet-4-5` · bedrock `anthropic.claude-3-5-sonnet-20240620-v1:0` |
| `AWS_REGION` และ credential ของ AWS (default chain) | ใช้เมื่อ `LLM_PROVIDER=bedrock` | — |

ถ้าไม่ได้ตั้ง `EXTRACT_MODE` / `AI_MODE` ระบบจะใช้ live เฉพาะเมื่อพบ key ของ provider มิฉะนั้นใช้ cached

### โหมด cached กับ live
- **`EXTRACT_MODE=cached`** — เมื่อไฟล์ที่อัปโหลดมี SHA-256 ตรงกับ `fixtures/sample_report.png` ระบบคืน `fixtures/sample_report.expected.json` ; ปุ่ม **"ใช้ใบตัวอย่าง"** ในหน้า Upload ส่งไฟล์นี้ให้ ; ไฟล์อื่นจะได้ข้อความแจ้งพร้อมทางเลือก "กรอกเอง"
- **`AI_MODE=cached`** — provider แบบ deterministic สร้างคำตอบจาก **ตัวเลขที่คำนวณได้ ณ ขณะนั้น** (toolResults) ด้วยแม่แบบข้อความใน `fixtures/consult_cached.json` (ไม่มีตัวเลขฝังไว้) จึงยังถูกต้องหลังยืนยันข้อมูลใหม่ และผ่าน `verify()` ตัวเดียวกับโหมด live
- **`live`** — เรียก LLM จากฝั่ง server ผ่าน `lib/llm` เท่านั้น (ไม่มี key ในเบราว์เซอร์) ; ถ้าเรียกไม่สำเร็จจะแสดงข้อความที่อ่านเข้าใจได้ และหน้าอื่นยังใช้ได้

### ใส่ LLM key (โหมด live — เฉพาะในเครื่อง ไม่ใช้บน Vercel)
เพิ่มบรรทัดเหล่านี้ในไฟล์ `.env` บนเครื่องตัวเอง (อยู่ใน `.gitignore` — **ห้าม commit**):

```bash
LLM_PROVIDER=gemini
LLM_API_KEY=<your-key>
LLM_MODEL=<model-name>
EXTRACT_MODE=live
AI_MODE=live
```

แล้วรัน `npm run dev` ใหม่ ; key ไม่ถูกส่งไปฝั่ง client และไม่ถูกเขียนลง log

### เปลี่ยนใบตัวอย่าง (ใช้ใบจริงที่ปกปิดข้อมูลแล้ว)
1. ปิดทับ HN / ชื่อ / Lab No บนภาพก่อน แล้ววางทับ `fixtures/sample_report.png` (หรือเพิ่มคู่ไฟล์ใหม่ใน `CACHED_SAMPLES` ของ `lib/extract/cached.ts`)
2. แก้ `fixtures/sample_report.expected.json` ให้ตรงกับใบใหม่ (HN เป็นค่าสมมติ)
3. โหมด cached จับคู่ด้วย SHA-256 ที่ **คำนวณจากไฟล์ตอนรัน** จึงไม่ต้องแก้ hash ในโค้ด — แค่รีสตาร์ต server
   (ดู hash ได้ด้วย `pwsh -c "(Get-FileHash fixtures/sample_report.png -Algorithm SHA256).Hash"`)
4. แก้ค่าที่คาดหวังใน `lib/extract/__tests__/golden.test.ts` แล้วรัน `npm test` ให้ผ่าน
- ภาพตัวอย่างปัจจุบันสร้างจาก `npx tsx scripts/make-sample-report.ts` (SVG → PNG): *K. pneumoniae* จาก Hemoculture, 15 ยา,
  รับตรวจ 12/10/2569 รายงาน 15/10/2569 (พ.ศ.; เก็บเป็น 2026-10-12), Final, ไม่มี Ward, ไม่มีชื่อผู้ป่วย,
  HN 0000123 · Lab No 9900000001 · Order No 7700000001 (ค่าสมมติทั้งหมด)

## การทดสอบ

```bash
npm test             # Vitest: test vector 1–3, first isolate, phenotype golden, validators, verify() 5 เคส, golden extraction 15/15 + ธง Ward, มาตรการความปลอดภัย (lib/security)
npm run build        # type-check + build
# smoke test DoD 1–6 ผ่าน HTTP (เปิด server ในโหมด cached ก่อน)
pwsh -NoProfile -File scripts/smoke-dod.ps1 -BaseUrl http://localhost:3000            # รีเซ็ตข้อมูลสาธิตก่อนทดสอบ
pwsh -NoProfile -File scripts/smoke-dod.ps1 -BaseUrl http://localhost:3000 -SkipSeed  # ไม่รีเซ็ต
pwsh -NoProfile -File scripts/smoke-dod.ps1 -BaseUrl http://localhost:3200 -User <user> -Password <password>  # เมื่อเปิด Basic Auth gate
```
สคริปต์สร้าง + ยืนยัน isolate จากใบตัวอย่าง 1 รายการ แล้วลบทิ้งตอนจบ (ใช้ `-KeepIsolate` ถ้าต้องการเก็บไว้) ; พิมพ์ PASS/FAIL ต่อข้อและคืน exit code 1 ถ้ามีข้อไม่ผ่าน

ลองขั้นตอน build แบบเดียวกับ Vercel ในเครื่อง (ใช้ฐานข้อมูลใน `.env`): `npm run vercel-build`

## Deploy บน Vercel

ขั้นตอน build บน Vercel (`vercel.json` → `npm run vercel-build`):
`prisma generate` → `prisma migrate deploy` → `tsx prisma/seed-if-empty.ts` → `next build`

1. **Push โฟลเดอร์นี้ขึ้น GitHub** ภายใต้ github.com/noppornc-MU (แนะนำ repo แบบ private) — `.gitignore` กันไฟล์ `.env*` (ยกเว้น `.env.example`), `.agents/`, `*.db`, `uploads/`, `node_modules/`, `.next/`, `.vercel/` ไว้แล้ว
2. **Import** — เข้า vercel.com/tech-8766 → **Add New… → Project** → Import Git Repository → เลือก repo จาก `noppornc-MU`
   (ครั้งแรกต้องติดตั้ง Vercel GitHub App ให้เห็น repo) ; Framework Preset = Next.js ; ไม่ต้องแก้ Build Command (อ่านจาก `vercel.json`)
3. **Environment Variables** (ในหน้า Import หรือ Settings → Environment Variables, เลือก Production + Preview):
   `EXTRACT_MODE=cached` และ `AI_MODE=cached` — **ไม่ต้องใส่ LLM key**
   และ `SITE_ACCESS_USER` / `SITE_ACCESS_PASSWORD` (รหัสสุ่ม ≥ 16 ตัวอักษร) ติ๊ก **Sensitive** — ถ้าไม่ตั้ง ทุกหน้าจะขึ้น 503 "access not configured" (fail closed)
4. **Deploy** — build ครั้งแรกจะล้มที่ `prisma migrate deploy` (ยังไม่มี `DATABASE_URL`) เป็นเรื่องปกติ
5. **Storage → Neon** — ในโปรเจกต์ไปที่แท็บ **Storage** → Create Database → **Neon** → เลือก region **Singapore (aws-ap-southeast-1)** ใกล้ประเทศไทย (และตั้ง Settings → Functions → Region = Singapore `sin1` ให้ตรงกัน) และแผน Free → Create
   → **Connect Project** เลือกโปรเจกต์นี้ และ environment Production + Preview (+ Development) → Connect
   - integration จะใส่ `DATABASE_URL` (pooled) และ `DATABASE_URL_UNPOOLED` (direct) ให้อัตโนมัติ — **ไม่ต้องตั้ง prefix** เพื่อให้ชื่อตรงกับ `prisma/schema.prisma`
6. **Redeploy** — Deployments → ⋯ → Redeploy ; ใน build log ต้องเห็น `Applying migration 20261016152324_init_postgres` และ `seed-if-empty: database was empty -> seeded 1000 isolates`
7. **Security → Deployment Protection → Vercel Authentication** เปิดใช้ แล้วเลือกขอบเขต **All Deployments** (ป้องกันทุก URL รวม production ต้อง login Vercel ที่มีสิทธิ์ในทีม ; ฟรีทุกแผน) — ระบบนี้ไม่มี login จริง จึงไม่ควรเปิดสาธารณะ
8. **ตรวจ production ในหน้าต่าง private/incognito** — เปิด `https://<project>.vercel.app` ต้องถูกพาไปหน้า login ของ Vercel แล้วตามด้วยกล่อง Basic Auth ; login แล้วเห็นแบนเนอร์ "ข้อมูลสังเคราะห์" ที่ `/dashboard` และปุ่ม "ใช้ใบตัวอย่าง" ใน `/entry` ทำงาน
9. **GitHub** — repo เป็น Private, เปิด Dependabot alerts และ secret scanning / push protection ถ้ามี (รายการเต็มใน SECURITY.md ข้อ 5)

### ข้อมูลบน Vercel
- **seed ครั้งแรก** — `seed-if-empty` ใส่ข้อมูลสังเคราะห์เฉพาะเมื่อตาราง isolate ว่าง ; deploy ครั้งถัดไปไม่แตะข้อมูล (ไม่ลบ ไม่เขียน)
- **รีเซ็ตข้อมูลสาธิต** — ปุ่ม "โหลดข้อมูลสาธิต" ใน `/isolates` (ICN) หรือ `POST /api/seed` ; ลบ isolate ทั้งหมดแล้วใส่ชุดสังเคราะห์ใหม่ (`maxDuration = 60` วินาที ; วัดในเครื่อง 1.5–3.4 วินาที, request แรกหลัง server เย็น ~10 วินาที)
- **ไฟล์อัปโหลดเป็นไฟล์ชั่วคราว** — บน Vercel เขียนได้เฉพาะ `/tmp` ระบบจึงเก็บใน `os.tmpdir()/mdr-uploads` (หรือ `UPLOAD_DIR`) ไฟล์หายเมื่อ instance ถูกรีไซเคิล และอาจเปิดภาพต้นฉบับไม่ได้ถ้า request ไปตก instance อื่น ; ใบตัวอย่างเสิร์ฟจาก `fixtures/` จึงใช้ได้เสมอ
- **Preview deployment** — build ของ preview ก็รัน `migrate deploy` + `seed-if-empty` กับฐานข้อมูลที่ผูกกับ Preview ; ถ้าไม่ได้เปิด Preview Branching ของ Neon จะเป็นฐานเดียวกับ production
- **ใช้ข้อมูลสังเคราะห์เท่านั้น (R30/R36)** — Vercel/Neon ไม่อยู่ในขอบเขตที่ DPO อนุมัติ ห้ามบันทึกหรืออัปโหลดใบผลแล็บจริง (แม้ปกปิดบางส่วน) และคง `EXTRACT_MODE`/`AI_MODE` เป็น `cached` เพื่อไม่ส่งไฟล์ออกไปยัง LLM ภายนอก

## สคริปต์ demo (≈ 4 นาที)

| เวลา | ทำ | พูดให้เห็นจุดขาย |
|---|---|---|
| 0:00 | เปิด Dashboard (ข้อมูลสาธิต) | "ข้อมูลเดิมอยู่ใน Excel ดูภาพรวมไม่ได้ทันที — ตอนนี้เห็น ICU vs Non-ICU, เชื้อดื้อยา และ **suspected cluster** CRAB ใน ICU B" (เปิดรายชื่อ: ผู้ป่วยไม่ซ้ำ ไม่ใช่นับแถว) |
| 1:00 | หน้าบันทึกข้อมูล → อัปโหลดใบผลตัวอย่าง | "AI อ่านใบ 15 ยาให้ ใบนี้ไม่มี Ward — ระบบ **ไม่เดา** ติดธงให้คนเลือก" · ภาพต้นฉบับอยู่ข้างฟอร์ม |
| 1:45 | เลือก Ward → กด "ยืนยันข้อมูล" | "คนยืนยันก่อนเสมอ ข้อมูลที่ยังไม่ยืนยันไม่เข้าสถิติ" · phenotype = ESBL-screen (ระบบคำนวณ ไม่ใช่ AI) |
| 2:15 | กลับ Dashboard / Antibiogram | ตัวเลข K. pneumoniae เปลี่ยนทันที · สลับสูตร %S (S เท่านั้น/รวม SDD) · ช่อง n น้อยแสดง `n<30` |
| 2:45 | Antibiogram → แยกตาม *K. pneumoniae – CRE* | "เมื่อเจอเชื้อดื้อยากลุ่มนี้ ยาที่ข้อมูลท้องถิ่นสนับสนุนคือ…" พร้อมป้าย 4 ระดับ ไม่ใช้คำว่า first-line |
| 3:15 | AI Consult (กดจาก isolate เมื่อกี้) | 3 ส่วน ข้อเท็จจริง/วิเคราะห์/ดุลยพินิจ · ตัวเลขตรงกับ Antibiogram · ลิงก์ "ดูตัวเลขที่ใช้" |
| 3:40 | ถาม "ขนาดยา" และถามเชื้อที่ n น้อย | AI **ปฏิเสธ/งดตอบ** พร้อมเหตุผล — ปิดด้วยสไลด์ Roadmap |

### เคล็ดลับก่อนขึ้นเวที
- กด "โหลดข้อมูลสาธิต" ก่อนเริ่ม — ใบตัวอย่างมี Lab No เดียวกันทุกครั้ง ถ้าอัปโหลดซ้ำระบบจะเตือนข้อมูลซ้ำ (MR2.5) ให้กด "ยืนยันว่าไม่ซ้ำ" หรือลบรายการเดิมใน `/isolates`
- ตอนยืนยันใบตัวอย่าง เลือก Ward = **ICU B** และ Patient Type = IPD เพื่อให้ต่อกับคำถาม AI ได้
- *K. pneumoniae – CRE* มี first isolate 22 ราย จึงแสดง `n<30` ที่ min N 30 ; ลด min N เป็น 10 เพื่อดูป้าย 4 ระดับ (ขึ้นแบนเนอร์ "ข้อมูลน้อย — ใช้ประกอบเท่านั้น") — ทุกยาในกลุ่มนี้ได้ "ข้อมูลท้องถิ่นไม่สนับสนุน" ซึ่งตรงกับความเป็นจริงของ CRE
- ตัวอย่างที่มี "ข้อมูลท้องถิ่นสนับสนุน": *K. pneumoniae* · ICU B · blood (n≈54: Amikacin, Meropenem, Imipenem, Ertapenem ≥ 90%)
- เชื้อ n น้อยสำหรับโชว์การงดตอบ: *Enterococcus faecalis* / *E. faecium* ใน หอเด็ก

## ข้อจำกัดของ demo
- ข้อมูลสังเคราะห์ทั้งหมด (seed แบบ deterministic) ; ใบตัวอย่างเป็นภาพสังเคราะห์ ไม่มีชื่อผู้ป่วย
- ไม่มี login/MFA/RBAC จริง — ใช้ตัวสลับบทบาท (การเข้าถึงทั้งไซต์คุมด้วย Vercel Authentication + Basic Auth รหัสร่วม) ; ไม่มี audit hash chain, report versions, 4-eyes, frozen antibiogram
- PDF ที่อัปโหลดจะถูกดาวน์โหลดแทนการแสดงในกรอบ (มาตรการความปลอดภัย ; ดู SECURITY.md) ; Vercel Functions รับ request body ได้ราว 4.5 MB
- กฎ phenotype (CRE, ESBL-screen, CRAB, CRPA, MRSA, VRE), ตาราง SDD และ intrinsic เป็นฉบับร่าง `[J]` ; ไม่ทำ MDR/XDR
- AI ไม่คำนวณสถิติ — ตัวเลขทั้งหมดมาจาก `lib/domain` ; AI ไม่ให้ขนาดยา และงดตอบเมื่อ n < min N
- โหมด live ของ LLM (gemini / anthropic / bedrock) เขียนไว้แล้วแต่ **ยังไม่ได้ทดสอบกับ key จริง**
- ยังไม่มี: Import CSV (MR4.2), drill-down คลิกกราฟ (MR7.3) ; ปุ่มพิมพ์ใช้ `window.print()`
- ในโหมด cached การ "สร้างใหม่ 1 ครั้ง" เมื่อ verify ไม่ผ่านให้ผลเดิม จึงจะแสดง "ไม่สามารถสร้างคำตอบที่ตรวจสอบได้" ทันที
- ไม่รองรับข้อมูลผู้ป่วยจริง ห้ามอัปโหลดใบผลที่ยังไม่ปกปิดข้อมูล ; บน Vercel ใช้ข้อมูลสังเคราะห์เท่านั้น
- บน Vercel ไฟล์ที่อัปโหลดเก็บใน `/tmp` ชั่วคราว (ยังไม่มี object storage)
