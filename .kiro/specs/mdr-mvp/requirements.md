# Requirements — IC MDR & Antibiogram (Hackathon MVP)

> ฉบับย่อจาก `requirements_IC_MDR_v4.md` เพื่อ **สร้างใน Kiro ให้เสร็จและ demo ได้ภายในเวลาแข่ง**
> เป้าหมาย: เห็นภาพการทำงานครบวงจร **บันทึก → Dashboard → Antibiogram → AI Consult**
> รูปแบบ: EARS (`WHEN … THE SYSTEM SHALL …`) · อ้างอิงข้อกำหนดเดิมด้วย `[v4 Rxx]`
> สถานะ: **demo เท่านั้น ไม่ใช่ระบบใช้งานจริง** — ใช้ข้อมูลสังเคราะห์ ไม่ใช่ข้อมูลผู้ป่วยจริง

## 0. ขอบเขตและหลักการ

### 0.1 Flow ที่ต้อง demo ให้ได้
```
[1 บันทึกข้อมูล]  Upload ใบผลแล็บ (AI อ่าน) หรือ Key in
        ↓ คนตรวจและกดยืนยัน
[2 Dashboard]     สถิติเชื้อ/ward/specimen/แนวโน้ม/เชื้อดื้อยา
        ↓ ข้อมูลเดียวกัน
[3 Antibiogram]   %S ต่อเชื้อ×ยา + จัดกลุ่มเชื้อดื้อยา + ยาที่ข้อมูลท้องถิ่นสนับสนุน
        ↓
[4 AI Consult]    ดึงข้อมูลจาก 3 แล้วอธิบายตัวเลือกยาให้เหมาะกับเชื้อที่พบ
```

### 0.2 หลักการที่คงไว้จาก v4 (ห้ามตัด เพราะเป็นจุดขายด้านความปลอดภัย)
1. **Deterministic ก่อน AI** — %S, first isolate, phenotype, cluster เป็นโค้ดที่ทดสอบได้ ; LLM ใช้ *อ่านใบผล* และ *อธิบายตัวเลขที่ระบบคำนวณแล้ว* เท่านั้น `[v4 §0.2]`
2. **Human-in-the-loop** — ผล AI OCR เป็น `DRAFT` จนคนกด "ยืนยัน" ; ข้อมูลที่ยังไม่ยืนยันไม่เข้าสถิติ `[v4 R5]`
3. **ไม่เดา** — อ่านไม่ได้ / จับคู่ master ไม่ได้ → `null` + ติดธง `needs_review` `[v4 R3.7]`
4. **AI ไม่สั่งการรักษา** — แยก *ข้อเท็จจริง / การอนุมาน / ดุลยพินิจแพทย์*, ไม่ให้ขนาดยา, n น้อยต้องงดตอบ, มี disclaimer ทุกคำตอบ `[v4 R15]`
5. **ไม่มี PHI จริง** — seed เป็นข้อมูลสังเคราะห์ ; ไม่ extract/เก็บชื่อผู้ป่วย `[v4 R30]`

### 0.3 คำนิยามกลาง (ย่อจาก v4 §0.3)
| คำ | นิยาม |
|---|---|
| Isolate | ผลเพาะเชื้อ 1 สายพันธุ์ จาก 1 specimen ของผู้ป่วย 1 ราย พร้อมผล AST |
| AST result | `S`, `I`, `R`, `D` (SDD), ว่าง = ไม่ได้ทดสอบ |
| `specimen_date` | วันที่ Lab รับสิ่งส่งตรวจ (ใช้เป็นวันฐานของทุกสถิติ) `[v4 Q1]` |
| Approved data | `status = APPROVED` **และ** `report_status = FINAL` — เท่านั้นที่เข้า Dashboard / Antibiogram / AI |
| First isolate | isolate แรกของผู้ป่วยแต่ละราย ต่อชนิดเชื้อ ต่อช่วงวิเคราะห์ `[v4 R12.1]` |
| Phenotype | กลุ่มเชื้อดื้อยา (CRE, CRAB, CRPA, MRSA, VRE, ESBL-screen) คำนวณโดยระบบจากตารางกฎ ไม่ให้ผู้ใช้เลือกเอง `[v4 R33]` |

