# Civic Connect — Backend

Crowdsourced Civic Issue Reporting and Resolution System.
REST API backend (Node.js + Express + MySQL) for the ABESIT B.Tech CSE(DS) project by Bhumi Sharma, Chhavi Sharma and Chahat Chaudhary.

---

## 1. Prerequisites (Windows)

Install these first:

1. **Node.js LTS (18+)** — https://nodejs.org (download the LTS installer, click through defaults)
2. **MySQL Community Server 8.x** — https://dev.mysql.com/downloads/installer/ (during setup, set a root password you'll remember)
3. **VS Code** — https://code.visualstudio.com
4. **Postman** — https://www.postman.com/downloads/
5. **Git** (optional, for version control) — https://git-scm.com/download/win

Verify installs by opening PowerShell and running:
```powershell
node -v
npm -v
mysql --version
```

---

## 2. Project folder

If you're reading this, your project folder should already look like:
```
backend\
├── database\
├── postman\
├── src\
├── tests\
├── uploads\
├── .env.example
├── .gitignore
├── API_CONTRACT.md
├── package.json
└── README.md
```

---

## 3. Install dependencies

Open the `backend` folder in VS Code (`File > Open Folder`), then open a terminal in VS Code (`` Ctrl+` ``) and run:

```powershell
npm install
```

This installs Express, MySQL2, JWT, bcrypt, Joi, multer, firebase-admin, etc. from `package.json`.

**Optional dependency**: if you plan to use cloud storage (`UPLOAD_STRATEGY=cloud` in `.env`) instead of local disk storage, also run:
```powershell
npm install @aws-sdk/client-s3
```
This is NOT required for local development — local file storage works out of the box.

---

## 4. Create the MySQL database

Open a terminal and log into MySQL:
```powershell
mysql -u root -p
```
Enter your MySQL root password, then run the schema and seed files. Easiest way — exit the MySQL prompt (`exit`) and run from PowerShell instead:

```powershell
mysql -u root -p < database\schema.sql
mysql -u root -p < database\seed.sql
```

This creates the `civic_connect` database, all 9 tables, and inserts:
- 1 admin, 2 department officials, 2 citizens (all with password `Password@123`)
- 5 departments, 6 categories
- 1 sample complaint already in `submitted` status

Verify it worked:
```powershell
mysql -u root -p -e "USE civic_connect; SHOW TABLES;"
```
You should see 9 tables listed.

---

## 5. Configure environment variables

Copy the example file:
```powershell
copy .env.example .env
```

Open `.env` in VS Code and set at minimum:
```
DB_PASSWORD=your_actual_mysql_root_password
JWT_SECRET=any_long_random_string_here
```

Everything else can stay at its default for local development. **Firebase, cloud storage, Google Maps, and ML endpoint variables can all be left blank** — the app runs fully without them, just with those specific features in fallback mode (explained in Section 9).

**Never commit your real `.env` file** — it's already in `.gitignore`.

---

## 6. Start the server

```powershell
npm run dev
```

You should see:
```
[INFO]  ... - MySQL connected: 127.0.0.1:3306/civic_connect
[INFO]  ... - Civic Connect API listening on http://localhost:5000
[INFO]  ... - Environment: development
[INFO]  ... - Upload strategy: local
[INFO]  ... - Firebase configured: false
```

Test it's alive by opening `http://localhost:5000/health` in a browser — you should see `{"success":true,"message":"Civic Connect API is running"}`.

If it fails to start, see Section 10 (Troubleshooting).

---

## 7. Testing endpoints in Postman

1. Open Postman → **Import** → select `postman\CivicConnect.postman_collection.json`
2. Open the collection → folder **"1. Auth"**
3. Run **"Login as Admin (seed user)"**, then **"Login as Department Official"**, then **"Login as Citizen"** — each automatically saves its JWT into the collection's variables (`adminToken`, `officialToken`, `citizenToken`), so every other request in the collection is pre-authenticated.
4. Work through folders **2 → 8** in order — folder **"4. Complaints" → "Create Complaint"** auto-saves the new `complaintId`, which folder **"5. Assignment Workflow"** and **"6. Feedback"** then use automatically.

This walks through the entire flow: register → login → submit complaint with photo+GPS → admin assigns to official → official updates status through to resolved → citizen leaves feedback → admin views analytics.

---

## 8. Running automated tests

```powershell
npm test
```

This runs `tests\auth.test.js` (registration, login, protected-route and role-check tests) against your real local database. Make sure the server is NOT already running on the same port when you run tests, and that your `.env` is configured — `npm test` starts its own instance of the Express app in-process (via supertest), it does not need `npm run dev` to be running separately.

---

## 9. Connecting to Flutter / React.js

The backend is a stateless REST API — either client calls the same endpoints.

- **Base URL**: `http://localhost:5000/api` (from an Android emulator, use `http://10.0.2.2:5000/api`; from a physical phone on the same Wi-Fi, use your PC's local IP, e.g. `http://192.168.1.5:5000/api`)
- **Auth**: store the JWT returned by `/auth/login` (e.g. in `flutter_secure_storage` or a React `httpOnly`-cookie/local state pattern) and send it as `Authorization: Bearer <token>` on every subsequent request.
- **CORS**: add your React dev server's origin (e.g. `http://localhost:3000`) to `CORS_ALLOWED_ORIGINS` in `.env`. Flutter mobile apps aren't subject to browser CORS, so no change is needed there.
- **Image uploads**: send `multipart/form-data` with field name `images` (array, complaint creation) or `image` (single, resolution proof) — see `API_CONTRACT.md`.
- Full endpoint list, request/response shapes, and roles: see `API_CONTRACT.md`.

---

## 10. Troubleshooting common errors

| Error | Cause | Fix |
|---|---|---|
| `Error: Missing required environment variable: JWT_SECRET` | `.env` not created or missing a value | Run Step 5 again; make sure `.env` (not `.env.example`) exists in the project root |
| `MySQL connection failed: ER_ACCESS_DENIED_ERROR` | Wrong `DB_PASSWORD` in `.env` | Double-check your MySQL root password |
| `MySQL connection failed: ECONNREFUSED` | MySQL service isn't running | Open "Services" app on Windows, find "MySQL80", start it |
| `Error: connect ECONNREFUSED` on port 5000 | Server isn't running, or crashed on startup | Check the terminal running `npm run dev` for the actual error above this line |
| `EADDRINUSE: address already in use :::5000` | Another process is already using port 5000 | Change `PORT` in `.env`, or stop the other process |
| Postman requests return `401 Unauthorized` | You didn't run the Login requests first, or the token expired | Re-run the relevant Login request in folder "1. Auth" |
| `413` or file upload errors | Image too large or wrong file type | Only JPG/PNG/WEBP under `MAX_UPLOAD_SIZE_MB` (default 5MB) are accepted |
| `npm install` fails with permission errors | Rare on Windows, usually antivirus/folder permissions | Try running PowerShell as Administrator, or move the project out of OneDrive-synced folders if OneDrive is locking files |

---

## 11. What's implemented vs. what needs external credentials or a trained model

**Fully implemented and testable with zero external accounts:**
- Registration, login, JWT auth, RBAC (citizen/department_official/admin)
- Complaint creation with photo upload (local disk storage), GPS coordinates, rule-based auto-categorization
- Full status workflow with server-side transition validation and audit history
- Assignment/reassignment with history
- In-app notifications (visible via `GET /api/notifications`)
- Feedback on resolved complaints
- Admin/official analytics dashboard (aggregated data only)
- Role-scoped data access (citizens see only their own; officials only their assignments; admins see all)

**Implemented, but requires YOU to provide real credentials to become fully "live":**
- **Push notifications (FCM)**: the code is a real, working Firebase Admin SDK integration — but without `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` in `.env`, every push is honestly logged as `not_configured` rather than faked as sent. Get these from a Firebase project's Service Account settings.
- **Cloud image storage**: local disk storage works immediately; S3-compatible cloud storage requires `npm install @aws-sdk/client-s3` plus real bucket credentials in `.env`. Without them, the app correctly uses local storage.
- **Google Maps API**: the backend stores and validates latitude/longitude; it does not call the Maps API server-side. Your Flutter/React client uses `GOOGLE_MAPS_API_KEY` directly for map rendering/pin-drop UI — that key never needs to touch this backend.

**Explicitly NOT a trained ML model:**
- `categorizationService.js` uses keyword-matching rules, not a trained classifier. If you train one later, point `ML_CATEGORIZATION_ENDPOINT` in `.env` at an HTTP endpoint accepting `{ title, description }` and returning `{ category_slug }` — the service will call it automatically and fall back to rules only if it's unreachable.

---

## 12. Default seed login credentials (for demo/testing only — change or remove for any real deployment)

| Role | Email | Password |
|---|---|---|
| Admin | admin@civicconnect.gov | Password@123 |
| Official (Roads) | ramesh.roads@civicconnect.gov | Password@123 |
| Official (Sanitation) | sunita.sanitation@civicconnect.gov | Password@123 |
| Citizen | bhumi.citizen@example.com | Password@123 |
| Citizen | chahat.citizen@example.com | Password@123 |
#   c i v i c i s s u e s  
 #   c i v i c i s s u e s  
 