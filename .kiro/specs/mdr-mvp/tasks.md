# Tasks — IC MDR & Antibiogram (Hackathon MVP)

> ใช้คู่กับ `requirements.md` และ `design.md` · ให้ Kiro ทำทีละ task แล้วรันทดสอบก่อนไปต่อ
> ลำดับถูกจัดให้ **ได้ของที่ demo ได้เร็วที่สุด**: ข้อมูลและตรรกะก่อน → หน้าจอที่ไม่พึ่ง AI → AI ทีหลังสุด
> ★ = จำเป็นต่อ Definition of Done · ○ = ตัดได้ถ้าเวลาไม่พอ
> หมายเหตุการติดตั้ง: โฟลเดอร์ config ที่ design เรียกว่า `data/` ใช้ชื่อ **`config/`** แทน (hook ของ workspace บล็อก path `data/` เพื่อกันข้อมูลผู้ป่วยจริง)

## วิธีใช้กับ Kiro
1. วาง `requirements.md` + `design.md` ไว้ใน `.kiro/specs/mdr-mvp/` (หรือให้ Kiro สร้าง spec จากสองไฟล์นี้)
2. ใส่ข้อห้ามถาวรใน steering (`.kiro/steering/`): *ห้ามใช้ข้อมูลผู้ป่วยจริง · ห้ามให้ LLM คำนวณสถิติ · ห้ามใส่ API key ในโค้ด/ฝั่ง client · logic สถิติอยู่ใน `lib/domain` เท่านั้น*
3. สั่งทีละ task เช่น "ทำ Task 2.1 ตาม design §4.3 และเขียน test จาก Test vector 1" แล้วรัน `npm test`
4. ถ้า Kiro ช้า ให้สั่งเป็นกลุ่มเล็ก (1 task = 1 ไฟล์หลัก) และอย่าให้สร้างหน้าจอก่อนที่ `lib/domain` ผ่าน test

---

## Phase 0 — โครงโปรเจกต์และข้อมูล (ทำก่อน)
- [x] ★ **0.1** สร้างโปรเจกต์ Next.js + TypeScript + Tailwind + shadcn/ui + Prisma(SQLite) + Vitest + Zod ; ตั้ง `.env.example`, `.gitignore` (`.env`, `uploads/`, `*.db`)
- [x] ★ **0.2** ใส่ Prisma schema ตาม design §4.1 + `prisma migrate`
- [x] ★ **0.3** สร้าง `config/*.json` (panels, sdd_allowed, intrinsic, aliases, phenotype_rules) ตาม design §4.2, §4.4
- [x] ★ **0.4** เขียน `prisma/seed.ts` ตาม design §8 + คำสั่ง `npm run seed` + ปุ่ม/endpoint `POST /api/seed` (MR4.1)

## Phase 1 — Domain logic (pure functions + test)
- [x] ★ **1.1** `firstIsolate.ts` + test (ไม่เพิ่มจำนวนแถว, tie-break คงที่, กันยีสต์/ที่ไม่ใช่ BACTERIA)
- [x] ★ **1.2** `antibiogram.ts` : %S, %SDD, n, สูตร S-only / S+SDD, `n<N`, intrinsic, tier ของ MR11 — test = **Test vector 1**
- [x] ★ **1.3** `phenotype.ts` : 6 กฎ + `UNCLASSIFIABLE` — test ด้วยใบ golden (ESBL_SCREEN ใช่, CRE ไม่ใช่)
- [x] ★ **1.4** `cluster.ts` : นับผู้ป่วยไม่ซ้ำ, รวม episode — test = **Test vector 2 และ 3**
- [x] ★ **1.5** `validators.ts` : ทั้ง 9 ตัวใน design §4.5
- [x] ★ **1.6** `getAntibiogram(scope)`, `getPhenotypeBreakdown(scope)`, `getDashboardStats(filters)` — ฟังก์ชันที่ API และ AI ใช้ร่วมกัน (**ตัวเลขต้องมาจากที่เดียว**)