### 0.4 บทบาท (demo ใช้ตัวสลับบทบาทมุมขวาบน ไม่มี login จริง)
| บทบาท | ทำได้ |
|---|---|
| `ICN` | ทุกหน้า ยืนยัน/ลบข้อมูล |
| `DOCTOR` | Dashboard, Antibiogram, AI Consult (ดู HN ได้) |
| `EXECUTIVE` | Dashboard แบบรวม — **ไม่เห็น HN** |

### 0.5 สิ่งที่ตัดออกจาก v4 (ใส่ไว้ใน "Roadmap" ของสไลด์นำเสนอ)
| ตัดใน MVP | ข้อกำหนด v4 | เหตุผล |
|---|---|---|
| Sandbox OCR, AI Gateway, PHI masking อัตโนมัติ | R36, R41, R42 | ใช้ข้อมูลสังเคราะห์ + แบนเนอร์เตือน ; ฟังก์ชัน LLM เรียกผ่าน adapter ตัวเดียว |
| Login/MFA/RBAC จริง, RLS | R26, R27, R43, R51 | ใช้ตัวสลับบทบาท |
| Audit hash chain, backup, deploy, incident | R29, R46–R48, R52 | นอกขอบเขต demo (เก็บ log พื้นฐานเท่านั้น) |
| Report versions, 4-eyes, frozen antibiogram | R35, R40, R44 | ซับซ้อน ไม่เห็นผลใน demo |
| Excel seed importer แบบเต็ม, reconciliation | R28, R34 | ใช้สคริปต์สร้างข้อมูลสังเคราะห์แทน |
| MDR/XDR (Magiorakos), culture tracking, LINE alert | R33.2, R17–R19 | ต้องมีกฎจาก ICN ; ทำเฉพาะ phenotype หลัก 6 กลุ่ม |
| Small-cell suppression, export control, config governance | R39, R45, R49 | — |

---

## Feature 1: บันทึกข้อมูล (Key in / Upload)

