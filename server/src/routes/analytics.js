import { Router } from 'express'
import { z } from 'zod'
import mongoose from 'mongoose'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import Student from '../models/Student.js'
import RiskPrediction from '../models/RiskPrediction.js'
import Alert from '../models/Alert.js'
import Recommendation from '../models/Recommendation.js'
import Intervention from '../models/Intervention.js'
import CohortAggregate from '../models/CohortAggregate.js'

const router = Router()

// Validation schemas
const querySchema = z.object({
  days: z.string().optional().transform(val => val ? Math.max(1, Math.min(90, parseInt(val))) : 14),
  period: z.enum(['week', 'month', 'semester', 'year']).optional(),
  page: z.string().optional().transform(val => val ? Math.max(1, parseInt(val)) : 1),
  limit: z.string().optional().transform(val => val ? Math.max(1, Math.min(100, parseInt(val))) : 50)
})

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

function handleError(error, defaultMessage = 'Operation failed') {
  console.error('[Analytics Error]', error)
  return {
    error: defaultMessage,
    message: error.message,
    type: error.name,
    timestamp: new Date().toISOString()
  }
}

/**
 * COHORT ANALYTICS
 */

// GET /api/analytics/cohort/:cohortId/overview - Cohort-level summary
router.get('/cohort/:cohortId/overview', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const { cohortId } = req.params
    
    if (!isValidObjectId(cohortId)) {
      return res.status(400).json({ error: 'Invalid cohort ID format', id: cohortId })
    }
    
    // Get all students in cohort
    const students = await Student.find({ cohortId }).lean()
    
    if (students.length === 0) {
      return res.status(404).json({ error: 'No students found in cohort', cohortId })
    }
    
    const studentIds = students.map(s => s._id)
    
    // Get latest predictions
    const predictions = await RiskPrediction.find({ studentId: { $in: studentIds } })
      .sort({ createdAt: -1 })
      .lean()
    
    const latestPredictions = {}
    predictions.forEach(pred => {
      if (!latestPredictions[pred.studentId]) {
        latestPredictions[pred.studentId] = pred
      }
    })
    
    // Calculate statistics
    const latestRisks = Object.values(latestPredictions).map(p => p.riskScore)
    const riskLevels = Object.values(latestPredictions).map(p => p.riskLevel)
    
    const stats = {
      totalStudents: students.length,
      avgRisk: latestRisks.length > 0 ? latestRisks.reduce((a, b) => a + b) / latestRisks.length : 0,
      medianRisk: latestRisks.length > 0 ? latestRisks.sort()[Math.floor(latestRisks.length / 2)] : 0,
      riskDistribution: {
        low: riskLevels.filter(r => r === 'low').length,
        moderate: riskLevels.filter(r => r === 'moderate').length,
        high: riskLevels.filter(r => r === 'high').length
      },
      maxRisk: Math.max(...latestRisks, 0),
      minRisk: latestRisks.length > 0 ? Math.min(...latestRisks) : 0,
      
      // Calculate standard deviation
      stdDev: latestRisks.length > 1 ? Math.sqrt(
        latestRisks.reduce((sq, n) => sq + Math.pow(n - (latestRisks.reduce((a, b) => a + b) / latestRisks.length), 2), 0) / latestRisks.length
      ) : 0
    }
    
    // Get active alerts
    const alerts = await Alert.countDocuments({
      studentId: { $in: studentIds },
      status: 'active'
    })
    
    return res.json({
      cohortId,
      timestamp: new Date().toISOString(),
      students: stats,
      alerts,
      activeInterventions: interventions,
      metadata: {
        lastUpdated: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('[Cohort Overview Error]', error)
    return res.status(500).json(handleError(error, 'Failed to fetch cohort overview'))
  }
})

// GET /api/analytics/cohort/:cohortId/risk-distribution - Risk level breakdown
router.get('/cohort/:cohortId/risk-distribution', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const { cohortId } = req.params
    
    const students = await Student.find({ cohortId }).select('_id').lean()
    const studentIds = students.map(s => s._id)
    
    const predictions = await RiskPrediction.find({ studentId: { $in: studentIds } })
      .sort({ createdAt: -1 })
      .lean()
    
    // Get latest unique predictions
    const latestMap = {}
    predictions.forEach(p => {
      if (!latestMap[p.studentId]) latestMap[p.studentId] = p
    })
    
    const distribution = Object.values(latestMap).reduce((acc, pred) => {
      const level = pred.riskLevel
      acc[level] = (acc[level] || 0) + 1
      return acc
    }, {})
    
    return res.json({
      cohortId,
      distribution: {
        low: distribution.low || 0,
        moderate: distribution.moderate || 0,
        high: distribution.high || 0
      },
      total: Object.values(distribution).reduce((a, b) => a + b, 0)
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/analytics/cohort/:cohortId/trends?days=14 - Risk trends over time
router.get('/cohort/:cohortId/trends', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const { cohortId } = req.params
    const days = parseInt(req.query.days) || 14
    
    const students = await Student.find({ cohortId }).select('_id').lean()
    const studentIds = students.map(s => s._id)
    
    // Get predictions from last N days
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    const predictions = await RiskPrediction.find({
      studentId: { $in: studentIds },
      createdAt: { $gte: startDate }
    }).sort({ createdAt: 1 }).lean()
    
    // Group by date and calculate daily averages
    const dailyStats = {}
    predictions.forEach(pred => {
      const date = new Date(pred.createdAt).toISOString().split('T')[0]
      if (!dailyStats[date]) {
        dailyStats[date] = { scores: [], levels: {} }
      }
      dailyStats[date].scores.push(pred.riskScore)
      dailyStats[date].levels[pred.riskLevel] = (dailyStats[date].levels[pred.riskLevel] || 0) + 1
    })
    
    const trend = Object.entries(dailyStats).map(([date, data]) => ({
      date,
      avgRisk: data.scores.reduce((a, b) => a + b) / data.scores.length,
      distribution: data.levels,
      sampleSize: data.scores.length
    }))
    
    return res.json({
      cohortId,
      period: `${days} days`,
      trend
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

/**
 * STUDENT ANALYTICS
 */

// GET /api/analytics/student/:studentId/trajectory - Individual risk trajectory
router.get('/student/:studentId/trajectory', requireAuth, async (req, res) => {
  try {
    const { studentId } = req.params
    
    // Check authorization
    const student = await Student.findById(studentId)
    if (!student) return res.status(404).json({ error: 'Student not found' })
    
    const predictions = await RiskPrediction.find({ studentId })
      .sort({ createdAt: 1 })
      .lean()
    
    const trajectory = predictions.map(p => ({
      date: p.createdAt,
      riskScore: p.riskScore,
      riskLevel: p.riskLevel,
      confidence: p.confidence
    }))
    
    // Calculate trend direction
    const isRising = trajectory.length >= 2 && 
      trajectory[trajectory.length - 1].riskScore > trajectory[0].riskScore
    
    return res.json({
      studentId,
      predictions: trajectory.length,
      trajectory,
      trend: isRising ? 'rising' : 'falling',
      latest: trajectory[trajectory.length - 1] || null,
      earliest: trajectory[0] || null
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/analytics/student/:studentId/profile - Detailed student profile with metrics
router.get('/student/:studentId/profile', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const { studentId } = req.params
    
    const student = await Student.findById(studentId)
    if (!student) return res.status(404).json({ error: 'Student not found' })
    
    // Get latest prediction
    const latestPred = await RiskPrediction.findOne({ studentId }).sort({ createdAt: -1 }).lean()
    
    // Get active alerts
    const alerts = await Alert.find({ studentId, status: 'active' }).lean()
    
    // Get recommendations
    const recommendations = await Recommendation.find({ studentId }).lean()
    
    // Get interventions
    const interventions = await Intervention.find({ studentId }).lean()
    
    // Calculate engagement (based on sessions)
    const sessions = student.sessions || []
    const last7Days = new Date()
    last7Days.setDate(last7Days.getDate() - 7)
    const recentSessions = sessions.filter(s => s > last7Days).length
    
    return res.json({
      _id: student._id,
      email: student.email,
      name: student.name,
      cohortId: student.cohortId,
      
      currentRisk: latestPred ? {
        score: latestPred.riskScore,
        level: latestPred.riskLevel,
        confidence: latestPred.confidence,
        updatedAt: latestPred.createdAt
      } : null,
      
      metrics: {
        totalSessions: sessions.length,
        recentActivity: recentSessions,
        alertsActive: alerts.length,
        recommendationsPending: recommendations.filter(r => r.status !== 'completed').length,
        interventionsActive: interventions.filter(i => i.status === 'in-progress').length
      },
      
      recentAlerts: alerts.slice(0, 5),
      activeInterventions: interventions.filter(i => i.status === 'in-progress')
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

/**
 * COMPARISON & INSIGHTS
 */

// GET /api/analytics/compare?studentIds=id1,id2,id3 - Compare multiple students
router.get('/compare', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const { studentIds } = req.query
    if (!studentIds) return res.status(400).json({ error: 'studentIds required' })
    
    const ids = Array.isArray(studentIds) ? studentIds : studentIds.split(',')
    
    const comparisons = await Promise.all(ids.map(async (id) => {
      const pred = await RiskPrediction.findOne({ studentId: id }).sort({ createdAt: -1 }).lean()
      const student = await Student.findById(id).lean()
      return {
        studentId: id,
        name: student?.name,
        email: student?.email,
        riskScore: pred?.riskScore,
        riskLevel: pred?.riskLevel,
        confidence: pred?.confidence
      }
    }))
    
    return res.json({ students: comparisons })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/analytics/cohort/:cohortId/performance - Cohort performance insights
router.get('/cohort/:cohortId/performance', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const { cohortId } = req.params
    
    const students = await Student.find({ cohortId }).lean()
    const studentIds = students.map(s => s._id)
    
    // Get all data
    const predictions = await RiskPrediction.find({ studentId: { $in: studentIds } }).sort({ createdAt: -1 }).lean()
    const recommendations = await Recommendation.find({ studentId: { $in: studentIds } }).lean()
    const interventions = await Intervention.find({ studentId: { $in: studentIds } }).lean()
    
    // Calculate metrics
    const latestPreds = {}
    predictions.forEach(p => {
      if (!latestPreds[p.studentId]) latestPreds[p.studentId] = p
    })
    
    const interventionEffectiveness = interventions
      .filter(i => i.effectiveness !== undefined)
      .map(i => i.effectiveness)
    
    const avgEffectiveness = interventionEffectiveness.length > 0
      ? interventionEffectiveness.reduce((a, b) => a + b) / interventionEffectiveness.length
      : 0
    
    return res.json({
      cohortId,
      performance: {
        totalStudents: students.length,
        avgRisk: Object.values(latestPreds).length > 0
          ? Object.values(latestPreds).reduce((sum, p) => sum + p.riskScore, 0) / Object.values(latestPreds).length
          : 0,
        recommendationsGenerated: recommendations.length,
        recommendationsAccepted: recommendations.filter(r => r.status === 'accepted').length,
        interventionsActive: interventions.filter(i => i.status === 'in-progress').length,
        interventionEffectiveness: avgEffectiveness
      }
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

export default router
