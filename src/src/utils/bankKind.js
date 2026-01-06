/**
 * Bank categorisation helper.
 *
 * Why: your backend banks may not provide `mode` yet.
 * We derive a stable "kind" for UI filters (Quick / Exam / PastQ)
 * using (in order): explicit fields -> tags -> title heuristics.
 */

function toArray(v) {
  if (!v) return []
  if (Array.isArray(v)) return v
  if (typeof v === 'string') {
    // allow comma-separated tags: "quick, exam"
    return v
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  }
  return [v]
}

function haystack(bank) {
  const title = String(bank?.title || '')
  const mode = String(bank?.mode || bank?.type || bank?.category || bank?.kind || '')
  const tags = toArray(bank?.tags || bank?.tag || bank?.labels || bank?.label)
  const extra = [
    bank?.source,
    bank?.sourceType,
    bank?.isPastQuestion ? 'pastq' : '',
    bank?.isExam ? 'exam' : '',
    bank?.isQuick ? 'quick' : '',
  ].filter(Boolean)

  return [title, mode, ...tags, ...extra].join(' ').toLowerCase()
}

/**
 * Returns one of: 'quick' | 'exam' | 'pastq' | 'practice'
 */
export function bankKind(bank) {
  const h = haystack(bank)

  // Past questions
  if (/(pastq|past\s*question|past\s*questions|\bpq\b)/.test(h)) return 'pastq'

  // Exam mode
  if (/(exam|cbt|mock|timed|full\s*length)/.test(h)) return 'exam'

  // Quick drills
  if (/(quick|drill|revision|speed|short|warm\s*up)/.test(h)) return 'quick'

  return 'practice'
}

export function bankKindLabel(kind) {
  switch (kind) {
    case 'quick':
      return 'Quick'
    case 'exam':
      return 'Exam'
    case 'pastq':
      return 'PastQ'
    default:
      return 'Practice'
  }
}

export function bankMeta(bank) {
  const kind = bankKind(bank)
  return { kind, label: bankKindLabel(kind) }
}
