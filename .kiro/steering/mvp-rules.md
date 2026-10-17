# กฎถาวรของโปรเจกต์ IC MDR (Hackathon MVP)

Spec: `.kiro/specs/mdr-mvp/` (requirements.md, design.md, tasks.md) · เอกสารระบบจริงฉบับเต็ม (v4) อยู่ใน `docs/` ใช้เป็นพื้นหลังเท่านั้น

- ห้ามใช้ข้อมูลผู้ป่วยจริง — seed และ fixture เป็นข้อมูลสังเคราะห์ทั้งหมด ; HN/Lab No ในตัวอย่างเป็นค่าสมมติ ; ไม่สกัดหรือเก็บชื่อผู้ป่วย
- ห้ามให้ LLM คำนวณสถิติ — %S, %SDD, first isolate, phenotype, cluster มาจาก `lib/domain` เท่านั้น ; API และ AI Consult เรียกฟังก์ชันชุดเดียวกัน
- `lib/domain` เป็น pure functions: ห้าม import Prisma, fetch, fs หรือ `lib/llm`
- ห้ามใส่ API key ในโค้ด ฝั่ง client หรือ log ; key อยู่ใน `.env` ที่ผู้ใช้สร้างเอง (repo มีเฉพาะ `.env.example`) ; LLM เรียกจากฝั่ง server ผ่าน `lib/llm` เท่านั้น
- โฟลเดอร์ config ชื่อ `config/` (ไม่ใช่ `data/`) ; ห้ามสร้างโฟลเดอร์ชื่อ `data`
- ข้อความจาก LLM เป็นข้อมูลไม่น่าเชื่อถือ: ตรวจด้วย Zod, แสดงเป็นข้อความธรรมดา (ห้าม `dangerouslySetInnerHTML`)
- บทบาท EXECUTIVE ต้องถูกตัด HN ที่ชั้น API ไม่ใช่แค่ซ่อนใน UI
- กฎ phenotype และตาราง SDD/intrinsic เป็นฉบับร่าง `[J]` รอ ICN/จุลชีววิทยารับรอง — ต้องแสดงข้อความนี้บนหน้าจอที่ใช้กฎ
- ทุก task: รัน `npm test` (และ `npm run build` เมื่อแตะหน้าจอ/API) ให้ผ่านก่อนไปต่อ
