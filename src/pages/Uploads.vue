<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import { apiFetch } from '../utils/api'

import AppCard from '../components/AppCard.vue'
import AppSelect from '../components/AppSelect.vue'
import AppButton from '../components/AppButton.vue'

const auth = useAuthStore()
const catalog = useCatalogStore()

const role = computed(() => auth.user?.role || 'student')
const meId = computed(() => String(auth.user?.id || ''))

// Course reps: backend stores allowed course ids here
const repCourseIds = computed(() => {
  const v = auth.user?.profile?.repCourseIds || []
  return Array.isArray(v) ? v.map(x => String(x)) : []
})

// Page state
const busy = ref(false)
const error = ref('')
const ok = ref('')

// Tabs
const uploadTab = ref('past') // 'past' | 'materials'
const manageTab = ref('past') // 'past' | 'materials'

// Course selection
const courseId = ref('')
const filterCourseId = ref('') // filter for manage section

// Form state (Past Questions)
const pqTitle = ref('')
const pqSession = ref('')
const pqSemester = ref('')
const pqFile = ref(null)
const pqFileKey = ref(0)

// Form state (Materials)
const mTitle = ref('')
const mType = ref('pdf')
const mTags = ref('')
const mFile = ref(null)
const mFileKey = ref(0)

// Lists
const listBusy = ref(false)
const listError = ref('')
const pastItems = ref([])
const materialItems = ref([])

// Inline edit model
// { kind: 'past'|'materials', id, title, session, semester, type, tags }
const edit = ref(null)

const MAX_BYTES = 50 * 1024 * 1024

function bytesLabel(n) {
  if (!n || Number.isNaN(Number(n))) return ''
  const mb = Number(n) / (1024 * 1024)
  return `${mb.toFixed(mb >= 10 ? 0 : 1)}MB`
}

function qs(params) {
  const sp = new URLSearchParams()
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === null || v === undefined) return
    const s = String(v)
    if (!s.trim()) return
    sp.set(k, s)
  })
  const str = sp.toString()
  return str ? `?${str}` : ''
}

function normalizeItems(res) {
  // supports {data:{items:[]}} or {items:[]} or [] or {data:[]}
  if (Array.isArray(res)) return res
  if (Array.isArray(res?.data?.items)) return res.data.items
  if (Array.isArray(res?.items)) return res.items
  if (Array.isArray(res?.data)) return res.data
  return []
}

const canAccessUploads = computed(() => role.value === 'admin' || role.value === 'course_rep')

const courseOptions = computed(() => {
  const all = (catalog.courses || []).map(c => ({
    value: String(c.id),
    label: `${c.code} — ${c.title} (${c.level})`,
  }))
  if (role.value === 'admin') return all
  // course_rep: only allow assigned courses (string-safe compare)
  const allowed = new Set(repCourseIds.value)
  return all.filter(c => allowed.has(String(c.value)))
})

const hasAnyAllowedCourse = computed(() => courseOptions.value.length > 0)

function ensureValidCourseSelection() {
  const allowed = new Set(courseOptions.value.map(o => String(o.value)))
  if (!allowed.size) {
    courseId.value = ''
    if (filterCourseId.value) filterCourseId.value = ''
    return
  }
  if (!courseId.value || !allowed.has(String(courseId.value))) {
    courseId.value = String(courseOptions.value[0].value)
  }
  // Keep manage filter convenient: if empty, follow selected course
  if (!filterCourseId.value) filterCourseId.value = courseId.value
}

function onPickFile(refVar, evt, { kind }) {
  const f = evt?.target?.files?.[0] || null
  if (!f) {
    refVar.value = null
    return
  }

  // size guard
  if (f.size > MAX_BYTES) {
    error.value = `File too large (${bytesLabel(f.size)}). Max is ${bytesLabel(MAX_BYTES)}.`
    refVar.value = null
    // reset the input (so re-selecting same file triggers change)
    if (kind === 'past') pqFileKey.value++
    if (kind === 'materials') mFileKey.value++
    return
  }

  refVar.value = f
}

function resetUploadMessages() {
  error.value = ''
  ok.value = ''
}

function resetManageMessages() {
  listError.value = ''
}

// ---- Upload handlers ----

