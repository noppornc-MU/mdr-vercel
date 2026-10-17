# Requirements — IC MDR & Antibiogram Analytics (v4.1)

> **ฉบับ 4.1** = v4 + การแก้ความสอดคล้องเชิงวิศวกรรมตาม `review_SE_process.md` (D1, D2, D3, D9, D13, D14, ช่องว่างหมวด 2 → **R53–R56**, คำถามใหม่ **Q25–Q28**) — **ไม่เปลี่ยนค่าทางคลินิก/นโยบาย** (เกณฑ์, N=30, K=5, แถบสี, ค่าสมมติของ Q1–Q24) ; ดู "Change Log v4 → v4.1"
> ฉบับที่ 4 = v3 + ข้อกำหนดด้านความปลอดภัย/สถาปัตยกรรม/การส่งมอบ ที่ได้จากการวิเคราะห์ 4 มุม (AI Architecture, Software Engineering, System Architecture, Cybersecurity): **R39–R52, NFR-13, Q21–Q24**
> คงเลข R1–R52 เดิม ; acceptance criteria แบบ EARS (`WHEN … THE SYSTEM SHALL …`) ; เอกสารคู่กัน: `design_IC_MDR.md` (rev2), `deployment_IC_MDR.md` (rev2), `decisions.md`, `adr/`, `review_SE_process.md`, `analysis_AI_SWE_SysArch_Cyber_MDR.md` (ไม่อยู่ใน workspace นี้)
> แท็ก: `[v3]` คงจาก v3 · `[New v4]` เพิ่มใน v4 · `[Changed v4.1]` แก้ใน v4.1 · `[PROPOSED v4.1 — needs IC/DPO confirmation]` ข้อกำหนดใหม่ที่ยังต้องยืนยัน · `[ASSUMPTION Qn]` ข้อสมมติรอยืนยัน (ตารางท้ายไฟล์ และ `decisions.md`)
> **สถานะ:** ร่างสำหรับทบทวน ยังไม่ผ่านการยืนยันจาก IC / DPO / เภสัชกรรม / ฝ่ายความมั่นคงปลอดภัย / ฝ่ายกำกับของโรงพยาบาล

## 0. บริบทและหลักการ

### 0.1 บริบทการใช้ข้อมูล `[Changed v3]`
| แหล่งข้อมูล | บทบาท |
|---|---|
| Excel `MDR-2026` | **Seed ครั้งเดียว** (R28): ข้อมูลประวัติ + พจนานุกรมตั้งต้นสำหรับ master data/alias — ไม่ใช่ช่องทางนำเข้าต่อเนื่อง |
| ใบรายงานจากแล็บภายนอก (PDF/ภาพ) | **ช่องทางนำเข้าหลัก** ผ่าน OCR (R3) แล้วให้คนยืนยัน (R5) |
| คีย์เอง | ช่องทางสำรอง/แก้ไข (R1) |

### 0.2 หลักการที่ห้ามละเมิด
1. ความปลอดภัยทางคลินิกมาก่อน: ระบบสนับสนุนการตัดสินใจ ไม่ใช่ผู้สั่งการรักษา
2. **Deterministic ก่อน AI:** %S, first isolate, phenotype, cluster = โค้ดที่ทดสอบได้ ; LLM ใช้อ่านเอกสารและอธิบายผลที่คำนวณแล้วเท่านั้น
3. **Human-in-the-loop:** ข้อมูลทุกชนิด (OCR/คีย์) เป็น `PENDING` จน ICN Approve
4. **ไม่เดา:** อ่านไม่ได้/จับคู่ master ไม่ได้ → `null` + `needs_review`
5. PDPA: ข้อมูลที่ระบุตัวตนไม่ออกนอกขอบเขตที่ DPO อนุมัติ (R30, R36)
6. ทุกคำตอบ AI แยก **ข้อเท็จจริง / การอนุมาน / ดุลยพินิจผู้เชี่ยวชาญ** (R15)
7. Audit trail ครบ (R29)

### 0.3 คำนิยามกลาง
| คำ | นิยาม |
|---|---|
| Isolate | ผลเพาะเชื้อ 1 สายพันธุ์ จาก 1 specimen ของผู้ป่วย 1 ราย พร้อมผล AST |
| `specimen_date` | วันที่ฐานสำหรับนับ/trend/cluster `[ASSUMPTION Q1]` ใช้ "วันที่ Lab รับสิ่งส่งตรวจ" (ตรงกับ Excel ที่ตรวจเทียบ 1 แถว); ระบบเก็บ timestamp อื่นแยกฟิลด์ (สั่ง, รับ, รายงาน) |
| First isolate | isolate แรกของผู้ป่วยแต่ละราย ต่อชนิดเชื้อ ต่อช่วงวิเคราะห์ (แนวทาง CLSI M39 — ดูหมวดอ้างอิง) |
| Phenotype | กลุ่มการดื้อยา คำนวณโดยระบบจาก `phenotype_rules` ไม่ใช่ผู้ใช้เลือก (R33) ; ผลต่อกฎมี 3 ค่า: positive / negative / indeterminate ("ไม่สามารถจัดกลุ่มได้") (R33.5) `[Changed v4.1]` |
| MDRO | isolate ที่มี phenotype ≥ 1 รายการที่กำหนดเป็น MDRO ใน rule table `[ASSUMPTION Q4]` |
| AST result | `S`, `I`, `R`, `D` (SDD), ว่าง = ไม่ได้ทดสอบ ; เก็บ MIC/วิธีทดสอบ/มาตรฐาน breakpoint ตามที่แล็บรายงาน ถ้ามี ; การรับค่า `NS` ยังเปิดอยู่ `[OPEN Q25]` |
| Approved data | `status = APPROVED` **และ** (`source = EXCEL_SEED` **หรือ** `report_status = Final`) — เท่านั้นที่เข้า Dashboard/Antibiogram/AI `[Changed v4.1]` ; แถว seed (R28) ไม่มีใบรายงานจึงใช้เงื่อนไข `source` ; ระบบต้องมี predicate นี้ **ที่เดียว** ให้ทุกสถิติใช้ร่วมกัน (design rev2 §3.2, ADR-005) ; หมายเหตุ: R1.2 ยังไม่มีฟิลด์ report status สำหรับข้อมูลคีย์เอง ทั้งที่ R5.4 บังคับ Final → ดูประเด็น P-1 ใน `decisions.md` |
| `VOIDED` | สถานะ "ถอนออก" ของ record ที่สร้างผิด (draft เสีย, อัปโหลดผิดผู้ป่วย) — เก็บไว้เพื่อ audit ไม่เข้าสถิติและไม่อยู่ในคิวงาน (R2.5) `[Changed v4.1]` |

---

## Feature A: การนำเข้าข้อมูล

### R3. Upload Lab Report → OCR `[Changed v3]` · **P1** · Must
**As an** ICWN / Lab, **I want to** upload a lab report (PDF/image) and have the system extract the data, **So that** manual keying is minimized.

**Acceptance Criteria**
1. THE SYSTEM SHALL accept `.pdf`, `.png`, `.jpg`/`.jpeg` (ขนาดสูงสุดตั้งค่าได้), reject others/corrupted/malware-flagged files, and support multi-page files and multiple reports per file (แยกเป็นรายงานละหนึ่งชุด).
2. WHEN a PDF contains a text layer, THE SYSTEM SHALL extract from the text first and use OCR/vision only for image content; THE SYSTEM SHALL record which method produced each field.
3. THE SYSTEM SHALL detect the report layout/source lab, supporting at least the layouts listed in `[ASSUMPTION Q12]` (เริ่มจาก: ใบห้องปฏิบัติการจุลชีววิทยา (แบบสแกน) และหน้า "Laboratory Report" ของโรงพยาบาล ที่ฝังใบสแกน); IF the layout is unknown, THEN THE SYSTEM SHALL still attempt generic extraction and mark the whole record `needs_review`.
4. **ขั้นข้อมูลประกอบ (Context step):** THE SYSTEM SHALL ask the uploader for fields commonly absent from lab reports — Ward (required), Patient Type OPD/IPD (required), Case Type/HAI category (optional), Next Appointment Date (optional) — pre-filling from the report when present; THE SYSTEM SHALL NOT allow submission for review without Ward and Patient Type `[ASSUMPTION Q15]`.
5. THE SYSTEM SHALL extract into the schema in Appendix B (HN, sex, Lab No, Order No, specimen, organism(s), AST panel, all report timestamps, report status, MIC/method/breakpoint standard if printed, laboratory comments). Patient name SHALL NOT be extracted unless the name feature is enabled (R30).
6. THE SYSTEM SHALL parse dates in both Buddhist Era and Common Era and `DD/MM/YYYY`, convert to CE, and keep the original text.
7. THE SYSTEM SHALL map organism, drug, specimen and ward text to master data via alias tables (R23–R25); IF no confident match, THEN THE SYSTEM SHALL leave the field empty and mark `needs_review`.
8. `[Changed v4.1]` THE SYSTEM SHALL run the validation rules in R3.9 and cross-check each extracted field against a second, independent source chosen by extraction method: (a) for a PDF with a text layer, THE SYSTEM SHALL compare the text-layer parse with OCR of the rendered page; (b) for an image or scanned page, THE SYSTEM SHALL compare two independent extraction methods (e.g., template-region OCR and a second OCR engine or vision model). The method pairing per layout SHALL be configurable. WHEN the two sources disagree on a field, THE SYSTEM SHALL mark it `needs_review`; WHERE the second source is disabled for a layout, THE SYSTEM SHALL record in the extraction report that those fields were not cross-checked. (หมายเหตุ: การ "รันซ้ำ" parser แบบ deterministic ตัวเดิมให้ผลเหมือนเดิมเสมอ จึงไม่นับเป็นการตรวจซ้ำ)
9. **AST validation rules:**
   a. number of drug rows read = number of result values read (ใบตัวอย่าง: 15 = 15); mismatch → whole AST block flagged
   b. every drug name resolves to a master drug
   c. every result ∈ {S, I, R, D} or blank
   d. result `D` is accepted without flag only for drug–organism-group pairs in the `sdd_allowed` table (R33); otherwise flagged `[ASSUMPTION Q16]`
   e. organism resolves to a master organism
   f. HN matches the configured pattern
   g. report status is read (`Final`/`Preliminary`/unknown)
