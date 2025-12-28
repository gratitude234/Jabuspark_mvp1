const PREFIX = 'jabuspark:'

export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key)
      return raw ? JSON.parse(raw) : fallback
    } catch (e) {
      return fallback
    }
  },
  set(key, value) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  },
  remove(key) {
    localStorage.removeItem(PREFIX + key)
  }
}
