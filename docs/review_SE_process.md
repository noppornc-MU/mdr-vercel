# การวิเคราะห์และปรับปรุงกระบวนการ Software Engineering — IC MDR

> ขอบเขตการทบทวน: `requirements_IC_MDR.md` (v4), `design_IC_MDR.md`, `deployment_IC_MDR.md`
> ไม่ได้เห็นไฟล์ใน `deploy/` (compose, Caddyfile, scripts, CI) — ข้อสังเกตด้าน deploy อิงจากคำบรรยายในคู่มือ
> ข้อสังเกตเรื่องพฤติกรรม PostgreSQL (RLS, NULL ใน UNIQUE) ยังไม่ได้รันกับฐานข้อมูลจริง ต้องยืนยันด้วย test ใน Increment 1

## 0. สรุป
1. **ข้อขัดแย้งระหว่าง requirements กับ DDL/RLS** — ถ้าเขียนโค้ดตาม design ตรง ๆ จะได้ bug ทันที
2. **ลำดับงานเป็น waterfall ตามชั้น** — ความเสี่ยงสูงสุด (OCR, นิยามกฎ phenotype) ถูกวางไว้ท้าย
3. **ยังไม่มีกลไกการทำงานจริง** — ไม่มี DoR/DoD, ไม่มีเจ้าของคำถามค้าง, ไม่มีข้อมูลสังเคราะห์, สืบย้อน R-ID ↔ test ด้วยมือ

## 1. ข้อบกพร่องที่ต้องแก้ก่อนเริ่มโค้ด
ระดับ: สูง = bug/ช่องโหว่ทันที · กลาง = ขาดสิ่งที่ requirement บังคับ · ต่ำ = ควรตัดสินใจให้ชัด

### 1.1 Data model และ business rules
| ID | ปัญหา | ข้อเสนอ | ระดับ |
|---|---|---|---|
| D1 | `first_isolates`/cluster กรอง `report_status = FINAL` (อยู่ใน `lab_reports`) แต่ seed มี `lab_report_id = NULL` → ข้อมูลประวัติ ~4.7 พันแถวหายจากสถิติ | predicate "Approved data" ที่เดียว: `status='APPROVED' AND (source='EXCEL_SEED' OR lr.report_status='FINAL')` + test ; แก้ §0.3 | สูง |
| D2 | `approved_has_approver` บังคับ `approved_by` แต่ seed เป็น `APPROVED` โดยไม่มีผู้อนุมัติ → import ล้ม | บัญชีระบบ `system:excel-seed` ; `approved_at` = เวลา commit ; ระบุใน R28.6 | สูง |
| D3 | `isolate_phenotypes` เก็บเฉพาะ code ที่ "เป็น" → แสดง "ไม่สามารถจัดกลุ่มได้" (R33.5) ไม่ได้ | เพิ่ม `result` (`POSITIVE/NEGATIVE/INDETERMINATE`) และ `missing_drugs` | กลาง |
| D4 | `phenotype_rules.definition jsonb` ไม่มีนิยาม DSL → ICN แก้กฎไม่ได้, ทดสอบไม่ได้ | JSON Schema ของ rule DSL + ตัวอย่าง CRE/MRSA/CR-AB + test vector (บล็อก R33) | สูง |
| D5 | DDL ยอม `NS` แต่ R1.4/R3.9c ยอมเฉพาะ S/I/R/D | ตัดสิน Q25 แล้วแก้ให้ตรงกัน | ต่ำ |
| D6 | ขาดคอลัมน์: `next_appointment_date`, `culture_clearance_status`, notes/ASP flag (R1.2, R3.4, R17–R18), annotation จาก seed (R28.4), `source_row_hash` (R28.9) | เพิ่มคอลัมน์ + `isolate_annotations` ; `source_row_hash` UNIQUE | กลาง |
| D7 | ขาดตาราง: `extraction_jobs`, `notifications` (R6, R20), `export_requests` (R45.1), `break_glass_grants` (R45.3), `cluster_watchlist` + `cluster_episodes` (R11, R19), สถานะ alias `PROPOSED/CONFIRMED` (R28.7), master `case_types` (Q11) | เพิ่มใน DDL ก่อน migration แรก | กลาง |
| D8 | ICN แก้ record `APPROVED` → เวอร์ชันใหม่เป็น `PENDING` → หายจากสถิติ ; 4-eyes ทำให้ ICN อนุมัติเองไม่ได้ | ตัดสิน Q26 | กลาง |
| D9 | ไม่มีทางออกสำหรับ draft เสีย/อัปโหลดผิดผู้ป่วย (R48.3) | เพิ่มสถานะ `VOIDED` (เหตุผล + audit) | กลาง |
| D10 | UNIQUE ที่มีคอลัมน์ NULL ได้ (`lab_reports`, `drugs`) — PostgreSQL ถือว่า NULL ไม่ซ้ำกัน → ตรวจซ้ำไม่ได้ผล | `NULLS NOT DISTINCT` (PG15+) หรือ NOT NULL + sentinel | กลาง |
| D11 | Audit hash chain: ธุรกรรมพร้อมกันอ่าน `prev_hash` เดียวกัน → chain แตกกิ่ง | `pg_advisory_xact_lock` ตอนเขียน audit | กลาง |
| D12 | `users.role` ค่าเดียว | ตัดสิน Q27 ; ถ้าหลายบทบาทใช้ `user_roles` | ต่ำ |
| D13 | Appendix B เป็นตัวอย่าง ไม่ใช่ schema และไม่มี bbox → R5.2 (ภาพครอบรายยา) ทำไม่ได้ | `packages/contracts/extraction.schema.json` v1 มี `page`, `bbox`, `method`, `confidence` ต่อฟิลด์ | สูง |
| D14 | R3.8 "extract twice" ไม่มีความหมายกับ parser แบบ deterministic | text layer → เทียบ text parse กับ OCR ของหน้าที่ render ; ภาพ → สองวิธีอิสระ ; ตั้งค่าได้ | ต่ำ |

