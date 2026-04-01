import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import Grade from '../models/Grade.js'
import Student from '../models/Student.js'
import Course from '../models/Course.js'

const router = Router()

const createGradeSchema = z.object({
  studentId: z.string().min(1),
  courseId: z.string().min(1),
  assignmentId: z.string().optional(),
  score: z.number().min(0),
  maxScore: z.number().min(1),
  weight: z.number().min(0).optional(),
  gradeType: z.enum(['assignment', 'quiz', 'exam', 'project', 'participation', 'final', 'midterm']).optional(),
  feedback: z.string().optional()
})

// POST /api/grades - Create grade (instructor/admin)
router.post('/', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const parsed = createGradeSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error })
  }

  const grade = await Grade.create({
    ...parsed.data,
    gradedBy: req.user.id
  })

  return res.status(201).json(grade)
})

// GET /api/grades - List all grades (with filters)
router.get('/', requireAuth, async (req, res) => {
  const { studentId, courseId, gradeType, page = 1, limit = 50 } = req.query
  const skip = (parseInt(page) - 1) * parseInt(limit)

  const filter = {}
  // Students can only see their own grades
  if (req.user.role === 'student') {
    filter.studentId = req.user.studentId
  } else if (studentId) {
    filter.studentId = studentId
  }
  if (courseId) filter.courseId = courseId
  if (gradeType) filter.gradeType = gradeType

  const [grades, total] = await Promise.all([
    Grade.find(filter)
      .populate('studentId', 'name email')
      .populate('courseId', 'code title')
      .populate('assignmentId', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Grade.countDocuments(filter)
  ])

  return res.json({
    grades,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    }
  })
})

// GET /api/grades/:id - Get specific grade
router.get('/:id', requireAuth, async (req, res) => {
  const grade = await Grade.findById(req.params.id)
    .populate('studentId', 'name email')
    .populate('courseId', 'code title')
    .populate('assignmentId', 'title dueDate')
    .populate('gradedBy', 'email')

  if (!grade) {
    return res.status(404).json({ error: 'Grade not found' })
  }

  return res.json(grade)
})

// PATCH /api/grades/:id - Update grade (instructor/admin)
router.patch('/:id', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const updates = req.body
  const allowedUpdates = ['score', 'maxScore', 'weight', 'feedback', 'letterGrade']
  const filteredUpdates = {}

  for (const key of allowedUpdates) {
    if (updates[key] !== undefined) {
      filteredUpdates[key] = updates[key]
    }
  }

  const grade = await Grade.findByIdAndUpdate(
    req.params.id,
    filteredUpdates,
    { new: true, runValidators: true }
  )

  if (!grade) {
    return res.status(404).json({ error: 'Grade not found' })
  }

  return res.json(grade)
})

// DELETE /api/grades/:id - Delete grade (admin only)
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const grade = await Grade.findByIdAndDelete(req.params.id)
  if (!grade) {
    return res.status(404).json({ error: 'Grade not found' })
  }
  return res.json({ message: 'Grade deleted successfully' })
})

// GET /api/grades/student/:studentId/gpa - Calculate student GPA
router.get('/student/:studentId/gpa', requireAuth, async (req, res) => {
  const { courseId } = req.query // Optional: GPA for specific course

  const filter = { studentId: req.params.studentId }
  if (courseId) filter.courseId = courseId

  const grades = await Grade.find(filter)

  if (grades.length === 0) {
    return res.json({ gpa: 0, totalGrades: 0, letterGrade: 'N/A' })
  }

  // Calculate weighted GPA
  let totalWeightedScore = 0
  let totalWeight = 0

  grades.forEach(grade => {
    const percentage = (grade.score / grade.maxScore) * 100
    const weight = grade.weight || 1
    totalWeightedScore += percentage * weight
    totalWeight += weight
  })

  const gpa = totalWeight > 0 ? (totalWeightedScore / totalWeight) / 25 : 0 // Convert to 4.0 scale
  const percentage = totalWeight > 0 ? totalWeightedScore / totalWeight : 0

  // Calculate letter grade
  let letterGrade = 'F'
  if (percentage >= 93) letterGrade = 'A'
  else if (percentage >= 90) letterGrade = 'A-'
  else if (percentage >= 87) letterGrade = 'B+'
  else if (percentage >= 83) letterGrade = 'B'
  else if (percentage >= 80) letterGrade = 'B-'
  else if (percentage >= 77) letterGrade = 'C+'
  else if (percentage >= 73) letterGrade = 'C'
  else if (percentage >= 70) letterGrade = 'C-'
  else if (percentage >= 60) letterGrade = 'D'

  return res.json({
    gpa: parseFloat(gpa.toFixed(2)),
    percentage: parseFloat(percentage.toFixed(2)),
    letterGrade,
    totalGrades: grades.length,
    totalWeight
  })
})

// GET /api/grades/student/:studentId/trends - Grade trends over time
router.get('/student/:studentId/trends', requireAuth, async (req, res) => {
  const { days = 30, courseId } = req.query
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - parseInt(days))

  const filter = {
    studentId: req.params.studentId,
    createdAt: { $gte: startDate }
  }
  if (courseId) filter.courseId = courseId

  const grades = await Grade.find(filter)
    .populate('courseId', 'code title')
    .sort({ createdAt: 1 })

  const trends = grades.map(grade => ({
    date: grade.createdAt,
    percentage: (grade.score / grade.maxScore) * 100,
    letterGrade: grade.letterGrade,
    courseCode: grade.courseId?.code,
    gradeType: grade.gradeType
  }))

  // Calculate trajectory (improving, declining, stable)
  let trajectory = 'stable'
  if (grades.length >= 3) {
    const recent = grades.slice(-3).map(g => (g.score / g.maxScore) * 100)
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length
    const older = grades.slice(0, -3).map(g => (g.score / g.maxScore) * 100)
    const avgOlder = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : avgRecent

    if (avgRecent > avgOlder + 5) trajectory = 'improving'
    else if (avgRecent < avgOlder - 5) trajectory = 'declining'
  }

  return res.json({
    trends,
    trajectory,
    totalGrades: grades.length,
    dateRange: { start: startDate, end: new Date() }
  })
})

// GET /api/grades/course/:courseId/statistics - Course grade statistics
router.get('/course/:courseId/statistics', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const grades = await Grade.find({ courseId: req.params.courseId })

  if (grades.length === 0) {
    return res.json({ message: 'No grades found for this course' })
  }

  const percentages = grades.map(g => (g.score / g.maxScore) * 100)
  const average = percentages.reduce((a, b) => a + b, 0) / percentages.length
  const sorted = [...percentages].sort((a, b) => a - b)
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)]

  const variance = percentages.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / percentages.length
  const stdDev = Math.sqrt(variance)

  // Grade distribution
  const distribution = {
    'A': grades.filter(g => g.letterGrade && g.letterGrade.startsWith('A')).length,
    'B': grades.filter(g => g.letterGrade && g.letterGrade.startsWith('B')).length,
    'C': grades.filter(g => g.letterGrade && g.letterGrade.startsWith('C')).length,
    'D': grades.filter(g => g.letterGrade === 'D').length,
    'F': grades.filter(g => g.letterGrade === 'F').length
  }

  return res.json({
    totalGrades: grades.length,
    average: parseFloat(average.toFixed(2)),
    median: parseFloat(median.toFixed(2)),
    standardDeviation: parseFloat(stdDev.toFixed(2)),
    min: parseFloat(Math.min(...percentages).toFixed(2)),
    max: parseFloat(Math.max(...percentages).toFixed(2)),
    distribution
  })
})

export default router