## Phase 2 — Dashboard และ Antibiogram (ยังไม่ต้องใช้ AI)
- [x] ★ **2.1** `GET /api/dashboard` + หน้า Dashboard : filter, KPI, กราฟ 5 แบบ (MR5–MR7)
- [x] ★ **2.2** ตาราง "เชื้อดื้อยาล่าสุด" + ตัดคอลัมน์ HN เมื่อ role = EXECUTIVE **ที่ชั้น API** (MR7.2)
- [x] ★ **2.3** การ์ด Suspected Cluster (MR8)
- [x] ★ **2.4** `GET /api/antibiogram` + หน้า Antibiogram แท็บ "ภาพรวมเชื้อ×ยา" : ลงสี+ตัวเลข, สวิตช์สูตร, min N, แบนเนอร์ (MR9)
- [x] ★ **2.5** แท็บ "แยกตามกลุ่มเชื้อดื้อยา" + การ์ดยา 4 ระดับ + ข้อความ disclaimer (MR10–MR11)
- [ ] ○ **2.6** ปุ่มพิมพ์/PDF (MR12) · drill-down คลิกกราฟ (MR7.3) — *ทำแล้วเฉพาะปุ่มพิมพ์ (window.print) ; drill-down ตัดออก*

## Phase 3 — บันทึกข้อมูล
- [x] ★ **3.1** ฟอร์ม Key in (MR2) : auto-complete เชื้อ → ตารางยาตาม panel → phenotype อ่านอย่างเดียว → ตรวจซ้ำ
- [x] ★ **3.2** `POST /api/isolates` (DRAFT) · `POST /api/isolates/:id/approve` · หน้ารายการ isolate (MR3)
- [x] ★ **3.3** `lib/llm` adapter + `lib/extract` (prompt, Zod schema, normalize ด้วย alias) — มีโหมด `cached`
- [x] ★ **3.4** `POST /api/extract` + หน้า Upload : dropzone, ภาพต้นฉบับข้างฟอร์ม, ธงรายฟิลด์, บังคับ Ward/Patient Type (MR1)
- [x] ★ **3.5** Golden test : ใบตัวอย่าง → 15/15 คู่ยา-ผล + ธง Ward ( `fixtures/sample_report.expected.json` )
- [x] ★ **3.6** หลังยืนยัน → ตัวเลขใน Dashboard/Antibiogram อัปเดตทันที + ปุ่มลัด "ดู Dashboard" / "ปรึกษา AI"
- [ ] ○ **3.7** Import CSV + เทมเพลต (MR4.2)

## Phase 4 — AI Consult
- [x] ★ **4.1** `lib/consult/redact.ts` + `schema.ts` (Zod ตาม design §6.2)
- [x] ★ **4.2** `lib/consult/verify.ts` + test 5 เคส (ตัวเลขไม่ตรง · ขนาดยา · n น้อยแต่แนะนำยา · injection · reasoning มีตัวเลขใหม่)
- [x] ★ **4.3** `POST /api/consult` : redact → toolResults → LLM → verify (ลองใหม่ 1 ครั้ง) → log (MR13, MR15)
- [x] ★ **4.4** หน้า AI Consult : ตัวเลือกบริบท, chips คำถาม, 3 การ์ด, disclaimer, ลิงก์ "ดูตัวเลขที่ใช้" (MR13)
- [x] ★ **4.5** Consult จาก isolate (MR14) : ปุ่มในรายการ isolate, หน้า Upload หลังยืนยัน, และ Antibiogram ที่เลือกบริบทแล้ว
- [x] ○ **4.6** `AI_MODE=cached` + `fixtures/consult_cached.json` (MR16) — *ทำก่อนวัน demo จริงอย่างน้อย 1 วัน*

## Phase 5 — เก็บงานและเตรียมนำเสนอ
- [x] ★ **5.1** ตัวสลับบทบาท ICN/DOCTOR/EXECUTIVE (cookie) + ซ่อนปุ่มที่ไม่มีสิทธิ์
- [x] ★ **5.2** ปิดทับ HN บนภาพตัวอย่างก่อน commit ; ตรวจว่า repo ไม่มี `.env`, ไม่มีข้อมูลจริง
- [x] ★ **5.3** รันตรวจ Definition of Done ทั้ง 6 ข้อใน `requirements.md`
- [x] ★ **5.4** `README.md` : คำสั่งรัน, env, โหมด cached, ข้อจำกัดของ demo
- [ ] ○ **5.5** สไลด์ Roadmap : ตารางใน requirements §0.5 → ระบบจริง (OCR sandbox, AI gateway, RLS/MFA, audit, report versions, MDR/XDR)

---

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
