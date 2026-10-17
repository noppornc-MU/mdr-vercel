# Instruction — ติดตั้งไลบรารีและเริ่มใช้งาน source code (IC MDR & Antibiogram MVP — เวอร์ชัน Vercel / PostgreSQL)

> ระบบสาธิตใช้ **ข้อมูลสังเคราะห์เท่านั้น** ห้ามใส่ข้อมูลผู้ป่วยจริง · รายละเอียดหน้าจอและสคริปต์ demo อยู่ใน `README.md`
> โฟลเดอร์นี้ (`MdrAI-vercel`) ใช้ **PostgreSQL** และเป็นชุดที่ push ขึ้น GitHub เพื่อ deploy บน Vercel ;
> ถ้าต้องการรันในเครื่องโดยไม่ติดตั้งฐานข้อมูล ให้ใช้โฟลเดอร์ `MdrAI` (SQLite)
> ความปลอดภัยและ checklist ก่อน deploy: **[SECURITY.md](SECURITY.md)** — นี่คือระบบสาธิต ไม่ได้รับการรับรองว่าเป็นไปตาม พ.ร.บ.ไซเบอร์ / PDPA / นโยบายโรงพยาบาล

## 1. สิ่งที่ต้องมีในเครื่อง
| โปรแกรม | เวอร์ชัน | หมายเหตุ |
|---|---|---|
| Node.js | 20.9 ขึ้นไป (ทดสอบกับ 24.11.1) | ดาวน์โหลดจาก nodejs.org ; มาพร้อม npm (ทดสอบกับ 11.12.0) |
| อินเทอร์เน็ต | ตอนติดตั้งครั้งแรก | ดาวน์โหลดแพ็กเกจจาก npm registry ; หลังติดตั้งแล้วโหมด cached ไม่เรียกบริการภายนอก |
| PostgreSQL | ทดสอบกับ 18 (Docker `postgres:18`) | ใช้ Docker ในเครื่อง หรือ Neon (ดูข้อ 2) |
| Docker Desktop (ไม่บังคับ) | — | สำหรับรัน Postgres ในเครื่อง |
| PowerShell 7 (ไม่บังคับ) | — | ใช้รัน `scripts/smoke-dod.ps1` |

ตรวจเวอร์ชัน: `node -v` และ `npm -v`

## 2. เตรียมฐานข้อมูล PostgreSQL
เลือกอย่างใดอย่างหนึ่ง

**ก. Docker (แนะนำสำหรับในเครื่อง)** — รหัสผ่าน `devpass` ใช้ในเครื่องเท่านั้น
```bash
docker run -d --name mdr-pg -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=mdr -p 127.0.0.1:54329:5432 postgres:18
```

**ข. Neon (ฐานข้อมูล dev บนคลาวด์)** — สร้างโปรเจกต์ (หรือ branch `dev`) ที่ console.neon.tech → ปุ่ม **Connect**
- แบบ *pooled* (host มี `-pooler`) → ใส่ใน `DATABASE_URL`
- ปิดสวิตช์ *Connection pooling* แล้วคัดลอกแบบ *direct* → ใส่ใน `DATABASE_URL_UNPOOLED`
- ถ้าเชื่อมต่อครั้งแรกแล้ว timeout (compute ของ Neon กำลังตื่น) ให้ต่อท้าย `&connect_timeout=15`

สร้างไฟล์ `.env` ที่ root ของโปรเจกต์ (**อยู่ใน `.gitignore` ห้าม commit**) ตัวอย่างสำหรับ Docker:
```bash
DATABASE_URL=postgresql://postgres:devpass@127.0.0.1:54329/mdr
DATABASE_URL_UNPOOLED=postgresql://postgres:devpass@127.0.0.1:54329/mdr
```
ในเครื่องใส่ URL เดียวกันทั้งสองตัวได้ ; ตัวแปรอื่นดูใน `.env.example`

## 3. ติดตั้ง (ครั้งแรก)
แตกไฟล์ zip แล้วเปิด terminal ที่โฟลเดอร์ `MdrAI-vercel` (โฟลเดอร์ที่มี `package.json`)

