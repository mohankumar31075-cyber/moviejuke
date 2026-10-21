# 📚 Knowledge Bank

A full curriculum companion for students **Pre-Nursery to Class 5** — board-aligned learning
content, a six-type quiz engine, Kahoot-style live multiplayer, free auto-generated
certificates, parent & teacher dashboards, a review-gated CMS and subscription/school
licences. Built mobile-first for Indian boards and mobile networks.

> This repository implements the Knowledge Bank PRD. All curriculum text is original.
> Reference sites (iseesam.com, halfprintkids.com, SPELD SA, Flyleaf Publishing portal)
> were studied for feature ideas only — no code, text, images, series names, logos or
> brand names were copied.

---

## Quick start

```bash
npm install
npm run dev        # starts API (port 8787) + web app (port 5173) together
```

Open **http://localhost:5173** (the Vite dev server proxies `/api` to the backend).
Production build: `npm run build` → `dist/` (serve with `npm start`, which also serves
the API).

### Demo accounts

| Role | How to sign in | What to try |
|---|---|---|
| 👨‍👩‍👧 Parent | Phone `9000000001`, OTP `123456` → pick **Aarav** (PIN `1234`) or **Diya** (PIN `2468`) | Child progress, weak topics, certificates, trial countdown |
| 👩‍🏫 Teacher | `teacher.meena` / `teach123` | Classes `SUN7Q2` & `STR4K8`, assign quizzes, host live sessions, CSV/PDF reports |
| 📝 Content editor | `editor.raj` / `edit123` | Drafts, AI-assisted drafts, submit for review |
| 🛡️ Admin / approver | `admin` / `admin123` | Approve/publish content, users, pass marks, school licences |
| 🎒 School student | Class code `SUN7Q2` + any nickname | Class-code login, live quizzes, anytime leaderboards |

In **demo mode the OTP is always `123456`** and is shown on screen instead of being SMS'd.

---

## What's implemented (MVP scope from the PRD)

### Learning content (§4, §7)
- Browse **without login**: 4 boards (CBSE, ICSE, State, Generic) × 8 class levels × 5 subjects
  (English, Maths, EVS/Science, Hindi/Regional, GK), with notes, video and audio items.
- Video plays through a hosted-video shell (drop in a hosted URL in production); audio
  lessons and "read aloud" use the device voice — no heavy media files, kind to 2G/3G.
- Age-adaptive UI (PRD §8): **Young Learner** theme (Pre-Nursery–Class 2) and **Explorer**
  theme (Class 3–5), auto-selected from the child's class, switchable anytime.

### Quiz engine & live multiplayer (§6)
- All six question types: **multiple choice, true/false, fill-in-the-blank, match-the-following,
  picture-based, audio** (spoken via device TTS).
- Group scoring modes per session: plain points, or points + capped speed bonus
  (live default = speed, anytime default = plain). Speed is measured from when the
  question reaches the device.
- **Live sessions**: short code + QR/link join, lobby, default 49-second questions
  (host-configurable), nickname-only leaderboards with filtered nicknames, no chat.
  Simulated players keep demos lively; the state machine supports 200+ players (load-test
  before school pilots — PRD §9).
- **Anytime mode**: per-quiz always-on leaderboards (best attempt per student).

### Certificates (§6)
- Free, auto-generated **PDF certificates** (server-generated, A4 landscape) with logo,
  serial number, **QR verification** and a WhatsApp share button.
- Awarded for: any quiz passed at the pass mark (default **80%**, per-subject override —
  GK is 70% in the demo), and **top performer(s) in each group session — ties share the
  crown and every tied player gets a certificate**.
- Public verification page: `/verify/KB-2026-0001`.

### Accounts & roles (§3)
- All four sign-in methods: **parent phone OTP** (+ DPDP consent), **child PIN profiles**,
  **class-code login**, **username/password** (recommended for Class 3–5).
- Parent-managed child profiles; parents can **link a school profile** to a home account.
- Roles: student, parent, teacher, content editor, **approver** (admin / senior editor)
  and platform **super-admin**.

### Dashboards (§3, §4)
- **Parent**: per-child progress by subject, time spent learning, weak topics to practise,
  certificates. (Payment/plan details deliberately stay off this dashboard.)