async function uploadPastQuestion() {
  resetUploadMessages()
  if (!canAccessUploads.value) return (error.value = 'You do not have upload access yet. Request course-rep access first.')
  if (!courseId.value) return (error.value = 'Choose a course first.')
  if (!pqTitle.value.trim()) return (error.value = 'Past question title is required.')
  if (!pqFile.value) return (error.value = 'Select a file to upload.')

  const fd = new FormData()
  fd.append('courseId', String(courseId.value))
  fd.append('title', pqTitle.value.trim())
  if (pqSession.value.trim()) fd.append('session', pqSession.value.trim())
  if (pqSemester.value.trim()) fd.append('semester', pqSemester.value.trim())
  fd.append('file', pqFile.value)

  busy.value = true
  try {
    await apiFetch('/pastquestions', { method: 'POST', body: fd })
    ok.value = 'Past question uploaded successfully.'
    pqTitle.value = ''
    pqSession.value = ''
    pqSemester.value = ''
    pqFile.value = null
    pqFileKey.value++
    await loadMine() // refresh manage list
  } catch (e) {
    error.value = e?.message || 'Upload failed.'
  } finally {
    busy.value = false
  }
}

async function uploadMaterial() {
  resetUploadMessages()
  if (!canAccessUploads.value) return (error.value = 'You do not have upload access yet. Request course-rep access first.')
  if (!courseId.value) return (error.value = 'Choose a course first.')
  if (!mTitle.value.trim()) return (error.value = 'Material title is required.')
  if (!mFile.value) return (error.value = 'Select a file to upload.')

  const fd = new FormData()
  fd.append('courseId', String(courseId.value))
  fd.append('title', mTitle.value.trim())
  fd.append('type', mType.value || 'pdf')
  const tags = String(mTags.value || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
  if (tags.length) fd.append('tags', JSON.stringify(tags))
  fd.append('file', mFile.value)

  busy.value = true
  try {
    await apiFetch('/materials', { method: 'POST', body: fd })
    ok.value = 'Material uploaded successfully.'
    mTitle.value = ''
    mType.value = 'pdf'
    mTags.value = ''
    mFile.value = null
    mFileKey.value++
    await loadMine() // refresh manage list
  } catch (e) {
    error.value = e?.message || 'Upload failed.'
  } finally {
    busy.value = false
  }
}

// ---- Manage uploads: list/edit/delete ----
//
// IMPORTANT:
// Your current frontend calls /uploader/* endpoints.
// If those endpoints are not available yet on backend, we fall back to /pastquestions and /materials list routes
// (assuming they can accept mine=1 and optional courseId).
//
async function fetchMinePast() {
  const cid = filterCourseId.value || ''
  // 1) preferred
  try {
    const res = await apiFetch(`/uploader/pastquestions${qs({ courseId: cid })}`)
    return normalizeItems(res)
  } catch (e) {
    // 2) fallback
    const res2 = await apiFetch(`/pastquestions${qs({ mine: 1, courseId: cid })}`)
    return normalizeItems(res2)
  }
}

async function fetchMineMaterials() {
  const cid = filterCourseId.value || ''
  // 1) preferred
  try {
    const res = await apiFetch(`/uploader/materials${qs({ courseId: cid })}`)
    return normalizeItems(res)
  } catch (e) {
    // 2) fallback
    const res2 = await apiFetch(`/materials${qs({ mine: 1, courseId: cid })}`)
    return normalizeItems(res2)
  }
}

async function loadMine() {
  resetManageMessages()
  listBusy.value = true
  try {
    const [pq, m] = await Promise.all([fetchMinePast(), fetchMineMaterials()])
    pastItems.value = pq
    materialItems.value = m
  } catch (e) {
    listError.value = e?.message || 'Failed to load uploads.'
  } finally {
    listBusy.value = false
  }
}

function startEdit(kind, item) {
  if (!item) return
  if (kind === 'past') {
    edit.value = {
      kind,
      id: item.id,
      title: item.title || '',
      session: item.session || '',
      semester: item.semester || '',
    }
  } else {
    edit.value = {
      kind,
      id: item.id,
      title: item.title || '',
      type: item.type || 'pdf',
      tags: Array.isArray(item.tags) ? item.tags.join(', ') : (item.tags ? String(item.tags) : ''),
    }
  }
}

function canManageItem(item) {
  // If backend returns only “mine”, this will always be true for course_reps.
  // But if admin sees all, allow admin always, otherwise allow if createdBy matches.
  if (role.value === 'admin') return true
  const createdBy =
    item?.createdBy ?? item?.created_by ?? item?.uploaderId ?? item?.uploader_id ?? item?.userId ?? item?.user_id ?? null
  if (createdBy === null || createdBy === undefined) return true // if not provided, don’t block UI
  return String(createdBy) === meId.value
}

async function saveEdit() {
  if (!edit.value) return
  resetManageMessages()

  // Basic validation
  if (!String(edit.value.title || '').trim()) {
    listError.value = 'Title is required.'
    return
  }

  try {
    if (edit.value.kind === 'past') {
      // NOTE: requires backend support for PATCH.
      await apiFetch('/pastquestions', {
        method: 'PATCH',
        body: {
          id: edit.value.id,
          title: String(edit.value.title || '').trim(),
          session: String(edit.value.session || '').trim(),
          semester: String(edit.value.semester || '').trim(),
        },
      })
    } else {
      const tags = String(edit.value.tags || '')
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)

      // NOTE: requires backend support for PATCH.
      await apiFetch('/materials', {
        method: 'PATCH',
        body: {
          id: edit.value.id,
          title: String(edit.value.title || '').trim(),
          type: edit.value.type || 'pdf',
          tags,
        },
      })
    }

    edit.value = null
    await loadMine()
  } catch (e) {
    const msg = e?.message || 'Update failed.'
    // Friendly hint if backend doesn’t support PATCH yet
    if (/method not allowed|405/i.test(msg)) {
      listError.value = 'Editing is not available yet (API PATCH endpoint not enabled).'
    } else {
      listError.value = msg
    }
  }
}