10. THE SYSTEM SHALL show model confidence per field as "model confidence" and SHALL NOT present any single number as "accuracy".
11. WHEN extraction completes, THE SYSTEM SHALL create draft isolates (`DRAFT`), store the extraction report (method, confidence, flags, model and prompt version), and attach the original file (R36).
12. THE SYSTEM SHALL send file content only to the OCR/LLM provider approved under R30 and only after masking per R36.

### R1. Manual Entry (fallback) `[Changed v3]` · P1 · Must
1. THE SYSTEM SHALL provide a 3-section form (Patient, Specimen/Organism, AST) as the fallback and the correction path for OCR drafts.
2. THE SYSTEM SHALL require: HN, Patient Type, Ward (dropdown), Specimen Date, Specimen Type, Organism (auto-complete), ≥ 1 AST result ; optional: Lab No, Order No, Case Type, Specimen Detail, Next Appointment Date, Culture Clearance Status (P3), Notes/ASP flag, Patient Name (R30, off by default).
3. THE SYSTEM SHALL NOT offer a user-selectable phenotype; it SHALL compute phenotype (R33) and show it read-only with the rule version. WHEN an ICN overrides it, THE SYSTEM SHALL require a reason and log it.
4. THE SYSTEM SHALL validate HN format (string, preserve leading zeros), Specimen Date ≤ today, no duplicate drug rows, results ∈ {S,I,R,D}.
5. WHEN saved, THE SYSTEM SHALL set `PENDING` and trigger R20; IF a duplicate is found, THE SYSTEM SHALL warn first (R31).
6. IF the user is ICWN/Lab, THEN THE SYSTEM SHALL restrict Ward to assigned wards.

### R2. Edit Before Approval `[v2]` `[Changed v4.1]` · P1 · Must
1. WHILE status ∈ {`DRAFT`, `PENDING`, `REJECTED`}, THE SYSTEM SHALL let the creator/uploader edit own records.
2. WHEN `APPROVED`, THE SYSTEM SHALL block creator edits (ICN edits follow R5.6).
3. THE SYSTEM SHALL log every edit (old/new value, user, time) (R29).
4. WHEN a `REJECTED` record is resubmitted, THE SYSTEM SHALL set `PENDING` and trigger R20.
5. `[New v4.1]` WHILE status ∈ {`DRAFT`, `PENDING`, `REJECTED`}, WHEN the creator/uploader or an ICN withdraws a record created in error (e.g., broken draft, wrong-patient upload — R48.3), THE SYSTEM SHALL require a reason, set `VOIDED`, record user and time in the audit trail (R29), keep the record and its source-file link for investigation, exclude it from all statistics and work queues, and SHALL NOT allow further edits or any transition out of `VOIDED`. Records already `APPROVED` SHALL follow R5.6 instead.

### R4. Quick Demo `[v2]` · P1 · Could
1. WHEN "Quick Demo" is clicked, THE SYSTEM SHALL run the full pipeline on a bundled **de-identified** sample and show field-level pass/fail vs expected output; it SHALL NOT write to the database (also a smoke test for R32).

---

## Feature B: การตรวจสอบและอนุมัติ

### R5. ICN Review & Approve `[Changed v3]` · P1 · Must
1. THE SYSTEM SHALL list `PENDING` records with filters: Source (OCR/manual/seed), Layout, flag count, Ward, Date, Uploader.
2. WHEN ICN opens a record, THE SYSTEM SHALL show the original file (zoomable) beside the extracted fields; **for each AST value, THE SYSTEM SHALL show a cropped image of that row** (when extracted from an image) so the value can be checked at a glance. `[Changed v4.1]` To make this possible, the extraction output SHALL carry, for every field and every AST row, the page number and bounding box in the source file (extraction contract v1, design rev2 §15); WHERE no bounding box is available for a value, THE SYSTEM SHALL show the whole page and mark the crop as unavailable.
3. THE SYSTEM SHALL expand only `needs_review` fields by default and collapse unflagged fields, and SHALL track review time per record (for NFR-11).
4. IF a record has unresolved flags, missing required fields, or `report_status` ≠ `Final`, THEN THE SYSTEM SHALL disable Approve for it.
5. WHEN ICN approves, THE SYSTEM SHALL set `APPROVED` with approver and timestamp.
6. WHEN ICN edits an `APPROVED` record, THE SYSTEM SHALL keep the prior version (`SUPERSEDED`), require a reason, create a new version, and recompute dependent statistics.
7. THE SYSTEM SHALL allow "approve selected" only for records without flags, after showing the count and requiring confirmation; THE SYSTEM SHALL NOT auto-approve.
8. THE SYSTEM SHALL NOT allow Admin (IT) to approve.

### R6. Reject `[Quick]` · P1 · Must
1. WHEN ICN rejects, THE SYSTEM SHALL require a reason, set `REJECTED`, notify the uploader in-app, and keep the reason in the audit trail; resubmission follows R2.4.

### R35. Report Versions & Status `[New v3]` · P1 · Must
1. THE SYSTEM SHALL identify a report by Lab No + Order No (+ source lab) and keep every uploaded version.
2. WHEN a report with the same key is uploaded again, THE SYSTEM SHALL detect it and offer: discard as duplicate, or treat as an updated version.
3. WHEN a `Final` report replaces a `Preliminary` one, THE SYSTEM SHALL supersede the earlier record, require re-review, and recompute statistics; WHEN a corrected report is received, THE SYSTEM SHALL do the same and flag the change.
4. THE SYSTEM SHALL keep `Preliminary` records viewable to ICN but excluded from all statistics `[ASSUMPTION Q14]`.

### R31. Duplicate Detection `[Changed v3]` · P1 · Must
1. THE SYSTEM SHALL first match by Lab No/Order No (R35), then by HN + organism + specimen type + specimen date; on a match THE SYSTEM SHALL warn and require explicit confirmation (manual) or route to R35.2 (upload).
2. THE SYSTEM SHALL provide a duplicates report for ICN.

---

## Feature C: Dashboard

### R7. KPI Cards `[Changed v3]` · P1 · Must
1. THE SYSTEM SHALL compute from Approved data using §0.3 definitions.
2. THE SYSTEM SHALL show: Total isolates, Total patients (distinct HN), MDRO patients (first-isolate rule), ICU vs Non-ICU proportion, carbapenem-resistant count (from phenotype rules), HAI count (from `case_type`), active suspected clusters (R11).
3. THE SYSTEM SHALL show, beside any ward-based metric, the number of isolates excluded because Ward is unknown.
4. THE SYSTEM SHALL state in tooltips whether a metric counts isolates or patients, show % change vs the previous period of equal length, and refresh within a configurable interval (default ≤ 60 s) of an approval.

### R8. Filters `[v2]` · P1 · Must
- Date range, Ward type, Ward, Specimen, Organism — from master data ; applied to all widgets ; default = current quarter `[ASSUMPTION Q3]`.

### R9. Charts `[v2]` · P1 · Must
- ICU vs Non-ICU bars, ward bars, specimen pie, monthly MDRO trend, Ward Summary Table (ward, isolates, patients, MDRO, %MDRO) with drill-down by role (R27).

### R10. High-Risk Pathogen Table `[v2]` · P1 · Must
1. THE SYSTEM SHALL list recent isolates with high-risk phenotypes (list from rule table), newest first, with link to the original file for permitted roles ; Executive SHALL NOT see HN ; "อัปโหลดใบผล Lab" opens R3.

### R11. Suspected Cluster Detection `[Changed v3]` · P1 (display) / P3 (alert) · Must
**เหตุผล:** จากข้อมูล seed พบว่าเกณฑ์ ≥3 ราย/14 วัน/ward เดียวกันแบบนับแถวผ่านบ่อยมาก และ ~31% ของหน้าต่างที่ผ่านเกิดจากผู้ป่วยซ้ำ (ภาคผนวก A)
1. THE SYSTEM SHALL detect clusters by: same organism (หรือ phenotype), same ward, ≥ N **distinct patients** within a rolling window (default N = 3, window = 14 วัน; ตั้งค่าได้), based on `specimen_date`.
2. THE SYSTEM SHALL evaluate only organisms/phenotypes in the cluster-watch list maintained by ICN `[ASSUMPTION Q17]` (ไม่ใช่ทุกเชื้อ).
3. THE SYSTEM SHALL merge overlapping windows into one cluster episode with first/last date and patient list, and count each patient once.
4. THE SYSTEM SHALL exclude isolates with unknown Ward and display how many were excluded.
5. THE SYSTEM SHALL label results "suspected" and link to records; it SHALL NOT declare an outbreak.

