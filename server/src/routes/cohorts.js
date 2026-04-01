import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import CohortAggregate from '../models/CohortAggregate.js'

const router = Router()

// GET /api/cohorts/:cohortId/aggregate - get aggregated metrics
router.get('/:cohortId/aggregate', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const aggregates = await CohortAggregate.find({ cohortId: req.params.cohortId })
    .sort({ period: -1 })
  return res.json(aggregates)
})

// POST /api/cohorts/:cohortId/aggregate - create/update cohort aggregate (admin)
router.post('/:cohortId/aggregate', requireAuth, requireRole('admin'), async (req, res) => {
  const { period, avgRisk, highRiskCount, avgLoad } = req.body
  
  const agg = await CohortAggregate.findOneAndUpdate(
    { cohortId: req.params.cohortId, period },
    { avgRisk, highRiskCount, avgLoad, updatedAt: new Date() },
    { upsert: true, new: true }
  )
  return res.json(agg)
})

export default router
