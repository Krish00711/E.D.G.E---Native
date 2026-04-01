import { Router } from 'express'
import { z } from 'zod'
import mongoose from 'mongoose'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import RecoveryAction from '../models/RecoveryAction.js'
import SessionAction from '../models/SessionAction.js'
import Recommendation from '../models/Recommendation.js'
import Alert from '../models/Alert.js'
import RiskPrediction from '../models/RiskPrediction.js'
import CognitiveLoadRecord from '../models/CognitiveLoadRecord.js'
import SelfReport from '../models/SelfReport.js'
import Student from '../models/Student.js'

const router = Router()

// Validation schemas
const querySchema = z.object({
  page: z.string().optional().transform(val => val ? Math.max(1, parseInt(val)) : 1),
  limit: z.string().optional().transform(val => val ? Math.max(1, Math.min(100, parseInt(val))) : 50),
  status: z.enum(['recommended', 'taken', 'ignored']).optional(),
  source: z.enum(['session', 'recommendation']).optional()
})

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

function handleError(error, defaultMessage = 'Operation failed') {
  console.error('[Recovery Error]', error)
  return {
    error: defaultMessage,
    message: error.message,
    type: error.name,
    timestamp: new Date().toISOString()
  }
}

const createActionSchema = z.object({
  type: z.enum(['break', 'counseling', 'support', 'mindfulness', 'exercise', 'schedule', 'peer']),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  durationMin: z.number().min(1).max(480).optional(),
  tags: z.array(z.string()).max(10).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional()
})

const personalizedSchema = z.object({
  studentId: z.string().min(1)
})