---

## Feature D: Antibiogram

### R12. %Susceptibility Matrix `[Changed v3]` · P1 · Must
1. THE SYSTEM SHALL use Approved isolates only, apply the first-isolate rule per patient/organism/analysis period, and exclude organisms outside the bacterial scope (R38).
2. THE SYSTEM SHALL show per cell: **%S**, **%SDD** (where the drug–organism pair has an SDD category), and **n tested**; I and R are not added to %S.
3. THE SYSTEM SHALL provide a configurable formula option "%S = S only" or "%S including SDD" with the active option printed on screen and in exports; the default SHALL be set by Microbiology/ASP `[ASSUMPTION Q2]`.
4. THE SYSTEM SHALL exclude untested results from the denominator.
5. IF n tested < minimum N, THEN THE SYSTEM SHALL show "n<N" with the raw count. Default N = 30 `[ASSUMPTION Q3b]`; selectable lower values SHALL show a "ข้อมูลน้อย — ใช้ประกอบเท่านั้น" banner.
6. THE SYSTEM SHALL color cells by configurable thresholds (default per SRS: ≥90 / 70–89 / 50–69 / <50; grey = insufficient) `[ASSUMPTION Q3c]`, always with the number visible.
7. THE SYSTEM SHALL hide/mark intrinsic-resistance and not-reported drug–organism pairs (R33).
8. THE SYSTEM SHALL show "ข้อมูลถึงวันที่ …", number of records pending (not counted), and a clinical-use disclaimer.
9. WHEN Ward-level views have mostly insufficient n, THE SYSTEM SHALL suggest widening scope (ward group, ICU/Non-ICU, longer period) rather than showing percentages.

### R13. Filters `[v2]` · P1 · Must
- Ward context, specimen category, pathogen group, minimum N, analysis period — from master data ; recalculates on change.

### R14. Export `[Changed v3]` · P1 · Should
1. THE SYSTEM SHALL export PDF with hospital name, period, filters, minimum N, first-isolate rule, %S formula option, data-as-of date, matrix with numbers, legend, disclaimer; THE SYSTEM SHALL log each export.

---

## Feature E: AI Consult

> **ขอบเขตตามขั้น (Level):** L1 แสดงข้อมูล · L2 สรุป/อธิบายข้อมูลที่ระบบคำนวณ · L3 จัดอันดับตัวเลือกตาม %S ท้องถิ่นพร้อม n · L4 แนะนำรายผู้ป่วย
> **v3 เริ่มที่ L2→L3 เท่านั้น ; L4 อยู่นอกขอบเขต** จนกว่าจะมี allergy/ไต/ความรุนแรง/guideline และการอนุมัติจากผู้เชี่ยวชาญและฝ่ายกำกับ

### R15. AI Consult — Interpretation of Local Susceptibility Data `[Changed v3]` · P2 · Should
1. THE SYSTEM SHALL call the LLM only from the backend; no API key or provider call in the browser.
2. THE SYSTEM SHALL accept: Ward, Infection site, optional free-text. Free-text SHALL be scanned and redacted for identifiers before leaving the backend, and the UI SHALL warn users not to type identifiers. THE SYSTEM SHALL NOT accept file uploads into AI Consult.
3. THE SYSTEM SHALL obtain data only through deterministic server functions (antibiogram by ward/specimen/period; isolate AST summary) and send only de-identified aggregates to the model.
4. THE SYSTEM SHALL require the model to answer as structured JSON (Appendix C) and render it as three labelled sections: **ข้อเท็จจริงจากข้อมูล** · **การวิเคราะห์ (อนุมาน)** · **ประเด็นที่ต้องใช้ดุลยพินิจแพทย์/เภสัชกร**.
5. THE SYSTEM SHALL present drugs as "supported by local data" ranked by %S, and "low local %S", not as a prescription; the wording of "first-line/alternative" SHALL follow pharmacy/IC decision `[ASSUMPTION Q9]`.
6. THE SYSTEM SHALL NOT provide dose, frequency or duration unless sourced from a hospital-approved guideline document in the knowledge base, cited with version.
7. IF the relevant n < minimum N or no data, THEN THE SYSTEM SHALL state data are insufficient and SHALL NOT infer.
8. THE SYSTEM SHALL always show the disclaimer: "ข้อมูลนี้เป็นข้อมูลสนับสนุนการตัดสินใจ ไม่ใช่คำสั่งการรักษา".
9. THE SYSTEM SHALL log every consult in `ai_consult_logs` (user, role, inputs, tool results, output, model and prompt version).
10. THE LLM provider/model SHALL be configuration (adapter); selection requires the approval in R30.

### R16. AI Consult from an Isolate `[v2]` · P2 · Should
1. WHERE role ∈ {Doctor, Pharmacist, ICN}, THE SYSTEM SHALL offer "AI Consult" on approved isolates, pre-fill ward/specimen, and send only organism, phenotype and AST (no HN/dates) ; the answer SHALL follow R15.4.

### R37. AI Verification, Evaluation & Operation `[New v3]` · P2 · Must
1. **Verification layer:** THE SYSTEM SHALL check each model output before display: every number, drug name and organism name must match the tool results of the same request, and every claim must cite a tool result or knowledge-base document; IF any check fails, THEN THE SYSTEM SHALL regenerate once and then show "ไม่สามารถสร้างคำตอบที่ตรวจสอบได้" instead of the failed output.
2. THE SYSTEM SHALL treat text in uploaded files, extraction notes and free-text as data, never as instructions (prompt-injection defense).
3. **Evaluation set:** infectious-disease physicians and pharmacists SHALL author questions with expected answers, including adversarial cases (n<30, organism with no data, request for dose, instructions embedded in free text, conflicting data).
4. THE SYSTEM SHALL report on the evaluation set: share of claims without supporting evidence, correctness of abstention, numeric fidelity; pass thresholds are set by the clinical owners `[ASSUMPTION Q18]`. Evaluation SHALL be re-run on every change of model, prompt, tool or knowledge base.
5. **Shadow mode:** before users see AI output, THE SYSTEM SHALL run it silently on real queries for a period set by the clinical owners and let reviewers grade it.
6. THE SYSTEM SHALL let users flag incorrect answers; each flag goes to a named reviewer.
7. THE SYSTEM SHALL provide a kill switch for AI Consult that does not affect Dashboard/Antibiogram.
8. Clinical content ownership SHALL belong to the ASP/IC committee and pharmacy, not the development team. Whether the function falls under the medical-device rules SHALL be determined by the hospital's regulatory/legal function before release `[ASSUMPTION Q19]`.

---

## Feature F: Proactive Alerts (Phase 3)
> ข้อความออกนอกระบบ (LINE ฯลฯ) มีข้อมูลระบุตัวตนน้อยที่สุด — ward, กลุ่มเชื้อ, จำนวน, ลิงก์ที่ต้อง login ; HN/ชื่อแสดงหลัง login `[ASSUMPTION Q6]`

### R17. Pre-Arrival Alert `[v2]` · P3 · Should
1. WHEN the daily job runs, THE SYSTEM SHALL find patients with active MDRO status and Next Appointment within 24–48 h (configurable), notify the ward team (in-app + approved channel), and not duplicate alerts per appointment.
### R18. Culture Tracking `[v2]` · P3 · Should
1. THE SYSTEM SHALL track clearance status (`ผู้ป่วยใหม่`, `รอผลครั้งที่ 1–3`, `ปลดเฝ้าระวังแล้ว`), remind at the interval defined by IC `[ASSUMPTION Q4b]`, and alert ICN after three consecutive negatives; it SHALL NOT change status automatically.
### R19. Cluster Warning `[Changed v3]` · P3 · Must
1. WHEN a new cluster episode per R11 is detected, THE SYSTEM SHALL send a CRITICAL alert to ICN with organism, ward, patient count, date range and a login-protected link ; no repeat for an unchanged episode within a configurable period.
### R20. Pending Review Alert `[v2]` · P1 (in-app) / P3 (external) · Should
1. WHEN a record enters `PENDING`, THE SYSTEM SHALL notify ICN with the pending count and latest entry.

---

## Feature G: Database, Master Data, Security

### R21. Isolate Database `[v2]` · P1 · Must
- List/search/filter (HN, Lab No, organism, status, phenotype, specimen, ward, date, source) ; attachment viewer by role ; export excludes names and is logged.
### R22. Attach File to Existing Isolate `[v2]` · P1 · Should
- Same checks as R3.1 ; immutable, hashed ; logged (R36).

