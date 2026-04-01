import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import Enrollment from '../models/Enrollment.js'
import Student from '../models/Student.js'
import Course from '../models/Course.js'

const router = Router()

const enrollmentSchema = z.object({
  studentId: z.string().min(1),
  courseId: z.string().min(1)
})

// POST /api/enrollments - Enroll student in course
router.post('/', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const parsed = enrollmentSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error })
  }

  // Check if student exists
  const student = await Student.findById(parsed.data.studentId)
  if (!student) {
    return res.status(404).json({ error: 'Student not found' })
  }

  // Check if course exists
  const course = await Course.findById(parsed.data.courseId)
  if (!course) {
    return res.status(404).json({ error: 'Course not found' })
  }

  // Check if already enrolled
  const existing = await Enrollment.findOne(parsed.data)
  if (existing) {
    return res.status(400).json({ error: 'Student already enrolled in this course' })
  }

  const enrollment = await Enrollment.create(parsed.data)
  return res.status(201).json(enrollment)
})

// GET /api/enrollments - List enrollments
router.get('/', requireAuth, async (req, res) => {
  const { studentId, courseId, page = 1, limit = 100 } = req.query
  const skip = (parseInt(page) - 1) * parseInt(limit)

  const filter = {}
  if (studentId) filter.studentId = studentId
  if (courseId) filter.courseId = courseId

  const [enrollments, total] = await Promise.all([
    Enrollment.find(filter)
      .populate('studentId', 'name email')
      .populate('courseId', 'code title')
      .sort({ enrollmentDate: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Enrollment.countDocuments(filter)
  ])

  return res.json({
    enrollments,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    }
  })
})

// GET /api/enrollments/:id - Get specific enrollment
router.get('/:id', requireAuth, async (req, res) => {
  const enrollment = await Enrollment.findById(req.params.id)
    .populate('studentId', 'name email')
    .populate('courseId', 'code title')

  if (!enrollment) {
    return res.status(404).json({ error: 'Enrollment not found' })
  }

  return res.json(enrollment)
})

// DELETE /api/enrollments/:id - Drop enrollment (unenroll)
router.delete('/:id', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const enrollment = await Enrollment.findByIdAndDelete(req.params.id)
  if (!enrollment) {
    return res.status(404).json({ error: 'Enrollment not found' })
  }
  return res.json({ message: 'Enrollment deleted successfully' })
})

// GET /api/enrollments/student/:studentId/courses - Get all courses for a student
router.get('/student/:studentId/courses', requireAuth, async (req, res) => {
  const enrollments = await Enrollment.find({ studentId: req.params.studentId })
    .populate('courseId')
    .sort({ enrollmentDate: -1 })

  const courses = enrollments.map(e => e.courseId)
  return res.json({ courses, total: courses.length })
})

// GET /api/enrollments/course/:courseId/students - Get all students in a course
router.get('/course/:courseId/students', requireAuth, async (req, res) => {
  const enrollments = await Enrollment.find({ courseId: req.params.courseId })
    .populate('studentId')
    .sort({ enrollmentDate: -1 })

  const students = enrollments.map(e => e.studentId)
  return res.json({ students, total: students.length })
})

// POST /api/enrollments/bulk - Bulk enroll students (admin only)
router.post('/bulk', requireAuth, requireRole('admin'), async (req, res) => {
  const { studentIds, courseId } = req.body

  if (!Array.isArray(studentIds) || !courseId) {
    return res.status(400).json({ error: 'studentIds (array) and courseId required' })
  }

  const enrollments = []
  const errors = []

  for (const studentId of studentIds) {
    try {
      // Check if already enrolled
      const existing = await Enrollment.findOne({ studentId, courseId })
      if (!existing) {
        const enrollment = await Enrollment.create({ studentId, courseId })
        enrollments.push(enrollment)
      } else {
        errors.push({ studentId, error: 'Already enrolled' })
      }
    } catch (error) {
      errors.push({ studentId, error: error.message })
    }
  }

  return res.json({
    success: enrollments.length,
    failed: errors.length,
    enrollments,
    errors
  })
})

export default router
