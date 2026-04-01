import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import SelfReport from '../models/SelfReport.js'
import { calculatePredictionForStudent } from '../services/predictionService.js'

const router = Router()

const createReportSchema = z.object({
  studentId: z.string().optional(),
  loadScore: z.number().min(1).max(10).optional(),
  stressScore: z.number().min(1).max(10).optional(),
  sleepHours: z.number().min(0).max(24).optional(),
  notes: z.string().optional(),
  isBaseline: z.boolean().optional()
})

// POST /api/self-reports - submit self report
router.post('/', requireAuth, async (req, res) => {
  const parsed = createReportSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' })
  }

  const studentId = req.user.role === 'student'
    ? req.user.studentId
    : parsed.data.studentId

  if (!studentId) {
    return res.status(400).json({ error: 'studentId is required' })
  }

  const report = await SelfReport.create({
    ...parsed.data,
    studentId
  })

  let prediction = null
  try {
    const result = await calculatePredictionForStudent(studentId)
    prediction = result.prediction
  } catch (error) {
    // Keep report creation successful even if prediction fails
  }

  return res.status(201).json({ report, prediction })
})

// GET /api/self-reports - list self reports
router.get('/', requireAuth, async (req, res) => {
  let filter = {}
  if (req.user.role === 'student') {
    filter.studentId = req.user.studentId
  } else if (req.query.studentId) {
    filter.studentId = req.query.studentId
  }

  const reports = await SelfReport.find(filter)
    .sort({ timestamp: -1 })
    .limit(100)
  return res.json(reports)
})

export default router