### 1.2 Authorization (RLS)
| ID | ปัญหา | ข้อเสนอ | ระดับ |
|---|---|---|---|
| A1 | `isolates_select` ให้ DOCTOR/PHARMACIST/EXECUTIVE อ่านทุกแถว APPROVED รวม HN → ขัด R27/R39 | Executive ไม่มี SELECT บน `isolates` ; ข้อมูลรวมผ่าน view/ฟังก์ชัน `SECURITY DEFINER` + suppression ; column privilege กับ `patient_hn` | สูง |
| A2 | ไม่มี policy INSERT → เปิด RLS แล้ว INSERT ถูกปฏิเสธ | `FOR INSERT WITH CHECK (ward ∈ scope)` | สูง |
| A3 | `isolates_write` ไม่มี `WITH CHECK` → ผู้ใช้ย้าย record ไป ward นอกสิทธิ์ได้ | `WITH CHECK` ตรวจ ward ; เปลี่ยนสถานะผ่าน service/ฟังก์ชันเท่านั้น | สูง |
| A4 | `current_setting(...)::uuid` — หลัง `SET LOCAL` จบ ค่าเป็น `''` ไม่ใช่ NULL → cast error กับ pool | `NULLIF(current_setting(...), '')::uuid` + test กับ pool จริง | กลาง |
| A5 | GUC `app.role` ตั้งโดย role แอปเอง → ไม่ป้องกัน SQL injection | บันทึกใน ADR ; ทางเลือก `SET ROLE` ต่อบทบาท | ต่ำ |

