# Deployment Guide — IC MDR & Antibiogram Analytics

> คู่กับ `requirements_IC_MDR_v4.md` (R52, R46, R47, R41–R43) และ `design_IC_MDR.md` · ไฟล์ประกอบอยู่ในโฟลเดอร์ `deploy/`
> **สถานะ: แม่แบบที่ยังไม่ได้ทดสอบ** — ผม **ไม่ได้ deploy จริง** เพราะ (1) ยังไม่มีโค้ดแอป (2) ไม่มีเซิร์ฟเวอร์/สิทธิ์เข้าถึงโครงสร้างพื้นฐานของคุณ (3) ที่ตั้งการติดตั้ง, IdP และผู้ให้บริการ OCR/LLM ยังไม่ตัดสิน (Q21, Q6) (4) สภาพแวดล้อมของผมไม่มี Docker จึงตรวจได้เพียงไวยากรณ์ YAML/shell และความสอดคล้องของเครือข่ายใน compose
> **ที่ตรวจแล้ว `[F]`:** compose อ่านได้, ทุก service อ้างเครือข่ายที่ประกาศไว้, `worker-extract` อยู่เฉพาะเครือข่าย sandbox และไม่มี `DATABASE_URL`, มีเพียง proxy ที่เปิดพอร์ต, มีเพียง `ai-gateway` และ `clamav` ที่อยู่เครือข่าย egress, สคริปต์ผ่าน `bash -n`
> **ที่ยังไม่ได้ตรวจ `[J]`:** การรันจริงทั้งหมด, ความถูกต้องของ tag/ชื่อ image, พฤติกรรมของ healthcheck, การสำรอง/กู้คืนจริง, CI จริง

## 1. สิ่งที่ได้ในชุดนี้
| ไฟล์ | หน้าที่ | Req |
|---|---|---|
| `docker-compose.yml` | โครงบริการ 4 โซนเครือข่าย (edge / backend / sandbox / egress), hardening (read-only, drop capabilities, no-new-privileges), จำกัดทรัพยากร worker | R41, R42, R52 |
| `.env.example` | รายการตัวแปร/ความลับที่ต้องกรอก (ห้าม commit `.env`) | R47.4 |
| `Caddyfile` | TLS, security headers, บล็อก `/internal/*`, จำกัดขนาด body | R52.3 |
| `db-init/01-roles.sh` | แยก role ฐานข้อมูล (migrator / app_rw / jobs_rw / readonly_ro) ไม่มีสิทธิ์ bypass RLS | R43 |
| `dockerfiles/*` | แม่แบบ Dockerfile (ผู้ใช้ไม่ใช่ root, ติดตั้งจาก lockfile ที่มี hash) | R47.2 |
| `scripts/backup.sh`, `restore_test.sh` | สำรองเข้ารหัส (age) + ทดสอบกู้คืน | R46.3 |
| `ci/github-actions-ci.yml` | pipeline: test → secret/dependency/SAST scan → build → SBOM → image scan | R47.2 |