- **Teacher/Admin**: create classes & share codes, assign quizzes, host live sessions,
  class performance + student-level reports exported as **CSV (Excel) and PDF**.
- **CMS**: non-technical authoring with optional **AI-assisted first drafts**, then
  editor → approver → publish. Nothing publishes without approval (PRD §7).
- **Super-admin**: users, subscribers, schools, revenue snapshot, pass-mark settings,
  demo reset.

### Access, pricing & billing (§5)
- **Free tier**: browse everything (notes/video/audio, no login), **English + GK quizzes**
  forever, certificates in free subjects.
- **One-time trial**: 30–60 min of quiz time (45 min in the demo), counted **server-side per
  account**, visible countdown, soft warning at 5 min, clear paywall at zero. Progress and
  certificates are kept after the trial. Abuse prevention: one trial per phone number and
  per child profile.
- **Individual plan**: ₹149/month, monthly only (no family/quarterly/yearly/trial/discount
  at launch). Demo checkout simulates **PhonePe PG** (web) / **Google Play Billing** (Android).
- **School licence**: ₹199/student/year, minimum ₹20,000/school/year, teachers free,
  30-day free pilot. Quote calculator matches the PRD examples
  (50→₹20,000 · 100→₹20,000 · 300→₹59,700 · 500→₹99,500). GST added at checkout / invoices.

### Child safety & compliance (§8, §10)
- Nickname-only leaderboards, banned-word filter, auto-generated safe nicknames, **no chat**.
- DPDP: verifiable parental consent captured at the parent account, consent versioned.
- Prices shown exclusive of GST with the GST note everywhere money is mentioned.

---

## Architecture

```
├── server/                 # Node + Express API (port 8787)
│   ├── index.js            #   routes: auth, content, quiz, sessions, certs, dashboards,
│   │                       #   CMS, billing, admin
│   ├── curriculum.js       #   boards/classes/subjects/topics/content/questions (original)
│   ├── seed.js             #   demo users, classes, attempts, certificates, schools
│   ├── store.js            #   JSON file store (.server-data/db.json — gitignored)
│   └── utils/              #   nickname filter, access rules, scoring, PDF certificates
├── client/                 # React + Vite web app (port 5173, proxies /api)
│   └── src/
│       ├── pages/          #   Home, Browse, Topic, Quiz, Live, Login, Parent, Teacher,
│       │                   #   CMS, Admin, Pricing, Certificates, Verify, Profile
│       ├── components/     #   Layout (age-adaptive), QuizPlayer (6 question types)
│       └── styles.css      #   mobile-first design system, two age-adaptive themes
├── capacitor.config.json   # Android wrapper config (webDir = dist)
└── package.json            # single install: npm run dev
```

- **Backend**: managed-backend friendly (the PRD recommends Supabase/Postgres, Mumbai
  region). This build ships a self-contained JSON store so the demo runs anywhere; the
  route layer maps 1:1 onto Postgres tables + Supabase Realtime for the live layer.
- **Live quizzes** use a poll-based lazy state machine (no fragile websockets) — swap in
  the backend's realtime channel for production scale.
- **Video/audio**: hosted video service in production (not self-hosted), per PRD §9.

## Android app (PRD §9)

The web app is the single codebase; wrap it with [Capacitor](https://capacitorjs.com):

```bash
npm run build
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android        # uses capacitor.config.json (webDir: dist)
npx cap open android       # Android Studio → build APK/AAB
```

In the Android build, switch checkout to **Google Play Billing** (PRD §9/§10 —
check current Play Payments policy for digital goods in India and the families policy
before release). iOS is explicitly a later phase.

## Production notes (from PRD §9–§10)

- OTP SMS: Indian provider with **DLT registration** — start early.
- Payments: PhonePe PG + UPI AutoPay/e-mandate for ₹149 monthly repeats; confirm
  current PhonePe PG recurring support and fees; GST rate/registration to confirm with a CA.
- Load-test live quizzes at **200 players** before school pilots; check realtime
  connection limits on the chosen plan.
- Hosting: Vercel / Netlify / Cloudflare Pages for the web app.

## Success metrics the product tracks toward (§11)

Free-to-paid conversion after trial · trial completion & quiz sessions per active child ·
monthly retention of paying parents · schools signed & students per school ·
live sessions per week and average players per session.