### 1.3 Network และ deployment
| ID | ปัญหา | ข้อเสนอ | ระดับ |
|---|---|---|---|
| N1 | `api` อยู่ในเครือข่าย sandbox → worker เรียก API ได้ทุก endpoint | บริการ/listener `ingest` เปิดเฉพาะ callback บน sandbox ; API หลักออกจาก sandbox | กลาง |
| N2 | Redis ใช้ร่วม sandbox/backend → worker ที่ถูกเจาะ enqueue งานให้ `worker-jobs` (มีสิทธิ์ DB) | Redis ACL ต่อผู้ใช้จำกัด key prefix หรือแยก Redis ; payload เป็นข้อมูลไม่น่าเชื่อถือ ; เซ็นข้อความงาน | กลาง |
| N3 | `clamav` อยู่ทั้ง egress และ sandbox | แยก `freshclam` (egress) กับ `clamd` (sandbox) ใช้ volume ลายเซ็นร่วม (clamd อ่านอย่างเดียว) | กลาง |
| N4 | ไม่ระบุว่ารัน migration จากที่ใด | service `migrate` one-off (`docker compose run --rm migrate`) ได้ secret เฉพาะตัว | กลาง |
| N5 | log shipping เป็น "ทางเลือก" แต่ audit chain พึ่งมัน | ย้ายเป็นงาน P0 ; เพิ่ม NTP | กลาง |
| N6 | backup DB ไม่ระบุ `pg_dump` หรือ WAL archiving | ระบุทั้งสองแบบ เลือกตาม Q10 | ต่ำ |
| N7 | ต้องตรวจว่าความลับส่งแยกต่อ service | compose `secrets:` ต่อ service | ไม่ทราบ |

## 2. ช่องว่างใน requirements
- UI/UX บางมาก — ไม่มี screen flow/wireframe ทั้งที่หน้าตรวจ (R5.2–R5.3) กำหนดผล NFR-11 → prototype + usability test กับ ICN ตั้งแต่ต้น
- ไม่มี requirement สำหรับ PDPA data subject, job ลบไฟล์ตาม `retention_until`, การยกเลิกสิทธิ์ให้ตรงกับ IdP
- NFR-11 ต้องกำหนด *วิธีวัด* ตอนนี้ (เช่น เวลา review = เปิด → approve/reject ไม่นับช่วงไม่มีกิจกรรมเกิน X นาที)
- Quick Demo (R4) ต้องมีผู้รับผิดชอบการ de-identify ตัวอย่าง

### คำถามค้าง แยกตามสิ่งที่บล็อก (หลัก: สร้างกลไกตอนนี้ ใส่นโยบายทีหลัง)
| กลุ่ม | คำถาม |
|---|---|
| เปลี่ยนโครงสร้าง/โค้ด | Q12, Q13, Q21, Q19, Q26, Q27, Q28 |
| ค่าตั้ง/ตารางกฎ — บล็อกการเปิดใช้ | Q1, Q2, Q3, Q4, Q14–Q17, Q20, Q22, Q23 |
| นโยบาย/กฎหมาย — บล็อก go-live | Q5, Q6, Q7, Q10, Q18, Q24 |

คำถามใหม่: **Q25** ยอมรับ `NS` หรือไม่ · **Q26** ICN แก้ record ที่อนุมัติแล้ว → `APPROVED` ทันที หรือ `PENDING` · **Q27** ผู้ใช้มีหลายบทบาทได้หรือไม่ · **Q28** โค้ดและ CI อยู่ที่ไหน (GitHub / GitLab ภายใน)

## 3. ปรับกระบวนการพัฒนา

### 3.1 Incremental ตามความเสี่ยง (แทน P0/P1 แบบตามชั้น)
| Increment | เนื้อหา | Req หลัก |
|---|---|---|
| Inc 0 — Setup | repo, steering, CI ขั้นต่ำ, compose dev, ตัวสร้างข้อมูลสังเคราะห์, ADR, ทะเบียนตัดสินใจ | R47, R52 (บางส่วน) |
| Inc 1 — Walking skeleton | master data ขั้นต่ำ → คีย์เอง → submit → approve → ช่อง %S หนึ่งช่องพร้อม first-isolate ; Keycloak dev ; RLS + authz matrix ; audit | R1, R5, R12, R26, R27, R29, R43 |
| Spike S1 (คู่ขนาน) | template parser กับ golden case #1 ; วัดผล ; ไม่ใช่โค้ด production | R3, R32 |
| Spike S2 (คู่ขนาน) | ต้นแบบ rule DSL + ICN ทบทวน CRE/MRSA | R33 |
| Inc 2 — Seed import | dry-run + reconciliation บน Excel สังเคราะห์ | R28, R34 |
| Inc 3 — Upload pipeline | sandbox, AV, extraction, หน้าตรวจพร้อมภาพครอบ, report versions | R3, R5, R35, R36, R41, R42 |
| Inc 4 — Analytics | Dashboard, cluster, antibiogram + published, suppression | R7–R14, R39, R44 |
| Inc 5 — Hardening | config governance, export, 4-eyes, pentest, DPIA, ซ้อมเหตุ/กู้คืน | R40, R45, R46, R48, R49, NFR-13 |

