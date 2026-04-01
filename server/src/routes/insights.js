import { Router } from 'express'
import { z } from 'zod'
import mongoose from 'mongoose'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import Student from '../models/Student.js'
import RiskPrediction from '../models/RiskPrediction.js'
import Alert from '../models/Alert.js'
import ActivityLog from '../models/ActivityLog.js'

const router = Router()

// Validation schemas
const querySchema = z.object({
  days: z.string().optional().transform(val => val ? Math.max(1, Math.min(90, parseInt(val))) : 30),
  limit: z.string().optional().transform(val => val ? Math.max(1, Math.min(100, parseInt(val))) : 50),
  page: z.string().optional().transform(val => val ? Math.max(1, parseInt(val)) : 1)
})

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

function handleError(error, defaultMessage = 'Operation failed') {
  console.error('[Insights Error]', error)
  return {
    error: defaultMessage,
    message: error.message,
    type: error.name,
    timestamp: new Date().toISOString()
  }
}

/**
 * ADVANCED INSIGHTS & PREDICTIVE FEATURES
 */

// GET /api/insights - list cohort-level insight summaries
router.get('/', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const { limit = 10 } = req.query
    const students = await Student.find().select('_id cohortId').lean()
    const cohortIds = [...new Set(students.map(s => s.cohortId).filter(Boolean))]

    const insights = await Promise.all(cohortIds.slice(0, Number(limit)).map(async (cohortId) => {
      const cohortStudents = students.filter(s => String(s.cohortId) === String(cohortId))
      const studentIds = cohortStudents.map(s => s._id)
      const preds = await RiskPrediction.find({ studentId: { $in: studentIds } })
        .sort({ createdAt: -1 }).lean()
      const latest = {}
      preds.forEach(p => { if (!latest[p.studentId]) latest[p.studentId] = p })
      const scores = Object.values(latest).map(p => p.riskScore)
      const avgRiskScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
      const highRiskCount = Object.values(latest).filter(p => p.riskLevel === 'high').length
      return {
        cohortId,
        totalStudents: cohortStudents.length,
        avgRiskScore,
        highRiskCount
      }
    }))

    return res.json({ insights })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/insights/early-warning - Detect students at risk soon
router.get('/early-warning', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    // Validate query parameters
    const { limit, days } = querySchema.parse(req.query)
    const lookbackDate = new Date()
    lookbackDate.setDate(lookbackDate.getDate() - days)

    const students = await Student.find().lean()
    
    const atRisk = await Promise.all(students.map(async (student) => {
      const predictions = await RiskPrediction.find({ studentId: student._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
      
      if (predictions.length < 2) return null
      
      // Check if risk is rising
      const isRising = predictions[0].riskScore > predictions[predictions.length - 1].riskScore
      const hasHighRecent = predictions.slice(0, 2).some(p => p.riskLevel === 'high')
      
      // Early warning if moderate risk trending up
      const warning = predictions[0].riskLevel === 'moderate' && isRising
      
      if (warning || hasHighRecent) {
        return {
          studentId: student._id,
          email: student.email,
          name: student.name,
          currentRisk: predictions[0].riskScore,
          trend: isRising ? 'rising' : 'stable',
          warningPoints: [
            ...(isRising ? ['Risk increasing'] : []),
            ...(hasHighRecent ? ['Recent high risk'] : []),
            ...(predictions[0].confidence > 0.8 ? ['High confidence'] : [])
          ]
        }
      }
      return null
    }))
    
    const filtered = atRisk.filter(s => s !== null).sort((a, b) => b.currentRisk - a.currentRisk)
    
    return res.json({
      earlyWarning: filtered.slice(0, limit),
      total: filtered.length,
      metadata: {
        lookbackDays: days,
        studentsAnalyzed: students.length,
        generatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('[Early Warning Error]', error)
    return res.status(error.name === 'ZodError' ? 400 : 500).json(handleError(error, 'Failed to fetch early warnings'))
  }
})

// GET /api/insights/peer-comparison/:studentId - Compare with cohort peers
router.get('/peer-comparison/:studentId', requireAuth, async (req, res) => {
  try {
    // Validate studentId
    if (!isValidObjectId(req.params.studentId)) {
      return res.status(400).json({ error: 'Invalid student ID format', id: req.params.studentId })
    }

    const student = await Student.findById(req.params.studentId)
    if (!student) return res.status(404).json({ error: 'Student not found', studentId: req.params.studentId })
    
    // Get all students in same cohort
    const cohortStudents = await Student.find({ cohortId: student.cohortId })
      .select('_id')
      .lean()
    
    const cohortIds = cohortStudents.map(s => s._id)
    
    // Get latest predictions for all
    const predictions = await RiskPrediction.find({
      studentId: { $in: cohortIds }
    }).sort({ createdAt: -1 }).lean()
    
    const latestMap = {}
    predictions.forEach(p => {
      if (!latestMap[p.studentId]) latestMap[p.studentId] = p
    })
    
    const cohortRisks = Object.values(latestMap).map(p => p.riskScore)
    const studentRisk = latestMap[student._id]?.riskScore || 0
    
    // Calculate percentile
    const sorted = cohortRisks.sort((a, b) => a - b)
    const percentile = (sorted.filter(r => r < studentRisk).length / sorted.length) * 100
    
    // Calculate standard deviation
    const avgRisk = cohortRisks.reduce((a, b) => a + b) / cohortRisks.length
    const variance = cohortRisks.reduce((sum, r) => sum + Math.pow(r - avgRisk, 2), 0) / cohortRisks.length
    const stdDev = Math.sqrt(variance)

    return res.json({
      student: {
        _id: student._id,
        name: student.name,
        riskScore: studentRisk,
        riskLevel: latestMap[student._id]?.riskLevel || 'unknown',
        rank: sorted.filter(r => r > studentRisk).length + 1,
        zScore: stdDev > 0 ? ((studentRisk - avgRisk) / stdDev).toFixed(2) : 0
      },
      cohort: {
        cohortId: student.cohortId,
        totalStudents: cohortIds.length,
        avgRisk: avgRisk.toFixed(3),
        medianRisk: sorted[Math.floor(sorted.length / 2)]?.toFixed(3) || 0,
        maxRisk: Math.max(...cohortRisks).toFixed(3),
        minRisk: Math.min(...cohortRisks).toFixed(3),
        stdDev: stdDev.toFixed(3)
      },
      percentile: percentile.toFixed(1),
      interpretation: percentile > 75 ? 'Higher risk than most peers' : percentile > 50 ? 'Average for cohort' : 'Lower risk than most',
      metadata: {
        generatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('[Peer Comparison Error]', error)
    return res.status(500).json(handleError(error, 'Failed to compare with peers'))
  }
})

// GET /api/insights/patterns - Detect common burnout patterns
router.get('/patterns', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const { limit, days } = querySchema.parse(req.query)
    const lookbackDate = new Date()
    lookbackDate.setDate(lookbackDate.getDate() - days)

    const students = await Student.find().lean()
    
    // Collect patterns from high-risk students
    const patterns = {
      timeOfDay: {},
      dayOfWeek: {},
      commonAlertCombos: {}
    }
    
    // Get high-risk students
    const predictions = await RiskPrediction.find({ riskLevel: 'high' }).lean()
    const highRiskStudents = [...new Set(predictions.map(p => p.studentId.toString()))]
    
    // Analyze alerts for these students
    const alerts = await Alert.find({ 
      studentId: { $in: predictions.map(p => p.studentId) }
    }).lean()
    
    // Group alerts by type combo
    alerts.forEach(alert => {
      const key = alert.message.substring(0, 30)
      patterns.commonAlertCombos[key] = (patterns.commonAlertCombos[key] || 0) + 1
    })
    
    // Get top patterns
    const topPatterns = Object.entries(patterns.commonAlertCombos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern, count]) => ({ pattern, occurrences: count }))
    
    return res.json({
      highRiskStudents: highRiskStudents.length,
      topAlertPatterns: topPatterns.slice(0, limit),
      affectedStudents: highRiskStudents.length > 0 
        ? Math.round((highRiskStudents.length / students.length) * 100)
        : 0,
      metadata: {
        totalStudents: students.length,
        totalAlerts: alerts.length,
        lookbackDays: days,
        generatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/insights/engagement/:studentId - Student engagement analysis
router.get('/engagement/:studentId', requireAuth, async (req, res) => {
  try {
    const { days } = querySchema.parse(req.query)

    // Validate studentId
    if (!isValidObjectId(req.params.studentId)) {
      return res.status(400).json({ error: 'Invalid student ID format', id: req.params.studentId })
    }

    const student = await Student.findById(req.params.studentId)
    if (!student) return res.status(404).json({ error: 'Student not found', studentId: req.params.studentId })
    
    // Get activity logs
    const lookbackDate = new Date()
    lookbackDate.setDate(lookbackDate.getDate() - days)
    
    const activities = await ActivityLog.find({
      studentId: req.params.studentId,
      timestamp: { $gte: lookbackDate }
    }).lean()
    
    // Calculate engagement score (0-100)
    const activityCount = activities.length
    const uniqueDays = new Set(activities.map(a => new Date(a.timestamp).toDateString())).size
    const avgPerDay = uniqueDays > 0 ? activityCount / uniqueDays : 0
    
    // Engagement score factors
    const frequencyScore = Math.min(avgPerDay * 20, 40) // Max 40 points
    const consistencyScore = uniqueDays >= 5 ? 40 : (uniqueDays / 5) * 40 // Max 40 points
    const recencyScore = activities.length > 0 ? 20 : 0 // Max 20 points
    
    const engagementScore = Math.round(frequencyScore + consistencyScore + recencyScore)
    
    return res.json({
      studentId: req.params.studentId,
      name: student.name,
      period: `${days} days`,
      metrics: {
        totalActivities: activityCount,
        activeDays: uniqueDays,
        avgPerDay: parseFloat(avgPerDay.toFixed(2)),
        engagementScore,
        engagementLevel: engagementScore >= 70 ? 'high' : engagementScore >= 40 ? 'moderate' : 'low',
        frequencyScore: Math.round(frequencyScore),
        consistencyScore: Math.round(consistencyScore),
        recencyScore
      },
      trend: activityCount > 5 ? 'consistent' : 'sporadic',
      metadata: {
        lookbackDays: days,
        generatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('[Engagement Error]', error)
    return res.status(error.name === 'ZodError' ? 400 : 500).json(handleError(error, 'Failed to analyze engagement'))
  }
})

// GET /api/insights/recovery-trajectory/:studentId - Predict recovery if intervened
router.get('/recovery-trajectory/:studentId', requireAuth, async (req, res) => {
  try {
    // Validate studentId
    if (!isValidObjectId(req.params.studentId)) {
      return res.status(400).json({ error: 'Invalid student ID format', id: req.params.studentId })
    }

    const { days = 14 } = req.query
    const projectionDays = Math.max(7, Math.min(30, parseInt(days)))

    const predictions = await RiskPrediction.find({ studentId: req.params.studentId })
      .sort({ createdAt: 1 })
      .lean()
    
    if (predictions.length < 2) {
      return res.json({ message: 'Not enough data for trajectory analysis' })
    }
    
    // Calculate trend
    const recent = predictions.slice(-7)
    if (recent.length < 2) {
      return res.json({ message: 'Not enough recent data' })
    }
    
    const firstScore = recent[0].riskScore
    const lastScore = recent[recent.length - 1].riskScore
    const scoreChange = lastScore - firstScore
    const dailyChange = scoreChange / (recent.length - 1)
    
    // Project N days with intervention effect
    const projections = []
    let projectedScore = lastScore
    const interventionFactor = 0.75 // Intervention reduces negative trend by 25%
    
    for (let i = 0; i < projectionDays; i++) {
      projectedScore += dailyChange * interventionFactor
      const clampedScore = Math.max(0, Math.min(1, projectedScore))
      projections.push({
        day: i + 1,
        projectedRisk: parseFloat(clampedScore.toFixed(3)),
        projectedLevel: clampedScore < 0.33 ? 'low' : clampedScore < 0.66 ? 'moderate' : 'high',
        confidence: Math.max(0.5, 1 - (i * 0.03)) // Confidence decreases with projection distance
      })
    }
    
    const recoveryDay = projections.findIndex(p => p.projectedLevel === 'low') + 1
    const improvementDay = projections.findIndex(p => p.projectedLevel !== 'high') + 1

    return res.json({
      studentId: req.params.studentId,
      current: {
        score: parseFloat(lastScore.toFixed(3)),
        level: recent[recent.length - 1].riskLevel,
        trend: dailyChange > 0.001 ? 'increasing' : dailyChange < -0.001 ? 'decreasing' : 'stable'
      },
      analysis: {
        dailyChangeRate: parseFloat(dailyChange.toFixed(4)),
        recentDataPoints: recent.length,
        interventionFactor: interventionFactor
      },
      projections,
      estimations: {
        recoveryToLowRisk: recoveryDay || 'beyond projection period',
        improvementFromHigh: improvementDay || (lastScore < 0.66 ? 'already improved' : 'beyond projection period'),
        projectionDays
      },
      recommendations: {
        interventionRecommended: lastScore > 0.6 && dailyChange > 0,
        urgency: lastScore > 0.75 ? 'high' : lastScore > 0.5 ? 'medium' : 'low'
      },
      metadata: {
        generatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('[Recovery Trajectory Error]', error)
    return res.status(500).json(handleError(error, 'Failed to compute recovery trajectory'))
  }
})

// GET /api/insights/cohort-trends/:cohortId - Cohort-level trends
router.get('/cohort-trends/:cohortId', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const { days } = querySchema.parse(req.query)

    // Validate cohortId
    if (!isValidObjectId(req.params.cohortId)) {
      return res.status(400).json({ error: 'Invalid cohort ID format', id: req.params.cohortId })
    }

    const students = await Student.find({ cohortId: req.params.cohortId })
      .select('_id')
      .lean()
    
    if (students.length === 0) {
      return res.status(404).json({ error: 'No students found in cohort', cohortId: req.params.cohortId })
    }

    const studentIds = students.map(s => s._id)
    
    // Get N days of predictions
    const lookbackDate = new Date()
    lookbackDate.setDate(lookbackDate.getDate() - days)
    
    const predictions = await RiskPrediction.find({
      studentId: { $in: studentIds },
      createdAt: { $gte: lookbackDate }
    }).lean()
    
    // Group by date
    const dailyStats = {}
    predictions.forEach(pred => {
      const date = new Date(pred.createdAt).toISOString().split('T')[0]
      if (!dailyStats[date]) {
        dailyStats[date] = []
      }
      dailyStats[date].push(pred.riskScore)
    })
    
    // Calculate daily averages
    const trend = Object.entries(dailyStats)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, scores]) => ({
        date,
        avgRisk: scores.reduce((a, b) => a + b) / scores.length,
        maxRisk: Math.max(...scores),
        studentsReported: scores.length
      }))
    
    // Overall trend
    const firstWeek = trend.slice(0, 7)
    const lastWeek = trend.slice(-7)
    
    const avgFirst = firstWeek.length > 0
      ? firstWeek.reduce((sum, d) => sum + d.avgRisk, 0) / firstWeek.length
      : 0
    
    const avgLast = lastWeek.length > 0
      ? lastWeek.reduce((sum, d) => sum + d.avgRisk, 0) / lastWeek.length
      : 0
    
    const riskChange = avgLast - avgFirst
    const percentChange = avgFirst > 0 ? ((riskChange / avgFirst) * 100).toFixed(1) : 0

    return res.json({
      cohortId: req.params.cohortId,
      period: `${days} days`,
      students: {
        total: students.length,
        withData: new Set(predictions.map(p => p.studentId.toString())).size
      },
      trend,
      summary: {
        overallTrend: Math.abs(riskChange) < 0.01 ? 'stable' : avgLast > avgFirst ? 'worsening' : 'improving',
        riskChange: parseFloat((avgLast - avgFirst).toFixed(3)),
        percentChange: parseFloat(percentChange),
        currentAvgRisk: parseFloat(avgLast.toFixed(3)),
        firstWeekAvg: parseFloat(avgFirst.toFixed(3))
      },
      metadata: {
        lookbackDays: days,
        totalPredictions: predictions.length,
        generatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('[Cohort Trends Error]', error)
    return res.status(error.name === 'ZodError' ? 400 : 500).json(handleError(error, 'Failed to analyze cohort trends'))
  }
})

export default router