async function deleteItem(kind, item) {
  if (!item) return
  if (!canManageItem(item)) {
    listError.value = 'You can only manage your own uploads.'
    return
  }
  if (!confirm('Delete this upload? This cannot be undone.')) return

  resetManageMessages()
  try {
    const endpoint = kind === 'past' ? '/pastquestions' : '/materials'
    await apiFetch(`${endpoint}?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' })
    await loadMine()
  } catch (e) {
    const msg = e?.message || 'Delete failed.'
    if (/forbidden|403/i.test(msg)) {
      listError.value = 'You do not have permission to delete this item.'
    } else {
      listError.value = msg
    }
  }
}

function viewUrl(item) {
  return item?.url || item?.fileUrl || item?.file_url || item?.path || ''
}

// ---- Lifecycle ----

onMounted(async () => {
  await catalog.fetchCourses({})

  // If user is rep/admin, ensure course selection is valid
  ensureValidCourseSelection()

  // If no upload access, still show page but don’t crash load
  await loadMine()
})

watch(courseOptions, () => {
  ensureValidCourseSelection()
})

watch(courseId, (next) => {
  // If course changes and user hasn't chosen a manage filter, follow it
  if (!filterCourseId.value && next) filterCourseId.value = next
})

watch(filterCourseId, () => {
  loadMine()
})
</script>

<template>
  <div class="page">
    <!-- Header -->
    <AppCard>
      <div class="row">
        <div class="min-w-0">
          <div class="h1">Uploads</div>
          <p class="sub mt-1">
            Upload past questions and materials. Course reps are restricted to their assigned courses.
          </p>
        </div>
        <RouterLink to="/profile" class="btn btn-ghost">Back</RouterLink>
      </div>

      <div class="divider my-4" />

      <!-- Access gating -->
      <div v-if="!canAccessUploads" class="alert alert-danger" role="alert">
        You don’t have upload access yet. Request course-rep access from your Profile page.
        <div class="mt-3">
          <RouterLink to="/rep/request" class="btn btn-ghost">Request upload access</RouterLink>
        </div>
      </div>

      <div v-else>
        <div v-if="!hasAnyAllowedCourse" class="alert alert-danger" role="alert">
          No assigned courses found for your account yet.
          <div class="mt-2 text-xs text-text-3">
            If you were just approved, refresh your profile or contact an admin to assign courses.
          </div>
        </div>

        <div v-else>
          <label class="label" for="coursePick">Course</label>
          <AppSelect
            id="coursePick"
            v-model="courseId"
            :options="courseOptions"
            placeholder="Select course…"
          />
          <p v-if="role !== 'admin'" class="help">You can only upload to assigned courses.</p>
        </div>

        <div v-if="ok" class="alert alert-ok mt-4" role="status">{{ ok }}</div>
        <div v-if="error" class="alert alert-danger mt-4" role="alert">{{ error }}</div>
      </div>
    </AppCard>

    <!-- Upload area -->
    <AppCard v-if="canAccessUploads && hasAnyAllowedCourse">
      <div class="row">
        <div>
          <div class="h2">Upload</div>
          <p class="sub mt-1">Choose what you want to upload.</p>
        </div>
      </div>

      <div class="divider my-4" />

      <div class="seg">
        <button
          class="seg-btn"
          :class="uploadTab === 'past' ? 'seg-btn--active' : 'seg-btn--inactive'"
          @click="uploadTab = 'past'"
        >Past question</button>
        <button
          class="seg-btn"
          :class="uploadTab === 'materials' ? 'seg-btn--active' : 'seg-btn--inactive'"
          @click="uploadTab = 'materials'"
        >Material</button>
      </div>

      <!-- Past questions -->
      <div v-if="uploadTab === 'past'" class="mt-4">
        <div class="h3">Past question</div>
        <p class="sub mt-1">PDF or image scans. Add session and semester if available.</p>

        <div class="divider my-4" />

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="label">Title</label>
            <input v-model="pqTitle" class="input" placeholder="e.g., CSC 201 Exam" />
          </div>

          <div>
            <label class="label">File</label>
            <input
              :key="pqFileKey"
              type="file"
              class="input"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              @change="onPickFile(pqFile, $event, { kind: 'past' })"
            />
            <p class="help">Max {{ bytesLabel(MAX_BYTES) }}. Accepts PDF / images.</p>
          </div>

          <div>
            <label class="label">Session (optional)</label>
            <input v-model="pqSession" class="input" placeholder="e.g., 2023/2024" />
          </div>

          <div>
            <label class="label">Semester (optional)</label>
            <input v-model="pqSemester" class="input" placeholder="First / Second" />
          </div>
        </div>

        <div class="mt-5">
          <AppButton :disabled="busy" @click="uploadPastQuestion">
            <span v-if="!busy">Upload past question</span>
            <span v-else>Uploading…</span>
          </AppButton>
        </div>
      </div>

      <!-- Materials -->
      <div v-else class="mt-4">
        <div class="h3">Material</div>
        <p class="sub mt-1">Lecture notes, handouts, PDFs.</p>

        <div class="divider my-4" />

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="label">Title</label>
            <input v-model="mTitle" class="input" placeholder="e.g., GST 211 Lecture 3" />
          </div>

          <div>
            <label class="label">File</label>
            <input
              :key="mFileKey"
              type="file"
              class="input"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
              @change="onPickFile(mFile, $event, { kind: 'materials' })"
            />
            <p class="help">Max {{ bytesLabel(MAX_BYTES) }}.</p>
          </div>

          <div>
            <label class="label">Type</label>
            <AppSelect
              v-model="mType"
              :options="[
                { value: 'pdf', label: 'PDF' },
                { value: 'image', label: 'Image' },
                { value: 'doc', label: 'DOC' }
              ]"
            />
          </div>

          <div>
            <label class="label">Tags (comma separated)</label>
            <input v-model="mTags" class="input" placeholder="e.g., revision, week 3" />
          </div>
        </div>

        <div class="mt-5">
          <AppButton :disabled="busy" @click="uploadMaterial">
            <span v-if="!busy">Upload material</span>
            <span v-else>Uploading…</span>
          </AppButton>
        </div>
      </div>
    </AppCard>

    <!-- Manage uploads -->
    <AppCard>
      <div class="row">
        <div>
          <div class="h2">Manage uploads</div>
          <p class="sub mt-1">
            View what you’ve uploaded. Editing/deleting depends on your permissions (admins can manage any upload).
          </p>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-ghost" :disabled="listBusy" @click="loadMine">Refresh</button>
        </div>
      </div>

      <div class="divider my-4" />

      <div class="grid gap-3 sm:grid-cols-3">
        <div class="sm:col-span-1">
          <label class="label">Filter by course</label>
          <AppSelect
            v-model="filterCourseId"
            :options="[{ value: '', label: 'All courses' }, ...courseOptions]"
            placeholder="All courses"
          />
          <p class="help mt-1">Tip: pick a course to narrow your list.</p>
        </div>

        <div class="sm:col-span-2">
          <label class="label">Type</label>
          <div class="seg">
            <button
              class="seg-btn"
              :class="manageTab === 'past' ? 'seg-btn--active' : 'seg-btn--inactive'"
              @click="manageTab = 'past'"
            >Past questions</button>
            <button
              class="seg-btn"
              :class="manageTab === 'materials' ? 'seg-btn--active' : 'seg-btn--inactive'"
              @click="manageTab = 'materials'"
            >Materials</button>
          </div>
        </div>
      </div>

      <div v-if="listError" class="alert alert-danger mt-4" role="alert">{{ listError }}</div>
      <div v-if="listBusy" class="sub mt-4">Loading…</div>

      <div v-else class="mt-4 grid gap-3">
        <!-- Past list -->
        <div v-if="manageTab === 'past'">
          <div v-if="pastItems.length === 0" class="alert alert-ok">No past questions found.</div>

          <div v-else class="grid gap-3">
            <div v-for="p in pastItems" :key="p.id" class="card card-pad">
              <div class="row">
                <div class="min-w-0">
                  <div class="h3 truncate">{{ p.title || 'Untitled' }}</div>

                  <p class="sub mt-1">
                    <span v-if="p.session" class="badge">{{ p.session }}</span>
                    <span v-if="p.semester" class="badge ml-2">{{ p.semester }}</span>
                    <span v-if="p.courseId" class="badge ml-2">{{ p.courseId }}</span>
                  </p>

                  <div v-if="viewUrl(p)" class="mt-2">
                    <a class="btn btn-ghost btn-sm" :href="viewUrl(p)" target="_blank" rel="noreferrer">View file</a>
                  </div>
                </div>

                <div class="flex gap-2">
                  <button class="btn btn-ghost btn-sm" :disabled="!canManageItem(p)" @click="startEdit('past', p)">
                    Edit
                  </button>
                  <button class="btn btn-danger btn-sm" :disabled="!canManageItem(p)" @click="deleteItem('past', p)">
                    Delete
                  </button>
                </div>
              </div>

              <div v-if="edit && edit.kind === 'past' && edit.id === p.id" class="mt-3 grid gap-3 sm:grid-cols-3">
                <div class="sm:col-span-3">
                  <label class="label">Title</label>
                  <input v-model="edit.title" class="input" />
                </div>

                <div>
                  <label class="label">Session</label>
                  <input v-model="edit.session" class="input" placeholder="2023/2024" />
                </div>

                <div>
                  <label class="label">Semester</label>
                  <input v-model="edit.semester" class="input" placeholder="First / Second" />
                </div>

                <div class="flex items-end gap-2 sm:col-span-3">
                  <AppButton class="w-full sm:w-auto" @click="saveEdit">Save</AppButton>
                  <button class="btn btn-ghost w-full sm:w-auto" @click="edit = null">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Materials list -->
        <div v-else>
          <div v-if="materialItems.length === 0" class="alert alert-ok">No materials found.</div>

          <div v-else class="grid gap-3">
            <div v-for="m in materialItems" :key="m.id" class="card card-pad">
              <div class="row">
                <div class="min-w-0">
                  <div class="h3 truncate">{{ m.title || 'Untitled' }}</div>

                  <p class="sub mt-1">
                    <span v-if="m.type" class="badge">{{ m.type }}</span>
                    <span v-if="m.courseId" class="badge ml-2">{{ m.courseId }}</span>
                  </p>

                  <p v-if="(m.tags || []).length" class="sub mt-1">
                    <span class="muted">Tags:</span> {{ (m.tags || []).join(', ') }}
                  </p>

                  <div v-if="viewUrl(m)" class="mt-2">
                    <a class="btn btn-ghost btn-sm" :href="viewUrl(m)" target="_blank" rel="noreferrer">View file</a>
                  </div>
                </div>

                <div class="flex gap-2">
                  <button class="btn btn-ghost btn-sm" :disabled="!canManageItem(m)" @click="startEdit('materials', m)">
                    Edit
                  </button>
                  <button class="btn btn-danger btn-sm" :disabled="!canManageItem(m)" @click="deleteItem('materials', m)">
                    Delete
                  </button>
                </div>
              </div>

              <div v-if="edit && edit.kind === 'materials' && edit.id === m.id" class="mt-3 grid gap-3 sm:grid-cols-3">
                <div class="sm:col-span-3">
                  <label class="label">Title</label>
                  <input v-model="edit.title" class="input" />
                </div>

                <div>
                  <label class="label">Type</label>
                  <AppSelect
                    v-model="edit.type"
                    :options="[
                      { value: 'pdf', label: 'PDF' },
                      { value: 'image', label: 'Image' },
                      { value: 'doc', label: 'DOC' }
                    ]"
                  />
                </div>

                <div class="sm:col-span-2">
                  <label class="label">Tags</label>
                  <input v-model="edit.tags" class="input" placeholder="revision, week 3" />
                </div>

                <div class="flex items-end gap-2 sm:col-span-3">
                  <AppButton class="w-full sm:w-auto" @click="saveEdit">Save</AppButton>
                  <button class="btn btn-ghost w-full sm:w-auto" @click="edit = null">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </AppCard>
  </div>
</template>
