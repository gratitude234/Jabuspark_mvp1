export const faculties = [
  { id: 'cnas', name: 'College of Natural & Agricultural Sciences' },
  { id: 'colaw', name: 'College of Law' },
  { id: 'comas', name: 'College of Management & Social Sciences' },
  { id: 'cosas', name: 'College of Social & Applied Sciences' },
  { id: 'cophas', name: 'College of Public Health & Allied Sciences' },
]

export const departments = [
  { id: 'csc', facultyId: 'cnas', name: 'Computer Science' },
  { id: 'bch', facultyId: 'cnas', name: 'Biochemistry' },
  { id: 'ags', facultyId: 'cnas', name: 'Agricultural Science' },
  { id: 'fnt', facultyId: 'cnas', name: 'Food Science & Nutrition' },

  { id: 'law', facultyId: 'colaw', name: 'Law' },

  { id: 'acc', facultyId: 'comas', name: 'Accounting' },
  { id: 'bus', facultyId: 'comas', name: 'Business Administration' },
  { id: 'eco', facultyId: 'comas', name: 'Economics' },

  { id: 'mcb', facultyId: 'cosas', name: 'Microbiology' },
  { id: 'ict', facultyId: 'cosas', name: 'Information & Communication Technology' },

  { id: 'nur', facultyId: 'cophas', name: 'Nursing Science' },
  { id: 'medlab', facultyId: 'cophas', name: 'Medical Laboratory Science' },
]

export const courses = [
  { id: 'gst211', deptIds: ['csc','bch','ags','fnt','law','acc','bus','eco','mcb','ict','nur','medlab'], code: 'GST 211', title: 'Communication in English', level: 200 },
  { id: 'gst212', deptIds: ['csc','bch','ags','fnt','law','acc','bus','eco','mcb','ict','nur','medlab'], code: 'GST 212', title: 'Philosophy & Logic', level: 200 },
  { id: 'csc201', deptIds: ['csc'], code: 'CSC 201', title: 'Data Structures', level: 200 },
  { id: 'bch201', deptIds: ['bch'], code: 'BCH 201', title: 'Biochemistry I', level: 200 },
  { id: 'nsc201', deptIds: ['nur'], code: 'NSC 201', title: 'Fundamentals of Nursing', level: 200 },
  { id: 'law201', deptIds: ['law'], code: 'LAW 201', title: 'Constitutional Law I', level: 200 },
]