### R23. Organisms Master `[Changed v3]` · P0 · Must
1. THE SYSTEM SHALL store canonical name, group, Active flag and **aliases**, seeded from the Excel dictionary (R28) and extended through OCR review; quantity/qualifier text (e.g., CFU ranges) SHALL be separate from the organism name.
### R24. Antibiotics Master `[Changed v3]` · P0 · Must
1. THE SYSTEM SHALL store drug name, class, order, Active, aliases, and **method/concentration attribute** (e.g., Gentamicin 10 mcg vs 120 mcg). Duplicate drug columns in the seed (Colistin, Doripenem, Ertapenem, Imipenem, Meropenem each appear twice) SHALL be mapped using the method attribute once the meaning is confirmed `[ASSUMPTION Q20]`.
### R25. Wards & Specimens Master `[Changed v3]` · P0 · Must
1. THE SYSTEM SHALL store wards (code, name, ICU/Non-ICU, group/building, Active) and ward aliases; THE SYSTEM SHALL permit `ward = unknown` **only** for `source = excel_seed` records and require Ward for all new records.
2. THE SYSTEM SHALL store specimen types (category) and keep detail as free text on the isolate.
### R26. Authentication `[v2]` · P0 · Must
- Secure login, credential hashing, lockout/rate limit, inactivity timeout, SSO/AD if available `[ASSUMPTION Q8]`.
### R27. RBAC `[v2]` · P0 · Must
- Enforced in the backend. ICN: all + approve/reject + rules ; ICWN/Lab/Pharmacist: view, upload/entry for assigned wards, edit own before approval ; Doctor: Dashboard/Antibiogram/AI ; Executive: aggregate only (no HN) ; Admin: master data + users, no approval `[ASSUMPTION Q7]`.

### R28. Excel Seed Import (one-time) `[Changed v3]` · P0 · Must
**As an** IT Admin, **I want to** load the existing Excel once as starting data, **So that** history and dictionaries exist before OCR data arrives.
1. THE SYSTEM SHALL provide a command-line importer (no UI) with **dry-run** mode that writes nothing and produces a report.
2. THE SYSTEM SHALL read `Sheet1` (86 columns, ~4,729 rows) as primary and reconcile it against the per-organism sheets; because those sheets are **not** verified subsets (key match 35–70% except `Other` = 100%; combined 7,205 rows), THE SYSTEM SHALL NOT discard them — differences go in the reconciliation report for decision.
3. THE SYSTEM SHALL store HN as text, not import `Name`, and parse organism text into organism + qualifier.
4. THE SYSTEM SHALL treat AST cells that are not S/I/R/D as follows: known annotation strings (e.g., "ESBL phenotype", "MDR") → stored as annotations on the isolate ; strings indicating a column mismatch ("คอลัมน์ซ้อน") or unrecognized values → row flagged `needs_review` ; **not** quarantine of every row (≈17% of rows contain such cells).
5. THE SYSTEM SHALL validate dates and report: unparseable values, future dates, Date Admit after specimen date.
6. THE SYSTEM SHALL import rows as `APPROVED`, `source = excel_seed`, linked to an `import_batch`, with `data_quality_flags` (ward unknown, case unknown, annotation present) so statistics can show or exclude them. `[Changed v4.1]` THE SYSTEM SHALL record the approver of seed rows as the system account `system:excel-seed` (which cannot log in) and `approved_at` as the commit time of the import batch; the import batch SHALL record the operator who ran the commit. Seed rows SHALL NOT be shown as approved by a person.
7. THE SYSTEM SHALL build proposed alias dictionaries (organism, drug, specimen, ward) from distinct seed values for ICN/Admin to confirm before they become master data.
8. THE SYSTEM SHALL produce the reconciliation report (R34) and record row counts: read / imported / flagged / skipped (with reasons).
9. THE SYSTEM MAY be re-run only through dry-run + explicit confirmation, and SHALL NOT create duplicate records (natural key + row hash).

### R29. Audit Trail `[v2]` · P0 · Must
- Log create/update/approve/reject/override/delete/attach/export/view of patient-level data/AI consult ; append-only at database level ; visible to ICN and Admin.

### R30. PDPA / Data Protection `[Changed v3]` · P0 · Must
1. Name off by default `[ASSUMPTION Q7]` ; if enabled → encrypted and role-limited.
2. Encrypt in transit and at rest ; secrets outside source ; no PHI in logs/errors.
3. No PHI to any external processor (OCR/LLM/messaging) not approved by the DPO ; record approved provider, region and data-use terms ; masking per R36.
4. Retention and data-subject requests per hospital policy `[ASSUMPTION Q10]`.
5. Real data (Excel, lab reports) outside source control and non-production environments unless de-identified.

### R36. Source Files & PHI Masking `[New v3]` · P0/P1 · Must
1. THE SYSTEM SHALL store original files encrypted, immutable and hashed, with access limited to roles that need them, because lab reports display patient names in the image even when the name is not stored as a field.
2. BEFORE sending an image to an external OCR/LLM provider, THE SYSTEM SHALL mask the patient-name/identifier regions (template-based per layout, or by a local detector); IF masking cannot be verified, THEN THE SYSTEM SHALL NOT send the image externally and SHALL route it to local processing or manual entry.
3. THE SYSTEM SHALL apply the retention period for source files per R30.4 and log every file view.

### R33. Phenotype Rules, SDD Table & Intrinsic Resistance `[Changed v3]` · P0 · Must
1. THE SYSTEM SHALL store versioned configurable rules (organism group + drug conditions): drafts for CRE, CR-AB, CRPA, MRSA, VRE, ESBL-screen, ESCR, MDR/XDR `[ASSUMPTION Q4]`.
2. THE SYSTEM SHALL record which organism groups each definition applies to; the MDR/XDR/PDR definitions of Magiorakos et al. cover S. aureus, Enterococcus, Enterobacteriaceae (not Salmonella/Shigella), P. aeruginosa and Acinetobacter only, so other organisms SHALL NOT receive an MDR/XDR label from those rules.
3. THE SYSTEM SHALL store the `sdd_allowed` table (drug × organism group where `D` is a valid result) — seed data show `D` almost only for Cefepime (140) and Piperacillin/tazobactam (124) — and the intrinsic-resistance/not-reported table ; ICN edits ; Microbiology confirms.
4. THE SYSTEM SHALL require ICN sign-off to activate a rule version, record the version used per isolate, and show before/after impact when a version changes.
5. THE SYSTEM SHALL treat incomplete drug panels explicitly: WHEN a phenotype rule needs a drug that was not tested, THE SYSTEM SHALL return "ไม่สามารถจัดกลุ่มได้" rather than a negative. `[Changed v4.1]` THE SYSTEM SHALL store, for each isolate and each applicable rule, one of three results — `positive`, `negative` or `indeterminate` ("ไม่สามารถจัดกลุ่มได้") — and, for `indeterminate`, the list of drugs whose missing results prevented classification; THE SYSTEM SHALL show the missing drugs wherever the indeterminate result is displayed, and SHALL NOT count `indeterminate` as `negative` in any statistic.

### R38. Organism Scope `[New v3]` · P1 · Should
1. THE SYSTEM SHALL classify organisms as bacteria, yeast/fungi, mycobacteria, or other ; THE SYSTEM SHALL exclude yeast and mycobacteria from the bacterial antibiogram and MDR rules (seed data contain ~183 yeast/Candida and ~61 Mycobacterium rows) and MAY offer a separate yeast view later.

### R32. OCR Evaluation & Quality Gate `[Changed v3]` · P1 · Must
1. THE SYSTEM SHALL keep a golden set of de-identified reports with verified expected output, **covering every source lab/layout** (`Q12`) ; the first case is Appendix B (Lab No. 9900000001).
2. THE SYSTEM SHALL measure on each change of model, prompt or pre-processing: field-level accuracy (HN, organism, specimen, dates, status) and **drug-level AST accuracy** ; and report flagged-rate and average review time.
3. THE SYSTEM SHALL NOT be enabled for production until thresholds agreed with IC are met on a golden set of ≥ 30 varied reports `[ASSUMPTION Q5]`.

### R34. Reconciliation & Traceability `[v2]` · P0/P1 · Should
1. THE SYSTEM SHALL compare seed counts (year/organism/ward/specimen) between Excel and the system with reasons for differences.
2. THE SYSTEM SHALL offer "how is this number calculated" for any KPI/Antibiogram cell, listing included isolate IDs (role-restricted).

---

## Feature H: ความปลอดภัย ความทนทาน และการส่งมอบ `[New v4]`

### R39. Small-cell Suppression · P1 · Should
1. WHEN a dashboard table, chart or export for a role without patient-level access (Executive; and Doctor where configured) would show a cell with fewer than K distinct patients, THE SYSTEM SHALL display "<K" instead of the value; K is configurable, default 5 `[ASSUMPTION Q23]`.
2. WHERE totals would reveal a suppressed value, THE SYSTEM SHALL apply complementary suppression.
3. THE SYSTEM SHALL NOT show HN to the Executive role in any view, and SHALL show a footnote wherever suppression is applied.

### R40. Segregation of Duties (4-eyes) · P1 · Should
1. WHERE the 4-eyes policy is enabled `[ASSUMPTION Q22]`, THE SYSTEM SHALL prevent the uploader, creator or last editor of a record from approving it.
2. WHERE only one eligible approver exists, THE SYSTEM SHALL allow a self-approval override that requires a reason, is flagged in the audit log, and is notified to a configured reviewer.
3. THE SYSTEM SHALL show approval-policy status on the review page.

### R41. File-processing Sandbox · P1 · Must
1. THE SYSTEM SHALL parse and OCR uploaded files only in an isolated worker that has no database credentials, no direct internet access, read-only access to the single file being processed, and CPU/memory/time/page limits.
2. THE SYSTEM SHALL validate the true file type (not only the extension), scan with antivirus, reject encrypted/password-protected, oversized or malformed files, and never execute or render active content.
3. THE SYSTEM SHALL return extraction results to the application only through an authenticated, job-scoped channel and SHALL treat all returned content as untrusted data (validated against schema before storing).

