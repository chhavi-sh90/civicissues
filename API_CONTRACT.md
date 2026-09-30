# Civic Connect — REST API Contract

Base URL (local dev): `http://localhost:5000/api`
All request/response bodies are JSON. All protected routes require:
`Authorization: Bearer <JWT>`

Standard response envelope (success):
```json
{ "success": true, "data": { ... }, "message": "..." }
```
Standard response envelope (error):
```json
{ "success": false, "message": "...", "errors": [ ... ] }
```

Standard HTTP status codes used: `200 OK`, `201 Created`, `400 Bad Request`,
`401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`, `422 Unprocessable Entity`, `500 Internal Server Error`.

---

## 1. Authentication — `/api/auth`

| Method | Path | Role | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | `/auth/register` | Public | `{ full_name, email, phone, password }` | 201, user (no password) + JWT | 400 validation, 409 email exists |
| POST | `/auth/login` | Public | `{ email, password }` | 200, user + JWT | 400 validation, 401 invalid credentials |
| GET | `/auth/me` | Any authenticated | — | 200, current user profile | 401 no/invalid token |

Note: citizens self-register via `/auth/register`. `department_official` and `admin` accounts are created only by an existing admin via `/api/users` (see below) — this prevents citizens from granting themselves elevated roles.

## 2. User & Profile — `/api/users`

| Method | Path | Role | Body | Success | Errors |
|---|---|---|---|---|---|
| GET | `/users/profile` | Any authenticated | — | 200, own profile | 401 |
| PUT | `/users/profile` | Any authenticated | `{ full_name?, phone? }` | 200, updated profile | 400, 401 |
| PUT | `/users/profile/password` | Any authenticated | `{ current_password, new_password }` | 200 | 400, 401 (wrong current password) |
| POST | `/users` | admin | `{ full_name, email, phone, password, role, department_id? }` | 201, created user | 400, 403, 409 |
| GET | `/users` | admin | query: `role, department_id, page, limit` | 200, paginated list | 403 |
| PUT | `/users/:id/status` | admin | `{ is_active }` | 200 | 403, 404 |

## 3. Categories — `/api/categories`

| Method | Path | Role | Body | Success | Errors |
|---|---|---|---|---|---|
| GET | `/categories` | Any authenticated | — | 200, list of active categories | 401 |
| POST | `/categories` | admin | `{ name, slug, default_department_id, default_priority }` | 201 | 400, 403, 409 |
| PUT | `/categories/:id` | admin | `{ name?, default_department_id?, default_priority?, is_active? }` | 200 | 400, 403, 404 |
| DELETE | `/categories/:id` | admin | — | 200 (soft delete: `is_active=0`) | 403, 404 |

## 4. Departments — `/api/departments`

| Method | Path | Role | Body | Success | Errors |
|---|---|---|---|---|---|
| GET | `/departments` | Any authenticated | — | 200, list | 401 |
| POST | `/departments` | admin | `{ name, description, contact_email }` | 201 | 400, 403, 409 |
| PUT | `/departments/:id` | admin | `{ name?, description?, contact_email?, is_active? }` | 200 | 400, 403, 404 |
| GET | `/departments/:id/officials` | admin | — | 200, officials in dept | 403, 404 |

## 5. Complaints — `/api/complaints`

| Method | Path | Role | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | `/complaints` | citizen | `multipart/form-data`: `title, description, category_id, latitude, longitude, address?, images[]` | 201, complaint with `reference_code` | 400, 401, 422 (bad file type/size) |
| GET | `/complaints` | Any authenticated (scoped — see below) | query: `status, category_id, department_id, page, limit, search` | 200, paginated list | 401 |
| GET | `/complaints/:id` | Owner citizen / assigned official / admin | — | 200, full complaint incl. images + status history | 401, 403, 404 |
| PUT | `/complaints/:id/status` | department_official (assigned) / admin | `{ new_status, remarks?, proof_image_url? }` | 200, updated complaint | 400 (invalid transition), 401, 403, 404 |
| GET | `/complaints/:id/history` | Owner citizen / assigned official / admin | — | 200, status history array | 401, 403, 404 |
| GET | `/complaints/my` | citizen | query: `status, page, limit` | 200, own complaints | 401 |
| GET | `/complaints/assigned` | department_official | query: `status, page, limit` | 200, complaints assigned to this official | 401, 403 |