## 2. โครงสร้างที่ติดตั้ง
```
Internet/Intranet ─► [proxy :443] ─► api ─► db (PostgreSQL, RLS)
                                       │ ├─► minio (ไฟล์ต้นฉบับ)
                                       │ └─► redis (คิวงาน)
                          network: backend (internal) : api, worker-jobs, db, redis, minio
                          network: sandbox (internal) : worker-extract, clamav, redis, minio, api, ai-gateway
                          network: egress             : ai-gateway, clamav  (ต้องจำกัดที่ไฟร์วอลล์โฮสต์)
```
- **ขนาด:** โฮสต์ 1 เครื่องเพียงพอสำหรับข้อมูลระดับนี้ `[R]` (~4.7 พันแถว) ; ถ้าต้องการแยกความเสี่ยง ให้แยก 2 โฮสต์: (A) proxy+api+db+minio+redis (B) worker-extract+clamav+ai-gateway
- **ข้อจำกัดของ compose:** `internal: true` กันการออกอินเทอร์เน็ต แต่ **ไม่ได้จำกัดระดับพอร์ต/ปลายทาง** ระหว่างคอนเทนเนอร์ในเครือข่ายเดียวกัน และเครือข่าย `egress` เปิดทางออกกว้าง → ต้องตั้งกฎไฟร์วอลล์ที่โฮสต์ให้ `ai-gateway` ออกได้เฉพาะปลายทางที่ DPO อนุมัติ และ `clamav` ออกได้เฉพาะ mirror ของ ClamAV (หรือเปลี่ยนเป็นอัปเดตลายเซ็นผ่าน mirror ภายใน)
- **MinIO ใน sandbox:** worker อ่านไฟล์ผ่าน presigned URL อายุสั้น ; ควรตั้ง bucket policy ให้ชัด และตรวจว่า worker ไม่มีคีย์ของ MinIO (ใน compose ไม่ได้ส่งคีย์ให้ worker)

## 3. สิ่งที่ต้องมีก่อนติดตั้ง (Prerequisites)
- โฮสต์/VM ที่ผ่านนโยบายความปลอดภัยของโรงพยาบาล, Docker Engine + Compose, ที่เก็บข้อมูลที่เข้ารหัส (ดิสก์/volume)
- ใบรับรอง TLS ที่โรงพยาบาลเชื่อถือ (วางที่ `deploy/certs/fullchain.pem`, `privkey.pem`) และชื่อโดเมนภายใน (`SITE_ADDRESS`)
- OIDC IdP (หรือเปิด profile `idp` เพื่อใช้ Keycloak) ; ตัดสินใจเรื่อง MFA (R51)
- ที่เก็บความลับ (secret manager) — ถ้าไม่มี ให้ใช้ไฟล์ `.env` ที่สิทธิ์ 600 บนโฮสต์ที่จำกัดการเข้าถึง และหมุนเวียนตามรอบ
- ที่เก็บสำรองนอกเครื่อง (และสำเนา immutable/offline อย่างน้อย 1 ชุด)
- คำตอบของ **Q6, Q21** (ผู้ให้บริการ OCR/LLM และที่ตั้งการติดตั้ง) — มีผลต่อ `ai-gateway`

## 4. ขั้นตอนติดตั้งครั้งแรก
1. **เตรียมโฮสต์:** ตั้งไฟร์วอลล์ขาเข้าเฉพาะ 80/443 ; ขาออกปฏิเสธโดยปริยาย ยกเว้นรายการที่อนุมัติ (ai-gateway provider, mirror ClamAV, NTP, แพ็กเกจที่อนุญาต)
2. **ดึงโค้ด/อิมเมจ:** สร้างอิมเมจใน CI ตรึงด้วย digest ; ห้าม build บนโฮสต์ production
3. **ตั้งค่า:** `cp deploy/.env.example deploy/.env` → สร้างความลับแบบสุ่มยาวทุกค่า (`CHANGE_ME`) → ตรวจสิทธิ์ไฟล์ 600 ; ตั้ง `*_IMAGE` เป็น digest ที่ตรวจแล้ว
4. **รันครั้งแรก:** `cd deploy && docker compose --env-file .env up -d db redis minio clamav` แล้วรอ healthy
5. **migrations:** รัน Alembic ด้วย role `migrator` (ไม่ใช่ app_rw) ; ตรวจว่า
   - ตารางทั้งหมดเปิด RLS ตามที่ออกแบบ, `app_rw` ไม่ใช่เจ้าของตาราง
   - `audit_log`, `access_log`, `published_antibiograms` ถูก `REVOKE UPDATE, DELETE` จาก `app_rw`/`jobs_rw`
   - `isolates` มี constraint `ward_required_for_new` และ `approved_has_approver`