```bash
npm ci                      # ติดตั้งไลบรารีตาม package-lock.json (เวอร์ชันตรงตามที่ทดสอบ) และรัน prisma generate อัตโนมัติ
npx prisma migrate deploy   # สร้างตารางในฐานข้อมูลตาม DATABASE_URL_UNPOOLED
npm run seed                # ใส่ข้อมูลสังเคราะห์ 1,000 isolates / 637 ผู้ป่วย (ประมาณ 2–5 วินาที)
npm test                    # ตรวจตรรกะการคำนวณ + มาตรการความปลอดภัย (ควรผ่าน 75/75 ; ไม่ใช้ฐานข้อมูล)
```
- ใช้ `npm ci` แทน `npm install` เพื่อให้ได้เวอร์ชันตรงกับ `package-lock.json` ทุกตัว
- โหมดสาธิต (`cached`) ไม่ต้องใส่ LLM key ใน `.env`

## 4. เปิดใช้งาน
```bash
npm run dev                 # โหมดพัฒนา → http://localhost:3000
```
โหมด production (เร็วกว่า เหมาะตอนนำเสนอ):
```bash
npm run build
npm run start               # → http://localhost:3000
```
ถ้า port 3000 ถูกโปรแกรมอื่นใช้อยู่ ให้เรียก Next.js ตรง ๆ พร้อมระบุ port:
```bash
npx next dev --port 3100
npx next start --port 3200
```
> ใน PowerShell คำสั่ง `npm run start -- --port 3200` **จะไม่ส่ง --port ต่อให้ Next.js** (PowerShell ตัด `--` ออก) จึงแนะนำ `npx next ... --port` แทน

รีเซ็ตข้อมูลสาธิต: `npm run seed` หรือปุ่ม **"โหลดข้อมูลสาธิต"** ในหน้า `/isolates` (บทบาท ICN)

## 5. ไลบรารีที่ใช้ (ตรึงเวอร์ชันใน `package.json`)
### ใช้ตอนรันระบบ (dependencies)
| แพ็กเกจ | เวอร์ชัน | ใช้ทำอะไร |
|---|---|---|
| next | 16.4.2 | เฟรมเวิร์กเว็บ (หน้าจอ + API routes) |
| react, react-dom | 19.3.1 | ส่วนแสดงผล |
| react-is | 19.3.1 | ไลบรารีประกอบที่ recharts ต้องใช้ |
| recharts | 3.10.1 | กราฟใน Dashboard |
| @prisma/client | 6.19.3 | เชื่อมต่อฐานข้อมูล PostgreSQL |
| zod | 4.6.7 | ตรวจรูปแบบข้อมูล/JSON จาก AI |
| sharp | 0.35.5 | แปลง SVG → PNG สำหรับสร้างใบผลตัวอย่าง |
| @google/genai | 2.30.0 | ตัวเชื่อม Gemini (โหมด live) |
| @anthropic-ai/sdk | 0.135.0 | ตัวเชื่อม Claude (โหมด live) |
| @aws-sdk/client-bedrock-runtime | 3.1152.0 | ตัวเชื่อม Amazon Bedrock (โหมด live) |

### ใช้ตอนพัฒนา/ทดสอบ/build (devDependencies — Vercel ติดตั้งให้ตอน build)
| แพ็กเกจ | เวอร์ชัน | ใช้ทำอะไร |
|---|---|---|
| typescript | 5.9.3 | ภาษา TypeScript / type-check |
| prisma | 6.19.3 | CLI ของ Prisma (generate, migrate deploy) |
| tailwindcss, @tailwindcss/postcss | 4.3.3 | สไตล์หน้าจอ |
| postcss | 8.5.30 | ประมวลผล CSS |
| vitest | 5.0.5 | รัน unit test |
| tsx | 4.23.15 | รันสคริปต์ TypeScript (seed, seed-if-empty, สร้างใบตัวอย่าง) |
| @types/node, @types/react, @types/react-dom | 24.19.2 / 19.3.0 / 19.3.0 | type definitions |

ไลบรารี LLM ทั้งสามตัวถูกติดตั้งเสมอ แต่ **ไม่ถูกเรียกใช้ในโหมด cached** (ไม่ต้องมี API key)

## 6. คำสั่งที่มีใน `package.json`
| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | เปิด server โหมดพัฒนา |
| `npm run build` / `npm run start` | build และเปิด server โหมด production |
| `npm test` | รัน Vitest ทั้งหมด |
| `npm run typecheck` | ตรวจ TypeScript |
| `npm run seed` | **ล้าง** isolate ทั้งหมดและใส่ข้อมูลสังเคราะห์ใหม่ |
| `npm run seed:if-empty` | ใส่ข้อมูลสังเคราะห์เฉพาะเมื่อยังไม่มี isolate (ไม่ลบข้อมูลเดิม) |
| `npm run db:deploy` | `prisma migrate deploy` — ใช้ migration ที่มีอยู่กับฐานข้อมูล |
| `npm run db:migrate` | สร้าง migration ใหม่เมื่อแก้ `prisma/schema.prisma` (สำหรับนักพัฒนา) |
| `npm run vercel-build` | สิ่งที่ Vercel รัน: `prisma generate` → `prisma migrate deploy` → seed-if-empty → `next build` |
| `postinstall` (อัตโนมัติ) | `prisma generate` หลังติดตั้ง |