### MR1. Upload ใบผลแล็บ → AI อ่านข้อมูล · **Must**
**As an** ICWN/Lab, **I want to** อัปโหลดใบรายงานผลเพาะเชื้อ **So that** ไม่ต้องคีย์ผล AST ทีละยา `[v4 R3]`
1. THE SYSTEM SHALL รับ `.png`, `.jpg`, `.jpeg`, `.pdf` ขนาด ≤ 10 MB และปฏิเสธชนิดอื่น
2. THE SYSTEM SHALL แสดงแบนเนอร์ "โหมดสาธิต — อัปโหลดเฉพาะใบตัวอย่าง/ที่ปกปิดข้อมูลผู้ป่วยแล้ว" ก่อนอัปโหลด
3. WHEN ไฟล์ถูกอัปโหลด, THE SYSTEM SHALL ส่งไปยัง LLM ที่รองรับภาพ **จากฝั่ง server เท่านั้น** (ไม่มี API key ในเบราว์เซอร์) และรับผลเป็น JSON ตาม schema ใน design §5
4. THE SYSTEM SHALL สกัด: HN, เพศ, Lab No, Order No, specimen, เชื้อ (แต่ละ isolate), ตาราง AST (ยา→ผล), วันที่รับตรวจ/รายงานผล, สถานะรายงาน (`Final`/`Preliminary`), หมายเหตุแล็บ ; **ห้ามสกัดหรือเก็บชื่อผู้ป่วย**
5. THE SYSTEM SHALL แปลงวันที่ `DD/MM/YYYY` ทั้ง พ.ศ. และ ค.ศ. เป็น ค.ศ. และเก็บข้อความเดิม
6. THE SYSTEM SHALL จับคู่ชื่อเชื้อ/ยา/specimen กับ master ผ่านตาราง alias ; IF จับคู่ไม่ได้, THEN เว้นว่างและติดธง `needs_review`
7. THE SYSTEM SHALL ตรวจ AST ตามกฎ `[v4 R3.9]`: จำนวนชื่อยา = จำนวนผล, ทุกยาอยู่ใน master, ผล ∈ {S,I,R,D}, ผล `D` ยอมรับเฉพาะคู่ในตาราง `sdd_allowed`, เชื้ออยู่ใน master, อ่านสถานะรายงานได้ ; กฎที่ไม่ผ่าน → ธงระดับฟิลด์
8. THE SYSTEM SHALL ขอ **Ward** และ **Patient Type (OPD/IPD)** จากผู้อัปโหลด (บังคับ) เพราะใบผลมักไม่มี `[v4 R3.4]`
9. THE SYSTEM SHALL แสดงภาพต้นฉบับ (ซูมได้) **ข้างฟอร์มที่สกัดได้** และเน้นสีเฉพาะฟิลด์ที่ติดธง
10. IF LLM ไม่พร้อมใช้งานหรือ API ล้มเหลว, THEN THE SYSTEM SHALL แสดงข้อความและเสนอ "กรอกเอง" (MR2) โดยส่วนอื่นของระบบยังทำงานได้ `[v4 R46.1]`
11. WHERE โหมด `EXTRACT_MODE=cached`, THE SYSTEM SHALL คืนผลที่บันทึกไว้ล่วงหน้าสำหรับใบตัวอย่าง (กันเน็ต/คีย์มีปัญหาตอนขึ้นเวที)

### MR2. Key in ด้วยมือ · **Must**
1. THE SYSTEM SHALL มีฟอร์ม 3 ส่วน: ผู้ป่วย (HN, เพศ, Patient Type, Ward) · specimen (วันที่, ชนิด, Lab No) · เชื้อ + ตาราง AST
2. THE SYSTEM SHALL ให้เลือกเชื้อด้วย auto-complete จาก master และแสดง **ชุดยามาตรฐานของกลุ่มเชื้อนั้นอัตโนมัติ** ให้ผู้ใช้กดเลือก S/I/R/D ต่อยา
3. THE SYSTEM SHALL ตรวจ: HN เป็น text (คงเลข 0 นำหน้า), วันที่ ≤ วันนี้, ไม่มียาซ้ำ, ผล ∈ {S,I,R,D}, อย่างน้อย 1 ผล AST
4. THE SYSTEM SHALL **ไม่ให้ผู้ใช้เลือก phenotype** — คำนวณและแสดงแบบอ่านอย่างเดียวทันทีที่กรอกผล `[v4 R1.3]`
5. WHEN บันทึก, IF พบข้อมูลซ้ำ (Lab No เดียวกัน หรือ HN+เชื้อ+specimen+วันที่ เดียวกัน), THEN THE SYSTEM SHALL เตือนและขอให้ยืนยัน `[v4 R31]`

### MR3. ตรวจและยืนยันข้อมูล · **Must**
1. THE SYSTEM SHALL เก็บ record จาก MR1/MR2 เป็น `DRAFT` ; ปุ่ม **"ยืนยันข้อมูล"** ปิดไว้จนกว่าฟิลด์จำเป็นครบและไม่มีธงค้าง `[v4 R5.4]`
2. IF `report_status` ≠ `FINAL`, THEN THE SYSTEM SHALL อนุญาตบันทึกแต่ **ไม่นับในสถิติ** และแสดงป้าย "Preliminary" `[v4 R35.4]`
3. WHEN ผู้ใช้ (บทบาท ICN) กดยืนยัน, THE SYSTEM SHALL ตั้ง `APPROVED` พร้อมผู้ยืนยันและเวลา แล้วสถิติ **ทุกหน้าอัปเดตทันที** (MVP ยืนยันขั้นเดียว)
4. WHEN บันทึกสำเร็จ, THE SYSTEM SHALL แสดงปุ่มลัด "ดู Dashboard" และ "ปรึกษา AI สำหรับเชื้อนี้" (→ MR18)
5. THE SYSTEM SHALL มีหน้ารายการ isolate (ค้น/กรองตาม HN, เชื้อ, ward, สถานะ, วันที่) และลบได้เฉพาะ `DRAFT` หรือโดย ICN

