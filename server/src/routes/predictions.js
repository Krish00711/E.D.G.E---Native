import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import RiskPrediction from '../models/RiskPrediction.js'
import { calculatePredictionForStudent } from '../services/predictionService.js'
import { getStudentFeatures } from '../services/predictionService.js'

const router = Router()

const createPredictionSchema = z.object({
  studentId: z.string(),
  sessionId: z.string().optional(),
  riskScore: z.number().min(0).max(1),
  riskLevel: z.enum(['low', 'moderate', 'high']),
  exhaustionScore: z.number().min(0).max(1).optional(),
  cynicismScore: z.number().min(0).max(1).optional(),
  efficacyScore: z.number().min(0).max(1).optional(),
  featuresSnapshot: z.record(z.any()).optional(),
  modelVersion: z.string().optional()
})

// POST /api/predictions - create risk prediction (admin/system)
router.post('/', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const parsed = createPredictionSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload' })
  }

  const prediction = await RiskPrediction.create(parsed.data)
  return res.status(201).json(prediction)
})

// GET /api/predictions/:id
router.get('/:id', requireAuth, async (req, res) => {
  const prediction = await RiskPrediction.findById(req.params.id)
  if (!prediction) {
    return res.status(404).json({ error: 'Prediction not found' })
  }

  if (req.user.role === 'student' && prediction.studentId.toString() !== req.user.studentId) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  return res.json(prediction)
})

// GET /api/predictions - list predictions
router.get('/', requireAuth, async (req, res) => {
  let filter = {}
  if (req.user.role === 'student') {
    filter.studentId = req.user.studentId
  } else if (req.query.studentId) {
    filter.studentId = req.query.studentId
  }

  const predictions = await RiskPrediction.find(filter)
    .sort({ timestamp: -1 })
    .limit(50)
  return res.json(predictions)
})

// GET /api/predictions/latest/:studentId - get latest prediction for a student
router.get('/latest/:studentId', requireAuth, async (req, res) => {
  const prediction = await RiskPrediction.findOne({ studentId: req.params.studentId })
    .sort({ timestamp: -1 })
  
  if (!prediction) {
    return res.status(404).json({ error: 'No prediction found' })
  }

  if (req.user.role === 'student' && req.params.studentId !== req.user.studentId) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  return res.json(prediction)
})

// POST /api/predictions/calculate/:studentId - Calculate prediction with enhanced academic features
router.post('/calculate/:studentId', requireAuth, async (req, res) => {
  try {
    const studentId = req.params.studentId

    if (req.user.role === 'student' && studentId !== req.user.studentId) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { prediction, features, mlResult } = await calculatePredictionForStudent(studentId)

    return res.status(201).json({
      prediction,
      features,
      mlResult
    })
  } catch (error) {
    console.error('[Predictions] Error calculating prediction:', error)
    return res.status(500).json({ error: error.message })
  }
})

// POST /api/predictions/whatif - simulate feature changes without saving
router.post('/whatif', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      studentId: z.string(),
      changes: z.record(z.any())
    })

    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload' })
    }

    const { studentId, changes } = parsed.data

    if (req.user.role === 'student' && studentId !== req.user.studentId) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const currentFeatures = await getStudentFeatures(studentId)
    const simulatedFeatures = { ...currentFeatures, ...changes }

    const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:5001'

    const [currentResponse, simulatedResponse] = await Promise.all([
      fetch(`${mlServiceUrl}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentFeatures)
      }),
      fetch(`${mlServiceUrl}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simulatedFeatures)
      })
    ])

    if (!currentResponse.ok || !simulatedResponse.ok) {
      return res.status(502).json({ error: 'ML service simulation failed' })
    }

    const [currentResult, simulatedResult] = await Promise.all([
      currentResponse.json(),
      simulatedResponse.json()
    ])

    const riskScoreChange = (simulatedResult.risk_score || 0) - (currentResult.risk_score || 0)

    const higherIsBetter = new Set([
      'sleep_hours',
      'quiz_scores',
      'gpa',
      'attendance_rate',
      'assignment_completion_rate',
      'mood_score',
      'social_interaction_hours',
      'physical_activity_hours',
      'sleep_quality',
      'activity_frequency'
    ])

    const lowerIsBetter = new Set([
      'stress_score',
      'load_score',
      'submission_lateness',
      'days_since_last_activity',
      'screen_time_hours',
      'social_media_hours',
      'anxiety_score',
      'academic_pressure_score',
      'extracurricular_load',
      'placement_pressure',
      'peer_stress',
      'financial_stress'
    ])

    const improved_features = []
    const worsened_features = []

    for (const featureName of Object.keys(changes)) {
      const before = Number(currentFeatures[featureName])
      const after = Number(simulatedFeatures[featureName])

      if (!Number.isFinite(before) || !Number.isFinite(after) || before === after) {
        continue
      }

      if (higherIsBetter.has(featureName)) {
        if (after > before) improved_features.push(featureName)
        else worsened_features.push(featureName)
      } else if (lowerIsBetter.has(featureName)) {
        if (after < before) improved_features.push(featureName)
        else worsened_features.push(featureName)
      }
    }

    const delta = {
      risk_score_change: riskScoreChange,
      risk_level_changed: currentResult.risk_level !== simulatedResult.risk_level,
      improved_features,
      worsened_features
    }

    const changedFeatureNames = Object.keys(changes)
    let message = 'Simulation complete.'
    if (changedFeatureNames.length > 0) {
      const f = changedFeatureNames[0]
      const before = currentFeatures[f]
      const after = simulatedFeatures[f]
      const absDelta = Math.abs(riskScoreChange).toFixed(2)
      if (riskScoreChange < 0) {
        message = `Improving ${f} from ${before} to ${after} would reduce your risk score by ${absDelta}`
      } else if (riskScoreChange > 0) {
        message = `Changing ${f} from ${before} to ${after} would increase your risk score by ${absDelta}`
      } else {
        message = `Changing ${f} from ${before} to ${after} does not change your risk score.`
      }
    }

    return res.json({
      current: {
        risk_level: currentResult.risk_level,
        risk_score: currentResult.risk_score,
        dimension_scores: currentResult.dimension_scores
      },
      simulated: {
        risk_level: simulatedResult.risk_level,
        risk_score: simulatedResult.risk_score,
        dimension_scores: simulatedResult.dimension_scores
      },
      delta,
      message
    })
  } catch (error) {
    console.error('[Predictions] What-if simulation error:', error)
    return res.status(500).json({ error: 'What-if simulation failed' })
  }
})

