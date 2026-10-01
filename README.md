# CivicConnect

CivicConnect is a full-stack civic issue reporting and resolution website. Citizens can register, report an issue with photos and map coordinates, and track its status. Department officials and administrators see role-scoped complaint data through the same portal.

The project combines:

- React + Vite frontend, based on [Bhumi147/CivicConnect](https://github.com/Bhumi147/CivicConnect)
- Node.js + Express REST API
- MySQL database
- JWT authentication and role-based access control
- Leaflet/OpenStreetMap location picker and issue map

## Two user portals

### Citizen

- Registers and logs in from the public website
- Reports an issue with category, description, photos, address, and map location
- Tracks status and reads the latest authority note
- Receives an in-app notification whenever an authority changes the status

### Authority

- Logs in with a pre-created `department_official` or `admin` account
- Sees the work queue for their department (admins see all departments)
- Changes an issue to Under Review, In Progress, Resolved, or Rejected
- Sends a required update note, plus a rejection reason when applicable

### Administrator intelligence

The admin account also has the dashboard modules from the `member3-admin` frontend branch, connected to live backend data:

- Complete complaint queue and map
- Complaint-density heatmap
- Date-filtered status, category, department, trend, and resolution analytics
- AI-assisted category/risk analysis with transparent ML or rule-based method labels
- Nearby duplicate detection and action recommendations
- User directory with roles, departments, activity status, and report counts

Citizen registration never creates an authority account. Authority accounts are seeded for the demo or created by an administrator.

## Project structure

```text
.
|-- frontend/          React website
|-- src/               Express API and server
|-- database/          MySQL schema and seed data
|-- postman/           API collection
|-- tests/             Backend tests
|-- uploads/           Local complaint images (ignored by Git)
|-- API_CONTRACT.md    REST API reference
`-- package.json       Full-stack scripts
```

## Requirements

- Node.js 20 or newer
- npm
- MySQL 8

## 1. Install dependencies

From the project root:

```powershell
npm install
npm run frontend:install
```

## 2. Create the database

Run the schema first and the seed data second:

```powershell
mysql -u root -p < database\schema.sql
mysql -u root -p < database\seed.sql
```

The seed creates departments, categories, demo users, and a sample complaint.

## 3. Create the local environment file

Create a `.env` file in the project root. Environment files are intentionally ignored by Git.

```dotenv
PORT=5000
NODE_ENV=development

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=civic_connect
DB_CONNECTION_LIMIT=10

JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=10

CORS_ALLOWED_ORIGINS=http://localhost:5173
UPLOAD_STRATEGY=local
MAX_UPLOAD_SIZE_MB=5
LOCAL_UPLOAD_DIR=uploads
```

Firebase, cloud-storage, Google Maps, and ML integration variables are optional. The React website uses OpenStreetMap and does not require a Google Maps key.

## 4. Run in development

Use two terminals from the project root.

Terminal 1 — API server:

```powershell
npm run dev
```

Terminal 2 — React development server:

```powershell
npm run dev:frontend
```

Open http://localhost:5173. Vite proxies `/api`, `/uploads`, and `/health` to the backend on port 5000.

## 5. Build and run as one website

```powershell
npm run build
npm start
```

Open http://localhost:5000. Express serves the compiled React app and the REST API from one process.

The production build output is generated in `frontend/dist` and is not committed to Git.

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the backend with nodemon |
| `npm run dev:frontend` | Start the Vite frontend |
| `npm run frontend:install` | Install frontend packages |
| `npm run build` | Install and compile the frontend |
| `npm start` | Start the production/full-stack server |
| `npm test` | Run backend Jest tests |
| `npm --prefix frontend run lint` | Lint the React code |

## Demo accounts

After importing `database/seed.sql`, all seeded users use password `Password@123`.

| Role | Email |
| --- | --- |
| Admin | `admin@civicconnect.gov` |
| Road official | `ramesh.roads@civicconnect.gov` |
| Sanitation official | `sunita.sanitation@civicconnect.gov` |
| Citizen | `bhumi.citizen@example.com` |
| Citizen | `chahat.citizen@example.com` |

Seed credentials are for local demonstrations only and must be changed before deployment.

## Main website flows

- Register and log in through the real authentication API
- Restore and validate the saved session
- Load categories from MySQL
- Submit complaints with description, address, photos, latitude, and longitude
- View role-scoped complaints and live status counts
- Plot accessible complaints on an OpenStreetMap map
- Serve unknown API routes as JSON while supporting the React single-page app

See [API_CONTRACT.md](API_CONTRACT.md) for all endpoints and role permissions.
