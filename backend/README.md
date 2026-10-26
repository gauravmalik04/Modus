# Modus Backend API 🎵

REST API for the **Modus** music application, engineered with Express.js, MongoDB Atlas (Mongoose), JWT authentication, and harmonic sequencing algorithms.

---

## 🏛 Architecture Overview (MVC)

The backend follows a strict **Model-View-Controller** separation:

```
backend/
├── config/             # Database connection, env loader, startup asserts
│   ├── db.js           # Mongoose Atlas connection + dev fallback
│   └── env.js          # Environment variable validation & type casting
├── controllers/        # HTTP Request / Response handlers
│   ├── auth.controller.js
│   ├── song.controller.js
│   ├── playlist.controller.js
│   └── admin.controller.js
├── models/             # Mongoose Schemas & business methods
│   ├── User.js         # User identity, bcrypt hashing, comparePassword
│   ├── Song.js         # Audio feature schema, ISRC index, upsert
│   └── Playlist.js     # User playlist, stats caching, topMood computation
├── services/           # Reusable business logic
│   ├── auth.service.js
│   ├── song.service.js
│   └── playlist.service.js
├── middleware/         # Express middleware
│   ├── auth.middleware.js      # JWT protect + adminOnly guards
│   ├── validate.middleware.js  # express-validator result handler
│   └── error.middleware.js     # Global API error normalizer
├── pipeline/           # Algorithmic sequencing engine
│   ├── PlaylistSequencer.js    # Greedy nearest-neighbor harmonic sequencing
│   ├── thresholds.js           # Calibrated preset mood cutoff thresholds
│   ├── FreqBlogClient.js       # External audio feature extractor client
│   └── Song.js                 # Track audio model
├── routes/             # Route definitions & validation rules
│   ├── auth.routes.js
│   ├── song.routes.js
│   ├── playlist.routes.js
│   └── admin.routes.js
└── server.js           # Express app initialization & server entry point
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** >= 18.0.0
- **MongoDB** (MongoDB Atlas cluster or local instance running on `mongodb://127.0.0.1:27017`)

### 2. Installation
```bash
cd backend
npm install
```

### 3. Environment Variables
Create a `.env` file in the project root (or inside `backend/`):
```bash
cp ../.env.example .env
```

| Variable | Description | Default (Dev) |
|---|---|---|
| `PORT` | HTTP server port | `5000` |
| `NODE_ENV` | Environment (`development`, `production`, `test`) | `development` |
| `MONGODB_URI` | MongoDB Atlas cluster connection string | `mongodb+srv://...` |
| `JWT_SECRET` | Secret key used to sign and verify JWT tokens | *(Required)* |
| `JWT_EXPIRES_IN` | Token expiration duration | `7d` |
| `CLIENT_ORIGIN` | Allowed CORS frontend origin | `http://localhost:5500` |
| `FREQBLOG_API_KEY` | API key for FreqBlog music features | *(Optional)* |
| `ADMIN_SECRET` | Secret header (`X-Admin-Secret`) for admin tasks | `change_me_in_production` |

> **Development Resiliency:** In development mode (`NODE_ENV=development`), if the configured MongoDB Atlas connection fails (e.g. your current IP address is not whitelisted on Atlas Network Access), the server automatically connects to the local MongoDB daemon (`mongodb://127.0.0.1:27017/modus`) so development is never interrupted.

### 4. Seed Song Catalog
Populate the database with all 20 curated tracks from `data/music_features.json`:
```bash
npm run seed
```

### 5. Start Development Server
```bash
npm run dev
```
The server will start listening on `http://localhost:5000`.

---

## 📡 REST API Reference

### Base URL
- **Local:** `http://localhost:5000/api`
- **Production:** `https://modus-api.onrender.com/api`

### Health Check
- `GET /health` or `GET /api/health` — Returns system status, environment, and timestamp.

---

### 1. Authentication — `/api/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/signup` | Public | Register new user. Returns JWT and user profile. |
| `POST` | `/api/auth/login` | Public | Log in with username or email + password. Returns JWT. |
| `GET` | `/api/auth/me` | Bearer | Get currently authenticated user profile. |
| `POST` | `/api/auth/logout` | Bearer | Invalidate session (client clears token). |
| `POST` | `/api/auth/forgot-password` | Public | Trigger password recovery request. |

### 2. Song Catalog — `/api/songs`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/songs?q=...&limit=20` | Bearer | Search and filter songs in catalog. |
| `GET` | `/api/songs/:id` | Bearer | Retrieve song features and mood presets by MongoDB ID. |
| `POST` | `/api/songs/search` | Bearer | Find song in DB or fetch on-demand from FreqBlog API. |
| `POST` | `/api/songs/bulk` | Bearer | Batch resolve or cache multiple tracks. |

### 3. Playlists — `/api/playlists`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/playlists` | Bearer | Get all playlists owned by the authenticated user. |
| `POST` | `/api/playlists` | Bearer | Create a new user playlist with auto-calculated stats. |
| `GET` | `/api/playlists/:id` | Bearer | Get playlist detail with fully populated song objects. |
| `PUT` | `/api/playlists/:id` | Bearer | Update playlist name, description, tags, cover image. |
| `DELETE` | `/api/playlists/:id` | Bearer | Delete a playlist (user ownership enforced). |
| `POST` | `/api/playlists/:id/songs` | Bearer | Add track to playlist; recomputes `trackCount` & `topMood`. |
| `DELETE` | `/api/playlists/:id/songs/:songId` | Bearer | Remove track from playlist; recalculates stats. |
| `POST` | `/api/playlists/:id/resequence` | Bearer | Run Camelot-wheel harmonic sequencing on playlist tracks. |
| `POST` | `/api/playlists/:id/export` | Bearer | Export generated sequence as a new permanent playlist. |
| `POST` | `/api/playlists/export` | Bearer | Export standalone sequence without source playlist ID. |

### 4. Admin — `/api/admin`

Requires either `X-Admin-Secret: <ADMIN_SECRET>` header or a JWT belonging to an admin user (`role: 'admin'`).

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/admin/seed` | Admin | Upsert catalog tracks from JSON. Idempotent. |
| `POST` | `/api/admin/extract` | Admin | Trigger bulk feature extraction via FreqBlog. |

---

## 🧪 Testing Suite

Modus backend includes 5 automated test suites covering every layer of the application:

```bash
# Run all 57 tests
npm test

# Run individual test suites
npm run test:auth          # 12 tests: signup, login, validation, JWT guards
npm run test:songs         # 10 tests: catalog search, caching, filters
npm run test:playlists     # 16 tests: CRUD, isolation, stats recomputation, sequencing
npm run test:admin         #  9 tests: secret guards, seed idempotency, extraction
npm run test:integration   # 10 tests: complete frontend-backend contract workflows
```

---

## 🔒 Security Features
- **Passwords:** Salted and hashed using `bcryptjs` (work factor 10) in Mongoose hooks.
- **JWT:** Signed with HMAC-SHA256, strict expiration (`7d`).
- **Security Headers:** Enforced via `helmet()`.
- **CORS Protection:** Configurable per environment, supporting localhost, local dev IP addresses, and Vercel domains.
- **Rate Limiting:**
  - Global: 200 requests per 15 minutes per IP.
  - Auth routes: 20 attempts per 15 minutes per IP.
- **Data Isolation:** User ID is extracted from verified JWT tokens on the server; users cannot read, modify, or delete another user's playlists.
