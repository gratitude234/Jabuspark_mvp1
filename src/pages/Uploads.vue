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
const repCourseIds = computed(() => auth.user?.profile?.repCourseIds || [])

const courseId = ref('')

// Past questions form
const pqTitle = ref('')
const pqSession = ref('')
const pqSemester = ref('')
const pqFile = ref(null)

// Materials form
const mTitle = ref('')
const mType = ref('pdf')
const mTags = ref('')
const mFile = ref(null)

const busy = ref(false)
const error = ref('')
const ok = ref('')

// Upload management (edit/delete)
const tab = ref('past') // 'past' | 'materials'
const listBusy = ref(false)
const listError = ref('')
const filterCourseId = ref('') // optional filter for "manage" section
const pastItems = ref([])
const materialItems = ref([])

const edit = ref(null) // { kind, id, title, session, semester, type, tags }

function qs(params) {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v === null || v === undefined) return
    const s = String(v)
    if (s.trim() === '') return
    sp.set(k, s)
  })
  const str = sp.toString()
  return str ? `?${str}` : ''
}

async function loadMine() {
  listError.value = ''
  listBusy.value = true
  try {
    const pq = await apiFetch(`/uploader/pastquestions${qs({ courseId: filterCourseId.value || '' })}`)
    pastItems.value = pq?.data?.items || []
    const m = await apiFetch(`/uploader/materials${qs({ courseId: filterCourseId.value || '' })}`)
    materialItems.value = m?.data?.items || []
  } catch (e) {
    listError.value = e?.message || 'Failed to load uploads.'
  } finally {
    listBusy.value = false
  }
}

function startEdit(kind, item) {
  if (kind === 'past') {
    edit.value = {
      kind,
      id: item.id,
      title: item.title || '',
      session: item.session || '',
      semester: item.semester || ''
    }
  } else {
    edit.value = {
      kind,
      id: item.id,
      title: item.title || '',
      type: item.type || 'pdf',
      tags: Array.isArray(item.tags) ? item.tags.join(', ') : ''
    }
  }
}

async function saveEdit() {
  if (!edit.value) return
  listError.value = ''
  try {
    if (edit.value.kind === 'past') {
      await apiFetch('/pastquestions', {
        method: 'PATCH',
        body: {
          id: edit.value.id,
          title: edit.value.title,
          session: edit.value.session,
          semester: edit.value.semester,
        }
      })
    } else {
      const tags = String(edit.value.tags || '')
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
      await apiFetch('/materials', {
        method: 'PATCH',
        body: {
          id: edit.value.id,
          title: edit.value.title,
          type: edit.value.type,
          tags,
        }
      })
    }
    edit.value = null
    await loadMine()
  } catch (e) {
    listError.value = e?.message || 'Update failed.'
  }
}

