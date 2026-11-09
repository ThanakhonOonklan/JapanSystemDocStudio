# Japan System Documentation Studio

ระบบเขียนเอกสารคู่มือด้วยไฟล์ Markdown แล้วสร้างเป็น PDF ที่มีหน้าปก สารบัญ และเลขหน้าอัตโนมัติ
รองรับภาษาไทยและอังกฤษ ใช้งานผ่านเว็บในเครื่องของตัวเอง

ระบบนี้พัฒนาต่อจาก [Overleaf Community Edition](https://github.com/overleaf/overleaf) (หน้ารวมโปรเจ็ค ตัวแก้ไขไฟล์ ตัวดู PDF)
โดยเปลี่ยนตัวสร้างเอกสารจาก LaTeX เป็น Markdown ผ่าน service ชื่อ `md-compile`

## ทำอะไรได้บ้าง

- เขียนเอกสารเป็นไฟล์ `.md` แล้วกดปุ่ม **Recompile** เพื่อดู PDF ทันที
- หน้าปก สารบัญ เลขหน้า และโลโก้ ตั้งค่าได้ในไฟล์ `book.yaml`
- ตัดคำภาษาไทยถูกต้อง ใช้ฟอนต์ไทยที่มากับระบบ
- รูปภาพ ตาราง ลิงก์ และหัวข้อมีรหัสอ้างอิงกันได้
- หลายโปรเจ็คในที่เดียว แต่ละโปรเจ็คเป็นเอกสารหนึ่งเล่ม
- โปรเจ็คใหม่ที่สร้างจะมีหน้าปกอยู่ต้นไฟล์ `book.yaml` ให้เลย

## สิ่งที่ต้องมี

| รายการ | รายละเอียด |
|---|---|
| Docker Desktop | Windows (ใช้ WSL2), macOS หรือ Linux ก็ได้ |
| พื้นที่ดิสก์ | ประมาณ 15 GB ว่าง (image ทั้งสองตัวรวมกันประมาณ 7 GB และยังมีฐานข้อมูล) |
| หน่วยความจำ | แนะนำให้ Docker ใช้ได้อย่างน้อย 4 GB |
| Git | ใช้ clone repo |

## ติดตั้ง

ทำครั้งเดียว ขั้นตอน build ใช้เวลานาน (ครั้งแรกอาจหลายสิบนาที ขึ้นกับเครื่องและอินเทอร์เน็ต)

### 1. ดาวน์โหลดซอร์ส

```bash
git clone https://github.com/ThanakhonOonklan/JapanSystemDocStudio.git
cd JapanSystemDocStudio
```

repo นี้เป็น Private ต้องล็อกอิน GitHub ด้วยบัญชีที่ได้รับสิทธิ์ก่อน clone

### 2. สร้าง Docker image

รันจากโฟลเดอร์รากของ repo ตามลำดับ

```bash
docker build --file server-ce/Dockerfile-base --tag docstudio/base:lean .
```

```bash
docker build --file server-ce/Dockerfile --build-arg OVERLEAF_BASE_TAG=docstudio/base:lean --tag docstudio/community:lean .
```

### 3. สร้างไฟล์ `.env`

ไฟล์นี้เก็บรหัสลับของระบบ ต้องสร้างครั้งเดียวแล้วเก็บค่าเดิมไว้ และห้ามนำขึ้น Git (repo ตั้ง ignore ไฟล์นี้ไว้แล้ว)

Windows (PowerShell)

```powershell
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Fill($b)
"OVERLEAF_INVITE_TOKEN_SECRET=$([Convert]::ToBase64String($b))" | Set-Content -Encoding ascii .env
```

macOS / Linux

```bash
echo "OVERLEAF_INVITE_TOKEN_SECRET=$(openssl rand -base64 32)" > .env
```

ถ้าอยากเปลี่ยนอีเมลของผู้ใช้เดียวในระบบ (ค่าเริ่มต้นคือ `admin@docstudio.test`) ให้เพิ่มบรรทัดนี้ลงใน `.env`

```
DOCSTUDIO_ADMIN_EMAIL=you@example.com
```

## เปิดระบบ

```bash
docker compose -f docker-compose.local.yml up -d
```

รอประมาณ 1 ถึง 2 นาทีให้ระบบเริ่มทำงาน แล้วเปิดเบราว์เซอร์ไปที่

**http://localhost:8080**

ระบบเป็นแบบผู้ใช้คนเดียว ไม่มีหน้า login เข้าไปแล้วเห็นหน้ารวมโปรเจ็คทันที

คำสั่งที่ใช้บ่อย

| ต้องการ | คำสั่ง |
|---|---|
| ดูสถานะ | `docker compose -f docker-compose.local.yml ps` |
| ดู log | `docker logs docstudio-app --tail 100` |
| ปิดระบบ (ข้อมูลยังอยู่) | `docker compose -f docker-compose.local.yml down` |
| เปิดใหม่ | `docker compose -f docker-compose.local.yml up -d` |

ข้อมูลโปรเจ็คเก็บใน Docker volume (`docstudio_app_data`, `docstudio_mongo_data`, `docstudio_redis_data`) การสั่ง `down` ไม่ลบข้อมูล
แต่ถ้าสั่ง `down -v` ข้อมูลทุกโปรเจ็คจะหายหมด

หมายเหตุ: ระบบเปิดที่ `127.0.0.1:8080` เท่านั้น เปิดได้จากเครื่องนี้เครื่องเดียว การเปิดให้เครื่องอื่นใช้ต้องตั้งค่าเพิ่มเอง (ดูหัวข้อ "ให้คนอื่นใช้")

## วิธีใช้งาน

### สร้างโปรเจ็ค

1. เปิด http://localhost:8080
2. กดปุ่มสร้างโปรเจ็คใหม่ แล้วเลือกแม่แบบ (แบบว่าง หรือแบบตัวอย่าง)
3. ตั้งชื่อโปรเจ็ค ระบบจะสร้างไฟล์ให้ดังนี้

```
my-manual/
├── book.yaml        ตั้งค่าเล่ม: ชื่อ หน้าปก สารบัญ ลำดับบท
├── th/
│   └── 01-intro.md  เนื้อหาภาษาไทย
├── en/
│   └── 01-intro.md  เนื้อหาภาษาอังกฤษ
└── images/          รูปภาพ (สร้างเองเมื่อต้องใช้)
```

ถ้าเขียนภาษาเดียว ให้ใส่ `languages: [th]` ใน `book.yaml` แล้วลบโฟลเดอร์ `en/` ออก ไม่อย่างนั้นระบบจะสร้าง PDF ทั้งสองภาษา

### เขียนเนื้อหา

- แก้ไฟล์ `.md` ในโฟลเดอร์ `th/` (และ `en/`) ทางซ้ายคือตัวแก้ไข ทางขวาคือ PDF
- เพิ่มบทใหม่โดยสร้างไฟล์ใหม่ แล้วเพิ่มชื่อไฟล์ใต้ `chapters:` ใน `book.yaml` ตามลำดับที่ต้องการ
- กด **Recompile** (ปุ่มเขียวด้านบน) เพื่อสร้าง PDF ใหม่ กดครั้งเดียวแล้วรอ ถ้ากดซ้ำตอนกำลังคอมไพล์จะขึ้นว่า "previous compile is still running"
- ปุ่มดาวน์โหลดข้างปุ่ม Recompile ใช้บันทึก PDF

### รูปแบบ Markdown ที่ใช้

| ต้องการ | เขียนอย่างไร |
|---|---|
| หัวข้อ | `# หัวข้อใหญ่`, `## หัวข้อรอง`, `### หัวข้อย่อย` |
| รหัสอ้างอิงหัวข้อ | `## ชื่อหัวข้อ {#my-id}` แล้วอ้างที่อื่นด้วย `@my-id` |
| รูปภาพ | `![คำอธิบาย](../images/pic.png){#fig-pic width=60%}` |
| ตาราง | ตาราง Markdown ปกติ ใส่คำอธิบายบรรทัดถัดไปด้วย `: คำอธิบาย {#tbl-id}` |
| ลิงก์ | `[ข้อความ](https://...)` หรือ `<https://...>` |
| ขึ้นหน้าใหม่ | บรรทัดเดียวว่า `\newpage` โดยเว้นบรรทัดว่างก่อนและหลัง |
| ขึ้นบรรทัดใหม่ในย่อหน้า | ใส่ `\` ท้ายบรรทัด |
| ข้อความมีสไตล์เฉพาะ | `**ข้อความ**{.ชื่อคลาส}` แล้วเขียนสไตล์ใน CSS ของโปรเจ็ค |
| หัวข้อไม่ต้องมีเลข | ใส่ `{.unnumbered}` ท้ายหัวข้อ (เมื่อเปิด `numbering: true`) |

ไฟล์ภาพวางในโฟลเดอร์ `images/` โดยใช้ปุ่ม Upload ในแผงไฟล์ด้านซ้าย

### ตั้งค่าเล่มใน `book.yaml`

ตัวอย่างที่ใช้จริง

```yaml
title:
  th: Factory Management System
author: Japan System

cover:                          # หน้าปก (หน้าแรกของ PDF)
  logo: images/logo.png         # โลโก้ ต้องอัปโหลดไฟล์ไว้ใน images/ ก่อน
  organization: ERP Base Demo
  subtitle:
    th: WORKFLOW MANUAL
  system:
    th: ระบบบริหารจัดการโรงงาน
  description:
    th: ใบเสนอราคา ใบสั่งขาย การผลิต การจัดซื้อ การส่งของ และการรับเงิน
  preparedBy: Japan System
theme:
  primary: "#000000"            # สีของชื่อเล่มและเส้นบนหน้าปก

css: style.css                  # ไฟล์ CSS ของโปรเจ็ค (ไม่บังคับ)
tocDepth: 3                     # สารบัญแสดงถึงหัวข้อระดับ 3
numbering: false                # true = ใส่เลขบท/หัวข้ออัตโนมัติ
figureNumbers: false            # true = ใส่เลขรูป
lof: false                      # true = มีสารบัญรูป
lot: false                      # true = มีสารบัญตาราง
defaultLanguage: th
languages: [th]                 # ภาษาที่จะสร้าง PDF
chapters:                       # ไฟล์ในโฟลเดอร์ th/ (และ en/) ตามลำดับ
  - 01-overview.md
  - 02-login.md
pageLabels:
  mainStart: 3                  # เลขหน้าของหน้าแรกของเนื้อหา
```

ตัวเลือกที่ใช้บ่อย

| คีย์ | ความหมาย |
|---|---|
| `title`, `author`, `version`, `date` | ข้อมูลเล่ม ใช้ข้อความธรรมดาหรือแยกตามภาษา (`th:` / `en:`) |
| `cover` | หน้าปก: `logo`, `organization`, `subtitle`, `system`, `description`, `preparedBy`, `background` ทุกบรรทัดไม่บังคับ |
| `theme.primary` | สีหลักของหน้าปก |
| `css` | ไฟล์ CSS เพิ่มเติมของโปรเจ็ค ใช้ปรับหน้าตา เช่น กรอบหน้าปก ท้ายกระดาษ ขนาดตัวอักษร |
| `chapters` | รายชื่อไฟล์ตามลำดับ |
| `toc`, `tocDepth` | เปิดปิดสารบัญ และความลึกของหัวข้อ (1 ถึง 4) |
| `numbering`, `figureNumbers`, `lof`, `lot` | เลขหัวข้อ เลขรูป สารบัญรูป สารบัญตาราง |
| `languages`, `defaultLanguage` | ภาษาที่สร้าง และภาษาของไฟล์ `output.pdf` |
| `pageLabels.mainStart` | เลขหน้าแรกของเนื้อหา ถ้าสารบัญยาวขึ้นหรือสั้นลง ต้องปรับให้ตรงกับจำนวนหน้าจริง (ปก 1 หน้า + หน้าสารบัญ + 1) |

### ใส่โลโก้บนหน้าปก

1. อัปโหลดไฟล์ภาพไว้ในโฟลเดอร์ `images/` เช่น `images/logo.png`
2. ใน `book.yaml` ใต้ `cover:` ใส่ `logo: images/logo.png`
3. กด Recompile โลโก้จะอยู่เหนือชื่อองค์กร ขนาดไม่เกินกว้าง 45 มม. สูง 28 มม.

### ปรับหน้าตาด้วย CSS

สร้างไฟล์ `style.css` ที่รากของโปรเจ็ค แล้วใส่ `css: style.css` ใน `book.yaml` ตัวอย่าง

```css
/* ภาพเต็มความกว้างของหน้า */
figure img:not([width]) { width: 100%; }

/* หัวข้อใหญ่ขึ้นหน้าใหม่เสมอ */
section.chapter h1 { break-before: page; }

/* ย่อหน้าเยื้องเข้าเล็กน้อย */
p { padding-left: 0.9cm; }
```

หมายเหตุ: ไฟล์ CSS ที่อัปโหลดมาในรูปแบบ zip อาจถูกระบบมองเป็นไฟล์แก้ไม่ได้ ให้สร้างไฟล์ใหม่ด้วยปุ่ม New file แล้ววางเนื้อหา

### สร้าง PDF จากบรรทัดคำสั่ง (ไม่ต้องเปิดเว็บ)

ใช้ตัวคอมไพล์ในตัว container โดยตรง (ระบบต้องเปิดอยู่)

```bash
docker cp ./my-manual docstudio-app:/tmp/my-manual
```

```bash
docker exec docstudio-app sh -c "cd /overleaf/services/md-compile && NODE_OPTIONS= node cli.mjs /tmp/my-manual book.yaml"
```

```bash
docker cp docstudio-app:/tmp/my-manual/output.pdf ./my-manual.pdf
```

ผลลัพธ์คือ `output.pdf` (ภาษาเริ่มต้น), `output-<ภาษา>.pdf` ต่อภาษา และ `output.log` สำหรับดูคำเตือน

## ให้คนอื่นใช้

| แบบ | เหมาะกับ | วิธี |
|---|---|---|
| ใช้ผ่านเครือข่ายเดียวกัน | ทีมในออฟฟิศ | รันบนเครื่องกลางหนึ่งเครื่อง แก้พอร์ตใน `docker-compose.local.yml` เป็น `0.0.0.0:8080:80` และตั้ง `OVERLEAF_SITE_URL` เป็นที่อยู่ของเครื่อง แล้วเปิด firewall เฉพาะพอร์ตนี้ |
| ให้คนอื่นติดตั้งเอง | ทีมที่มีเครื่องของตัวเอง | เพิ่มเขาเป็น collaborator ใน GitHub แล้วให้ทำตามหัวข้อ "ติดตั้ง" และ "เปิดระบบ" |
| ส่งเฉพาะผลลัพธ์ | คนที่ต้องการแค่คู่มือ | ส่งไฟล์ PDF หรือโฟลเดอร์ `.md` |

คำเตือนด้านความปลอดภัย

- ระบบเป็นแบบผู้ใช้คนเดียว ทุกคนที่เข้าถึงพอร์ตได้ จะเข้าใช้เป็นผู้ใช้คนเดียวกันโดยไม่ต้องล็อกอิน จึงห้ามเปิดออกอินเทอร์เน็ตตรง ๆ
- ตามคำเตือนของ Overleaf Community Edition ผู้ใช้มีสิทธิ์เข้าถึงทรัพยากรในตัว container ระหว่างคอมไพล์ จึงควรให้เฉพาะคนที่ไว้ใจเท่านั้น
- ถ้าต้องการเปิดให้ภายนอกเข้า ควรอยู่หลัง VPN หรือ reverse proxy ที่มีระบบยืนยันตัวตนและ HTTPS

## สำรองและย้ายข้อมูล

- **สำรองรายโปรเจ็ค:** ดาวน์โหลดโปรเจ็คเป็นไฟล์ ZIP จากเมนูของโปรเจ็ค
- **สำรองทั้งระบบ:** สำรอง Docker volume ด้วยคำสั่งด้านล่าง (ปิดระบบก่อนด้วย `docker compose -f docker-compose.local.yml down`)

```bash
docker run --rm -v docstudio_app_data:/data -v "$PWD":/backup alpine tar czf /backup/app_data.tgz -C /data .
```

ข้อมูลโปรเจ็คจริงอยู่ในฐานข้อมูล MongoDB (`docstudio_mongo_data`) ด้วย ถ้าสำรองทั้งระบบ ให้สำรองให้ครบทั้งสอง volume

## อัปเดตเวอร์ชัน

```bash
git pull
docker build --file server-ce/Dockerfile --build-arg OVERLEAF_BASE_TAG=docstudio/base:lean --tag docstudio/community:lean .
docker compose -f docker-compose.local.yml up -d
```

ถ้าไม่ได้แก้ `server-ce/Dockerfile-base` ไม่ต้อง build image base ใหม่

## แก้ปัญหาเบื้องต้น

| อาการ | วิธีแก้ |
|---|---|
| เปิด http://localhost:8080 ไม่ได้ | รอ 1 ถึง 2 นาทีหลังเปิดระบบ ตรวจ `docker compose -f docker-compose.local.yml ps` ว่าทุกตัวเป็น running และดู `docker logs docstudio-app` |
| `set OVERLEAF_INVITE_TOKEN_SECRET in .env` | ยังไม่ได้สร้างไฟล์ `.env` ให้ทำตามหัวข้อ "สร้างไฟล์ .env" |
| พอร์ต 8080 ถูกใช้อยู่ | เปลี่ยน `127.0.0.1:8080:80` ใน `docker-compose.local.yml` เป็นพอร์ตอื่น และแก้ `OVERLEAF_SITE_URL` ให้ตรงกัน |
| กด Recompile แล้วขึ้น previous compile is still running | รอให้คอมไพล์รอบก่อนจบ แล้วกดครั้งเดียว |
| PDF ไม่มีโลโก้ และ log เตือนว่าไม่พบภาพ | ตรวจชื่อไฟล์และที่อยู่ใน `cover.logo` ว่าตรงกับไฟล์ในโฟลเดอร์ `images/` |
| คอมไพล์ล้มเหลว | เปิดแผง Logs ข้างปุ่ม Recompile อ่านข้อความ `output.log` มักบอกไฟล์และบรรทัดที่ผิด |
| เลขหน้าในสารบัญไม่ตรงกับเลขท้ายกระดาษ | ปรับ `pageLabels.mainStart` ใน `book.yaml` |
| ขึ้นคำเตือน "css file not found" | ตรวจว่าไฟล์ CSS อยู่ตาม path ที่ระบุใน `css:` |

## โครงสร้างของ repo

| โฟลเดอร์ | หน้าที่ |
|---|---|
| `services/md-compile` | ตัวแปลง Markdown เป็น PDF (markdown-it + Paged.js + Chromium) |
| `services/web` | หน้าเว็บและ API ของระบบ รวมแม่แบบโปรเจ็คใหม่ใน `app/templates/project_files/` |
| `services/clsi` | service ที่เรียกตัวคอมไพล์ |
| `server-ce` | Dockerfile สำหรับสร้าง image |
| `docker-compose.local.yml` | ไฟล์เปิดระบบบนเครื่องเดียว |
| `PLAN.md` | แผนงานและบันทึกการพัฒนา |

## สัญญาอนุญาตและเครดิต

ซอร์สโค้ดอยู่ภายใต้ [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0) เหมือนต้นทาง
ถ้าเปิดให้ผู้อื่นใช้ระบบที่แก้ไขนี้ผ่านเครือข่าย ต้องเปิดซอร์สโค้ดส่วนที่แก้ให้ผู้ใช้เหล่านั้นด้วย

ระบบนี้พัฒนาต่อจาก Overleaf Community Edition ของ Overleaf (https://github.com/overleaf/overleaf)
ชื่อและโลโก้ Overleaf เป็นเครื่องหมายการค้าของเจ้าของเดิม

ผู้พัฒนา: Japan System
