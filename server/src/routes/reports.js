import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import Student from '../models/Student.js'
import RiskPrediction from '../models/RiskPrediction.js'
import Alert from '../models/Alert.js'
import Recommendation from '../models/Recommendation.js'
import Intervention from '../models/Intervention.js'
import Grade from '../models/Grade.js'
import Attendance from '../models/Attendance.js'
import Course from '../models/Course.js'
import Enrollment from '../models/Enrollment.js'
import AssignmentSubmission from '../models/AssignmentSubmission.js'

const router = Router()

/**
 * REPORT GENERATION & EXPORT
 */

// GET /api/reports - list recent reports summary (admin/mentor)
router.get('/', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const { limit = 20 } = req.query
    // Build a summary list from cohort reports
    const students = await Student.find().select('_id cohortId').lean()
    const cohortIds = [...new Set(students.map(s => s.cohortId).filter(Boolean))]

    const reports = await Promise.all(cohortIds.slice(0, Number(limit)).map(async (cohortId) => {
      const cohortStudents = students.filter(s => String(s.cohortId) === String(cohortId))
      const studentIds = cohortStudents.map(s => s._id)
      const latestPred = await RiskPrediction.findOne({ studentId: { $in: studentIds } })
        .sort({ createdAt: -1 }).lean()
      return {
        _id: cohortId,
        type: 'cohort',
        title: `Cohort ${cohortId} Report`,
        status: 'completed',
        createdAt: latestPred?.createdAt || new Date(),
        data: { students: cohortStudents.length }
      }
    }))

    return res.json({ reports })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// Helper: Convert to CSV
function convertToCSV(data, headers) {
  const csvHeaders = headers.join(',')
  const csvRows = data.map(row => 
    headers.map(header => {
      const value = row[header]
      // Escape commas and quotes in values
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }).join(',')
  )
  return [csvHeaders, ...csvRows].join('\n')
}

// GET /api/reports/student/:studentId - Generate student report
router.get('/student/:studentId', requireAuth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId)
    if (!student) return res.status(404).json({ error: 'Student not found' })
    
    // Get predictions
    const predictions = await RiskPrediction.find({ studentId: req.params.studentId })
      .sort({ createdAt: -1 })
      .lean()
    
    // Get alerts
    const alerts = await Alert.find({ studentId: req.params.studentId })
      .lean()
    
    // Get recommendations
    const recommendations = await Recommendation.find({ studentId: req.params.studentId })
      .lean()
    
    // Get interventions
    const interventions = await Intervention.find({ studentId: req.params.studentId })
      .lean()
    
    const latest = predictions[0] || {}
    
    const report = {
      student: {
        _id: student._id,
        email: student.email,
        name: student.name,
        cohortId: student.cohortId,
        registeredAt: student.createdAt
      },
      currentRisk: {
        score: latest.riskScore,
        level: latest.riskLevel,
        confidence: latest.confidence,
        updatedAt: latest.createdAt
      },
      statistics: {
        totalPredictions: predictions.length,
        totalAlerts: alerts.length,
        activeAlerts: alerts.filter(a => a.status === 'active').length,
        totalRecommendations: recommendations.length,
        acceptedRecommendations: recommendations.filter(r => r.status === 'accepted').length,
        activeInterventions: interventions.filter(i => i.status === 'in-progress').length,
        completedInterventions: interventions.filter(i => i.status === 'completed').length
      },
      recentPredictions: predictions.slice(0, 10).map(p => ({
        date: p.createdAt,
        score: p.riskScore,
        level: p.riskLevel,
        confidence: p.confidence
      })),
      alerts,
      recommendations,
      interventions
    }
    
    return res.json(report)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/reports/cohort/:cohortId - Generate cohort report
router.get('/cohort/:cohortId', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const students = await Student.find({ cohortId: req.params.cohortId })
      .lean()
    
    const studentIds = students.map(s => s._id)
    
    // Get all predictions
    const predictions = await RiskPrediction.find({ studentId: { $in: studentIds } })
      .lean()
    
    // Latest predictions per student
    const latestMap = {}
    predictions.forEach(p => {
      if (!latestMap[p.studentId]) latestMap[p.studentId] = p
    })
    
    const latestPreds = Object.values(latestMap)
    const risks = latestPreds.map(p => p.riskScore)
    
    // Get all alerts
    const alerts = await Alert.find({ studentId: { $in: studentIds } })
      .lean()
    
    // Get interventions
    const interventions = await Intervention.find({ studentId: { $in: studentIds } })
      .lean()
    
    const report = {
      cohort: {
        _id: req.params.cohortId,
        studentCount: students.length,
        reportDate: new Date()
      },
      riskMetrics: {
        avgRisk: risks.length > 0 ? risks.reduce((a, b) => a + b) / risks.length : 0,
        medianRisk: risks.length > 0 ? risks.sort()[Math.floor(risks.length / 2)] : 0,
        maxRisk: Math.max(...risks, 0),
        minRisk: Math.min(...risks, Infinity),
        riskDistribution: {
          low: latestPreds.filter(p => p.riskLevel === 'low').length,
          moderate: latestPreds.filter(p => p.riskLevel === 'moderate').length,
          high: latestPreds.filter(p => p.riskLevel === 'high').length
        }
      },
      alerts: {
        total: alerts.length,
        active: alerts.filter(a => a.status === 'active').length,
        critical: alerts.filter(a => a.severity === 'critical').length
      },
      interventions: {
        total: interventions.length,
        inProgress: interventions.filter(i => i.status === 'in-progress').length,
        completed: interventions.filter(i => i.status === 'completed').length,
        avgEffectiveness: interventions.length > 0 
          ? interventions.reduce((sum, i) => sum + (i.effectiveness || 0), 0) / interventions.length 
          : 0
      },
      studentSummary: students.map(s => ({
        email: s.email,
        name: s.name,
        riskScore: latestMap[s._id]?.riskScore,
        riskLevel: latestMap[s._id]?.riskLevel,
        activeAlerts: alerts.filter(a => a.studentId.equals(s._id)).length
      }))
    }
    
    return res.json(report)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/reports/export/students/csv?cohortId=... - Export students to CSV
router.get('/export/students/csv', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const { cohortId } = req.query
    
    const filter = cohortId ? { cohortId } : {}
    const students = await Student.find(filter).lean()
    
    // Enhance with risk data
    const enhanced = await Promise.all(students.map(async (s) => {
      const pred = await RiskPrediction.findOne({ studentId: s._id })
        .sort({ createdAt: -1 })
        .lean()
      return {
        email: s.email,
        name: s.name,
        cohortId: s.cohortId,
        riskScore: pred?.riskScore || 'N/A',
        riskLevel: pred?.riskLevel || 'N/A',
        registeredAt: s.createdAt.toISOString().split('T')[0]
      }
    }))
    
    const csv = convertToCSV(enhanced, ['email', 'name', 'cohortId', 'riskScore', 'riskLevel', 'registeredAt'])
    
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="students_${Date.now()}.csv"`)
    return res.send(csv)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/reports/export/predictions/csv?studentId=... - Export predictions to CSV
router.get('/export/predictions/csv', requireAuth, async (req, res) => {
  try {
    const { studentId, cohortId } = req.query
    
    let filter = {}
    if (studentId) {
      filter.studentId = studentId
    } else if (cohortId) {
      const students = await Student.find({ cohortId }).select('_id').lean()
      filter.studentId = { $in: students.map(s => s._id) }
    }
    
    const predictions = await RiskPrediction.find(filter)
      .sort({ createdAt: -1 })
      .lean()
    
    const data = predictions.map(p => ({
      studentId: p.studentId,
      date: p.createdAt.toISOString(),
      riskScore: p.riskScore,
      riskLevel: p.riskLevel,
      confidence: p.confidence
    }))
    
    const csv = convertToCSV(data, ['studentId', 'date', 'riskScore', 'riskLevel', 'confidence'])
    
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="predictions_${Date.now()}.csv"`)
    return res.send(csv)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/reports/export/alerts/csv - Export alerts to CSV
router.get('/export/alerts/csv', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const alerts = await Alert.find().lean()
    
    const data = alerts.map(a => ({
      studentId: a.studentId,
      severity: a.severity,
      message: a.message,
      status: a.status,
      createdAt: a.createdAt.toISOString()
    }))
    
    const csv = convertToCSV(data, ['studentId', 'severity', 'message', 'status', 'createdAt'])
    
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="alerts_${Date.now()}.csv"`)
    return res.send(csv)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/reports/export/interventions/csv - Export interventions to CSV
router.get('/export/interventions/csv', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const interventions = await Intervention.find().lean()
    
    const data = interventions.map(i => ({
      studentId: i.studentId,
      type: i.type,
      status: i.status,
      priority: i.priority,
      effectiveness: i.effectiveness || 'N/A',
      createdAt: i.createdAt.toISOString(),
      completedAt: i.completedAt ? i.completedAt.toISOString() : 'N/A'
    }))
    
    const csv = convertToCSV(data, ['studentId', 'type', 'status', 'priority', 'effectiveness', 'createdAt', 'completedAt'])
    
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="interventions_${Date.now()}.csv"`)
    return res.send(csv)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// POST /api/reports/generate/weekly - Generate weekly report for cohort
router.post('/generate/weekly', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const { cohortId } = req.body
    if (!cohortId) return res.status(400).json({ error: 'cohortId required' })
    
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    
    const students = await Student.find({ cohortId }).select('_id').lean()
    const studentIds = students.map(s => s._id)
    
    // Weekly predictions
    const predictions = await RiskPrediction.find({
      studentId: { $in: studentIds },
      createdAt: { $gte: weekAgo }
    }).lean()
    
    // Weekly alerts
    const alerts = await Alert.find({
      studentId: { $in: studentIds },
      createdAt: { $gte: weekAgo }
    }).lean()
    
    // Weekly interventions
    const interventions = await Intervention.find({
      studentId: { $in: studentIds },
      createdAt: { $gte: weekAgo }
    }).lean()
    
    return res.json({
      cohortId,
      week: {
        start: weekAgo,
        end: new Date()
      },
      summary: {
        predictions: predictions.length,
        alerts: alerts.length,
        interventions: interventions.length,
        highRiskStudents: predictions.filter(p => p.riskLevel === 'high').length
      },
      topAlerts: alerts.slice(0, 5),
      topInterventions: interventions.slice(0, 5)
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/reports/transcript/:studentId - Generate academic transcript
router.get('/transcript/:studentId', requireAuth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId)
    if (!student) return res.status(404).json({ error: 'Student not found' })

    const enrollments = await Enrollment.find({ studentId: req.params.studentId })
      .populate('courseId')

    const transcriptData = []
    let totalCredits = 0
    let totalWeightedGPA = 0

    for (const enrollment of enrollments) {
      const grades = await Grade.find({
        studentId: req.params.studentId,
        courseId: enrollment.courseId._id
      })

      if (grades.length > 0) {
        const courseAvg = grades.reduce((sum, g) => 
          sum + ((g.score / g.maxScore) * 100 * (g.weight || 1)), 0
        ) / grades.reduce((sum, g) => sum + (g.weight || 1), 0)

        const letterGrade = getLetterGrade(courseAvg)
        const gradePoints = getGradePoints(letterGrade)
        const credits = enrollment.courseId?.credits || 3

        totalCredits += credits
        totalWeightedGPA += gradePoints * credits

        transcriptData.push({
          courseCode: enrollment.courseId?.code,
          courseTitle: enrollment.courseId?.title,
          credits: credits,
          grade: letterGrade,
          gradePoints: gradePoints,
          semester: enrollment.courseId?.semester,
          year: enrollment.courseId?.year
        })
      }
    }

    const gpa = totalCredits > 0 ? (totalWeightedGPA / totalCredits).toFixed(2) : 0

    return res.json({
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        major: student.major
      },
      transcript: transcriptData,
      summary: {
        totalCredits,
        cumulativeGPA: parseFloat(gpa),
        totalCourses: transcriptData.length
      },
      generatedAt: new Date()
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/reports/progress/:studentId - Progress report with academic metrics
router.get('/progress/:studentId', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    const student = await Student.findById(req.params.studentId)
    if (!student) return res.status(404).json({ error: 'Student not found' })

    const filter = { studentId: req.params.studentId }
    if (startDate || endDate) {
      filter.createdAt = {}
      if (startDate) filter.createdAt.$gte = new Date(startDate)
      if (endDate) filter.createdAt.$lte = new Date(endDate)
    }

    const grades = await Grade.find(filter).populate('courseId', 'code title')
    const avgGrade = grades.length > 0
      ? grades.reduce((sum, g) => sum + ((g.score / g.maxScore) * 100), 0) / grades.length
      : 0

    const attendanceFilter = { studentId: req.params.studentId }
    if (startDate || endDate) {
      attendanceFilter.date = {}
      if (startDate) attendanceFilter.date.$gte = new Date(startDate)
      if (endDate) attendanceFilter.date.$lte = new Date(endDate)
    }
    const attendance = await Attendance.find(attendanceFilter)
    const attendanceRate = attendance.length > 0
      ? (attendance.filter(a => a.status === 'present' || a.status === 'late').length / attendance.length) * 100
      : 0

    const submissions = await AssignmentSubmission.find({
      studentId: req.params.studentId
    }).populate('assignmentId', 'title dueDate')

    const onTimeRate = submissions.length > 0
      ? (submissions.filter(s => !s.isLate).length / submissions.length) * 100
      : 0

    const riskPrediction = await RiskPrediction.findOne({ studentId: req.params.studentId })
      .sort({ createdAt: -1 })

    return res.json({
      student: {
        id: student._id,
        name: student.name,
        email: student.email
      },
      period: {
        startDate: startDate || 'all time',
        endDate: endDate || 'present'
      },
      metrics: {
        averageGrade: parseFloat(avgGrade.toFixed(2)),
        attendanceRate: parseFloat(attendanceRate.toFixed(2)),
        onTimeSubmissionRate: parseFloat(onTimeRate.toFixed(2)),
        totalGrades: grades.length,
        totalAttendanceRecords: attendance.length,
        totalSubmissions: submissions.length
      },
      riskAssessment: {
        riskLevel: riskPrediction?.riskLevel || 'unknown',
        probability: riskPrediction?.probability,
        lastAssessed: riskPrediction?.createdAt
      },
      recentGrades: grades.slice(-5).map(g => ({
        course: g.courseId?.code,
        score: g.score,
        maxScore: g.maxScore,
        percentage: ((g.score / g.maxScore) * 100).toFixed(2),
        date: g.createdAt
      })),
      generatedAt: new Date()
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/reports/course/:courseId - Course performance summary
router.get('/course/:courseId', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId)
    if (!course) return res.status(404).json({ error: 'Course not found' })

    const enrollments = await Enrollment.find({ courseId: req.params.courseId })
      .populate('studentId', 'name email')

    const studentIds = enrollments.map(e => e.studentId)

    const grades = await Grade.find({ courseId: req.params.courseId })
    const gradeDistribution = {}
    grades.forEach(g => {
      const percentage = (g.score / g.maxScore) * 100
      const letter = getLetterGrade(percentage)
      gradeDistribution[letter] = (gradeDistribution[letter] || 0) + 1
    })

    const avgGrade = grades.length > 0
      ? grades.reduce((sum, g) => sum + ((g.score / g.maxScore) * 100), 0) / grades.length
      : 0

    const attendance = await Attendance.find({ courseId: req.params.courseId })
    const attendanceRate = attendance.length > 0
      ? (attendance.filter(a => a.status === 'present' || a.status === 'late').length / attendance.length) * 100
      : 0

    return res.json({
      course: {
        id: course._id,
        code: course.code,
        title: course.title,
        credits: course.credits,
        semester: course.semester,
        year: course.year
      },
      enrollment: {
        total: enrollments.length,
        maxEnrollment: course.maxEnrollment
      },
      performance: {
        averageGrade: parseFloat(avgGrade.toFixed(2)),
        attendanceRate: parseFloat(attendanceRate.toFixed(2)),
        gradeDistribution,
        totalGrades: grades.length
      },
      students: enrollments.map(e => ({
        id: e.studentId?._id,
        name: e.studentId?.name,
        email: e.studentId?.email
      })),
      generatedAt: new Date()
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/reports/analytics/overview - System-wide analytics dashboard
router.get('/analytics/overview', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const [
      totalStudents,
      totalCourses,
      totalGrades,
      totalAttendance,
      activeEnrollments
    ] = await Promise.all([
      Student.countDocuments(),
      Course.countDocuments({ isActive: true }),
      Grade.countDocuments(),
      Attendance.countDocuments(),
      Enrollment.countDocuments()
    ])

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [
      recentGrades,
      recentAttendance,
      recentSubmissions
    ] = await Promise.all([
      Grade.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      Attendance.countDocuments({ date: { $gte: sevenDaysAgo } }),
      AssignmentSubmission.countDocuments({ submittedAt: { $gte: sevenDaysAgo } })
    ])

    const riskDistribution = await RiskPrediction.aggregate([
      {
        $group: {
          _id: '$riskLevel',
          count: { $sum: 1 }
        }
      }
    ])

    return res.json({
      systemOverview: {
        totalStudents,
        totalCourses,
        totalGrades,
        totalAttendanceRecords: totalAttendance,
        activeEnrollments
      },
      recentActivity: {
        gradesEntered: recentGrades,
        attendanceMarked: recentAttendance,
        assignmentsSubmitted: recentSubmissions
      },
      riskDistribution: riskDistribution.reduce((acc, item) => {
        acc[item._id] = item.count
        return acc
      }, {}),
      generatedAt: new Date()
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// Helper functions for grade calculation
function getLetterGrade(percentage) {
  if (percentage >= 97) return 'A+'
  if (percentage >= 93) return 'A'
  if (percentage >= 90) return 'A-'
  if (percentage >= 87) return 'B+'
  if (percentage >= 83) return 'B'
  if (percentage >= 80) return 'B-'
  if (percentage >= 77) return 'C+'
  if (percentage >= 73) return 'C'
  if (percentage >= 70) return 'C-'
  if (percentage >= 67) return 'D+'
  if (percentage >= 63) return 'D'
  if (percentage >= 60) return 'D-'
  return 'F'
}

function getGradePoints(letterGrade) {
  const gradeMap = {
    'A+': 4.0, 'A': 4.0, 'A-': 3.7,
    'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7,
    'D+': 1.3, 'D': 1.0, 'D-': 0.7,
    'F': 0.0
  }
  return gradeMap[letterGrade] || 0
}

export default router
