import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import Course from '../models/Course.js'

const router = Router()

const createCourseSchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  instructorId: z.string().optional(),
  description: z.string().optional(),
  credits: z.number().min(0).optional(),
  department: z.string().optional(),
  difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  maxEnrollment: z.number().optional(),
  semester: z.string().optional(),
  year: z.number().optional(),
  schedule: z.object({
    days: z.array(z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])).optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    location: z.string().optional()
  }).optional()
})

// POST /api/courses - create course (admin/instructor)
router.post('/', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const parsed = createCourseSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' })
  }

  const course = await Course.create(parsed.data)
  return res.status(201).json(course)
})

// GET /api/courses/:id
router.get('/:id', requireAuth, async (req, res) => {
  const course = await Course.findById(req.params.id)
  if (!course) {
    return res.status(404).json({ error: 'Course not found' })
  }
  return res.json(course)
})

// GET /api/courses - list all courses
router.get('/', requireAuth, async (req, res) => {
  const courses = await Course.find()
  return res.json(courses)
})

// PATCH /api/courses/:id - update course (admin/instructor)
router.patch('/:id', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true })
  if (!course) {
    return res.status(404).json({ error: 'Course not found' })
  }
  return res.json(course)
})

export default router
