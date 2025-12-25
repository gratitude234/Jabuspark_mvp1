<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useCatalogStore } from '../stores/catalog'
import AppCard from '../components/AppCard.vue'
import AppSelect from '../components/AppSelect.vue'
import AppButton from '../components/AppButton.vue'

const router = useRouter()
const auth = useAuthStore()
const catalog = useCatalogStore()

const user = computed(() => auth.user || {})
const profile = computed(() => user.value.profile || {})
const role = computed(() => user.value.role || 'student')
const repCourseIds = computed(() => profile.value.repCourseIds || [])

const fullName = ref(user.value.fullName || '')
const facultyId = ref(profile.value.facultyId || null)
const departmentId = ref(profile.value.departmentId || null)
const level = ref(profile.value.level || 200)
const pickedCourseIds = ref([...(profile.value.courseIds || [])])

const busy = ref(false)
const error = ref('')
const savedOk = ref(false)

const levelOptions = [
  { value: 100, label: '100 Level' },
  { value: 200, label: '200 Level' },
  { value: 300, label: '300 Level' },
  { value: 400, label: '400 Level' },
  { value: 500, label: '500 Level' },
  { value: 600, label: '600 Level' },
]

const facultyOptions = computed(() => (catalog.faculties || []).map(f => ({ value: f.id, label: f.name })))
const departmentOptions = computed(() => (catalog.departments || []).map(d => ({ value: d.id, label: d.name })))

const courseOptions = computed(() => (catalog.courses || []).map(c => ({
  id: c.id,
  label: `${c.code} — ${c.title} (${c.level})`
})))

function toggleCourse(id) {
  const i = pickedCourseIds.value.indexOf(id)
  if (i >= 0) pickedCourseIds.value.splice(i, 1)
  else pickedCourseIds.value.push(id)
}

watch(facultyId, async (next) => {
  departmentId.value = null
  pickedCourseIds.value = []
  if (!next) return
  await catalog.fetchDepartments({ facultyId: next })
})

watch([departmentId, level], async ([dept, lvl]) => {
  pickedCourseIds.value = []
  if (!dept) return
  await catalog.fetchCourses({ departmentId: dept, level: Number(lvl) || 0 })
})

onMounted(async () => {
  await catalog.bootstrap()
  if (facultyId.value) await catalog.fetchDepartments({ facultyId: facultyId.value })
  if (departmentId.value) await catalog.fetchCourses({ departmentId: departmentId.value, level: Number(level.value) || 0 })
})

async function save() {
  error.value = ''
  savedOk.value = false

  const n = (fullName.value || '').trim()
  if (!n) return (error.value = 'Full name is required.')
  if (!facultyId.value) return (error.value = 'Choose a faculty to continue.')
  if (!departmentId.value) return (error.value = 'Choose a department to continue.')
  if (!level.value) return (error.value = 'Choose your level to continue.')

  busy.value = true
  try {
    // Keep current auth logic: update profile + name
    await auth.updateProfile({
      fullName: n,
      facultyId: facultyId.value,
      departmentId: departmentId.value,
      level: Number(level.value),
      courseIds: pickedCourseIds.value,
    })
    savedOk.value = true
  } catch (e) {
    error.value = e?.message || 'Failed to save changes.'
  } finally {
    busy.value = false
  }
}

async function logout() {
  await auth.logout()
  router.push('/auth/login')
}
</script>

