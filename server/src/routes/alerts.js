import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import Alert from '../models/Alert.js'

const router = Router()

const createAlertSchema = z.object({
  studentId: z.string(),
  predictionId: z.string().optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  message: z.string().min(1),
  deliveredVia: z.enum(['app', 'email']).optional()
})

// POST /api/alerts - create alert (admin/system)
router.post('/', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const parsed = createAlertSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' })
  }

  const alert = await Alert.create(parsed.data)
  return res.status(201).json(alert)
})

// GET /api/alerts - list alerts
router.get('/', requireAuth, async (req, res) => {
  let filter = {}
  if (req.user.role === 'student') {
    filter.studentId = req.user.studentId
  } else if (req.query.studentId) {
    filter.studentId = req.query.studentId
  }

  const alerts = await Alert.find(filter)
    .sort({ timestamp: -1 })
    .limit(50)
  return res.json(alerts)
})

export default router