**Scoping rule for `GET /complaints`:** citizens see only their own; officials see only complaints assigned to their department; admins see all. This is enforced server-side in the controller, not left to the client.

**Valid status transitions** (enforced server-side):
`submitted → under_review → assigned → in_progress → resolved`
`submitted/under_review/assigned → rejected` (with mandatory `rejection_reason`)
No transition may skip backward except admin override (documented separately, not exposed by default in MVP).

## 6. Complaint Images — `/api/complaints/:id/images`

| Method | Path | Role | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | `/complaints/:id/images` | Owner citizen (submission) / assigned official (resolution proof) | `multipart/form-data`: `image, image_type` | 201, image record | 400, 401, 403, 422 |
| DELETE | `/complaints/:id/images/:imageId` | Owner citizen / admin | — | 200 | 401, 403, 404 |

## 7. Assignments — `/api/assignments`

| Method | Path | Role | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | `/assignments` | admin (or department official assigning within own dept) | `{ complaint_id, official_id, notes? }` | 201, assignment + complaint status → `assigned` | 400, 401, 403, 404 |
| PUT | `/assignments/:complaintId/reassign` | admin | `{ official_id, notes? }` | 200, new current assignment | 400, 401, 403, 404 |
| GET | `/assignments/complaint/:complaintId` | Owner citizen / assigned official / admin | — | 200, assignment history | 401, 403, 404 |

## 8. Notifications — `/api/notifications`

| Method | Path | Role | Body | Success | Errors |
|---|---|---|---|---|---|
| GET | `/notifications` | Any authenticated | query: `is_read, page, limit` | 200, own notifications | 401 |
| PUT | `/notifications/:id/read` | Owner | — | 200 | 401, 403, 404 |
| PUT | `/notifications/read-all` | Owner | — | 200 | 401 |

Note: if Firebase Admin credentials are not configured in `.env`, push notifications are logged with `delivery_status = 'not_configured'` and the API never reports `sent` for a push that wasn't actually delivered.

## 9. Feedback — `/api/feedback`

| Method | Path | Role | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | `/feedback` | Owner citizen (only on resolved complaint) | `{ complaint_id, rating, comment? }` | 201 | 400 (not resolved / already exists), 401, 403, 404 |
| GET | `/feedback/complaint/:complaintId` | Owner citizen / assigned official / admin | — | 200 | 401, 403, 404 |

## 10. Analytics — `/api/analytics`

| Method | Path | Role | Query | Success | Errors |
|---|---|---|---|---|---|
| GET | `/analytics/summary` | admin, department_official (scoped to own dept) | `from?, to?` | 200: totals, by-status counts | 401, 403 |
| GET | `/analytics/by-category` | admin, department_official | `from?, to?` | 200: complaint counts per category | 401, 403 |
| GET | `/analytics/by-department` | admin | `from?, to?` | 200: complaint counts per department | 401, 403 |
| GET | `/analytics/resolution-time` | admin, department_official | `from?, to?` | 200: avg resolution time (hours) overall + per category | 401, 403 |
| GET | `/analytics/trends` | admin | `from?, to?, group_by=day\|week\|month` | 200: time series counts | 401, 403 |
| GET | `/analytics/hotspots` | admin | `from?, to?` | 200: complaint counts grouped by rounded lat/lng (recurring-issue detection) | 401, 403 |

All analytics endpoints return only aggregated counts/averages — never raw citizen personal data — per your "authorized/aggregated data only" requirement.

---

### Example: Create complaint (success)
Request: `POST /api/complaints` (multipart/form-data)
```
title: Large pothole on MG Road
description: Dangerous pothole causing traffic issues
category_id: 1
latitude: 28.6448
longitude: 77.2167
address: MG Road, Ward 12
images: [file1.jpg]
```
Response `201`:
```json
{
  "success": true,
  "message": "Complaint submitted successfully",
  "data": {
    "id": 1,
    "reference_code": "CC-2026-000001",
    "status": "submitted",
    "category": "Potholes",
    "created_at": "2026-09-26T10:00:00.000Z"
  }
}
```

### Example: Invalid status transition (error)
Response `400`:
```json
{
  "success": false,
  "message": "Invalid status transition: cannot move from 'submitted' to 'resolved' without going through 'assigned' and 'in_progress'."
}
```