### MR4. Import CSV และข้อมูลตัวอย่าง · **Should**
1. THE SYSTEM SHALL มีปุ่ม **"โหลดข้อมูลสาธิต"** ที่สร้าง/รีเซ็ต isolate สังเคราะห์ (design §8) ภายใน 10 วินาที
2. THE SYSTEM SHALL รับ CSV ตามเทมเพลตที่ดาวน์โหลดได้ (หนึ่งแถว = หนึ่ง isolate, คอลัมน์ยาเป็นชื่อยา) และรันตัวตรวจเดียวกับ MR1.7 ; แถวที่ผ่านเข้าเป็น `DRAFT` ; แถวที่ไม่ผ่านแสดงเหตุผลรายแถว

---

## Feature 2: Dashboard

### MR5. KPI Cards · **Must** `[v4 R7]`
1. THE SYSTEM SHALL คำนวณจาก Approved data เท่านั้น และแสดง: จำนวน isolate, จำนวนผู้ป่วย (distinct HN), ผู้ป่วยเชื้อดื้อยากลุ่มเฝ้าระวัง (นับ first-isolate), สัดส่วน ICU/Non-ICU, จำนวน CRE/CRAB/CRPA/MRSA/VRE, จำนวน suspected cluster
2. THE SYSTEM SHALL แสดง % เปลี่ยนแปลงเทียบช่วงก่อนหน้าที่ยาวเท่ากัน และ tooltip ระบุว่านับ isolate หรือผู้ป่วย

### MR6. Filters · **Must** `[v4 R8]`
- ช่วงวันที่ (default = 90 วันล่าสุดของข้อมูล), ประเภท ward (ICU/Non-ICU), ward, specimen, เชื้อ — ใช้กับทุก widget พร้อมกัน

### MR7. Charts และตาราง · **Must** `[v4 R9–R10]`
1. THE SYSTEM SHALL แสดง: แท่ง ICU vs Non-ICU, แท่งรายหอผู้ป่วย, วงกลม specimen, เส้นแนวโน้มรายเดือนของเชื้อดื้อยา, แท่ง Top 10 เชื้อ
2. THE SYSTEM SHALL แสดงตาราง "เชื้อดื้อยาล่าสุด" (เรียงใหม่→เก่า) พร้อม phenotype, ward, วันที่ ; บทบาท EXECUTIVE **ไม่เห็น HN**
3. THE SYSTEM SHALL คลิกที่แท่ง/ชิ้นกราฟเพื่อกรองข้อมูล (drill-down) — *Could*

### MR8. Suspected Cluster · **Must** `[v4 R11]`
1. THE SYSTEM SHALL ตรวจ: เชื้อ (หรือ phenotype) เดียวกัน, ward เดียวกัน, ผู้ป่วยไม่ซ้ำ ≥ 3 ราย ภายใน 14 วัน (ปรับได้) โดยนับ **ผู้ป่วยไม่ซ้ำ ไม่ใช่จำนวนแถว**
2. THE SYSTEM SHALL รวมช่วงที่ซ้อนกันเป็น 1 episode แสดงวันแรก/วันล่าสุด/รายชื่อผู้ป่วย และติดป้าย "suspected" — ไม่ประกาศว่าเป็น outbreak
3. THE SYSTEM SHALL ไม่นับ isolate ที่ไม่ทราบ Ward

---

## Feature 3: Antibiogram

