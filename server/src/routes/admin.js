import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import Student from '../models/Student.js'
import User from '../models/User.js'
import RiskPrediction from '../models/RiskPrediction.js'
import Alert from '../models/Alert.js'
import Intervention from '../models/Intervention.js'
import SelfReport from '../models/SelfReport.js'
import Grade from '../models/Grade.js'
import Attendance from '../models/Attendance.js'
import AssignmentSubmission from '../models/AssignmentSubmission.js'
import ActivityLog from '../models/ActivityLog.js'
import Session from '../models/Session.js'

const router = Router()

/**
 * ADMIN DASHBOARD ENDPOINTS
 */

// GET /api/admin/students?risk=high&cohort=...&page=1&limit=20
router.get('/students', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const { risk, cohort, page = 1, limit = 20, search } = req.query
    
    // Build filter
    const filter = {}
    if (cohort) filter.cohortId = cohort
    if (search) filter.$or = [
      { email: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } }
    ]
    
    // Get students
    let students = await Student.find(filter)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean()
    
    // Enhance with risk data
    const enhancedStudents = await Promise.all(students.map(async (student) => {
      const pred = await RiskPrediction.findOne({ studentId: student._id }).sort({ createdAt: -1 }).lean()
      const alertCount = await Alert.countDocuments({ studentId: student._id, status: 'active' })
      return {
        ...student,
        currentRisk: pred?.riskScore,
        riskLevel: pred?.riskLevel,
        activeAlerts: alertCount
      }
    }))
    
    // Filter by risk level if specified
    let filtered = enhancedStudents
    if (risk) {
      filtered = enhancedStudents.filter(s => s.riskLevel === risk)
    }
    
    const total = await Student.countDocuments(filter)
    
    return res.json({
      students: filtered,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/admin/students/critical - High risk students requiring immediate attention
router.get('/students/critical', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const students = await Student.find().lean()
    
    const criticalStudents = await Promise.all(students.map(async (student) => {
      const pred = await RiskPrediction.findOne({ studentId: student._id }).sort({ createdAt: -1 }).lean()
      const alerts = await Alert.find({ studentId: student._id, status: 'active' }).lean()
      
      if (pred?.riskLevel === 'high' || alerts.length > 2) {
        return {
          _id: student._id,
          email: student.email,
          name: student.name,
          riskScore: pred?.riskScore,
          riskLevel: pred?.riskLevel,
          criticalAlerts: alerts.length,
          needsIntervention: pred?.riskScore > 0.7
        }
      }
      return null
    }))
    
    return res.json({
      critical: criticalStudents.filter(s => s !== null).sort((a, b) => b.riskScore - a.riskScore)
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/admin/students/:id - Detailed student view
router.get('/students/:id', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('cohortId', 'name')
      .lean()
    
    if (!student) return res.status(404).json({ error: 'Student not found' })
    
    // Get all predictions
    const predictions = await RiskPrediction.find({ studentId: student._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
    
    // Get all active alerts
    const alerts = await Alert.find({ studentId: student._id })
      .sort({ createdAt: -1 })
      .lean()
    
    // Get all interventions
    const interventions = await Intervention.find({ studentId: student._id })
      .populate('mentorId', 'email name')
      .sort({ createdAt: -1 })
      .lean()
    
    return res.json({
      student,
      predictions: predictions.slice(0, 10),
      alerts,
      interventions
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/admin/alerts/critical - All critical alerts
router.get('/alerts/critical', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const alerts = await Alert.find({ status: 'active', severity: 'critical' })
      .populate('studentId', 'email name')
      .sort({ createdAt: -1 })
      .lean()
    
    return res.json({ alerts })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/admin/alerts - All active alerts with pagination
router.get('/alerts', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const { page = 1, limit = 20, severity } = req.query
    
    const filter = { status: 'active' }
    if (severity) filter.severity = severity
    
    const alerts = await Alert.find(filter)
      .populate('studentId', 'email name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean()
    
    const total = await Alert.countDocuments(filter)
    
    return res.json({
      alerts,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/admin/cohorts - All cohorts with metrics
router.get('/cohorts', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const cohorts = await Student.collection.aggregate([
      { $group: { _id: '$cohortId', count: { $sum: 1 } } }
    ]).toArray()
    
    const enriched = await Promise.all(cohorts.map(async (cohort) => {
      const students = await Student.find({ cohortId: cohort._id }).select('_id').lean()
      const studentIds = students.map(s => s._id)
      
      const preds = await RiskPrediction.find({ studentId: { $in: studentIds } })
        .sort({ createdAt: -1 })
        .lean()
      
      const latest = {}
      preds.forEach(p => {
        if (!latest[p.studentId]) latest[p.studentId] = p
      })
      
      const risks = Object.values(latest).map(p => p.riskScore)
      
      return {
        cohortId: cohort._id,
        studentCount: cohort.count,
        avgRisk: risks.length > 0 ? risks.reduce((a, b) => a + b) / risks.length : 0,
        highRiskCount: Object.values(latest).filter(p => p.riskLevel === 'high').length
      }
    }))
    
    return res.json({ cohorts: enriched })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/admin/dashboard/overview - Admin dashboard overview
router.get('/dashboard/overview', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments()
    const totalAlerts = await Alert.countDocuments({ status: 'active' })
    const criticalAlerts = await Alert.countDocuments({ status: 'active', severity: 'critical' })
    const activeInterventions = await Intervention.countDocuments({ status: 'in-progress' })
    
    // Get all students and their risks
    const students = await Student.find().select('_id').lean()
    const studentIds = students.map(s => s._id)
    
    const predictions = await RiskPrediction.find({ studentId: { $in: studentIds } })
      .sort({ createdAt: -1 })
      .lean()
    
    const latest = {}
    predictions.forEach(p => {
      if (!latest[p.studentId]) latest[p.studentId] = p
    })
    
    const riskLevels = Object.values(latest).map(p => p.riskLevel)
    
    return res.json({
      summary: {
        totalStudents,
        totalAlerts,
        criticalAlerts,
        activeInterventions
      },
      riskDistribution: {
        low: riskLevels.filter(r => r === 'low').length,
        moderate: riskLevels.filter(r => r === 'moderate').length,
        high: riskLevels.filter(r => r === 'high').length
      },
      avgRisk: Object.values(latest).length > 0
        ? Object.values(latest).reduce((sum, p) => sum + p.riskScore, 0) / Object.values(latest).length
        : 0
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/admin/export/training-data — export labeled prediction data for ML retraining
router.get('/export/training-data', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    // Fetch all predictions that have a featuresSnapshot (the 24-feature vector)
    const predictions = await RiskPrediction.find({
      featuresSnapshot: { $exists: true, $ne: {} }
    })
      .select('featuresSnapshot riskLevel riskScore studentId createdAt')
      .sort({ createdAt: -1 })
      .limit(10000)
      .lean()

    if (predictions.length === 0) {
      return res.status(404).json({ error: 'No labeled training data found' })
    }

    const FEATURES = [
      'session_duration', 'quiz_scores', 'load_score', 'activity_frequency',
      'sleep_hours', 'stress_score', 'submission_lateness', 'gpa',
      'attendance_rate', 'assignment_completion_rate', 'grade_trend',
      'days_since_last_activity', 'screen_time_hours', 'social_media_hours',
      'physical_activity_hours', 'anxiety_score', 'mood_score',
      'social_interaction_hours', 'academic_pressure_score',
      'extracurricular_load', 'placement_pressure', 'peer_stress',
      'sleep_quality', 'financial_stress'
    ]

    const format = req.query.format || 'json'

    if (format === 'csv') {
      const header = [...FEATURES, 'burnout_risk', 'risk_score', 'student_id', 'created_at'].join(',')
      const rows = predictions.map(p => {
        const snap = p.featuresSnapshot || {}
        const featureValues = FEATURES.map(f => {
          const v = snap[f]
          return v !== undefined && v !== null ? Number(v) : ''
        })
        return [
          ...featureValues,
          p.riskLevel || '',
          p.riskScore !== undefined ? p.riskScore : '',
          p.studentId?.toString() || '',
          p.createdAt ? new Date(p.createdAt).toISOString() : ''
        ].join(',')
      })

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename="edge_training_export.csv"')
      return res.send([header, ...rows].join('\n'))
    }

    // Default: JSON
    const records = predictions.map(p => ({
      features: p.featuresSnapshot,
      burnout_risk: p.riskLevel,
      risk_score: p.riskScore,
      student_id: p.studentId?.toString(),
      created_at: p.createdAt
    }))

    return res.json({
      count: records.length,
      records
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/admin/users - list all users (admin only)
router.get('/users', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 100, role } = req.query
    const filter = {}
    if (role) filter.role = role

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .lean(),
      User.countDocuments(filter)
    ])

    return res.json({ users, pagination: { total, page: Number(page), limit: Number(limit) } })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// PATCH /api/admin/users/:id - update user active status (admin only)
router.patch('/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { isActive } = req.body
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    ).select('-passwordHash')
    if (!user) return res.status(404).json({ error: 'User not found' })
    return res.json(user)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// POST /api/admin/retrain - Trigger ML model retraining
router.post('/retrain', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const mlUrl = (process.env.ML_SERVICE_URL || 'http://localhost:5001') + '/retrain'
    const headers = { 'Content-Type': 'application/json' }
    if (process.env.ML_SECRET_TOKEN) {
      headers['Authorization'] = 'Bearer ' + process.env.ML_SECRET_TOKEN
    }

    const response = await fetch(mlUrl, { method: 'POST', headers })

    const data = await response.json().catch(() => ({}))
    return res.status(response.status).json(data)
  } catch (error) {
    if (error.cause?.code === 'ECONNREFUSED' || error.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'ML service is unreachable' })
    }
    return res.status(503).json({ error: 'Failed to contact ML service', message: error.message })
  }
})

export default router