ตรวจ DoD 1–6 ผ่าน HTTP (เปิด server ก่อน): `pwsh -NoProfile -File scripts/smoke-dod.ps1 -BaseUrl http://localhost:3200`
(ถ้าเปิด Basic Auth gate ด้วย `SITE_ACCESS_USER` / `SITE_ACCESS_PASSWORD` ให้เพิ่ม `-User <user> -Password <password>`)
สร้างใบผลตัวอย่างใหม่: `npx tsx scripts/make-sample-report.ts`

## 7. Deploy บน Vercel
ไฟล์ `vercel.json` กำหนด Build Command เป็น `npm run vercel-build` แล้ว

1. Push โฟลเดอร์นี้ขึ้น GitHub ภายใต้ github.com/noppornc-MU (แนะนำ private)
2. vercel.com/tech-8766 → **Add New… → Project** → Import Git Repository → เลือก repo จาก `noppornc-MU` (Framework = Next.js ; ไม่ต้องแก้ Build Command)
3. Environment Variables (Production + Preview): `EXTRACT_MODE=cached`, `AI_MODE=cached` — ไม่ต้องใส่ LLM key ;
   `SITE_ACCESS_USER` และ `SITE_ACCESS_PASSWORD` (รหัสสุ่ม ≥ 16 ตัวอักษร) ติ๊ก **Sensitive** — **ต้องตั้ง** ไม่งั้นทุก request ได้ 503 "access not configured"
4. กด **Deploy** — ครั้งแรกจะล้มที่ `prisma migrate deploy` เพราะยังไม่มีฐานข้อมูล (ปกติ)
5. แท็บ **Storage** → Create Database → **Neon** → เลือก region **Singapore (aws-ap-southeast-1)** และแผน Free → Create → **Connect Project** (Production + Preview) → Connect ;
   ตั้ง Settings → Functions → Region = **Singapore (sin1)** ให้ตรงกัน และตรวจว่า connection string มี `sslmode=require`
   — ได้ `DATABASE_URL` (pooled) และ `DATABASE_URL_UNPOOLED` (direct) อัตโนมัติ ; ไม่ต้องตั้ง prefix
6. Deployments → ⋯ → **Redeploy** ; build log ต้องมี `All migrations have been successfully applied` และ `seed-if-empty: database was empty -> seeded 1000 isolates`
7. **Security → Deployment Protection → Vercel Authentication** เปิดใช้ เลือกขอบเขต **All Deployments** (ระบบไม่มี login จริง)
8. เปิด production ในหน้าต่าง **private/incognito** — ต้องขึ้นหน้า login ของ Vercel แล้วตามด้วยกล่อง Basic Auth ; login แล้วตรวจ `/dashboard` และ "ใช้ใบตัวอย่าง" ใน `/entry`
9. GitHub: repo **Private**, เปิด Dependabot alerts, secret scanning / push protection ถ้ามี (ดู SECURITY.md ข้อ 5)

ข้อควรรู้บน Vercel
- **seed ครั้งแรก**: ทำอัตโนมัติเมื่อฐานข้อมูลว่างเท่านั้น ; deploy ครั้งต่อไปไม่ลบ/ไม่เขียนข้อมูล
- **รีเซ็ตข้อมูลสาธิต**: ปุ่ม "โหลดข้อมูลสาธิต" (ICN) หรือ `POST /api/seed` (จำกัดเวลา 60 วินาที ; ใช้จริงประมาณ 2–4 วินาที)
  หรือจากเครื่องตัวเอง: ตั้ง `DATABASE_URL` เป็น connection string ของ Neon ใน shell ชั่วคราว แล้ว `npm run seed`
- **ไฟล์อัปโหลดเป็นไฟล์ชั่วคราว**: เก็บใน `/tmp` (`os.tmpdir()/mdr-uploads` หรือ `UPLOAD_DIR`) หายเมื่อ instance รีไซเคิล ; ใบตัวอย่างใน `fixtures/` ใช้ได้เสมอ
- **ข้อมูลสังเคราะห์เท่านั้น (R30/R36)**: ห้ามบันทึกหรืออัปโหลดใบผลจริงบน Vercel/Neon และคงโหมด `cached`