async function deleteItem(kind, item) {
  if (!confirm('Delete this upload? This cannot be undone.')) return
  listError.value = ''
  try {
    const endpoint = kind === 'past' ? '/pastquestions' : '/materials'
    await apiFetch(`${endpoint}?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' })
    await loadMine()
  } catch (e) {
    listError.value = e?.message || 'Delete failed.'
  }
}

const courseOptions = computed(() => {
  const all = (catalog.courses || []).map(c => ({ value: c.id, label: `${c.code} — ${c.title} (${c.level})` }))
  if (role.value === 'admin') return all
  // course_rep: only allow assigned courses
  return all.filter(c => repCourseIds.value.includes(c.value))
})

function onPickFile(refVar, evt) {
  const f = evt?.target?.files?.[0] || null
  refVar.value = f
}

async function uploadPastQuestion() {
  error.value = ''
  ok.value = ''
  if (!courseId.value) return (error.value = 'Choose a course first.')
  if (!pqTitle.value.trim()) return (error.value = 'Past question title is required.')
  if (!pqFile.value) return (error.value = 'Select a file to upload.')

  const fd = new FormData()
  fd.append('courseId', courseId.value)
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
  } catch (e) {
    error.value = e?.message || 'Upload failed.'
  } finally {
    busy.value = false
  }
}

async function uploadMaterial() {
  error.value = ''
  ok.value = ''
  if (!courseId.value) return (error.value = 'Choose a course first.')
  if (!mTitle.value.trim()) return (error.value = 'Material title is required.')
  if (!mFile.value) return (error.value = 'Select a file to upload.')

  const fd = new FormData()
  fd.append('courseId', courseId.value)
  fd.append('title', mTitle.value.trim())
  fd.append('type', mType.value)
  const tags = mTags.value
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
  } catch (e) {
    error.value = e?.message || 'Upload failed.'
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  await catalog.fetchCourses({})
  // default selection: first allowed course
  if (!courseId.value && courseOptions.value.length) {
    courseId.value = courseOptions.value[0].value
  }

  // Default filter follows selected course for convenience
  if (!filterCourseId.value && courseId.value) filterCourseId.value = courseId.value
  await loadMine()
})

watch(filterCourseId, () => {
  loadMine()
})
</script>

<template>
  <div class="page">
    <AppCard>
      <div class="row">
        <div>
          <div class="h1">Uploads</div>
          <p class="sub mt-1">Upload past questions and materials. Course reps are restricted to their assigned courses.</p>
        </div>
        <RouterLink to="/profile" class="btn btn-ghost">Back</RouterLink>
      </div>

      <div class="divider my-4" />

      <div>
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
    </AppCard>

    <AppCard>
      <div class="h2">Upload Past Question</div>
      <p class="sub mt-1">PDF or image scans. Add session and semester if available.</p>

      <div class="divider my-4" />

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label">Title</label>
          <input v-model="pqTitle" class="input" placeholder="e.g., CSC 201 Exam" />
        </div>
        <div>
          <label class="label">File</label>
          <input type="file" class="input" @change="onPickFile(pqFile, $event)" />
          <p class="help">Max 50MB.</p>
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
    </AppCard>

    <AppCard>
      <div class="h2">Upload Material</div>
      <p class="sub mt-1">Lecture notes, handouts, PDFs.</p>

      <div class="divider my-4" />

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label">Title</label>
          <input v-model="mTitle" class="input" placeholder="e.g., GST 211 Lecture 3" />
        </div>
        <div>
          <label class="label">File</label>
          <input type="file" class="input" @change="onPickFile(mFile, $event)" />
          <p class="help">Max 50MB.</p>
        </div>
        <div>
          <label class="label">Type</label>
          <AppSelect v-model="mType" :options="[{value:'pdf',label:'PDF'},{value:'image',label:'Image'},{value:'doc',label:'DOC'}]" />
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
    </AppCard>

    <!-- Manage uploads (edit / delete) -->
    <AppCard>
      <div class="row">
        <div>
          <div class="h2">Manage uploads</div>
          <p class="sub mt-1">Course reps can edit/delete only their own uploads. Admins can manage any upload.</p>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-ghost" :disabled="listBusy" @click="loadMine">Refresh</button>
        </div>
      </div>

      <div class="divider my-4" />

      <div class="grid gap-3 sm:grid-cols-3">
        <div class="sm:col-span-1">
          <label class="label">Filter by course</label>
          <AppSelect v-model="filterCourseId" :options="[{value:'',label:'All courses'}, ...courseOptions]" />
          <p class="help mt-1">Tip: pick a course to narrow your list.</p>
        </div>
        <div class="sm:col-span-2">
          <label class="label">Type</label>
          <div class="seg">
            <button
              class="seg-btn"
              :class="tab === 'past' ? 'seg-btn--active' : 'seg-btn--inactive'"
              @click="tab = 'past'"
            >Past questions</button>
            <button
              class="seg-btn"
              :class="tab === 'materials' ? 'seg-btn--active' : 'seg-btn--inactive'"
              @click="tab = 'materials'"
            >Materials</button>
          </div>
        </div>
      </div>

      <div v-if="listError" class="alert alert-danger mt-4" role="alert">{{ listError }}</div>

      <div v-if="listBusy" class="sub mt-4">Loading…</div>

      <div v-else class="mt-4 grid gap-3">
        <div v-if="tab === 'past'">
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
                </div>
                <div class="flex gap-2">
                  <button class="btn btn-ghost btn-sm" @click="startEdit('past', p)">Edit</button>
                  <button class="btn btn-danger btn-sm" @click="deleteItem('past', p)">Delete</button>
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
                <div class="flex items-end gap-2">
                  <AppButton class="w-full" @click="saveEdit">Save</AppButton>
                  <button class="btn btn-ghost w-full" @click="edit=null">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </div>

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
                </div>
                <div class="flex gap-2">
                  <button class="btn btn-ghost btn-sm" @click="startEdit('materials', m)">Edit</button>
                  <button class="btn btn-danger btn-sm" @click="deleteItem('materials', m)">Delete</button>
                </div>
              </div>

              <div v-if="edit && edit.kind === 'materials' && edit.id === m.id" class="mt-3 grid gap-3 sm:grid-cols-3">
                <div class="sm:col-span-3">
                  <label class="label">Title</label>
                  <input v-model="edit.title" class="input" />
                </div>
                <div>
                  <label class="label">Type</label>
                  <AppSelect v-model="edit.type" :options="[{value:'pdf',label:'PDF'},{value:'image',label:'Image'},{value:'doc',label:'DOC'}]" />
                </div>
                <div class="sm:col-span-2">
                  <label class="label">Tags</label>
                  <input v-model="edit.tags" class="input" placeholder="revision, week 3" />
                </div>
                <div class="flex items-end gap-2 sm:col-span-3">
                  <AppButton class="w-full sm:w-auto" @click="saveEdit">Save</AppButton>
                  <button class="btn btn-ghost w-full sm:w-auto" @click="edit=null">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppCard>
  </div>
</template>