6. **สร้าง bucket และคีย์แอปของ MinIO** ที่มีสิทธิ์เฉพาะ bucket `mdr-source-files` ; เปิดการเข้ารหัสฝั่งเซิร์ฟเวอร์ตามนโยบาย KMS ของโรงพยาบาล `[J]`
7. **เปิดบริการที่เหลือ:** `docker compose --env-file .env up -d` แล้วตรวจ `docker compose ps` ว่า healthy ทั้งหมด
8. **ตั้งค่า IdP:** ลงทะเบียน client, redirect URI, บังคับ MFA สำหรับ ICN/Admin/ops ; map role → ตาราง `users`
9. **ตรวจรับ (smoke):** เข้าด้วย role ต่างกัน, ทดสอบ authz matrix บน staging, ตรวจว่า `/internal/*` ภายนอกได้ 404, ตรวจ header ความปลอดภัย, ตรวจว่า `worker-extract` เชื่อม DB ไม่ได้และออกอินเทอร์เน็ตไม่ได้ (ลอง `curl` และ `psql` จากคอนเทนเนอร์)

## 5. Seed ข้อมูลจาก Excel (R28)
- รันจาก **เครื่องผู้ดูแลที่ได้รับอนุญาต** ไม่ใช่ใน workspace ของเอเจนต์ AI และไม่ copy Excel จริงเข้า repo
- ขั้น: `--dry-run` → ตรวจรายงาน (ค่าที่ไม่ใช่ S/I/R/D, วันที่ผิด, ward ว่าง, alias ที่เสนอ, reconcile กับชีตแยกเชื้อ) → ICN ยืนยัน alias/ward mapping → `--commit`
- หลัง commit: ตรวจรายงาน reconciliation (R34) เทียบกับ Excel ; เก็บรายงานเป็นหลักฐาน
- **อย่าอัปโหลดข้อมูลจริงใน staging** ยกเว้นผ่านการ de-identify หรือได้รับอนุมัติจาก DPO

## 6. สภาพแวดล้อม
| Env | ข้อมูล | หมายเหตุ |
|---|---|---|
| dev | สังเคราะห์เท่านั้น | เครื่องนักพัฒนา/เอเจนต์ AI เห็นเฉพาะข้อมูลนี้ (R47.1) |
| staging | สังเคราะห์/de-identified | ทดสอบสิทธิ์ ทดสอบ migration และซ้อมกู้คืน ความลับแยกจาก production |
| production | ข้อมูลจริง | เข้าได้เฉพาะผู้ดูแลที่ได้รับอนุมัติ ; ไม่มีเครื่องมือ debug เปิดค้าง |

## 7. Release และ Rollback (R52.2)
1. CI build → test → scan → SBOM → อิมเมจที่ตรึง digest
2. Deploy ไป staging → รัน authz matrix + e2e + golden OCR (ถ้ามี)
3. Production: สำรอง DB ก่อนทุกครั้ง → `docker compose pull && docker compose up -d` (ทีละ service เมื่อทำได้) → smoke test
4. **Migration:** ใช้แบบ backward-compatible (expand → migrate → contract) เพื่อให้ rollback แอปได้โดยไม่ต้อง rollback ฐานข้อมูล ; หากต้อง rollback ฐานข้อมูล ให้ใช้ down-migration ที่ทดสอบแล้ว หรือกู้จากสำรอง
5. Rollback แอป: ตั้ง `APP_VERSION` เป็นเวอร์ชันก่อนหน้า → `up -d` ; ตรวจ health
6. บันทึกการ deploy (ผู้ทำ, เวอร์ชัน, เวลา, ผลตรวจ)