### R42. AI Gateway · P1/P2 · Must
1. THE SYSTEM SHALL route every call to an external or internal OCR/LLM provider through one gateway component that enforces: provider allowlist and egress control, PHI masking (R36), per-user and per-day rate limits, token/cost budget, timeouts, and logging without PHI.
2. IF masking cannot be verified or the provider is not on the approved list (R30.3), THEN THE GATEWAY SHALL refuse the call and report the reason.
3. THE GATEWAY SHALL record provider, model, prompt version and request ID for every call, enabling trace-back of any output.
4. THE GATEWAY SHALL be switchable per capability (OCR, Consult) by an administrator (kill switch, R37.7).

### R43. Row-level Authorization · P0 · Must
1. THE SYSTEM SHALL enforce role and ward scope in the database layer (row-level security) in addition to the application layer.
2. THE SYSTEM SHALL serve source files only through short-lived signed URLs issued after an authorization check, and SHALL log each issuance.
3. THE SYSTEM SHALL include an automated test that exercises every endpoint for every role and ward scope and fails the build on any unexpected allow.

### R44. Published Antibiogram (Frozen Report) · P1 · Must
1. WHEN ICN publishes an antibiogram, THE SYSTEM SHALL create a frozen, versioned artifact containing: parameters (period, scope, minimum N, %S formula option, thresholds), rule versions, data-as-of date, the matrix, and the list of included isolate IDs.
2. THE SYSTEM SHALL NOT change a published artifact when data, rules or configuration change later; a new version SHALL be created instead, with a link to the previous version and the reason.
3. THE SYSTEM SHALL record the approver and timestamp, and allow export (R14) from the frozen artifact.

### R45. Export Control and Break-glass Access · P1 · Should
1. WHEN a patient-level export exceeds a configured row count, THE SYSTEM SHALL require a stated purpose and log it; WHERE configured, it SHALL require a second approver.
2. THE SYSTEM SHALL alert a configured reviewer on anomalous access volume (many HN views or exports by one user in a short period).
3. WHEN a user invokes break-glass access to data outside their scope, THE SYSTEM SHALL require a reason, grant time-limited access, notify a reviewer, and include it in the next access review.

### R46. Resilience and Degraded Operation · P0/P1 · Must
1. WHILE OCR or AI services are unavailable, THE SYSTEM SHALL keep manual entry, review/approve, Dashboard and Antibiogram available and SHALL show the service status.
2. THE SYSTEM SHALL retry failed jobs with backoff and move files that repeatedly fail to a dead-letter list visible to ICN/Admin.
3. THE SYSTEM SHALL back up the database and object storage on a schedule set by the hospital `[ASSUMPTION Q10]`, keep at least one copy off the production host (immutable or offline where possible), encrypt backups, and verify restore by a periodic automated restore test whose result is reported.
4. THE SYSTEM SHALL document a manual fallback procedure for IC operations during prolonged outage `[ASSUMPTION Q10]`.

### R47. Development Environment and Supply Chain · P0 · Must
1. THE PROJECT SHALL use only synthetic or de-identified data in development and test environments, and SHALL keep real data (Excel, lab reports) outside the workspace of any AI coding agent.
2. THE PROJECT SHALL pin dependencies with lockfiles, generate an SBOM per release, scan dependencies, container images and source for vulnerabilities and secrets in CI, and fail the build above a severity threshold set by the security team.
3. THE PROJECT SHALL allow-list AI-agent plugins and MCP servers, set agent permissions to "ask" for file edits and shell commands, and review all agent-generated changes through the normal code-review process.
4. THE PROJECT SHALL keep secrets in a secret manager or environment injection, never in the repository, images, logs or agent context.

### R48. Incident Response · P0/P1 · Must
1. THE PROJECT SHALL maintain an incident procedure covering detection, classification, decision authority, notification timelines defined by DPO/legal `[ASSUMPTION Q24]`, evidence preservation, containment (including the AI kill switch), recovery and review.
2. THE SYSTEM SHALL provide the data needed for investigation: audit trail (R29), access logs, gateway logs and file hashes.
3. THE PROJECT SHALL exercise the procedure with at least the scenarios: prompt-injection document, wrong-patient upload, post-approval tampering, and coding-agent data exposure — before first production use with real data and before each major release.

### R49. Configuration Governance · P1 · Must
1. WHEN a threshold, rule, watch-list, SDD table, formula option or alias is changed, THE SYSTEM SHALL require an authorized role, record before/after values with reason, and show the impact on key statistics before activation.
2. THE SYSTEM SHALL keep configuration versions and mark each isolate/statistic with the version used.

### R50. AI Knowledge-base Governance · P2 · Must
1. THE SYSTEM SHALL accept knowledge-base documents only from an approved owner, with version, effective and expiry dates, and content hash; expired documents SHALL NOT be cited.
2. WHEN a knowledge-base document or prompt changes, THE SYSTEM SHALL require re-running the AI evaluation set (R37.4) before the change is activated.
3. THE SYSTEM SHALL NOT index patient-level data into any knowledge-base or vector store.

### R51. Strong Authentication · P0 · Must
1. THE SYSTEM SHALL require multi-factor authentication for ICN, Admin and operations/database roles.
2. THE SYSTEM SHALL support the hospital identity provider (OIDC/SAML) `[ASSUMPTION Q8, Q21]`; WHERE none is available, THE SYSTEM SHALL provide local accounts with the controls of R26 and MFA.

### R52. Deployment, Release and Operations · P0 · Must
1. THE SYSTEM SHALL be deployable from versioned, reproducible artifacts (container images built in CI, infrastructure described as code) to separate dev, staging and production environments with distinct secrets.
2. THE SYSTEM SHALL expose health and readiness checks for each component, and SHALL support rollback to the previous release including database migrations (backward-compatible migrations or tested down-migrations).
3. THE SYSTEM SHALL terminate TLS with a certificate trusted by the hospital, redirect plain HTTP, and apply security headers.
4. THE SYSTEM SHALL segment the network so that the database, object storage and queue are not reachable from outside, and the sandbox worker and AI gateway are the only components with the network paths described in R41/R42.
5. THE SYSTEM SHALL provide runbooks for deploy, rollback, backup/restore, certificate renewal, secret rotation and user lifecycle.

---

## Feature I: ช่องว่างที่พบจากการทบทวนกระบวนการ `[PROPOSED v4.1 — needs IC/DPO confirmation]`
> ที่มา: `review_SE_process.md` หมวด 2 ; ข้อกำหนดชุดนี้สร้าง **กลไก** เท่านั้น ค่าระยะเวลา/เงื่อนไขทางนโยบายยังเป็นของ DPO/IC (`[ASSUMPTION Q10]`) ; phase ยังไม่ล็อกจนกว่าจะยืนยัน (ข้อเสนอใน Phase Summary)

### R53. PDPA Data-subject Requests · P0/P1 (เสนอ) · Should (เสนอ) `[PROPOSED v4.1 — needs IC/DPO confirmation]`
1. THE SYSTEM SHALL let a role designated by the DPO register a data-subject request (access, rectification, erasure, restriction, objection) with request ID, request type, received date, legal basis noted by the DPO, decision and completion date, without storing the requester's identity documents in the system.
2. WHEN a request is registered for an HN, THE SYSTEM SHALL list every place the HN appears (isolates, lab reports, source files, exports, published antibiogram isolate lists, audit references) for the designated role only, and SHALL log the search (R29).
3. WHEN the DPO approves an erasure or restriction, THE SYSTEM SHALL apply it through a dedicated, audited operation that keeps the audit chain verifiable (e.g., by replacing identifiers with a tombstone reference rather than deleting audit rows), and SHALL report which published artifacts (R44) reference the affected isolates instead of changing them silently.
4. THE SYSTEM SHALL NOT enforce any response deadline by itself; timelines and exemptions SHALL follow hospital policy `[ASSUMPTION Q10]`.

### R54. Retention Purge Job · P1 (เสนอ) · Should (เสนอ) `[PROPOSED v4.1 — needs IC/DPO confirmation]`
1. THE SYSTEM SHALL set `retention_until` on every source file from the retention rule active at upload time (R30.4, R36.3) and record the rule version.
2. WHEN the scheduled retention job runs, THE SYSTEM SHALL list source files whose `retention_until` has passed and that are not under an investigation or legal hold (R48.1), and SHALL purge them only after confirmation by an authorized role, or automatically WHERE automatic purge is enabled by configuration.
3. WHEN a file is purged, THE SYSTEM SHALL delete the stored object, keep its hash and metadata with the purge time and actor, mark dependent views as "ไฟล์ต้นฉบับถูกลบตามนโยบายการเก็บรักษา", and audit the action; THE SYSTEM SHALL document how purged files expire from backups (R46.3).
4. THE SYSTEM SHALL report the number of files due, purged and held on each run.