## 8. ตั้งค่า AI จริง (ไม่บังคับ — เฉพาะในเครื่อง ยังไม่ได้ทดสอบกับ key จริง)
เพิ่มค่าเหล่านี้ในไฟล์ `.env` บนเครื่องตัวเอง (**ห้าม commit**):

| ตัวแปร | ค่า |
|---|---|
| `LLM_PROVIDER` | `gemini` (ค่าเริ่มต้น) · `anthropic` · `bedrock` |
| `LLM_API_KEY` | key ของ provider (หรือใช้ `GEMINI_API_KEY` / `GOOGLE_API_KEY` / `ANTHROPIC_API_KEY`) |
| `LLM_MODEL` | ชื่อรุ่นที่บัญชีใช้ได้ |
| `EXTRACT_MODE`, `AI_MODE` | `live` เพื่อเรียก AI จริง ; `cached` สำหรับสาธิตแบบไม่ต้องใช้เน็ต |
| Bedrock | `AWS_REGION` + credential ของ AWS (`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, `AWS_PROFILE` หรือ `AWS_BEARER_TOKEN_BEDROCK`) |

แล้วรีสตาร์ต server ; key ใช้เฉพาะฝั่ง server ไม่ถูกส่งไปเบราว์เซอร์

## 9. แก้ปัญหาที่พบบ่อย
| อาการ | วิธีแก้ |
|---|---|
| `Environment variable not found: DATABASE_URL` หรือ `DATABASE_URL_UNPOOLED` | ใส่ทั้งสองตัวใน `.env` (ในเครื่องใช้ค่าเดียวกัน) ; บน Vercel ให้ Connect Neon กับโปรเจกต์แล้ว Redeploy |
| `P1001: Can't reach database server` | ตรวจว่า container `mdr-pg` ทำงานอยู่ (`docker ps`) ; ถ้าเป็น Neon ให้ต่อท้าย `&connect_timeout=15` |
| `The table ... does not exist` | รัน `npx prisma migrate deploy` แล้ว `npm run seed` |
| `@prisma/client did not initialize` | รัน `npx prisma generate` |
| `EADDRINUSE` port 3000 | ใช้ `npx next dev --port 3100` |
| ติดตั้ง `sharp` ไม่สำเร็จ | ตรวจว่าใช้ Node 64-bit เวอร์ชัน ≥ 20.9 แล้วรัน `npm ci` ใหม่ ; sharp ใช้เฉพาะตอนสร้างใบตัวอย่างใหม่ |
| Windows: เขียนไฟล์ในโฟลเดอร์โปรเจกต์ไม่ได้ | Windows Defender "Controlled folder access" อาจป้องกันโฟลเดอร์นั้น — ย้ายโปรเจกต์ไป `C:\Users\<user>\source\` หรือให้ผู้ดูแลระบบอนุญาต node.exe |
| อัปโหลดใบตัวอย่างซ้ำแล้วขึ้นเตือนข้อมูลซ้ำ | ปกติ (Lab No เดียวกัน) — กด "ยืนยันว่าไม่ซ้ำ" หรือรีเซ็ตข้อมูลสาธิต |
| บน Vercel เปิดภาพต้นฉบับที่อัปโหลดไม่ได้ (404) | ไฟล์ใน `/tmp` เป็นของ instance เดียวและหายได้ — อัปโหลดใหม่ หรือใช้ใบตัวอย่าง |

## 10. ไฟล์ที่ไม่ถูก commit (`.gitignore`)
`.env` และ `.env.*` (ยกเว้น `.env.example`), `.agents/`, `*.db`, `*.db-journal`, `uploads/`, `node_modules/`, `.next/`, `.vercel/`, `*.tsbuildinfo`, `*.pem`, `*.key`, `*.p12`, `*.pfx`

## 11. ตัวแปรสำหรับความปลอดภัย
| ตัวแปร | ค่า |
|---|---|
| `SITE_ACCESS_USER` / `SITE_ACCESS_PASSWORD` | HTTP Basic Auth ทั้งไซต์ (รวม `/api/*`) ; รหัส ≥ 12 ตัวอักษร ; ในเครื่องไม่ตั้ง = ปิด ; บน Vercel ต้องตั้ง (Sensitive) ไม่งั้น 503 |

ก่อน push ขึ้น GitHub ทุกครั้ง: สแกนความลับด้วย gitleaks และรัน `npm audit` (รายละเอียดใน SECURITY.md)