// GET /api/predictions/forecast/:studentId - simple trend-based 7-day forecast
router.get('/forecast/:studentId', requireAuth, async (req, res) => {
  try {
    const { studentId } = req.params

    if (req.user.role === 'student' && studentId !== req.user.studentId) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const predictions = await RiskPrediction.find({ studentId })
      .sort({ createdAt: -1 })
      .limit(14)

    if (predictions.length < 2) {
      return res.json({
        historical: [],
        forecast: [],
        trend: 'stable',
        daysUntilHighRisk: null,
        message: 'Not enough data yet. Keep logging check-ins.'
      })
    }

    const oldestToNewest = [...predictions].reverse()
    const riskScores = oldestToNewest.map((p) => Number(p.riskScore || 0))

    let slope = 0
    for (let i = 1; i < riskScores.length; i += 1) {
      slope += (riskScores[i] - riskScores[i - 1])
    }
    slope = slope / (riskScores.length - 1)

    let trend = 'stable'
    if (slope > 0.01) {
      trend = 'worsening'
    } else if (slope < -0.01) {
      trend = 'improving'
    }

    const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value))
    const toRiskLevel = (score) => {
      if (score >= 0.6) return 'high'
      if (score >= 0.4) return 'moderate'
      return 'low'
    }

    const lastRecord = oldestToNewest[oldestToNewest.length - 1]
    const lastScore = Number(lastRecord.riskScore || 0)
    const baseDate = new Date(lastRecord.createdAt)

    const forecast = Array.from({ length: 7 }, (_, idx) => {
      const day = idx + 1
      const projectedRiskScore = clamp(lastScore + (slope * day))
      const date = new Date(baseDate)
      date.setDate(baseDate.getDate() + day)

      return {
        date: date.toISOString(),
        projected_risk_score: projectedRiskScore,
        projected_risk_level: toRiskLevel(projectedRiskScore)
      }
    })

    let daysUntilHighRisk = null
    if (trend === 'worsening' && lastScore < 0.6) {
      const crossing = forecast.findIndex((f) => f.projected_risk_score >= 0.6)
      if (crossing !== -1) {
        daysUntilHighRisk = crossing + 1
      }
    }

    const historical = oldestToNewest.map((p) => ({
      date: new Date(p.createdAt).toISOString(),
      risk_score: Number(p.riskScore || 0),
      risk_level: p.riskLevel
    }))

    let message = 'Your risk trend is stable over the last two weeks.'
    if (trend === 'improving') {
      message = 'Your risk trend is improving. Keep up your current habits.'
    } else if (trend === 'worsening') {
      message = daysUntilHighRisk
        ? `Your risk trend is worsening and may reach high risk in about ${daysUntilHighRisk} day(s).`
        : 'Your risk trend is worsening. Consider early intervention steps now.'
    }

    return res.json({
      historical,
      forecast,
      trend,
      daysUntilHighRisk,
      message
    })
  } catch (error) {
    console.error('[Predictions] Forecast error:', error)
    return res.status(500).json({ error: 'Forecast generation failed' })
  }
})

export default router
