import express from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import User from '../models/User.js'
import Student from '../models/Student.js'
import SelfReport from '../models/SelfReport.js'
import predictionService from '../services/predictionService.js'

const router = express.Router()

const onboardingSchema = z.object({
  sleep_hours: z.number().min(3).max(12),
  stress_score: z.number().min(1).max(10),
  load_score: z.number().min(1).max(10),
  anxiety_score: z.number().min(0).max(10),
  academic_pressure_score: z.number().min(1).max(10),
  screen_time_hours: z.number().min(0).max(16),
  physical_activity_hours: z.number().min(0).max(8),
  financial_stress: z.number().min(1).max(10),
  placement_pressure: z.number().min(1).max(10),
  mood_score: z.number().min(0).max(10),
  social_interaction_hours: z.number().min(0).max(8),
  activity_frequency: z.number().min(1).max(20),
  session_duration: z.number().min(30).max(480),
  quiz_scores: z.number().min(0).max(100),
  gpa: z.number().min(0).max(4),
  attendance_rate: z.number().min(0).max(100),
  assignment_completion_rate: z.number().min(0).max(100),
  social_media_hours: z.number().min(0).max(12),
  peer_stress: z.number().min(1).max(10),
  sleep_quality: z.number().min(1).max(5),
  extracurricular_load: z.number().min(0).max(8),
  submission_lateness: z.number().min(0).max(14),
  grade_trend: z.number().min(-15).max(15),
  days_since_last_activity: z.number().min(0).max(30)
})

// POST /api/onboarding/submit
router.post('/submit', requireAuth, async (req, res) => {
  try {
    const parsed = onboardingSchema.safeParse(req.body)

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid onboarding payload',
        details: parsed.error.flatten()
      })
    }

    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const student = await Student.findOne({ userId }).select('_id')
    if (!student) {
      return res.status(404).json({ error: 'Student profile not found' })
    }

    const payload = parsed.data

    // Store baseline report and include all onboarding inputs in notes for traceability.
    await SelfReport.create({
      studentId: student._id,
      sleepHours: payload.sleep_hours,
      stressScore: payload.stress_score,
      loadScore: payload.load_score,
      isBaseline: true,
      notes: JSON.stringify(payload)
    })

    await User.findByIdAndUpdate(userId, {
      onboardingComplete: true,
      lastActive: new Date()
    })

    let prediction = null
    try {
      if (typeof predictionService.triggerPredictionUpdate === 'function') {
        prediction = await predictionService.triggerPredictionUpdate(student._id)
      } else if (typeof predictionService.calculatePredictionForStudent === 'function') {
        prediction = await predictionService.calculatePredictionForStudent(student._id)
      }
    } catch (predictionError) {
      // Keep onboarding successful even if prediction generation fails.
      console.error('[Onboarding] Initial prediction failed:', predictionError)
      prediction = null
    }

    return res.json({
      success: true,
      message: 'Onboarding complete',
      prediction
    })
  } catch (error) {
    console.error('[Onboarding] Submit error:', error)
    return res.status(500).json({
      error: 'Failed to complete onboarding'
    })
  }
})

// GET /api/onboarding/status
router.get('/status', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const [user, student] = await Promise.all([
      User.findById(userId).select('onboardingComplete'),
      Student.findOne({ userId }).select('_id')
    ])

    if (!user || !student) {
      return res.status(404).json({ error: 'User or student profile not found' })
    }

    return res.json({
      onboardingComplete: Boolean(user.onboardingComplete),
      studentId: String(student._id)
    })
  } catch (error) {
    console.error('[Onboarding] Status error:', error)
    return res.status(500).json({
      error: 'Failed to fetch onboarding status'
    })
  }
})

export default router