router.post('/personalized', requireAuth, async (req, res) => {
  try {
    const parsed = personalizedSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
    }

    const { studentId } = parsed.data
    if (!studentId || studentId.length !== 24) {
      return res.status(400).json({ error: 'Invalid student ID' })
    }

    // Students can only request their own recommendations
    if (req.user.role === 'student') {
      const studentDoc = await Student.findOne({ userId: req.user.id }).select('_id').lean().maxTimeMS(3000).catch(() => null)
      if (!studentDoc || studentDoc._id.toString() !== studentId) {
        return res.status(403).json({ error: 'Forbidden' })
      }
    }

    const [latestPrediction, latestSelfReport] = await Promise.all([
      RiskPrediction.findOne({ studentId }).sort({ createdAt: -1 }).lean().maxTimeMS(3000),
      SelfReport.findOne({ studentId }).sort({ createdAt: -1 }).select('notes').lean().maxTimeMS(3000)
    ])

    const basedOn = {
      riskLevel: latestPrediction?.riskLevel ?? 'unknown',
      exhaustionScore: Number(latestPrediction?.exhaustionScore ?? 0),
      cynicismScore: Number(latestPrediction?.cynicismScore ?? 0),
      efficacyScore: Number(latestPrediction?.efficacyScore ?? 0)
    }

    const features = (() => {
      try {
        return JSON.parse(latestSelfReport?.notes || '{}')
      } catch {
        return {}
      }
    })()

    const recommendations = []

    const predefinedByDimension = {
        exhaustion: [
          {
            title: 'Take a 20-minute power nap between study sessions',
            description: 'Short naps restore alertness and reduce cognitive fatigue, helping you sustain focus later in the day.',
            category: 'sleep',
            priority: 'high',
            source: 'predefined'
          },
          {
            title: 'Practice 4-7-8 breathing: inhale 4s, hold 7s, exhale 8s',
            description: 'This breathing pattern calms your nervous system and can quickly lower exhaustion-related stress signals.',
            category: 'mental',
            priority: 'medium',
            source: 'predefined'
          },
          {
            title: 'Limit caffeine after 2pm to improve sleep quality',
            description: 'Reducing late caffeine improves nighttime recovery, which directly helps reduce burnout exhaustion.',
            category: 'sleep',
            priority: 'medium',
            source: 'predefined'
          }
        ],
        cynicism: [
          {
            title: 'Connect with a classmate or friend for 15 minutes today',
            description: 'Brief social connection can reduce emotional detachment and improve motivation when cynicism rises.',
            category: 'social',
            priority: 'high',
            source: 'predefined'
          },
          {
            title: 'Write down 3 things you\'re grateful for in your studies',
            description: 'A short gratitude reset helps shift attention from frustration to progress and meaning.',
            category: 'mental',
            priority: 'medium',
            source: 'predefined'
          },
          {
            title: 'Take a complete break from academics for 2 hours',
            description: 'Intentional time away can reduce mental resistance and improve re-engagement quality later.',
            category: 'stress',
            priority: 'medium',
            source: 'predefined'
          }
        ],
        efficacy: [
          {
            title: 'Break your next assignment into 5 small tasks',
            description: 'Smaller goals create quick wins and rebuild confidence when self-efficacy is low.',
            category: 'academic',
            priority: 'high',
            source: 'predefined'
          },
          {
            title: 'Review and celebrate one thing you completed this week',
            description: 'Recognizing recent progress counters negative self-judgment and reinforces capability.',
            category: 'mental',
            priority: 'medium',
            source: 'predefined'
          },
          {
            title: 'Ask your mentor or professor one question you\'ve been avoiding',
            description: 'Timely clarification removes hidden blockers and improves control over your coursework.',
            category: 'academic',
            priority: 'medium',
            source: 'predefined'
          }
        ]
      }

    const dimensions = [
      { key: 'exhaustion', score: basedOn.exhaustionScore },
      { key: 'cynicism', score: basedOn.cynicismScore },
      { key: 'efficacy', score: basedOn.efficacyScore }
    ].sort((a, b) => b.score - a.score)

    const topDimension = dimensions[0]
    if (topDimension && topDimension.score > 0.6) {
      const topSet = predefinedByDimension[topDimension.key]
      const count = topDimension.score >= 0.75 ? 3 : 2
      recommendations.push(...topSet.slice(0, count))
    }

    const addFeatureRule = (condition, recommendation) => {
      if (condition) recommendations.push(recommendation)
    }

    addFeatureRule(Number(features.sleep_hours) < 6, {
      title: 'Aim for 7-8 hours tonight — set a sleep alarm',
      description: 'A sleep alarm helps protect your recovery window and improves concentration and mood the next day.',
      category: 'sleep',
      priority: 'high',
      source: 'ai'
    })

    addFeatureRule(Number(features.stress_score) > 7, {
      title: 'Try a 10-minute meditation on YouTube',
      description: 'Brief guided meditation can rapidly reduce stress arousal and improve emotional regulation.',
      category: 'stress',
      priority: 'high',
      source: 'ai'
    })

    addFeatureRule(Number(features.physical_activity_hours) < 0.5, {
      title: 'Take a 15-minute walk outside',
      description: 'Light movement boosts energy and mood, and can lower cognitive fatigue after study blocks.',
      category: 'physical',
      priority: 'medium',
      source: 'ai'
    })

    addFeatureRule(Number(features.social_media_hours) > 4, {
      title: 'Enable app limits for social media today',
      description: 'Reducing passive scrolling can free up attention and reduce stress spikes from overexposure.',
      category: 'mental',
      priority: 'medium',
      source: 'ai'
    })

    addFeatureRule(Number(features.days_since_last_activity) > 3, {
      title: 'Start with just 25 minutes of study (Pomodoro)',
      description: 'A small, time-boxed restart lowers resistance and rebuilds academic momentum.',
      category: 'academic',
      priority: 'high',
      source: 'ai'
    })

    addFeatureRule(Number(features.gpa) < 2.5, {
      title: 'Visit your professor\'s office hours this week',
      description: 'Early academic support helps close learning gaps before they compound into burnout pressure.',
      category: 'academic',
      priority: 'high',
      source: 'ai'
    })

    addFeatureRule(Number(features.attendance_rate) < 70, {
      title: 'Attend your next class — even for 30 minutes',
      description: 'Partial attendance still re-establishes routine and improves re-engagement with course material.',
      category: 'academic',
      priority: 'high',
      source: 'ai'
    })

    addFeatureRule(Number(features.financial_stress) > 7, {
      title: 'Talk to your university\'s student support services',
      description: 'Financial support resources can reduce chronic stress and improve your capacity to focus.',
      category: 'stress',
      priority: 'medium',
      source: 'ai'
    })

    const uniqueRecommendations = []
    const seenTitles = new Set()
    for (const rec of recommendations) {
      if (!seenTitles.has(rec.title)) {
        seenTitles.add(rec.title)
        uniqueRecommendations.push(rec)
      }
    }

    return res.json({
      recommendations: uniqueRecommendations,
      basedOn
    })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to generate recommendations' })
  }
})

router.get('/actions', requireAuth, async (req, res) => {
  try {
    const { type, priority, page, limit } = querySchema.parse(req.query)
    
    const filter = { isActive: true }
    if (req.query.type) filter.type = req.query.type
    if (req.query.priority) filter.priority = req.query.priority

    const skip = (page - 1) * limit

    const [actions, total] = await Promise.all([
      RecoveryAction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      RecoveryAction.countDocuments(filter)
    ])

    return res.json({ 
      actions, 
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      },
      metadata: {
        generatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('[Get Actions Error]', error)
    return res.status(error.name === 'ZodError' ? 400 : 500).json(handleError(error, 'Failed to fetch actions'))
  }
})

router.post('/actions', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const parsed = createActionSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Invalid payload', 
        details: parsed.error.flatten(),
        timestamp: new Date().toISOString()
      })
    }

    const action = await RecoveryAction.create({
      ...parsed.data,
      createdBy: req.user.id
    })

    return res.status(201).json({
      action,
      message: 'Recovery action created successfully',
      metadata: {
        createdAt: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('[Create Action Error]', error)
    return res.status(500).json(handleError(error, 'Failed to create action'))
  }
})

