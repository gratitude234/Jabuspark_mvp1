# JABUSPARK Improvements (Dec 24, 2025)

This bundle contains:
- `frontend/` (Vue 3 + Pinia + Router UI)
- `backend/` (PHP API)

## What was improved

### 1) API / Data Contract Alignment
- Banks now return questions using:
  - `question` (string)
  - `options` (string[])
  - `answerIndex` (number)
  - `explanation` (string)
- Practice submit now returns `result.explanation`.
- Bank create endpoint accepts both legacy + current keys:
  - `question` or `prompt`
  - `explanation` or `explain`

### 2) Frontend Safety Normalization
- `frontend/src/stores/content.js` normalizes bank questions so the UI still works even if an older API returns `prompt/explain`.

### 3) UX: Search in lists
- Added client-side search boxes:
  - Practice banks (`/practice`)
  - Past questions (`/past-questions`)
  - Materials (`/materials`)

### 4) UX: Better session-expired handling
- Added a global Toast host and an `auth:expired` listener.
- When the API returns 401, the app shows a toast and redirects to `/auth/login`.

### 5) Small routing fix
- Profile logout redirect now routes correctly to `/auth/login`.
