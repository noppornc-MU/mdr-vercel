# SECURITY — IC MDR & Antibiogram MVP (เวอร์ชัน Vercel / PostgreSQL)

> **นี่คือระบบสาธิต ไม่ได้รับการรับรองว่าเป็นไปตาม พ.ร.บ.ไซเบอร์ / PDPA / นโยบายโรงพยาบาล**
>
> เอกสารนี้บอกว่ามีมาตรการทางเทคนิคอะไรบ้าง อยู่ที่ไฟล์ไหน และยังขาดอะไร มาตรการเหล่านี้เทียบกับ OWASP Top 10 (2021) / ASVS L1 แบบภาพรวมเท่านั้น
> ไม่ใช่การรับรองตามกฎหมายหรือตามนโยบายองค์กร ก่อนใช้กับข้อมูลจริงต้องผ่านฝ่ายความมั่นคงปลอดภัยสารสนเทศของโรงพยาบาลและ DPO ก่อน (ดูข้อ 6)

## 1. Threat model (สรุป)
| ส่วนประกอบ | รายละเอียด |
|---|---|
| ระบบ | Next.js 16 (App Router) + Prisma 6 + PostgreSQL (Neon) บน Vercel ; repo GitHub แบบ private |
| ข้อมูล | **ข้อมูลสังเคราะห์เท่านั้น** (HN/Lab No สมมติ) ; ไม่มีข้อมูลผู้ป่วยจริง ; โหมด `cached` ไม่ส่งข้อมูลออกไปยัง LLM ภายนอก |
| ผู้ใช้ | ทีมที่ได้รับอนุญาตใน Vercel team `tech-8766` (Vercel Authentication) ซึ่งรู้รหัส Basic Auth ด้วย |
| ภัยหลักที่ป้องกัน | คนนอกเข้าถึง URL สาธารณะ (`*.vercel.app`) · CSRF ผ่าน cookie/Basic Auth ที่เบราว์เซอร์แนบให้ · XSS/clickjacking · อัปโหลดไฟล์อันตรายหรือ path traversal · การยิง API ราคาแพงซ้ำ ๆ (seed/extract/consult) · ข้อความ error/log เผยข้อมูลภายใน · ความลับหลุดเข้า git · dependency มีช่องโหว่ |
| ภัยที่ **ไม่** ครอบคลุม | ผู้ใช้ภายในที่ผ่าน gate แล้ว (ไม่มีตัวตนรายบุคคล ไม่มี RBAC จริง ไม่มี audit trail) · DDoS ระดับเครือข่าย (พึ่ง Vercel) · การโจมตีโครงสร้างพื้นฐานของ Vercel/Neon/GitHub |

**ตัวสลับบทบาท (cookie `demo_role`) เป็นอุปกรณ์สาธิต ไม่ใช่การยืนยันตัวตน** — ใครก็ตามที่ผ่าน gate เลือกบทบาทใดก็ได้ การตรวจบทบาทฝั่ง server (เช่น EXECUTIVE ไม่เห็น HN) มีไว้แสดง flow เท่านั้น