router.get('/session-actions', requireAuth, async (req, res) => {
  try {
    const { studentId, status, source, page, limit } = querySchema.parse(req.query)
    
    const filter = {}
    if (req.user.role === 'student') {
      filter.studentId = req.user.studentId
    } else if (studentId) {
      if (!isValidObjectId(studentId)) {
        return res.status(400).json({ error: 'Invalid student ID format', id: studentId })
      }
      filter.studentId = studentId
    }

    if (status) filter.status = status
    if (source) filter.source = source

    const skip = (page - 1) * limit

    const [actions, total, statusCounts] = await Promise.all([
      SessionAction.find(filter)
        .populate('actionId')
        .populate('studentId', 'name email')
        .sort({ recommendedAt: -1 })
        .skip(skip)
        .limit(limit),
      SessionAction.countDocuments(filter),
      SessionAction.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ])

    const counts = {
      recommended: 0,
      taken: 0,
      ignored: 0
    }
    statusCounts.forEach(item => {
      if (item._id) counts[item._id] = item.count
    })

    return res.json({ 
      actions, 
      statusCounts: counts,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      },
      metadata: {
        generatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('[Get Session Actions Error]', error)
    return res.status(error.name === 'ZodError' ? 400 : 500).json(handleError(error, 'Failed to fetch session actions'))
  }
})

router.patch('/session-actions/:id', requireAuth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid action ID format', id: req.params.id })
    }

    const parsed = z.object({ 
      status: z.enum(['taken', 'ignored']),
      notes: z.string().max(500).optional()
    }).safeParse(req.body)
    
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Invalid payload', 
        details: parsed.error.flatten()
      })
    }

    const action = await SessionAction.findById(req.params.id)
    if (!action) {
      return res.status(404).json({ error: 'Action not found', actionId: req.params.id })
    }

    if (req.user.role === 'student' && action.studentId.toString() !== req.user.studentId) {
      return res.status(403).json({ error: 'Forbidden: Not your action' })
    }

    action.status = parsed.data.status
    if (parsed.data.notes) action.notes = parsed.data.notes
    if (parsed.data.status === 'taken') {
      action.takenAt = new Date()
    }
    await action.save()

    return res.json({
      action,
      message: `Action marked as ${parsed.data.status}`
    })
  } catch (error) {
    console.error('[Update Session Action Error]', error)
    return res.status(500).json(handleError(error, 'Failed to update action'))
  }
})

router.post('/recommend/:studentId', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const { studentId } = req.params

  const [latestPrediction, latestLoad, actions] = await Promise.all([
    RiskPrediction.findOne({ studentId }).sort({ timestamp: -1 }),
    CognitiveLoadRecord.findOne({ studentId }).sort({ recordedAt: -1 }),
    RecoveryAction.find({ isActive: true })
  ])

  if (!latestPrediction && !latestLoad) {
    return res.status(400).json({ error: 'No prediction or load data available' })
  }

  const recommended = []
  const highRisk = latestPrediction?.riskLevel === 'high' || (latestLoad?.overallLoad || 0) > 75

  const pickAction = (type) => actions.find((action) => action.type === type)

  if (highRisk) {
    const action = pickAction('break') || pickAction('mindfulness') || actions[0]
    if (action) recommended.push(action)
  }

  if ((latestPrediction?.cynicismScore || 0) > 0.6) {
    const action = pickAction('peer') || pickAction('support')
    if (action) recommended.push(action)
  }

  if ((latestPrediction?.efficacyScore || 0) > 0.6) {
    const action = pickAction('schedule') || pickAction('support')
    if (action) recommended.push(action)
  }

  const created = []
  for (const action of recommended) {
    const sessionAction = await SessionAction.create({
      studentId,
      actionId: action._id,
      status: 'recommended'
    })

    await Recommendation.create({
      studentId,
      predictionId: latestPrediction?._id,
      type: 'support',
      message: action.description
    })

    created.push(sessionAction)
  }

  if (highRisk) {
    await Alert.create({
      studentId,
      predictionId: latestPrediction?._id,
      severity: 'critical',
      message: 'High cognitive load detected. A recovery action was recommended.'
    })
  }

  return res.json({ actions: created, total: created.length })
})

export default router
