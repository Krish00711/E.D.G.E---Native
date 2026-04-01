import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import SensorData from '../models/SensorData.js'
import CognitiveLoadRecord from '../models/CognitiveLoadRecord.js'
import SelfReport from '../models/SelfReport.js'
import Session from '../models/Session.js'

const router = Router()

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function computeLoadFromSensors(sensors, selfReport) {
  const byType = sensors.reduce((acc, s) => {
    acc[s.type] = acc[s.type] || []
    acc[s.type].push(s.value)
    return acc
  }, {})

  const avg = (arr, fallback) => arr && arr.length > 0
    ? arr.reduce((a, b) => a + b, 0) / arr.length
    : fallback

  const heartRate = avg(byType.heartRate, 70)
  const hrv = avg(byType.hrv, 50)
  const theta = avg(byType.eegTheta, 0.3)
  const alpha = avg(byType.eegAlpha, 0.3)
  const blink = avg(byType.blinkRate, 12)
  const gsr = avg(byType.gsr, 0.6)
  const stress = avg(byType.facialStress, 0.4)

  const selfLoad = selfReport?.loadScore ? selfReport.loadScore * 10 : 50
  const selfStress = selfReport?.stressScore ? selfReport.stressScore * 10 : 50

  const intrinsic = clamp((theta / (alpha + 0.01)) * 40 + (heartRate - 60) * 0.6 + selfLoad * 0.3)
  const extraneous = clamp((blink - 8) * 4 + gsr * 40 + selfStress * 0.4)
  const germane = clamp(60 - (hrv - 40) * 0.6 + (selfLoad * 0.2))

  const overall = clamp((intrinsic * 0.4) + (extraneous * 0.35) + (germane * 0.25))

  return {
    overallLoad: overall,
    intrinsicLoad: intrinsic,
    extraneousLoad: extraneous,
    germaneLoad: germane,
    featuresSnapshot: {
      heartRate,
      hrv,
      theta,
      alpha,
      blink,
      gsr,
      stress,
      selfLoad,
      selfStress
    }
  }
}

router.get('/current/:studentId', requireAuth, async (req, res) => {
  if (req.user.role === 'student' && req.params.studentId !== req.user.studentId) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const record = await CognitiveLoadRecord.findOne({ studentId: req.params.studentId })
    .sort({ recordedAt: -1 })

  return res.json(record || null)
})

router.get('/history/:studentId', requireAuth, async (req, res) => {
  if (req.user.role === 'student' && req.params.studentId !== req.user.studentId) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { days = 7 } = req.query
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - parseInt(days))

  const records = await CognitiveLoadRecord.find({
    studentId: req.params.studentId,
    recordedAt: { $gte: startDate }
  }).sort({ recordedAt: -1 })

  return res.json({ records, total: records.length })
})

router.post('/compute/:studentId', requireAuth, async (req, res) => {
  const { studentId } = req.params
  if (req.user.role === 'student' && studentId !== req.user.studentId) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const [sensors, selfReport, session] = await Promise.all([
    SensorData.find({ studentId }).sort({ recordedAt: -1 }).limit(30),
    SelfReport.findOne({ studentId }).sort({ createdAt: -1 }),
    Session.findOne({ studentId }).sort({ startAt: -1 })
  ])

  const computed = computeLoadFromSensors(sensors, selfReport)
  const record = await CognitiveLoadRecord.create({
    studentId,
    sessionId: session?._id,
    ...computed
  })

  return res.status(201).json(record)
})

router.post('/simulate/:studentId', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const { studentId } = req.params
  const session = await Session.findOne({ studentId }).sort({ startAt: -1 })

  const record = await CognitiveLoadRecord.create({
    studentId,
    sessionId: session?._id,
    overallLoad: 72,
    intrinsicLoad: 70,
    extraneousLoad: 68,
    germaneLoad: 60,
    featuresSnapshot: { simulated: true }
  })

  return res.status(201).json(record)
})

export default router
