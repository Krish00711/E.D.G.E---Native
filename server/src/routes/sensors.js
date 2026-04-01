import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import SensorData from '../models/SensorData.js'
import Session from '../models/Session.js'

const router = Router()

const sensorSchema = z.object({
  studentId: z.string(),
  sessionId: z.string().optional(),
  type: z.enum([
    'heartRate',
    'hrv',
    'eegTheta',
    'eegAlpha',
    'eegBeta',
    'blinkRate',
    'pupilDilation',
    'gsr',
    'facialStress'
  ]),
  value: z.number(),
  unit: z.string().optional(),
  recordedAt: z.string().optional(),
  source: z.string().optional()
})

router.post('/', requireAuth, async (req, res) => {
  const parsed = sensorSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error })
  }

  if (req.user.role === 'student' && parsed.data.studentId !== req.user.studentId) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const sensor = await SensorData.create({
    ...parsed.data,
    recordedAt: parsed.data.recordedAt ? new Date(parsed.data.recordedAt) : undefined
  })

  return res.status(201).json(sensor)
})

router.get('/', requireAuth, async (req, res) => {
  const { studentId, sessionId, type, limit = 100 } = req.query
  const filter = {}

  if (req.user.role === 'student') {
    filter.studentId = req.user.studentId
  } else if (studentId) {
    filter.studentId = studentId
  }

  if (sessionId) filter.sessionId = sessionId
  if (type) filter.type = type

  const sensors = await SensorData.find(filter)
    .sort({ recordedAt: -1 })
    .limit(parseInt(limit))

  return res.json({ sensors, total: sensors.length })
})

router.post('/simulate/:studentId', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const { studentId } = req.params
  const session = await Session.findOne({ studentId }).sort({ startAt: -1 })

  const now = new Date()
  const samples = [
    { type: 'heartRate', value: 72, unit: 'bpm' },
    { type: 'hrv', value: 48, unit: 'ms' },
    { type: 'eegTheta', value: 0.32, unit: 'ratio' },
    { type: 'eegAlpha', value: 0.28, unit: 'ratio' },
    { type: 'blinkRate', value: 12, unit: 'per_min' },
    { type: 'pupilDilation', value: 3.2, unit: 'mm' },
    { type: 'gsr', value: 0.7, unit: 'microS' },
    { type: 'facialStress', value: 0.4, unit: 'score' }
  ]

  const payload = samples.map((sample, idx) => ({
    studentId,
    sessionId: session?._id,
    ...sample,
    recordedAt: new Date(now.getTime() - idx * 60000),
    source: 'simulated'
  }))

  const sensors = await SensorData.insertMany(payload)
  return res.json({ sensors, total: sensors.length })
})

export default router