## 2. มาตรการที่ทำแล้ว และตำแหน่งในโค้ด
### 2.1 การควบคุมการเข้าถึง (defence in depth)
| ชั้น | ทำอะไร | ไฟล์ |
|---|---|---|
| หลัก: **Vercel Authentication — All Deployments** | ทุก URL (รวม production domain) ต้อง login Vercel ที่มีสิทธิ์ในโปรเจกต์ ; ฟรีทุกแผนตั้งแต่ ก.ย. 2026 ([Vercel changelog](https://vercel.com/changelog/protect-production-deployments-for-free-on-every-plan), [docs](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication)) | ตั้งใน dashboard (ข้อ 5) |
| รอง: **HTTP Basic Auth ในแอป** | ครอบทุก route รวม `/api/*` ; อ่านค่าจาก `SITE_ACCESS_USER` / `SITE_ACCESS_PASSWORD` ; เทียบแบบ constant-time (SHA-256 + `timingSafeEqual`) ; รหัสผ่าน ≥ 12 ตัวอักษร | `proxy.ts`, `lib/security/basic-auth.ts` |
| Fail closed | บน Vercel (มี `VERCEL`) ถ้าไม่ได้ตั้งค่าหรือค่าไม่ถูกต้อง (ตั้งแค่ตัวเดียว, รหัสสั้นกว่า 12, user มี `:`) → **503 "access not configured"** ทุก request | `lib/security/basic-auth.ts` (`readAccessConfig`) |
| ในเครื่อง | gate ปิดถ้าไม่ได้ตั้งทั้งสองตัว ; ตั้งแล้วทำงานเหมือนบน Vercel | — |

ไฟล์ static ของ build (`/_next/static`, `/_next/image`, `favicon.ico`) ไม่ผ่าน `proxy.ts` (ไม่มีข้อมูล) แต่ยังอยู่หลัง Vercel Authentication

### 2.2 Security headers
| Header | ค่า | ไฟล์ |
|---|---|---|
| Content-Security-Policy (หน้าเว็บ) | `script-src 'self' 'nonce-<สุ่มทุก request>' 'strict-dynamic'` · `style-src 'self' 'unsafe-inline'` · `object-src 'none'` · `base-uri 'self'` · `form-action 'self'` · `frame-ancestors 'none'` · `upgrade-insecure-requests` (เฉพาะ HTTPS) | `proxy.ts`, `lib/security/headers.ts` |
| CSP (API) | `default-src 'none'; … frame-ancestors 'none'` | เหมือนข้างบน |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains` | `next.config.ts` (`headers()`) |
| X-Content-Type-Options / Referrer-Policy / Permissions-Policy / COOP / X-Frame-Options | `nosniff` / `strict-origin-when-cross-origin` / camera, microphone, geolocation ปิด / `same-origin` / `DENY` | `next.config.ts` |
| X-Powered-By | ปิด (`poweredByHeader: false`) | `next.config.ts` |

ทำไม `style-src` ต้องมี `'unsafe-inline'`: React แสดง `style={{…}}` (Recharts, ความสูงกราฟใน `DashboardCharts`, การซูมภาพใน `OriginalViewer`) เป็น attribute `style="…"` ซึ่ง nonce ใช้กับ attribute ไม่ได้ และถ้าใส่ nonce ใน `style-src` เบราว์เซอร์จะไม่สน `'unsafe-inline'` ; ส่วน **script ใช้ nonce เต็มรูปแบบ** (ไม่มี `'unsafe-inline'` / `'unsafe-eval'` ใน production) ตาม [คู่มือ CSP ของ Next.js 16](https://nextjs.org/docs/app/guides/content-security-policy) ทุกหน้าเป็น dynamic อยู่แล้ว (layout อ่าน cookie) จึงใส่ nonce ได้

### 2.3 ไฟล์อัปโหลด
| มาตรการ | ไฟล์ |
|---|---|
| ขนาด ≤ 10 MB (ตรวจ `Content-Length` ใน proxy, ใน route และขนาดไฟล์จริง) ; ชนิดไฟล์ตัดสินจาก **magic bytes** (PNG/JPEG/PDF) ไม่เชื่อ extension/MIME | `lib/extract/run.ts` (`sniffType`), `app/api/extract/route.ts`, `proxy.ts` |
| ตั้งชื่อไฟล์ฝั่ง server แบบสุ่ม (`randomBytes(12)` → 24 hex + นามสกุลจาก magic bytes) ; ไม่ใช้ชื่อไฟล์ของผู้อัปโหลด ; เขียนแบบ `wx` (ไม่ทับไฟล์เดิม) | `lib/extract/run.ts` |
| `/api/extract/file` รับเฉพาะชื่อที่ server สร้าง (Zod regex) → `../`, `..\`, `%2e%2e%2f`, NUL ฯลฯ ได้ 400 | `lib/security/validate.ts` (`fileQuerySchema`), `app/api/extract/file/route.ts` |
| ส่งไฟล์พร้อม Content-Type ที่ถูกต้อง, `nosniff`, CSP `sandbox` ; **PDF ส่งเป็น attachment** (ดาวน์โหลด) | `app/api/extract/file/route.ts`, `lib/security/headers.ts` (`FILE_CSP`) |
| ไม่แสดงชื่อไฟล์ที่ผู้ใช้ส่งมาใน HTML/JSON | — |

### 2.4 API
| มาตรการ | ไฟล์ |
|---|---|
| Zod ตรวจ body ทุกตัว (`createBodySchema`, `ConsultRequestSchema`, `{useSample:true}`, ฟิลด์ multipart) และ query string ทุก endpoint (key ที่ไม่รู้จัก/ซ้ำ/ค่าผิดรูป → 400) และ `[id]` ต้องเป็น UUID | `lib/security/validate.ts`, `app/api/**/route.ts`, `lib/isolates.ts`, `lib/consult/run.ts` |
| CSRF: POST/PUT/PATCH/DELETE ที่ `Origin` ไม่ตรง host (หรือ `Sec-Fetch-Site: cross-site/same-site`) → 403 | `lib/security/request-guards.ts`, `proxy.ts` |
| Cookie บทบาท: `Path=/`, `SameSite=Lax`, `Secure` เมื่อเป็น HTTPS | `components/nav/RoleSwitcher.tsx` |
| Rate limit ต่อ IP (POST): `/api/seed` 5/นาที, `/api/extract` 20/นาที, `/api/consult` 20/นาที → 429 + `Retry-After` | `lib/security/request-guards.ts`, `proxy.ts` |
| Body อื่นที่ไม่ใช่ upload ≤ 1 MB → 413 | `proxy.ts` |
| Error ใน production ไม่เผย stack trace, SQL หรือ path (ข้อความกลาง ๆ ทั้ง API และหน้า Dashboard/Antibiogram) | `lib/security/log.ts`, `app/api/**`, `app/dashboard/page.tsx`, `app/antibiogram/page.tsx` |

**ข้อจำกัดของ rate limit:** เก็บตัวนับในหน่วยความจำของแต่ละ instance บน Vercel แต่ละ function instance นับแยกกันและรีเซ็ตเมื่อ cold start จึงกันได้แค่ client เดียวที่ยิงถี่ ๆ ถ้าต้องการจริงให้ใช้ Vercel Firewall (WAF rate limiting) หรือ store กลาง เช่น Redis

### 2.5 ความลับและ supply chain
- `.gitignore` กัน `.env*` (ยกเว้น `.env.example`), `*.db`, `uploads/`, `.agents/`, `node_modules/`, `.next/`, `.vercel/`, `*.pem`, `*.key`, `*.p12`, `*.pfx`
- `.env.example` มีแต่ placeholder ; ความลับบน Vercel ตั้งเป็น Environment Variable แบบ **Sensitive**
- สแกนความลับด้วย gitleaks (ดาวน์โหลด release ทางการ ตรวจ checksum แล้ว เก็บนอก repo) ก่อน push ทุกครั้ง
- `npm audit` (prod + full) ต้องเป็น 0 high/critical ; dependency ตรึงเวอร์ชันแบบ exact + `package-lock.json` ; ใช้ `npm ci`
- `overrides.deepmerge-ts = 8.0.2` ปิด GHSA-ggr8-5vv4-36mx (CVE-2026-40345) ใน `@prisma/config` ของ Prisma CLI 6.19.3 โดยไม่ต้องอัปเกรดเป็น Prisma 7 (breaking)

### 2.6 การคุ้มครองข้อมูล
- ใช้ข้อมูลสังเคราะห์เท่านั้น มีแบนเนอร์ "ข้อมูลสังเคราะห์ — ไม่ใช่ข้อมูลผู้ป่วยจริง" ทุกหน้า (`app/layout.tsx`, `lib/config.ts`)
- Log ฝั่ง server ไม่มี PHI/ความลับ: error ของ Prisma (ซึ่งอาจมีค่าใน query เช่น HN) log เฉพาะชื่อคลาส + code ; ไม่ log body (`lib/security/log.ts`)
- ไฟล์อัปโหลดบน Vercel อยู่ใน `/tmp` ของ instance เป็นไฟล์ชั่วคราว หายเมื่อ instance รีไซเคิล (`lib/extract/run.ts`)
- ฐานข้อมูล Neon: เลือก region **AWS Asia Pacific (Singapore) `aws-ap-southeast-1`** ให้ใกล้ประเทศไทย และตั้ง Vercel Functions region เป็น **Singapore (`sin1`)** ให้ตรงกัน ; connection string ต้องมี `sslmode=require` (integration ของ Neon ใส่ให้ ตรวจใน Settings → Environment Variables)
- คง `EXTRACT_MODE=cached` และ `AI_MODE=cached` บน Vercel เพื่อไม่ส่งไฟล์/คำถามออกไปยัง LLM ภายนอก

## 3. OWASP Top 10 (2021) / ASVS L1
| OWASP 2021 | ASVS L1 ที่เกี่ยวข้อง | สถานะ | หมายเหตุ |
|---|---|---|---|
| A01 Broken Access Control | V4.1, V4.2 (CSRF), V12.5 | **บางส่วน** | gate ทั้งไซต์ + CSRF + path traversal ปิดแล้ว ; ไม่มีสิทธิ์รายบุคคล/RLS (บทบาทเป็นของสาธิต) |
| A02 Cryptographic Failures | V9.1 (TLS), V6 | **ทำแล้ว** (ขอบเขต demo) | HTTPS + HSTS บน Vercel ; Postgres `sslmode=require` ; ไม่มีการเก็บรหัสผ่านในฐานข้อมูล |
| A03 Injection | V5.1–V5.3 | **ทำแล้ว** | Zod ทุก input ; Prisma query แบบ parameterized (raw SQL มีแค่ advisory lock ค่าคงที่) ; React escape output ; CSP nonce |
| A04 Insecure Design | V1 (L2+) | **บางส่วน** | มี threat model นี้ ; ยังไม่มี threat model/DPIA ฉบับทางการ (NFR-13) |
| A05 Security Misconfiguration | V14.4 (headers), V14.3 | **ทำแล้ว** | headers ครบ, ปิด `X-Powered-By`, error กลาง ๆ, fail closed เมื่อไม่ได้ตั้ง gate |
| A06 Vulnerable & Outdated Components | V14.2 | **ทำแล้ว** | npm audit 0 ; exact pins + lockfile ; Dependabot alerts (ข้อ 5) |
| A07 Identification & Authentication Failures | V2.1, V3 | **บางส่วน** | Vercel Authentication (บัญชี Vercel, MFA ตามการตั้งค่าบัญชี) + Basic Auth รหัสร่วม ; ไม่มีบัญชีรายบุคคล/MFA ในแอป/lockout |
| A08 Software & Data Integrity Failures | V10.3, V14.2 | **บางส่วน** | lockfile + integrity hash ; gitleaks ; ไม่มี signed commits/SBOM |
| A09 Security Logging & Monitoring Failures | V7.1 | **บางส่วน** | log ไม่มี PHI ; ยังไม่มี audit trail / alert / incident response (R29, R48) |
| A10 SSRF | V12.6 | **ไม่เกี่ยวข้อง** (ในโหมด cached) | ไม่มีการ fetch URL จากผู้ใช้ ; โหมด live เรียก endpoint ของ LLM ที่กำหนดตายตัวเท่านั้น |
| (ไฟล์) | V12.1–V12.5 | **ทำแล้ว** | ขนาด, magic bytes, ชื่อสุ่ม, allow-list ชื่อไฟล์, sandbox/attachment |

## 4. ข้อจำกัดและความเสี่ยงที่เหลือ
1. **ไม่มีตัวตนรายบุคคลในแอป** — Basic Auth เป็นรหัสร่วม ; บทบาทเลือกเองได้ ; ไม่มี audit ว่าใครทำอะไร
2. **Rate limit อ่อน** บน serverless (ข้อ 2.4)
3. **ไฟล์อัปโหลด ≤ 10 MB ตาม MR1 แต่ Vercel Functions รับ request body ได้ราว 4.5 MB** ไฟล์ใหญ่กว่านั้นจะถูก Vercel ปฏิเสธ (413) ก่อนถึงแอป ; ในโหมด cached อ่านได้เฉพาะใบตัวอย่างอยู่แล้ว
4. **PDF ที่อัปโหลดดาวน์โหลดแทนการแสดงในกรอบ** (โหมด live เท่านั้น ; โหมด cached ไม่แสดงไฟล์ที่อัปโหลด)
5. `style-src 'unsafe-inline'` (ข้อ 2.2)
6. Preview deployment ใช้ฐานข้อมูลเดียวกับ production ถ้าไม่ได้เปิด Neon branching
7. Basic Auth ส่งรหัสทุก request (ปลอดภัยเฉพาะบน HTTPS) และเบราว์เซอร์จำไว้จนปิดหน้าต่าง ไม่มีปุ่ม logout

## 5. Checklist ก่อน/หลัง deploy (ต้องทำใน dashboard)
**GitHub (github.com/noppornc-MU)**
- [ ] repo เป็น **Private**
- [ ] Settings → Advanced Security (หรือ Code security) → เปิด **Dependency graph** และ **Dependabot alerts** (และ Dependabot security updates ถ้าต้องการ)
- [ ] เปิด **Secret scanning** และ **Push protection** ถ้าบัญชี/องค์กรมี (repo private ต้องมี GitHub Secret Protection ; ถ้าไม่มี ให้รัน gitleaks ในเครื่องก่อน push ทุกครั้ง)

**Vercel (vercel.com/tech-8766 → โปรเจกต์)**
- [ ] Settings → Environment Variables (Production + Preview): `SITE_ACCESS_USER`, `SITE_ACCESS_PASSWORD` (สุ่ม ≥ 16 ตัวอักษร) — ติ๊ก **Sensitive** ; `EXTRACT_MODE=cached`, `AI_MODE=cached` ; ไม่ใส่ LLM key
- [ ] Security → **Deployment Protection → Vercel Authentication → All Deployments** → Save
- [ ] Storage → Neon: region **Singapore (aws-ap-southeast-1)** ; ตรวจว่า `DATABASE_URL` / `DATABASE_URL_UNPOOLED` มี `sslmode=require`
- [ ] Settings → Functions → Function Region = **Singapore (sin1)**
- [ ] Redeploy แล้วเปิดในหน้าต่าง private: ต้องเจอหน้า login ของ Vercel ก่อน แล้วจึงเจอกล่อง Basic Auth ; ถ้าเจอ "access not configured" แปลว่ายังไม่ได้ตั้ง/ตั้ง env ไม่ถูก

## 6. สิ่งที่ต้องได้รับอนุมัติจากฝ่ายความมั่นคงปลอดภัยของโรงพยาบาล / DPO ก่อนใช้ข้อมูลจริง
ห้ามใช้ข้อมูลผู้ป่วยจริงบนระบบนี้จนกว่าจะทำครบ (อ้างอิง `docs/requirements_IC_MDR.md` v4: R26–R52 และ NFR-13)
- Login จริงรายบุคคล + **MFA** (R26, R51) และ RBAC/สิทธิ์ระดับแถว (**RLS**, R27, R43)
- **Audit trail** แบบป้องกันการแก้ไข (R29) ; incident response (R48) ; backup/resilience (R46) ; deployment & operations (R52)
- PDPA / data protection, การปกปิด PHI และ sandbox ไฟล์ (R30, R36, R41) ; AI gateway (R42) ; export control (R45)
- **DPIA** และ threat model ฉบับทางการ ; **pentest/ทดสอบสิทธิ์** ก่อนใช้ข้อมูลจริง (NFR-13)
- การประเมินผู้ให้บริการภายนอก (Vercel, Neon, GitHub, ผู้ให้บริการ LLM) ด้าน data residency / สัญญา / การโอนข้อมูลข้ามประเทศ
- การพิจารณาสถานะตาม พ.ร.บ.การรักษาความมั่นคงปลอดภัยไซเบอร์ พ.ศ. 2562 (CII หรือไม่) และนโยบายความมั่นคงปลอดภัยของโรงพยาบาล

## 7. การทดสอบมาตรการเหล่านี้ในเครื่อง
```bash
npm test                                   # รวม lib/security/__tests__ (gate, CSRF, rate limit, CSP, validation)
npm run build
# เปิด gate ในเครื่อง: ตั้ง SITE_ACCESS_USER / SITE_ACCESS_PASSWORD เป็น env ของ process แล้ว
npx next start --port 3200
pwsh -NoProfile -File scripts/smoke-dod.ps1 -BaseUrl http://localhost:3200 -User <user> -Password <password>
```
แจ้งปัญหาด้านความปลอดภัย: ติดต่อเจ้าของ repo โดยตรง (อย่าเปิด issue สาธารณะ)
