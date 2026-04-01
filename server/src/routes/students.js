import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import Student from '../models/Student.js'
import User from '../models/User.js'

const router = Router()

const createStudentSchema = z.object({
  userId: z.string(),
  program: z.string().optional(),
  year: z.number().optional(),
  cohortId: z.string().optional()
})

// POST /api/students - create student (admin/mentor)
router.post('/', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const parsed = createStudentSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' })
  }

  const student = await Student.create(parsed.data)
  return res.status(201).json(student)
})

// GET /api/students/:id - get student by id
router.get('/:id', requireAuth, async (req, res) => {
  const student = await Student.findById(req.params.id).populate('userId')
  if (!student) {
    return res.status(404).json({ error: 'Student not found' })
  }
  return res.json(student)
})

// GET /api/students - list all students (admin) or own student (student)
router.get('/', requireAuth, async (req, res) => {
  if (req.user.role === 'admin') {
    const students = await Student.find()
    return res.json(students)
  }

  const user = await User.findById(req.user.sub)
  const student = await Student.findOne({ userId: req.user.sub })
  if (!student) {
    return res.status(404).json({ error: 'Student profile not found' })
  }
  return res.json([student])
})

// PATCH /api/students/:id - update student (admin/mentor or self)
router.patch('/:id', requireAuth, async (req, res) => {
  const student = await Student.findById(req.params.id)
  if (!student) {
    return res.status(404).json({ error: 'Student not found' })
  }

  if (req.user.role !== 'admin' && student.userId.toString() !== req.user.sub) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  Object.assign(student, req.body)
  await student.save()
  return res.json(student)
})

export default router