### R55. User Deprovisioning Sync with the IdP · P0 (เสนอ) · Must (เสนอ) `[PROPOSED v4.1 — needs IC/DPO confirmation]`
1. WHEN a user is disabled or removed in the identity provider, THE SYSTEM SHALL deny that user's next request (session validation against the IdP or token lifetime no longer than a configurable maximum) and SHALL NOT rely on the local `users` table alone.
2. THE SYSTEM SHALL run a scheduled reconciliation between local users (role, ward scope) and the IdP, deactivate local accounts that no longer exist or are disabled in the IdP, and report accounts whose role/ward differs, for Admin and ICN review (R27, R51).
3. THE SYSTEM SHALL keep deactivated accounts (not delete them) so audit references remain resolvable, and SHALL log every activation, deactivation, role or ward change (R29).
4. THE SYSTEM SHALL include the reconciliation report in the periodic access review (R45.3) ; the review interval follows hospital policy.

### R56. Review-time Measurement Method for NFR-11 · P1 (เสนอ) · Must (เสนอ) `[PROPOSED v4.1 — needs IC/DPO confirmation]`
1. THE SYSTEM SHALL measure review time per record as the active time from opening the review page (R5.2) to approve or reject, excluding gaps without user activity longer than a configurable idle threshold; the threshold value SHALL be agreed with IC before NFR-11 targets are set.
2. THE SYSTEM SHALL measure "fields corrected by ICN" as the share of extracted fields whose approved value differs from the extracted value, and "records requiring manual entry" as the share of uploads that ended in `MANUAL_REQUIRED` or were keyed manually, per layout and per period.
3. THE SYSTEM SHALL record these measurements without PHI (record IDs and timings only) and SHALL show the method and idle threshold next to every reported NFR-11 figure.

---

## Non-Functional Requirements `[ตัวเลขเป็นข้อเสนอเริ่มต้น]`
| ID | ข้อกำหนด |
|---|---|
| NFR-1 | Dashboard/Antibiogram p95 ≤ 3 s บน ≥ 50,000 isolates |
| NFR-2 | Uptime, RPO/RTO, restore test ตามนโยบายโรงพยาบาล `[Q10]` |
| NFR-3 | OWASP ASVS (ระดับที่ตกลง), upload validation, parameterized queries, CSRF/XSS, rate limit, dependency scan |
| NFR-4 | ไม่มี PHI ใน log/analytics |
| NFR-5 | UI ไทย ; Asia/Bangkok ; เก็บ CE แสดง พ.ศ./ค.ศ. ตามตั้งค่า |
| NFR-6 | WCAG 2.1 AA ; ไม่พึ่งสีอย่างเดียว ; ใช้บนมือถือ/แท็บเล็ตได้ |
| NFR-7 | ทุกตัวเลขตรวจย้อนกลับถึง isolate (R34) |
| NFR-8 | กฎ %S/first-isolate/phenotype/cluster เป็น pure functions แยกโมดูลพร้อม unit test |
| NFR-9 | Structured logging ไม่มี PHI ; alert เมื่อ OCR/background job ล้มเหลว |
| NFR-10 | OCR/LLM/messaging ผ่าน adapter เปลี่ยนผู้ให้บริการได้ |
| NFR-11 | วัดและรายงาน: เวลาเฉลี่ยในการ review ต่อใบ, สัดส่วนฟิลด์ที่ถูกแก้โดย ICN, สัดส่วนใบที่ต้องคีย์เอง — เป็นตัวชี้วัดว่า OCR "ลดการคีย์" จริงหรือไม่ (เกณฑ์ตั้งร่วมกับ IC) ; วิธีวัด: R56 `[Changed v4.1]` |
| NFR-12 | OCR ต่อใบ: เวลาประมวลผลเป้าหมายตั้งร่วมกับผู้ใช้ ; คิวงานทนต่อการล้มเหลว/ลองใหม่ |
| NFR-13 | **Security gates ต่อ Phase:** P0 threat model + DPIA ฉบับร่าง · P1 ทดสอบสิทธิ์/pentest ก่อนใช้ข้อมูลจริง · P2 red-team AI (injection, exfiltration, abstention) + shadow mode · P3 ทดสอบช่องทางแจ้งเตือน |
| NFR-14 | ข้อมูลจริงอยู่ที่ระดับปริมาณ ~5 พันแถวต่อปี (ดูภาคผนวก A) ; ระบบต้องรองรับ ≥ 50,000 isolates ตาม NFR-1 โดยไม่ต้องแยกบริการ |

## Phase Summary
| Phase | Stories |
|---|---|
| **P0 Foundation** | R23–R27, R28 (seed), R29, R30, R33, R34, R36 (storage/masking), **R43, R46 (backup/degraded), R47, R48, R51, R52** |
| **P1 Core** | R3, R32, R35, R1, R2, R4, R5, R6, R31, R7–R14, R20 (in-app), R21, R22, R38, **R39, R40, R41, R42 (OCR path), R44, R45, R49** |
| **P2 AI** | R15, R16, R37 (เริ่ม L2→L3, shadow mode ก่อนเปิดใช้), **R42 (Consult path), R50** |
| **P3 Alerts** | R17–R19, R20 (external) |

> **Security gates (NFR-13):** ห้ามใช้ข้อมูลจริงใน P1 จนกว่าผ่านการทดสอบสิทธิ์/pentest และ DPIA ; ห้ามเปิด AI Consult จนกว่าผ่าน red-team + shadow mode + ข้อ Q19

> **R53–R56 `[PROPOSED v4.1]`** ยังไม่จัดเข้า phase จนกว่า IC/DPO ยืนยัน ; ข้อเสนอ: R55 คู่กับ R26/R51 (P0) · R53, R54 คู่กับ R30/R36 (P0/P1) · R56 คู่กับ R5 (P1) ; ลำดับการพัฒนาจริงใช้แผน increment ใน design rev2 §14

---

## Change Log v3 → v4
| จุด | v3 | v4 |
|---|---|---|
| ความปลอดภัยเชิงสถาปัตยกรรม | กระจายใน R30/R36/R37 | R41 sandbox, R42 AI gateway, R43 RLS, R51 MFA |
| ความถูกต้องของรายงาน | live statistics | R44 รายงานฉบับเผยแพร่แบบ frozen + R49 config governance |
| การควบคุมการอนุมัติ | R5 | R40 4-eyes (ตั้งค่าได้) |
| ความเป็นส่วนตัวของสถิติ | ซ่อน HN ใน Executive | R39 small-cell suppression |
| ความทนทาน | NFR-2 | R46 degraded mode, dead-letter, ซ้อมกู้คืน |
| การพัฒนา/ส่งมอบ | NFR-3, NFR-8 | R47 supply chain + dev data, R48 incident, R52 deployment/release |
| คำถามค้าง | Q1–Q20 | + Q21–Q24 |

## Change Log v4 → v4.1
> ที่มา: `review_SE_process.md` ; เป็นการแก้ความสอดคล้องเชิงวิศวกรรมเท่านั้น ไม่เปลี่ยนค่าทางคลินิก/นโยบาย ; finding ที่แก้ในเอกสารอื่นดู Change Log ของ design rev2 / deployment rev2

| Finding | ส่วนที่แก้ในไฟล์นี้ | สรุปการเปลี่ยนแปลง |
|---|---|---|
| D1 | §0.3 แถว "Approved data" | predicate เดียว: `status = APPROVED` และ (`source = EXCEL_SEED` หรือ `report_status = Final`) ; บันทึกประเด็น P-1 (ข้อมูลคีย์เองไม่มีฟิลด์ report status) |
| D2 | R28.6 | ผู้อนุมัติแถว seed = บัญชีระบบ `system:excel-seed` ; `approved_at` = เวลา commit ; batch เก็บผู้รัน |
| D3 | R33.5, §0.3 แถว "Phenotype" | ผล 3 ค่า positive/negative/indeterminate + รายการยาที่ขาด ; indeterminate ไม่นับเป็น negative |
| D9 | R2.5 (ข้อใหม่), §0.3 แถว `VOIDED` | สถานะ `VOIDED` พร้อมเหตุผล + audit สำหรับ draft เสีย/อัปโหลดผิดผู้ป่วย |
| D13 | R5.2 | ผล extraction ต้องมี page + bounding box ต่อฟิลด์/แถวยา (contract v1) |
| D14 | R3.8 | "extract twice" → ตรวจไขว้ตามวิธี: text layer เทียบ OCR ของหน้าที่ render ; ภาพใช้สองวิธีอิสระ ; ตั้งค่าได้ต่อ layout |
| D5 | §0.3 แถว "AST result", Open Questions Q25 | ตั้งคำถาม Q25 เรื่อง `NS` ; ค่าสมมติคง S/I/R/D |
| D8 | Open Questions Q26 | ตั้งคำถาม Q26 ; ทางเลือกอยู่ใน design rev2 §4.1 |
| D12 | Open Questions Q27 | ตั้งคำถาม Q27 |
| หมวด 2 (PDPA data subject) | R53 (ใหม่) | `[PROPOSED v4.1 — needs IC/DPO confirmation]` |
| หมวด 2 (retention purge) | R54 (ใหม่) | job ลบไฟล์ตาม `source_files.retention_until` + hold + audit |
| หมวด 2 (deprovisioning) | R55 (ใหม่) | ซิงก์การยกเลิกสิทธิ์กับ IdP + รายงาน reconciliation |
| หมวด 2 (วิธีวัด NFR-11) | R56 (ใหม่), NFR-11 | นิยามเวลา review แบบตัดช่วงไม่มีกิจกรรม (ค่าเกณฑ์ตั้งร่วมกับ IC) |
| Q28 | Open Questions Q28 | ตั้งคำถามที่ตั้ง repo/CI |
| ตาราง Open Questions | หัวตาราง + คอลัมน์ "Req ที่กระทบ" | ทุกแถวมี 4 คอลัมน์ ; คำถามเดิมไม่เปลี่ยน |
| หัวเอกสาร | บรรทัดเวอร์ชัน/แท็ก | v4.1, แท็ก `[Changed v4.1]` และ `[PROPOSED v4.1 — needs IC/DPO confirmation]` |

