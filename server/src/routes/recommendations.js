import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import Recommendation from '../models/Recommendation.js'

const router = Router()

const createRecommendationSchema = z.object({
  studentId: z.string(),
  predictionId: z.string().optional(),
  type: z.enum(['break', 'schedule', 'support', 'counseling']),
  message: z.string().min(1)
})

const updateRecommendationSchema = z.object({
  status: z.enum(['shown', 'accepted', 'ignored']).optional()
})

// POST /api/recommendations - create recommendation (admin/system)
router.post('/', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const parsed = createRecommendationSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' })
  }

  const rec = await Recommendation.create(parsed.data)
  return res.status(201).json(rec)
})

// GET /api/recommendations - list recommendations
router.get('/', requireAuth, async (req, res) => {
  let filter = {}
  if (req.user.role === 'student') {
    filter.studentId = req.user.studentId
  } else if (req.query.studentId) {
    filter.studentId = req.query.studentId
  }

  const recs = await Recommendation.find(filter)
    .sort({ timestamp: -1 })
    .limit(50)
  return res.json(recs)
})

// PATCH /api/recommendations/:id - update recommendation status
router.patch('/:id', requireAuth, async (req, res) => {
  const parsed = updateRecommendationSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' })
  }

  const rec = await Recommendation.findById(req.params.id)
  if (!rec) {
    return res.status(404).json({ error: 'Recommendation not found' })
  }

  if (req.user.role === 'student' && rec.studentId.toString() !== req.user.studentId) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  Object.assign(rec, parsed.data)
  await rec.save()
  return res.json(rec)
})

export default router