<template>
  <div class="page">
    <AppCard class="relative overflow-hidden">
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/12 via-transparent to-transparent" />
      <div class="relative">
        <div class="h1">Profile</div>
        <p class="sub mt-1">Update your study profile and account details.</p>

        <div class="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label class="label" for="pname">Full name</label>
            <input
              id="pname"
              v-model="fullName"
              class="input"
              autocomplete="name"
              placeholder="Your full name"
            />
            <p class="help">Used for your dashboard greeting.</p>
          </div>

          <div class="flex flex-col sm:items-end sm:justify-end gap-2">
            <AppButton class="w-full sm:w-auto" :disabled="busy" @click="save">
              <span v-if="!busy">Save changes</span>
              <span v-else>Saving…</span>
            </AppButton>
            <button class="btn btn-ghost w-full sm:w-auto" @click="logout">Log out</button>
          </div>
        </div>

        <div v-if="savedOk" class="alert alert-ok mt-4" role="status">Saved successfully.</div>
        <div v-if="error" class="alert alert-danger mt-4" role="alert">{{ error }}</div>
      </div>
    </AppCard>

    <AppCard>
      <div class="h2">Study settings</div>
      <p class="sub mt-1">This controls what content you see by default.</p>

      <div class="divider my-4" />

      <div class="grid gap-4 sm:grid-cols-3">
        <div>
          <label class="label" for="pfac">Faculty</label>
          <AppSelect id="pfac" v-model="facultyId" :options="facultyOptions" placeholder="Select faculty…" />
          <p v-if="catalog.loading.faculties" class="help">Loading…</p>
        </div>

        <div>
          <label class="label" for="pdept">Department</label>
          <AppSelect id="pdept" v-model="departmentId" :options="departmentOptions" placeholder="Select department…" />
          <p v-if="catalog.loading.departments" class="help">Loading…</p>
        </div>

        <div>
          <label class="label" for="plevel">Level</label>
          <AppSelect id="plevel" v-model="level" :options="levelOptions" placeholder="Select level…" />
        </div>
      </div>

      <div class="divider my-6" />

      <div class="row">
        <div>
          <div class="h2">Courses</div>
          <p class="sub mt-1">Choose courses to personalise practice and filters.</p>
        </div>
        <span class="badge">{{ pickedCourseIds.length }} selected</span>
      </div>

      <div class="mt-3">
        <p v-if="catalog.loading.courses" class="sub">Loading courses…</p>
        <div v-else-if="courseOptions.length === 0" class="alert alert-ok" role="status">
          Select a department (and level) to load courses.
        </div>

        <div v-else class="grid gap-2 sm:grid-cols-2">
          <button
            v-for="c in courseOptions"
            :key="c.id"
            type="button"
            class="card card-press card-pad text-left"
            :class="pickedCourseIds.includes(c.id) ? 'ring-2 ring-accent/50' : ''"
            @click="toggleCourse(c.id)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-extrabold truncate">{{ c.label }}</div>
                <div class="text-xs text-text-3 mt-1">
                  {{ pickedCourseIds.includes(c.id) ? 'Selected' : 'Tap to select' }}
                </div>
              </div>
              <span class="badge" :class="pickedCourseIds.includes(c.id) ? 'bg-accent/15 border-accent/30 text-text' : ''">
                {{ pickedCourseIds.includes(c.id) ? '✓' : '+' }}
              </span>
            </div>
          </button>
        </div>
      </div>
    </AppCard>

    <AppCard>
      <div class="h2">Account</div>
      <p class="sub mt-1">Manage your session and app state.</p>

      <div class="divider my-4" />

      <div class="flex flex-col sm:flex-row gap-2">
        <RouterLink to="/dashboard" class="btn btn-ghost">Back to dashboard</RouterLink>
        <RouterLink to="/saved" class="btn btn-ghost">Saved</RouterLink>
      </div>
    </AppCard>

    <AppCard>
      <div class="h2">Admin & Uploads</div>
      <p class="sub mt-1">Your current role: <span class="font-bold text-text">{{ role }}</span></p>

      <div class="divider my-4" />

      <div v-if="role === 'admin'" class="flex flex-col sm:flex-row gap-2">
        <RouterLink to="/admin/rep-requests" class="btn btn-ghost">Review rep requests</RouterLink>
        <RouterLink to="/uploads" class="btn btn-ghost">Open uploads</RouterLink>
      </div>

      <div v-else-if="role === 'course_rep'" class="">
        <div class="alert alert-ok" role="status">
          You are approved to upload.
        </div>
        <div class="mt-3 flex flex-col sm:flex-row gap-2">
          <RouterLink to="/uploads" class="btn btn-ghost">Open uploads</RouterLink>
          <RouterLink to="/past-questions" class="btn btn-ghost">View past questions</RouterLink>
        </div>
        <div class="mt-4">
          <div class="text-xs text-text-3 mb-2">Assigned courses</div>
          <div v-if="repCourseIds.length" class="flex flex-wrap gap-2">
            <span v-for="cid in repCourseIds" :key="cid" class="badge">{{ cid }}</span>
          </div>
          <div v-else class="sub">No assigned courses found. Ask an admin to assign courses to your account.</div>
        </div>
      </div>

      <div v-else>
        <div class="alert alert-ok" role="status">
          Want to help your department? Request course rep access to upload past questions and materials.
        </div>
        <div class="mt-3 flex flex-col sm:flex-row gap-2">
          <RouterLink to="/rep/request" class="btn btn-ghost">Request course rep access</RouterLink>
        </div>
      </div>
    </AppCard>
  </div>
</template>
