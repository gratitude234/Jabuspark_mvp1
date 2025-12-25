<script setup>
import { computed, onMounted, ref } from 'vue'
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
  </div>
</template>