## 8. สำรอง กู้คืน และ degraded mode (R46)
- **ความถี่/เก็บรักษา:** ตามนโยบาย `[OPEN Q10]` ; ค่าเริ่มต้นในสคริปต์: เก็บ 30 วัน (ปรับได้)
- ตั้ง cron/scheduler รัน `scripts/backup.sh` ; คัดลอกออกนอกโฮสต์ทันที ; เก็บ private key ของ age แยกจากสำรอง
- **ทดสอบกู้คืนเป็นระยะ** ด้วย `scripts/restore_test.sh` (เช่นรายเดือนและก่อนทุก release ใหญ่) แล้วรายงานผล ; ผลไม่ผ่านต้องเปิดเหตุ
- **Object storage:** สคริปต์ใช้การ copy volume แบบพื้นฐาน ซึ่งอาจไม่สอดคล้องกันขณะมีการเขียน → แนะนำเปลี่ยนเป็น `mc mirror`/การ replicate ของ MinIO
- **Degraded mode:** ปิด OCR/AI ได้โดยตั้ง `FEATURE_OCR_ENABLED=false` / `FEATURE_AI_CONSULT_ENABLED=false` (หรือสวิตช์ใน DB เมื่อพัฒนาแล้ว) → ระบบยังคีย์เอง/อนุมัติ/ดูสถิติได้
- **แผนสำรองนอกระบบ:** เอกสารขั้นตอนบันทึกเคสเชื้อดื้อยาชั่วคราว (กระดาษ/ฟอร์ม) และการนำเข้าย้อนหลัง `[OPEN Q10]`

## 9. Monitoring และ Alert (NFR-9)
- ขั้นต่ำ: healthcheck ของทุก service, การแจ้งเตือนเมื่อ service ไม่ healthy, ที่เก็บเกือบเต็ม, ใบรับรอง TLS ใกล้หมด, backup/restore test ล้มเหลว, คิวงาน/dead-letter ผิดปกติ, ความต่อเนื่องของ audit hash chain, การ login ล้มเหลวมาก, export ผิดปกติ
- Log: structured, **ไม่มี PHI** ; ส่งไปยังระบบเก็บ log ของโรงพยาบาล/SIEM และเก็บแยกจากโฮสต์ระบบ (กันการแก้ไขย้อนหลัง)
- (ทางเลือก) Prometheus + Grafana + Loki — ไม่ได้ใส่ใน compose ชุดนี้

## 10. Hardening checklist
- [ ] ไฟร์วอลล์ขาเข้า 80/443 เท่านั้น ; ขาออกปฏิเสธโดยปริยาย + allowlist
- [ ] `ai-gateway` ออกได้เฉพาะปลายทางที่ DPO อนุมัติ ; ถ้ายังไม่อนุมัติ `AI_PROVIDER_ALLOWLIST` ต้องว่าง
- [ ] ทุก image ตรึง digest และผ่าน scan ; ไม่ใช้ `latest`
- [ ] ความลับไม่อยู่ใน repo/image/log ; ไฟล์ `.env` สิทธิ์ 600 ; หมุนเวียนตามรอบ
- [ ] DB: app ไม่ใช่เจ้าของตาราง, ไม่ bypass RLS ; audit ห้าม UPDATE/DELETE (ทดสอบแล้ว)
- [ ] MinIO: bucket ไม่ public, presigned URL อายุสั้น, เข้ารหัส
- [ ] MFA เปิดสำหรับ ICN/Admin/ops
- [ ] `/internal/*` ภายนอกได้ 404 ; security headers ครบ
- [ ] sandbox worker: ไม่มี DB/เน็ต, read-only rootfs, จำกัดทรัพยากร (ตรวจจริง)
- [ ] ปิดบริการ/พอร์ตที่ไม่ใช้ (เช่น คอนโซล MinIO :9001 ไม่ได้เปิดออกภายนอกใน compose)
- [ ] สำรอง + ซ้อมกู้คืนผ่านอย่างน้อย 1 ครั้งก่อน go-live