## ข้อแก้ไขข้อผิดพลาดจากฉบับก่อนหน้า (v2 / steering)
| ข้อความเดิม | ที่ถูกต้องตามการตรวจข้อมูล |
|---|---|
| `Sheet1` มี 89 คอลัมน์ | **86** คอลัมน์ (89 คือชีต S.aureus) ; ร่างของ Quick ถูกต้อง |
| ชีตแยกตามเชื้อ "ดูเหมือนเป็นสำเนา" | **ไม่ได้ยืนยัน** ; key match 35–70% (ยกเว้น `Other` 100%) ; ผลรวมแถว 7,205 > 4,729 → อย่าทิ้งก่อน reconcile |
| ผล D "ไม่นับเป็น S" เป็น default | **ยังไม่มีแหล่งยืนยัน** ; แนวปฏิบัติจริงมีทั้งแบบรวม S+SDD และแบบรายงาน %S กับ %SDD แยก → ใช้แสดงสองคอลัมน์ + ตัวเลือก (R12) |
| import เป็นระบบ re-run + กักแถวที่มีค่าไม่ใช่ S/I/R/D | Excel เป็น seed ครั้งเดียว ; ค่า annotation เก็บเป็นหมายเหตุ (R28) |

## Open Questions
> `[Changed v4.1]` หัวตารางมี 4 คอลัมน์เท่ากันทุกแถว (เดิม Q21–Q24 มี 4 ช่องแต่หัวตารางมี 3) ; คอลัมน์ "Req ที่กระทบ" ของ Q1–Q20 รวบรวมจากป้าย `[ASSUMPTION Qn]` ในเอกสารนี้ ; ค่าสมมติของ Q1–Q24 **ไม่เปลี่ยน** ; ทะเบียนเจ้าของ/increment ที่บล็อกอยู่ใน `decisions.md`

| ID | คำถาม | Req ที่กระทบ | ค่าสมมติปัจจุบัน |
|---|---|---|---|
| Q1 | `specimen_date` ใช้วันเก็บ / Lab รับ / รายงาน | §0.3, R11.1, R12.1 | Lab รับ (ตรวจเทียบ 1 แถว) |
| Q2 | วิธีนับ D และ I ใน %S | R12.3 | แสดง %S และ %SDD แยก ; default ให้จุลชีววิทยา/ASP เลือก |
| Q3 / Q3b / Q3c | ปีปฏิทิน/ปีงบ ; n ขั้นต่ำ ; เกณฑ์สี | R8, R12.5, R12.6 | ไตรมาสปัจจุบัน ; 30 ; 90/70/50 ตาม SRS |
| Q4 / Q4b | นิยาม MDRO/CRE/CR-AB/CRPA/MRSA/VRE/ESBL/ESCR ; ช่วง culture tracking | §0.3, R33.1, R18.1 | ฉบับร่างใน R33 รอ ICN ลงนาม |
| Q5 | เกณฑ์ผ่านของ OCR | R32.3 | ไม่กำหนดตัวเลขเอง |
| Q6 | ผู้ให้บริการ OCR/LLM/LINE ที่ DPO อนุมัติ และข้อมูลที่ส่งออกได้ | R30.3, R42, Feature F | ส่งเฉพาะข้อมูลที่ mask/ไม่ระบุตัวตน |
| Q7 | เก็บชื่อผู้ป่วยหรือไม่ ; สิทธิ์ Admin | R27, R30.1 | ไม่เก็บ ; Admin ไม่อนุมัติ |
| Q8 | SSO/AD ; เชื่อม HIS/LIS ในอนาคต | R26, R51.2 | ยังไม่รวม |
| Q9 | ถ้อยคำ "first-line/alternative" ; มี guideline ASP ให้ AI อ้างอิงหรือไม่ | R15.5, R15.6 | ไม่ให้ dose/duration |
| Q10 | Retention, RPO/RTO, สิทธิ์เจ้าของข้อมูล | R30.4, R36.3, R46.3, R46.4, NFR-2, R53, R54 | รอนโยบาย |
| Q11 | ตาราง ward → ICU/Non-ICU/ตึก ; รายการ `Case` (HAI) | R25.1, R7.2 | สร้างจาก seed แล้วให้ ICN ยืนยัน |
| **Q12** | แล็บต้นทางภายนอกมีกี่แห่ง รูปแบบไฟล์ (PDF ข้อความ/สแกน/โทรสาร) และ layout | R3.3, R32.1 | เริ่มจาก layout ของโรงพยาบาล 2 แบบที่มีตัวอย่าง |
| **Q13** | ผู้ป่วยเชื่อมกับโรงพยาบาล อย่างไร (HN ของโรงพยาบาล บนใบ?) | R3.5, R3.9 | HN ของโรงพยาบาล อยู่บนใบ |
| **Q14** | ใบ Preliminary ให้นับในสถิติหรือไม่ | R35.4 | ไม่นับ |
| **Q15** | ใครกรอก Ward/Patient Type ตอนอัปโหลด (ผู้อัปโหลด หรือดึงจาก HIS) | R3.4 | ผู้อัปโหลดกรอก |
| **Q16** | รายการยา × เชื้อที่ `D` ใช้ได้ (sdd_allowed) | R3.9, R33.3 | เริ่มจาก Cefepime, Pip/tazo ใน Enterobacterales ตามข้อมูล seed รอจุลชีววิทยายืนยัน |
| **Q17** | รายชื่อเชื้อ/phenotype ในรายการเฝ้าระวัง cluster | R11.2 | ICN กำหนด |
| **Q18** | เกณฑ์ผ่านการประเมิน AI และระยะ shadow mode | R37.4, R37.5 | ผู้เชี่ยวชาญกำหนด |
| **Q19** | AI Consult เข้าข่ายเครื่องมือแพทย์ตามกฎหมายไทยหรือไม่ | R37.8 | ให้ฝ่ายกำกับ/กฎหมายตัดสินก่อนเปิดใช้ |
| **Q20** | คอลัมน์ยาที่ซ้ำ (`.1`) ใน Excel หมายถึงอะไร (วิธีทดสอบ/ panel) | R24.1 | ยังไม่ทราบ ; จับคู่ด้วย method เมื่อยืนยัน |
| **Q21** | เป้าหมาย deployment: เซิร์ฟเวอร์ในโรงพยาบาล / private cloud ของโรงพยาบาล / คลาวด์ภายนอก (ภูมิภาคใด) และมี Identity Provider (AD/OIDC) หรือไม่ | R51, R52 | on-prem หรือ private cloud + Docker Compose ; ใช้ OIDC ถ้ามี ไม่มีจึงใช้ Keycloak/local |
| **Q22** | ใช้นโยบาย 4-eyes กับการอนุมัติหรือไม่ (ผู้อนุมัติ ≠ ผู้อัปโหลด) และมี ICN กี่คน | R40 | ปิดไว้ก่อน (ตั้งค่าเปิดได้) ; ถ้ามี ICN คนเดียวใช้ override พร้อมเหตุผล |
| **Q23** | ค่า K ของ small-cell suppression และ role ที่ถูกซ่อน HN | R39 | K=5 ; ซ่อน HN ใน Executive |
| **Q24** | สถานะ CII ของโรงพยาบาล, ช่องทางและกรอบเวลาแจ้งเหตุ (PDPA/ไซเบอร์) | R48 | ให้ DPO/ไซเบอร์กำหนด |
| **Q25** `[New v4.1]` | ยอมรับผล `NS` (non-susceptible) จากใบรายงานหรือไม่ และถ้ารับ นับในตัวหารของ %S อย่างไร | R1.4, R3.9, R12.2, R12.4 | ไม่รับ — ผลที่ยอมรับคือ S/I/R/D ตาม R1.4/R3.9 ; ค่า `NS` บนใบ → `needs_review` |
| **Q26** `[New v4.1]` | ICN แก้ record ที่ `APPROVED` แล้ว → เวอร์ชันใหม่เป็น `APPROVED` ทันที หรือเข้า `PENDING` (และฉบับเดิมนับในสถิติระหว่างรอหรือไม่) | R5.6, R35.3, R40 | R5.6 ยังไม่ระบุ ; design rev1 ให้เวอร์ชันใหม่เป็น `PENDING` ซึ่งทำให้ record หายจากสถิติระหว่างรอ (D8) ; ทางเลือกใน design rev2 §4.1 |
| **Q27** `[New v4.1]` | ผู้ใช้หนึ่งคนมีหลายบทบาทได้หรือไม่ (เช่น ICN ที่เป็น Admin ด้วย) | R27, R5.8, R40 | หนึ่งบทบาทต่อผู้ใช้ (`users.role` ใน design) |
| **Q28** `[New v4.1]` | โค้ดและ CI อยู่ที่ใด (GitHub / GitLab ภายในโรงพยาบาล / อื่น ๆ) | R47.2, R47.3, R52.1 | ยังไม่กำหนด ; แม่แบบ CI ในคู่มือ deployment เขียนสำหรับ GitHub Actions |

