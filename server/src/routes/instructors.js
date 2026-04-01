import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import Instructor from '../models/Instructor.js'
import Course from '../models/Course.js'
import Student from '../models/Student.js'
import Enrollment from '../models/Enrollment.js'
import Grade from '../models/Grade.js'

const router = Router()

const createInstructorSchema = z.object({
  userId: z.string().min(1),
  department: z.string().optional()
})

// POST /api/instructors - Create instructor profile (admin only)
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const parsed = createInstructorSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error })
  }

  const instructor = await Instructor.create(parsed.data)
  return res.status(201).json(instructor)
})

// GET /api/instructors - List all instructors
router.get('/', requireAuth, async (req, res) => {
  const { department, page = 1, limit = 50 } = req.query
  const skip = (parseInt(page) - 1) * parseInt(limit)

  const filter = {}
  if (department) filter.department = department

  const [instructors, total] = await Promise.all([
    Instructor.find(filter)
      .populate('userId', 'email name')
      .skip(skip)
      .limit(parseInt(limit)),
    Instructor.countDocuments(filter)
  ])

  return res.json({
    instructors,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    }
  })
})

// GET /api/instructors/:id - Get specific instructor
router.get('/:id', requireAuth, async (req, res) => {
  const instructor = await Instructor.findById(req.params.id)
    .populate('userId', 'email name')

  if (!instructor) {
    return res.status(404).json({ error: 'Instructor not found' })
  }

  // Get courses taught by this instructor
  const courses = await Course.find({ instructorId: req.params.id })

  return res.json({ instructor, courses, totalCourses: courses.length })
})

// PATCH /api/instructors/:id - Update instructor (admin only)
router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const instructor = await Instructor.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  )

  if (!instructor) {
    return res.status(404).json({ error: 'Instructor not found' })
  }

  return res.json(instructor)
})

// DELETE /api/instructors/:id - Delete instructor (admin only)
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const instructor = await Instructor.findByIdAndDelete(req.params.id)
  if (!instructor) {
    return res.status(404).json({ error: 'Instructor not found' })
  }
  return res.json({ message: 'Instructor deleted successfully' })
})

// GET /api/instructors/:id/courses - Get courses taught by instructor
router.get('/:id/courses', requireAuth, async (req, res) => {
  const courses = await Course.find({ instructorId: req.params.id })

  return res.json({ courses, total: courses.length })
})

// GET /api/instructors/:id/students - Get all students taught by instructor
router.get('/:id/students', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  // Get all courses taught by instructor
  const courses = await Course.find({ instructorId: req.params.id })
  const courseIds = courses.map(c => c._id)

  // Get all enrollments in these courses
  const enrollments = await Enrollment.find({ courseId: { $in: courseIds } })
    .populate('studentId')
    .populate('courseId', 'code title')

  const students = enrollments.map(e => ({
    student: e.studentId,
    course: e.courseId,
    enrollmentDate: e.enrollmentDate
  }))

  return res.json({ students, total: students.length })
})

// GET /api/instructors/:id/dashboard - Instructor dashboard summary
router.get('/:id/dashboard', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  // Get courses
  const courses = await Course.find({ instructorId: req.params.id })
  const courseIds = courses.map(c => c._id)

  // Get total students
  const enrollments = await Enrollment.find({ courseId: { $in: courseIds } })
  const uniqueStudentIds = [...new Set(enrollments.map(e => e.studentId.toString()))]

  // Get recent grades
  const recentGrades = await Grade.find({ courseId: { $in: courseIds } })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('studentId', 'name')
    .populate('courseId', 'code')

  return res.json({
    totalCourses: courses.length,
    totalStudents: uniqueStudentIds.length,
    totalEnrollments: enrollments.length,
    recentGrades,
    courses: courses.map(c => ({
      id: c._id,
      code: c.code,
      title: c.title
    }))
  })
})

export default router
