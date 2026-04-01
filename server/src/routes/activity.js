import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import ActivityLog from '../models/ActivityLog.js'
import { calculatePredictionForStudent } from '../services/predictionService.js'

const router = Router()

const createActivitySchema = z.object({
  studentId: z.string().optional(),
  sessionId: z.string().optional(),
  type: z.enum(['login', 'quiz', 'assignment', 'study', 'pageview']),
  value: z.number().optional(),
  score: z.number().optional()
})

// POST /api/activity - log activity
router.post('/', requireAuth, async (req, res) => {
  const parsed = createActivitySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' })
  }

  const studentId = req.user.role === 'student'
    ? req.user.studentId
    : parsed.data.studentId

  if (!studentId) {
    return res.status(400).json({ error: 'studentId is required' })
  }

  const log = await ActivityLog.create({
    ...parsed.data,
    studentId
  })

  let prediction = null
  try {
    const result = await calculatePredictionForStudent(studentId)
    prediction = result.prediction
  } catch (error) {
    // Ignore prediction errors for activity logging
  }

  return res.status(201).json({ log, prediction })
})

// GET /api/activity - list activity logs
router.get('/', requireAuth, async (req, res) => {
  let filter = {}
  if (req.user.role === 'student') {
    filter.studentId = req.user.studentId
  } else if (req.query.studentId) {
    filter.studentId = req.query.studentId
  }

  if (req.query.sessionId) {
    filter.sessionId = req.query.sessionId
  }

  const logs = await ActivityLog.find(filter)
    .sort({ timestamp: -1 })
    .limit(100)
  return res.json(logs)
})

export default router