### MR9. ตาราง %Susceptibility · **Must** `[v4 R12]`
1. THE SYSTEM SHALL ใช้ Approved isolate + first-isolate rule ต่อผู้ป่วย/ชนิดเชื้อ/ช่วงวิเคราะห์ และใช้เฉพาะเชื้อกลุ่ม bacteria
2. THE SYSTEM SHALL แสดงแต่ละช่อง: **%S**, **%SDD** (เฉพาะคู่ที่มีในตาราง `sdd_allowed`), และ **n tested** ; ยาที่ไม่ได้ทดสอบไม่นับในตัวหาร ; I และ R ไม่รวมใน %S
3. THE SYSTEM SHALL มีสวิตช์ "%S = S เท่านั้น" / "%S รวม SDD" และแสดงตัวเลือกที่ใช้อยู่บนหน้าจอเสมอ
4. IF n tested < minimum N (default 30, ปรับได้), THEN THE SYSTEM SHALL แสดง `n<N` พร้อมจำนวนจริง ; WHERE ผู้ใช้ลด N, THE SYSTEM SHALL แสดงแบนเนอร์ "ข้อมูลน้อย — ใช้ประกอบเท่านั้น"
5. THE SYSTEM SHALL ลงสี ≥90 เขียว · 70–89 เหลือง · 50–69 ส้ม · <50 แดง · เทา = n ไม่พอ โดย **แสดงตัวเลขเสมอ** (ไม่พึ่งสีอย่างเดียว)
6. THE SYSTEM SHALL ซ่อน/ทำเครื่องหมายคู่เชื้อ-ยาที่ดื้อโดยธรรมชาติ (intrinsic) ตามตาราง `[v4 R33.3]`
7. THE SYSTEM SHALL แสดง "ข้อมูลถึงวันที่ …", จำนวน record ที่ยังไม่ยืนยัน (ไม่ถูกนับ), และ disclaimer ทางคลินิก
8. THE SYSTEM SHALL มีตัวกรอง: ช่วงเวลา, ward/กลุ่ม ward, specimen category, กลุ่มเชื้อ, minimum N

### MR10. จัดกลุ่มเชื้อดื้อยา (Phenotype) · **Must** *(ใหม่ ตอบโจทย์ข้อ 3)*
1. THE SYSTEM SHALL จัดกลุ่มแต่ละ isolate ด้วยตารางกฎ (design §4.4): CRE, CRAB, CRPA, MRSA, VRE, ESBL-screen ; กฎเป็น *ฉบับร่างรอ ICN/จุลชีววิทยารับรอง* และต้องแสดงข้อความนี้บนหน้าจอ
2. IF ยาที่กฎต้องใช้ไม่ได้ทดสอบ, THEN THE SYSTEM SHALL แสดง "ไม่สามารถจัดกลุ่มได้" ไม่ใช่ "ไม่ใช่" `[v4 R33.5]`
3. THE SYSTEM SHALL มีมุมมอง **"แยกตามกลุ่มเชื้อดื้อยา"**: เลือกเชื้อหรือ phenotype (เช่น *K. pneumoniae – CRE*) แล้วเห็น %S ของยาแต่ละตัวเฉพาะกลุ่มนั้น

### MR11. ยาที่ข้อมูลท้องถิ่นสนับสนุน (ประกอบการพิจารณาของแพทย์) · **Must** *(ใหม่ ตอบโจทย์ข้อ 3)*
1. WHEN ผู้ใช้เลือกเชื้อ/phenotype/ward, THE SYSTEM SHALL แสดงรายการยาเรียงตาม %S จากมากไปน้อย แบ่งป้ายตามเกณฑ์: **"ข้อมูลท้องถิ่นสนับสนุน"** (≥90) · **"พิจารณาประกอบดุลยพินิจ"** (70–89) · **"ข้อมูลท้องถิ่นไม่สนับสนุน"** (<70) · **"ข้อมูลน้อย"** (n<N)
2. THE SYSTEM SHALL ไม่ใช้คำว่า first-line/alternative/แนะนำให้ใช้ และไม่แสดงขนาดยา `[v4 R15.5–15.6, Q9]`
3. THE SYSTEM SHALL แสดงข้อความ "ข้อมูลนี้ใช้ประกอบการพิจารณา ไม่ใช่คำสั่งการรักษา" กำกับ

