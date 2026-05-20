# Team Task Manager

A full-stack collaborative task management web application. Users can sign up, create projects, invite team members with role-based access (Admin / Member), assign tasks, track status, and view project dashboards.

## Live Demo

> Deploy to Railway and add your live URL here after deployment.

## Features

- **Authentication** — Signup (name, email, password) and JWT-based login
- **Projects** — Create projects; creator becomes Admin; add/remove members by email
- **Tasks** — Title, description, due date, priority; assign to members; status (To Do, In Progress, Done)
- **Dashboard** — Total tasks, breakdown by status, tasks per user, overdue count
- **Role-based access**
  - **Admin** — Manage members, create/delete tasks, assign tasks, update any task
  - **Member** — View and update status on assigned tasks only

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React 19, Vite, Tailwind CSS v4     |
| Backend  | Node.js, Express 5, Prisma ORM      |
| Database | PostgreSQL                        |
| Auth     | JWT (7-day expiry), bcrypt passwords|
| Deploy   | Railway                             |

## Project Structure

```
├── backend/          # REST API
│   ├── prisma/       # Database schema
│   └── src/
│       ├── routes/   # auth, projects, tasks, dashboard
│       └── middleware/
└── frontend/         # React SPA
    └── src/
        ├── pages/
        ├── components/
        └── lib/api.js
```

## Local Setup

### Prerequisites

- Node.js 20+
- PostgreSQL (local or Docker)

### 1. Database

```bash
# Example with Docker
docker run --name team-tasks-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=team_tasks -p 5432:5432 -d postgres:16
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: set DATABASE_URL and JWT_SECRET

npm install
npx prisma db push
npm run dev
```

API runs at `http://localhost:3001`

### 3. Frontend

```bash
cd frontend
cp .env.example .env
# VITE_API_URL=http://localhost:3001 (or leave empty to use Vite proxy)

npm install
npm run dev
```

App runs at `http://localhost:5173`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/projects` | List / create projects |
| GET | `/api/projects/:id` | Project details |
| POST/DELETE | `/api/projects/:id/members` | Add / remove members |
| GET/POST | `/api/tasks/project/:id` | List / create tasks |
| PATCH/DELETE | `/api/tasks/:id` | Update / delete task |
| GET | `/api/dashboard/project/:id` | Dashboard stats |

## Railway Deployment

Deploy **three** services in one Railway project (or two if you use an external Postgres):

### Service 1: PostgreSQL

1. In Railway dashboard → **New** → **Database** → **PostgreSQL**
2. Copy the `DATABASE_URL` from the Postgres service variables

### Service 2: Backend API

1. **New** → **GitHub Repo** → select this repository
2. Set **Root Directory** to `backend`
3. Add environment variables:
   - `DATABASE_URL` — reference from Postgres plugin (`${{Postgres.DATABASE_URL}}`)
   - `JWT_SECRET` — long random string
   - `NODE_ENV` = `production`
   - `FRONTEND_URL` — your frontend Railway URL (set after frontend deploy)
4. Deploy. Note the public URL (e.g. `https://your-api.up.railway.app`)

### Service 3: Frontend

1. **New** → same repo, **Root Directory** = `frontend`
2. Environment variables:
   - `VITE_API_URL` — backend public URL (e.g. `https://your-api.up.railway.app`)
3. Redeploy backend with `FRONTEND_URL` set to frontend URL for CORS

### Build commands (auto-detected via `railway.toml`)

- **Backend**: `npx prisma db push && npm start`
- **Frontend**: `npm run build && npx serve dist -s -l $PORT`

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs |
| `PORT` | Server port (Railway sets automatically) |
| `FRONTEND_URL` | Frontend origin for CORS |
| `NODE_ENV` | `development` or `production` |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL |

## Submission Checklist

- [ ] Live application URL (Railway frontend)
- [ ] GitHub repository link
- [ ] README with setup and deployment (this file)
- [ ] Backend and frontend connected via `VITE_API_URL` / `FRONTEND_URL`

## License

MIT
