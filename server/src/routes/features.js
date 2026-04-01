import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import Session from '../models/Session.js'
import ActivityLog from '../models/ActivityLog.js'
import SelfReport from '../models/SelfReport.js'
import RiskPrediction from '../models/RiskPrediction.js'

const router = Router()

// Helper: aggregate features for a student
async function aggregateFeatures(studentId) {
  const now = new Date()
  const seventDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  
  // Get recent sessions
  const sessions = await Session.find({ studentId, startAt: { $gte: seventDaysAgo } })
  
  // Get recent activity logs
  const activities = await ActivityLog.find({ studentId, timestamp: { $gte: seventDaysAgo } })
  
  // Get recent self-reports
  const selfReports = await SelfReport.find({ studentId, timestamp: { $gte: seventDaysAgo } })
  
  // Aggregate features
  const totalSessionDuration = sessions.reduce((sum, s) => sum + (s.durationMin || 0), 0)
  const avgSessionDuration = sessions.length > 0 ? totalSessionDuration / sessions.length : 120
  
  const quizzes = activities.filter(a => a.type === 'quiz')
  const quizScores = quizzes.map(q => q.score).filter(s => s !== undefined)
  const avgQuizScore = quizScores.length > 0 
    ? quizScores.reduce((sum, s) => sum + s, 0) / quizScores.length 
    : 75
  
  const sessionCount = sessions.length
  const activityFrequency = sessionCount > 0 ? (activities.length / 7) : 5
  
  const latestReport = selfReports.length > 0 ? selfReports[0] : null
  const avgLoadScore = latestReport?.loadScore || 5
  const avgSleepHours = latestReport?.sleepHours || 7
  const avgStressScore = latestReport?.stressScore || 5
  
  // Calculate submission lateness (if any assignments are late)
  const lateAssignments = activities.filter(a => a.type === 'assignment' && a.value === -1)
  const submissionLateness = lateAssignments.length > 0 ? 3 : 0
  
  return {
    session_duration: Math.round(avgSessionDuration),
    quiz_scores: Math.round(avgQuizScore),
    load_score: avgLoadScore,
    activity_frequency: Math.round(activityFrequency),
    sleep_hours: avgSleepHours,
    stress_score: avgStressScore,
    submission_lateness: submissionLateness
  }
}

// Helper: call Python ML service
async function callMLService(features) {
  try {
    const response = await fetch('http://localhost:5001/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(features)
    })
    
    if (!response.ok) {
      throw new Error(`ML service error: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('[Features] ML service error:', error.message)
    throw error
  }
}

// POST /api/features/:studentId/predict - generate risk prediction
router.post('/:studentId/predict', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const { studentId } = req.params
    
    // Aggregate features from student data
    console.log(`[Features] Aggregating features for student ${studentId}...`)
    const features = await aggregateFeatures(studentId)
    console.log('[Features] Features:', features)
    
    // Call ML service for prediction
    console.log('[Features] Calling ML service...')
    const mlResult = await callMLService(features)
    
    // Save prediction to MongoDB
    const prediction = await RiskPrediction.create({
      studentId,
      riskScore: mlResult.risk_score,
      riskLevel: mlResult.risk_level,
      featuresSnapshot: features,
      modelVersion: 'v1'
    })
    
    console.log('[Features] Prediction saved:', prediction._id)
    return res.status(201).json({
      prediction: {
        id: prediction._id,
        riskScore: prediction.riskScore,
        riskLevel: prediction.riskLevel,
        confidence: mlResult.confidence,
        features: prediction.featuresSnapshot,
        timestamp: prediction.timestamp
      }
    })
  } catch (error) {
    console.error('[Features] Error:', error.message)
    return res.status(500).json({ error: 'Failed to generate prediction' })
  }
})

// GET /api/features/:studentId - get aggregated features
router.get('/:studentId', requireAuth, async (req, res) => {
  try {
    if (req.user.role === 'student' && req.params.studentId !== req.user.studentId) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    
    const features = await aggregateFeatures(req.params.studentId)
    return res.json(features)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

export default router