## 11. เกณฑ์ Go-live (ผูกกับ NFR-13)
- [ ] ผ่านการทดสอบสิทธิ์/pentest และแก้ข้อพบระดับสูงแล้ว
- [ ] DPIA ฉบับร่างผ่านการทบทวนโดย DPO ; อนุมัติ provider ที่ใช้ (ถ้ามี)
- [ ] ตอบ Q1–Q4, Q12–Q13, Q21–Q24 อย่างน้อยส่วนที่กระทบ P1
- [ ] ชุด golden OCR ผ่านเกณฑ์ที่ IC กำหนด (R32) — ก่อนเปิดใช้ OCR กับข้อมูลจริง
- [ ] ซ้อมแผนเหตุ (R48.3) อย่างน้อย 4 สถานการณ์
- [ ] AI Consult ปิดอยู่ จนกว่าผ่าน red-team + shadow mode + ตัดสินสถานะ SaMD (Q19)
- [ ] ผู้รับผิดชอบระบบ/ผู้อนุมัติ/ช่องทางติดต่อเหตุ ระบุชัด

## 12. Runbooks ย่อ
**ต่อใบรับรอง TLS:** วางไฟล์ใหม่ใน `deploy/certs/` → `docker compose exec proxy caddy reload --config /etc/caddy/Caddyfile` → ตรวจวันหมดอายุ
**หมุนเวียนความลับ:** สร้างค่าใหม่ → อัปเดต secret manager/.env → restart service ที่เกี่ยวข้อง (ลำดับ: DB password → app; callback secret → api+worker+gateway พร้อมกัน) → ตรวจ health → บันทึกการหมุน
**วงจรผู้ใช้:** เพิ่ม/ลบ/เปลี่ยน role ผ่าน IdP และตาราง `users` ; ทบทวนสิทธิ์ตามรอบ (เช่นรายไตรมาส) พร้อมตรวจบัญชีที่ไม่ได้ใช้
**เหตุสงสัยรั่วไหล/ถูกโจมตี (ย่อ):** 1) ตั้ง `FEATURE_AI_CONSULT_ENABLED=false` และ `FEATURE_OCR_ENABLED=false` 2) แยก service ที่สงสัย 3) เก็บหลักฐาน (audit/access log, gateway log, hash ไฟล์) 4) แจ้ง DPO/ความมั่นคงไซเบอร์ตามกรอบเวลาที่กำหนด (Q24) 5) หมุนความลับที่เกี่ยวข้อง 6) กู้คืนจากสำรองที่ผ่านการทดสอบถ้าจำเป็น 7) ทบทวนหลังเหตุ
**Troubleshooting เร็ว:** `docker compose ps` / `docker compose logs <service>` ; แอปไม่ขึ้น → ตรวจ `.env` ครบ (compose จะล้มเมื่อขาดตัวแปรที่บังคับ), สิทธิ์ role DB, health ของ db/redis/minio ; OCR ไม่ทำงาน → ตรวจคิว/dead-letter, gateway allowlist, สถานะ AV

## 13. เหตุผลที่ไม่ deploy ให้จริงในรอบนี้ และขั้นถัดไป
| สิ่งที่ขาด | ใครต้องให้/ทำ |
|---|---|
| โค้ดแอป (api, worker, web) | พัฒนาใน Kiro/OpenCode ตาม P0–P1 ในเอกสาร design |
| ที่ตั้งและสิทธิ์เซิร์ฟเวอร์ | IT/โครงสร้างพื้นฐานของโรงพยาบาล |
| การตัดสิน Q21 (on-prem/cloud, IdP), Q6 (provider) | โรงพยาบาล + DPO |
| ใบรับรอง TLS และโดเมน | IT |
| การทดสอบ compose/สคริปต์/CI จริง | ทีมพัฒนาบน staging |

**ขั้นถัดไปที่แนะนำ:** (1) ให้ Kiro/OpenCode สร้างโครง repo + schema/migrations + `packages/domain` พร้อม test vector ในเอกสาร design (2) ตั้ง CI (3) ติดตั้ง staging ด้วย compose นี้ด้วยข้อมูลสังเคราะห์ (4) ซ้อมกู้คืน (5) ค่อยเข้าสู่ P1