### MR12. ส่งออก · **Could**
- ปุ่มพิมพ์/บันทึก PDF ของตาราง พร้อมช่วงเวลา, ตัวกรอง, minimum N, สูตร %S และวันที่ของข้อมูล `[v4 R14]`

---

## Feature 4: AI Assistant (Consult)

### MR13. AI Consult จากบริบท ward/เชื้อ/specimen · **Must** `[v4 R15]`
1. THE SYSTEM SHALL รับ: เชื้อ (หรือ phenotype), ward, specimen category, ตำแหน่งติดเชื้อ (ไม่บังคับ), คำถามอิสระ (ไม่บังคับ) พร้อมปุ่มคำถามตัวอย่าง (chips)
2. THE SYSTEM SHALL ดึงข้อมูลผ่านฟังก์ชันคำนวณฝั่ง server (ตัวเดียวกับ MR9–MR11) แล้วส่งให้โมเดลเฉพาะ **ตัวเลขรวมที่ไม่ระบุตัวตน**
3. THE SYSTEM SHALL บังคับให้โมเดลตอบเป็น JSON ตาม schema (design §6.2) และแสดงเป็น 3 ส่วน: **ข้อเท็จจริงจากข้อมูล** · **การวิเคราะห์ (อนุมาน)** · **ประเด็นที่ต้องใช้ดุลยพินิจแพทย์/เภสัชกร**
4. THE SYSTEM SHALL แสดงยาเป็น "ข้อมูลท้องถิ่นสนับสนุน" เรียงตาม %S พร้อม n เสมอ ไม่ใช่ใบสั่งยา
5. THE SYSTEM SHALL **ไม่ให้ขนาดยา ความถี่ หรือระยะเวลา**
6. IF n tested < minimum N หรือไม่มีข้อมูล, THEN THE SYSTEM SHALL ตอบว่าข้อมูลไม่เพียงพอและ **ไม่อนุมาน/ไม่แนะนำยา** `[v4 R15.7]`
7. THE SYSTEM SHALL แสดง disclaimer "ข้อมูลนี้เป็นข้อมูลสนับสนุนการตัดสินใจ ไม่ใช่คำสั่งการรักษา" ทุกคำตอบ
8. THE SYSTEM SHALL ตรวจข้อความอิสระและลบตัวระบุ (ตัวเลขยาว ≥ 6 หลัก, รูปแบบ HN) ก่อนส่งให้โมเดล และเตือนผู้ใช้ไม่ให้พิมพ์ข้อมูลผู้ป่วย ; ไม่รับไฟล์แนบ

### MR14. AI Consult จาก isolate · **Must** `[v4 R16]`
1. WHERE บทบาท ∈ {DOCTOR, ICN}, THE SYSTEM SHALL มีปุ่ม "ปรึกษา AI" บน isolate ที่ยืนยันแล้ว (และหลังบันทึกใน MR3.4)
2. THE SYSTEM SHALL ส่งเฉพาะ เชื้อ + phenotype + ผล AST + ward (ไม่ส่ง HN/วันที่) พร้อมข้อมูล %S ท้องถิ่นของเชื้อนั้น
3. THE SYSTEM SHALL สรุปว่ายาตัวใดที่ isolate นี้ **ไวตามผลแล็บ** และยาตัวใดที่ **ข้อมูลท้องถิ่นของเชื้อชนิดนี้สนับสนุน** แยกกันให้ชัด