---

## Appendix A — สรุปข้อมูล seed (Excel) ที่ใช้ประกอบการออกแบบ
คำนวณจาก `Sheet1` โดยทำความสะอาดชื่อเชื้อ/ward แบบหยาบ ตัวเลขเป็นค่าประมาณ

- 4,729 แถว ; 1,720 HN ; 806 HN ปรากฏหลายแถว (รวม 3,814 แถว) ; สูงสุด 120 แถวต่อ HN ; first isolate (HN+เชื้อ+ปี) ≈ 2,998 แถว
- ช่วงเวลา: 2026 = 3,548 · 2025 = 976 · ก่อนหน้า = 205 ; ล่าสุด 26 ก.ย. 2026
- n ≥ 30 ระดับทั้งโรงพยาบาล: ปี 2025 = 4 เชื้อ ; ปี 2026 = 11 เชื้อ
- Ward ว่าง 45.7% ; ค่าดิบ 288 แบบ ; `Case` ว่าง 2,468 แถว และสะกดไม่คงที่
- ช่อง AST ที่ไม่ใช่ S/I/R/D: 851 ช่อง ใน 819 แถว (17%) ; 492 แบบ
- ผล D = 269 (Cefepime 140, Pip/tazo 124 ที่เหลือเล็กน้อย)
- 182 แถวซ้ำทั้ง HN+วันที่+specimen+เชื้อ ; `Name` ว่าง 100%
- ทดสอบ cluster (14 วัน, เชื้อ+ward เดียวกัน): 982 หน้าต่างผ่านเมื่อนับแถว → 680 เมื่อนับผู้ป่วยไม่ซ้ำ

## Appendix B — Golden case #1 (ใบของโรงพยาบาล, Lab No. 9900000001)
```json
{
  "source_layout": "micro_lab_scan",
  "lab_no": "9900000001", "order_no": "7700000001", "hn": "0000123", "sex": "M",
  "lab_received_at": "2023-05-13T01:05", "reported_at": "2023-05-16T13:10",
  "report_status": "Final", "ward": null,
  "specimen_raw": "Organism/Culture, Hemoculture double lumen cath (เส้น A)",
  "isolates": [{
    "organism_raw": "Klebsiella pneumoniae",
    "ast": {"Amikacin":"S","Amoxicillin/clavulanate":"R","Ampicillin":"R","Cefepime":"S",
      "Cefoxitin":"R","Ceftriaxone":"R","Cefuroxime":"R","Ciprofloxacin":"R",
      "Ertapenem":"S","Gentamicin (10 mcg)":"S","Imipenem":"S","Meropenem":"S",
      "Piperacillin/tazobactam":"D","Tetracycline":"R","Trimethoprim/Sulfamethoxazole":"S"}
  }],
  "needs_review": [{"path":"ward","reason":"not readable on report; supplied by uploader (R3.4)"}]
}
```
หมายเหตุ: ค่า Ward ในภาพที่ผมมองไม่เห็น (อาจว่างหรือถูกแถบปิดทับ) ; หน้า HIS ของใบเดียวกันระบุ ICU B ; ต้องตรวจกับภาพต้นฉบับ

## Appendix C — โครงสร้างคำตอบของ AI Consult (structured output)
```json
{
  "scope": {"ward": "", "specimen_category": "", "period": "", "data_as_of": "", "min_n": 30},
  "facts": [{"id": "f1", "statement": "", "organism": "", "drug": "", "pct_s": 0.0, "n_tested": 0, "source": {"tool": "get_antibiogram", "call_id": ""}}],
  "reasoning": [{"statement": "", "assumptions": [""], "depends_on": ["f1"]}],
  "needs_clinician_judgment": [""],
  "abstentions": [{"reason": "n_below_minimum|no_data|out_of_scope", "detail": ""}],
  "guideline_citations": [{"document": "", "version": "", "section": ""}],
  "disclaimer_shown": true
}
```
กฎ: ทุกตัวเลขใน `facts` ต้องตรงกับผลจาก tool ของคำขอเดียวกัน ; `reasoning` ห้ามมีตัวเลขใหม่ ; ถ้า `abstentions` ไม่ว่าง ต้องไม่มีข้อแนะนำยาในรายการ

## แหล่งอ้างอิง
ค้นพบและอ่านบางส่วนเมื่อ 16 ต.ค. 2026 — ระดับการตรวจสอบระบุไว้แต่ละข้อ

1. **CLSI M39, 5th ed. (ม.ค. 2022)** — https://clsi.org/shop/standards/m39/ · อ่านได้แค่หน้ารายการเปลี่ยนแปลง ; กฎ "≥30 isolates" และ "first isolate ต่อผู้ป่วยต่อ period" มาจากบทสรุปรอง (PMC4729434) ซึ่งอาจอ้างฉบับเก่า → ตรวจกับตัวเล่มก่อนล็อกค่า (R12)
2. **CLSI M100, 36th ed. (ม.ค. 2026)** — https://clsi.org/shop/standards/M100 · ที่มาของหมวด SDD และ breakpoint
3. **Magiorakos AP et al., Clin Microbiol Infect 2012;18(3):268–281**, doi:10.1111/j.1469-0691.2011.03570.x · นิยาม MDR/XDR/PDR สำหรับ 5 กลุ่มเชื้อ ; แนะนำให้ทดสอบยาครบหรือเกือบครบหมวด ; นิยาม CRE/ESBL ไม่ได้อยู่ในบทความนี้
4. **Australian Commission on Safety and Quality in Health Care — Specification for a Hospital Cumulative Antibiogram (2026)** — https://www.safetyandquality.gov.au/sites/default/files/2026-08/Specification-for-a-Hospital-Cumulative-Antibiogram.pdf · เห็นเพียงบางส่วน ; ใช้เทียบรูปแบบนำเสนอ
5. **กฎหมายเครื่องมือแพทย์ไทย:** พ.ร.บ.เครื่องมือแพทย์ พ.ศ. 2551 (แก้ไขฉบับที่ 2 พ.ศ. 2562) ; แนวทาง SaMD ของ อย. (มิ.ย. 2024 แก้ไข ต.ค. 2024) ; หน้าจัดระดับความเสี่ยง https://medical.fda.moph.go.th/samd-head/riskclass_samd (ลิงก์มาจากรายการอ้างอิงของบทความวิชาการไทย ยังไม่ได้เปิดเอง) ; ประกาศ labeling 2025 บังคับ UDI สำหรับ SaMD ระดับ 2–4 มีผล 20 มิ.ย. 2026 (สรุปโดย Tilleke & Gibbins) → ข้อ Q19
6. **PDPA พ.ศ. 2562 (มีผล 1 มิ.ย. 2022)** — ข้อมูลสุขภาพเป็นข้อมูลอ่อนไหว ; สรุปจากแหล่งรอง (Hunton, Tilleke) ; ไม่ได้อ่านตัวบท → ให้ DPO/กฎหมายตรวจมาตรา 26, 28
7. **FDA (สหรัฐฯ) Clinical Decision Support Software guidance (ปรับปรุง ม.ค. 2026)** — ไม่ใช่กฎหมายไทย ; ใช้เป็นเกณฑ์อ้างอิงการออกแบบ (แพทย์ต้องตรวจสอบเหตุผลของคำแนะนำได้เอง) ; อ่านจากบทวิเคราะห์สำนักกฎหมาย วันที่ในแหล่งต่าง ๆ ไม่ตรงกัน
8. **Kiro documentation** — https://kiro.dev/docs/getting-started/first-project · steering อยู่ที่ `.kiro/steering/` ; requirements ใช้ EARS · ต้นฉบับ EARS (Mavin et al., RE 2009) อ้างจากความจำ ยังไม่ได้ตรวจ
9. **CREOLA framework — npj Digital Medicine 2025;8:274** — https://pmc.ncbi.nlm.nih.gov/articles/12075489/ · กรอบจัดประเภท/ประเมินความรุนแรงของ hallucination และ omission ในการสรุปเวชระเบียน ; ไม่ใช่งานแนะนำยา → ใช้เป็นแนวทางวิธีวัด ไม่ใช่ตัวเลขอ้างอิง
10. **OWASP Top 10 for LLM Applications 2025** — https://genai.owasp.org · ใช้เป็นเกณฑ์ R37, R41, R42 ; ยืนยันรายชื่อ 10 ข้อจากบทสรุปรองหลายแหล่ง ไม่ได้อ่านตัว PDF ต้นฉบับ
11. **NIST AI 600-1 Generative AI Profile (ก.ค. 2024)** — https://doi.org/10.6028/NIST.AI.600-1 · ใช้เป็นกรอบ Govern/Map/Measure/Manage ของ R37
12. **พ.ร.บ.การรักษาความมั่นคงปลอดภัยไซเบอร์ พ.ศ. 2562** (สรุปโดย Mondaq/Asia Law Portal) และร่างแก้ไข ก.ค. 2025 (Tilleke & Gibbins) · แหล่งรอง ไม่ได้อ่านตัวบท ; สถานะ CII ของโรงพยาบาล ไม่ทราบ (Q24)

**ยังไม่พบ:** แนวทางระดับชาติของไทยสำหรับ antibiogram/นิยาม MDRO และแหล่งนิยาม CRE/ESBL → ขอจากคณะกรรมการ IC/ASP ของโรงพยาบาล