### 3.2 Definition of Ready
- [ ] ระบุ R-ID และ acceptance criteria ที่ทดสอบได้
- [ ] คำถามที่บล็อกได้คำตอบ หรือตกลงค่าเริ่มต้นแบบตั้งค่าได้
- [ ] logic โดเมนมี test vector ที่คำนวณมือได้
- [ ] ระบุชนิดข้อมูล (PHI / aggregate / config)
- [ ] data flow ใหม่ข้ามโซน → อัปเดต threat model

### 3.3 Definition of Done
- [ ] unit test (+ property test สำหรับ `packages/domain`) ผ่าน
- [ ] endpoint ใหม่มีแถวใน authz matrix ; RLS test ผ่านบน PostgreSQL จริง
- [ ] migration expand/contract ผ่าน upgrade → downgrade → upgrade
- [ ] การเปลี่ยนข้อมูลส่ง audit event ; test "ไม่มี PHI ใน log" ผ่าน
- [ ] OpenAPI/runbook/เอกสารอัปเดต ; security scan ผ่าน ; คนทบทวนแล้ว (R47.3)

### 3.4 สืบย้อนอัตโนมัติ
`@pytest.mark.req("R12.2")` → สคริปต์ CI สร้างตารางสืบย้อน แจ้งเมื่อ Must ใน increment ปัจจุบันไม่มี test ; `tasks.md` และ PR template อ้าง R-ID

### 3.5 ข้อมูลทดสอบ
ตัวสร้างข้อมูลสังเคราะห์เป็นงาน Inc 0 จำลองจาก Appendix A: ward ว่าง ~46%, HN ซ้ำหลายแถว, ช่อง AST ไม่ใช่ S/I/R/D ~17%, D ส่วนใหญ่ที่ Cefepime/Pip-tazo, yeast/Mycobacterium, วันที่ พ.ศ./ค.ศ. ปน, คอลัมน์ยาซ้ำ `.1`, qualifier (CFU) ; ชุด ≥ 50,000 isolates (NFR-1) ; Excel สังเคราะห์ 86 คอลัมน์ ; golden set de-identify โดย IC เก็บนอก workspace ของเอเจนต์

### 3.6 การจัดการการตัดสินใจ
`docs/adr/`: ADR-001 monolith + Python/FastAPI · ADR-002 RLS ผ่าน GUC (A5) · ADR-003 queue + Redis ACL (N2) · ADR-004 topology sandbox/ingest (N1, N3) · ADR-005 predicate Approved data (D1) · ADR-006 audit hash chain (D11) · ADR-007 rule DSL (D4)
`docs/decisions.md`: ทะเบียน Q1–Q28 พร้อมค่าสมมติ, เจ้าของ, วันที่ต้องได้คำตอบ, increment ที่บล็อก

### 3.7 การควบคุมเอเจนต์ AI (R47)
steering `product.md`, `tech.md`, `structure.md`, `security-data.md` ; hook บล็อก path ข้อมูลจริง ; Supervised mode สำหรับ migrations/RLS, auth, gateway ; spec ต่อ increment ; allowlist MCP

### 3.8 CI ที่ควรเพิ่ม
PostgreSQL service (RLS/constraint/migration up-down) · `import-linter` · `hadolint` + scan config · DAST baseline บน staging · coverage ของ `packages/domain` + mutation testing รายคืน · restore test บน staging · รายงานสืบย้อน R-ID

## 4. ความเสี่ยงหลัก
OCR/layout (Q5, Q12) → Spike S1 · กฎ phenotype (Q4, Q16) → Spike S2 · RLS ผิด → test บน DB จริงตั้งแต่ Inc 1 · ICN คอขวด (Q22) → วัดคิว + Q26 · หน้าตรวจไม่ถูกใช้ → usability test · SaMD (Q19) → P2 แยกขาด + kill switch