### MR15. ตรวจสอบคำตอบ AI ก่อนแสดง · **Must** `[v4 R37.1–37.2]`
1. THE SYSTEM SHALL ตรวจว่า ทุกตัวเลข ชื่อยา ชื่อเชื้อ ใน `facts` ตรงกับผลคำนวณของคำขอเดียวกัน และ `reasoning` ไม่มีตัวเลขใหม่
2. IF ตรวจไม่ผ่าน, THEN THE SYSTEM SHALL สร้างใหม่ 1 ครั้ง ; IF ยังไม่ผ่าน, THEN แสดง "ไม่สามารถสร้างคำตอบที่ตรวจสอบได้" แทนคำตอบนั้น
3. THE SYSTEM SHALL ถือข้อความในไฟล์/ช่องกรอกเป็น *ข้อมูล* ไม่ใช่คำสั่ง (prompt-injection defense)
4. THE SYSTEM SHALL บันทึกทุก consult ใน `ai_consult_logs` (บทบาท, อินพุต, ผลคำนวณ, เอาต์พุต, ผลการตรวจสอบ, ชื่อโมเดล/เวอร์ชัน prompt)

### MR16. โหมดสำรองสำหรับขึ้นเวที · **Should**
- WHERE `AI_MODE=cached`, THE SYSTEM SHALL ตอบจากคำตอบที่บันทึกไว้ล่วงหน้าสำหรับคำถามตัวอย่าง ; IF `AI_MODE=live` และเรียกโมเดลล้มเหลว, THEN THE SYSTEM SHALL แสดงข้อผิดพลาดที่อ่านเข้าใจได้ และหน้าอื่นยังใช้ได้

---

## ข้อกำหนดที่ไม่ใช่ฟังก์ชัน (NFR)
| ID | ข้อกำหนด |
|---|---|
| N1 | `npm install && npm run seed && npm run dev` แล้วใช้งานได้ ไม่ต้องติดตั้งฐานข้อมูลภายนอก |
| N2 | หน้า Dashboard/Antibiogram โหลด ≤ 3 วินาทีบนข้อมูลสาธิต ~1,000 isolates |
| N3 | UI ภาษาไทย ; เก็บวันที่เป็น CE แสดง พ.ศ./ค.ศ. ตามตั้งค่า ; เขตเวลา Asia/Bangkok |
| N4 | ไม่พึ่งสีอย่างเดียว ; ใช้บนแท็บเล็ตได้ |
| N5 | กฎ first-isolate, %S, phenotype, cluster เป็น pure functions แยกโมดูลพร้อม unit test (test vector ใน design) `[v4 NFR-8]` |
| N6 | API key อยู่ใน `.env` เท่านั้น ; ไม่ commit ; ไม่แสดงใน log |
| N7 | ไม่มีข้อมูลผู้ป่วยจริงใน repo และใน seed |

## Acceptance ของ Demo (Definition of Done)
1. อัปโหลดใบตัวอย่าง (K. pneumoniae, 15 ยา) → ได้ฟอร์มที่ถูกต้อง 15/15 คู่ยา-ผล ; Ward ติดธงจนผู้ใช้เลือก
2. กดยืนยัน → ตัวเลขใน Dashboard เพิ่ม 1 และ Antibiogram ของ K. pneumoniae เปลี่ยนตาม
3. Antibiogram แสดง %S/%SDD/n, สลับสูตรได้, มีมุมมองแยก CRE และรายการยาที่ข้อมูลท้องถิ่นสนับสนุน
4. AI Consult ตอบคำถาม "K. pneumoniae จาก blood culture ใน ICU B ยาตัวไหนข้อมูลท้องถิ่นสนับสนุน" เป็น 3 ส่วน มีตัวเลขตรงกับ Antibiogram
5. ถามด้วยเชื้อ/ward ที่ n น้อย → AI งดตอบและบอกเหตุผล
6. ขอ "ขนาดยา" → AI ปฏิเสธและชี้ไปที่แนวทางของโรงพยาบาล
