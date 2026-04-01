import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import Session from '../models/Session.js'
import ActivityLog from '../models/ActivityLog.js'

const router = Router()

const createSessionSchema = z.object({
  studentId: z.string().optional(),
  courseId: z.string().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional(),
  context: z.object({ examWeek: z.boolean() }).optional()
})

// POST /api/sessions - create session
router.post('/', requireAuth, async (req, res) => {
  const parsed = createSessionSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' })
  }

  const data = parsed.data
  let durationMin = null
  if (data.startAt && data.endAt) {
    durationMin = Math.round((new Date(data.endAt) - new Date(data.startAt)) / 60000)
  }

  const studentId = req.user.role === 'student'
    ? req.user.studentId
    : data.studentId

  if (!studentId) {
    return res.status(400).json({ error: 'studentId is required' })
  }

  const session = await Session.create({
    ...data,
    studentId,
    durationMin
  })
  return res.status(201).json(session)
})

// GET /api/sessions/:id
router.get('/:id', requireAuth, async (req, res) => {
  const session = await Session.findById(req.params.id)
  if (!session) {
    return res.status(404).json({ error: 'Session not found' })
  }

  if (req.user.role === 'student' && session.studentId.toString() !== req.user.studentId) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  return res.json(session)
})

// GET /api/sessions - list sessions (filter by studentId if student role)
router.get('/', requireAuth, async (req, res) => {
  let filter = {}
  if (req.user.role === 'student') {
    filter.studentId = req.user.studentId
  } else if (req.query.studentId) {
    filter.studentId = req.query.studentId
  }

  const sessions = await Session.find(filter).sort({ startAt: -1 })
  return res.json(sessions)
})

// PATCH /api/sessions/:id - end session
router.patch('/:id', requireAuth, async (req, res) => {
  const session = await Session.findById(req.params.id)
  if (!session) {
    return res.status(404).json({ error: 'Session not found' })
  }

  if (req.user.role === 'student' && session.studentId.toString() !== req.user.studentId) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  Object.assign(session, req.body)
  if (session.startAt && session.endAt) {
    session.durationMin = Math.round((new Date(session.endAt) - new Date(session.startAt)) / 60000)
  }
  await session.save()
  return res.json(session)
})

export default router
