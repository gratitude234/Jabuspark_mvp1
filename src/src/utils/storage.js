// Namespace all localStorage keys for this app.
//
// Rename note:
// The app was renamed from "jabuspark" -> "jabustudyhub".
// We keep a legacy prefix so existing users don't lose their session/data.
const PREFIX = 'jabustudyhub:'
const LEGACY_PREFIX = 'jabuspark:'

function safeParse(raw, fallback) {
  if (!raw) return fallback
  try {
    return JSON.parse(raw)
  } catch (e) {
    return fallback
  }
}

function migrateLegacyKey(key) {
  const legacyKey = LEGACY_PREFIX + key
  const nextKey = PREFIX + key

  try {
    const raw = localStorage.getItem(legacyKey)
    if (raw == null) return null

    // Copy the raw JSON string forward (avoids re-serializing).
    localStorage.setItem(nextKey, raw)
    localStorage.removeItem(legacyKey)
    return raw
  } catch (e) {
    return null
  }
}

export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key)
      if (raw != null) return safeParse(raw, fallback)

      // Fallback to legacy keys, then migrate.
      const legacyRaw = migrateLegacyKey(key)
      if (legacyRaw != null) return safeParse(legacyRaw, fallback)

      return fallback
    } catch (e) {
      return fallback
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
      // Clean up any legacy value to avoid confusion.
      localStorage.removeItem(LEGACY_PREFIX + key)
    } catch (e) {
      // ignore
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(PREFIX + key)
      localStorage.removeItem(LEGACY_PREFIX + key)
    } catch (e) {
      // ignore
    }
  },
}
