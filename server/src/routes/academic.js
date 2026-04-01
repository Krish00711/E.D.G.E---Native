import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import Grade from '../models/Grade.js'
import Attendance from '../models/Attendance.js'
import Enrollment from '../models/Enrollment.js'
import Student from '../models/Student.js'
import RiskPrediction from '../models/RiskPrediction.js'
import AssignmentSubmission from '../models/AssignmentSubmission.js'

const router = Router()

// GET /api/academic/student/:studentId/overview - Comprehensive academic overview
router.get('/student/:studentId/overview', requireAuth, async (req, res) => {
  const { semester } = req.query
  const studentId = req.params.studentId

  // Get enrollments
  const enrollments = await Enrollment.find({ studentId })
    .populate('courseId')

  // Get GPA
  const grades = await Grade.find({ studentId })
  let gpa = 0
  if (grades.length > 0) {
    const totalWeightedScore = grades.reduce((sum, g) => {
      const percentage = (g.score / g.maxScore) * 100
      return sum + (percentage * (g.weight || 1))
    }, 0)
    const totalWeight = grades.reduce((sum, g) => sum + (g.weight || 1), 0)
    gpa = totalWeight > 0 ? (totalWeightedScore / totalWeight) / 25 : 0
  }

  // Get attendance rate
  const attendanceRecords = await Attendance.find({ studentId })
  let attendanceRate = 0
  if (attendanceRecords.length > 0) {
    const attended = attendanceRecords.filter(r => 
      r.status === 'present' || r.status === 'late'
    ).length
    attendanceRate = (attended / attendanceRecords.length) * 100
  }

  // Get assignment completion rate
  const submissions = await AssignmentSubmission.find({ studentId })
  const completionRate = submissions.length > 0 
    ? (submissions.filter(s => s.status !== 'missing').length / submissions.length) * 100
    : 0

  // Get latest risk prediction
  const latestPrediction = await RiskPrediction.findOne({ studentId })
    .sort({ createdAt: -1 })

  // Calculate academic standing
  let standing = 'Good Standing'
  if (gpa < 2.0) standing = 'Academic Probation'
  else if (gpa > 3.5) standing = 'Dean\'s List'

  return res.json({
    studentId,
    currentGPA: parseFloat(gpa.toFixed(2)),
    attendanceRate: parseFloat(attendanceRate.toFixed(2)),
    assignmentCompletionRate: parseFloat(completionRate.toFixed(2)),
    enrolledCourses: enrollments.length,
    totalGrades: grades.length,
    academicStanding: standing,
    currentRiskLevel: latestPrediction?.riskLevel || 'unknown',
    courses: enrollments.map(e => ({
      code: e.courseId?.code,
      title: e.courseId?.title,
      credits: e.courseId?.credits
    }))
  })
})

// GET /api/academic/student/:studentId/performance-trends - Performance over time
router.get('/student/:studentId/performance-trends', requireAuth, async (req, res) => {
  const { days = 90 } = req.query
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - parseInt(days))

  const grades = await Grade.find({
    studentId: req.params.studentId,
    createdAt: { $gte: startDate }
  }).sort({ createdAt: 1 })

  const attendance = await Attendance.find({
    studentId: req.params.studentId,
    date: { $gte: startDate }
  }).sort({ date: 1 })

  const submissions = await AssignmentSubmission.find({
    studentId: req.params.studentId,
    submittedAt: { $gte: startDate }
  }).sort({ submittedAt: 1 })

  // Calculate weekly metrics
  const weeklyMetrics = {}
  
  grades.forEach(grade => {
    const week = getWeekKey(grade.createdAt)
    if (!weeklyMetrics[week]) weeklyMetrics[week] = { grades: [], attendance: [], submissions: [] }
    weeklyMetrics[week].grades.push((grade.score / grade.maxScore) * 100)
  })

  attendance.forEach(record => {
    const week = getWeekKey(record.date)
    if (!weeklyMetrics[week]) weeklyMetrics[week] = { grades: [], attendance: [], submissions: [] }
    weeklyMetrics[week].attendance.push(record.status === 'present' || record.status === 'late' ? 1 : 0)
  })

  submissions.forEach(sub => {
    const week = getWeekKey(sub.submittedAt)
    if (!weeklyMetrics[week]) weeklyMetrics[week] = { grades: [], attendance: [], submissions: [] }
    weeklyMetrics[week].submissions.push(sub.isLate ? 0 : 1)
  })

  const trends = Object.entries(weeklyMetrics).map(([week, data]) => ({
    week,
    averageGrade: data.grades.length > 0 
      ? data.grades.reduce((a, b) => a + b, 0) / data.grades.length 
      : null,
    attendanceRate: data.attendance.length > 0
      ? (data.attendance.reduce((a, b) => a + b, 0) / data.attendance.length) * 100
      : null,
    onTimeSubmissionRate: data.submissions.length > 0
      ? (data.submissions.reduce((a, b) => a + b, 0) / data.submissions.length) * 100
      : null
  }))

  return res.json({ trends, totalWeeks: trends.length })
})

// Helper function to get week key
function getWeekKey(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const week = Math.ceil((d - new Date(year, 0, 1)) / (7 * 24 * 60 * 60 * 1000))
  return `${year}-W${week}`
}

// GET /api/academic/course/:courseId/performance - Course performance analytics
router.get('/course/:courseId/performance', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const courseId = req.params.courseId

  // Get all students in course
  const enrollments = await Enrollment.find({ courseId })
  const studentIds = enrollments.map(e => e.studentId)

  // Get grades
  const grades = await Grade.find({ courseId })

  if (grades.length === 0) {
    return res.json({ message: 'No grade data available for this course' })
  }

  // Calculate statistics
  const percentages = grades.map(g => (g.score / g.maxScore) * 100)
  const average = percentages.reduce((a, b) => a + b, 0) / percentages.length

  // Get attendance for this course
  const attendance = await Attendance.find({ courseId })
  const attendanceRate = attendance.length > 0
    ? (attendance.filter(a => a.status === 'present' || a.status === 'late').length / attendance.length) * 100
    : 0

  // Get submission statistics
  const submissions = await AssignmentSubmission.find({
    studentId: { $in: studentIds }
  })

  const onTimeRate = submissions.length > 0
    ? (submissions.filter(s => !s.isLate).length / submissions.length) * 100
    : 0

  // Identify struggling students (bottom 25%)
  const studentGrades = {}
  grades.forEach(grade => {
    const sid = grade.studentId.toString()
    if (!studentGrades[sid]) studentGrades[sid] = []
    studentGrades[sid].push((grade.score / grade.maxScore) * 100)
  })

  const studentAverages = Object.entries(studentGrades).map(([studentId, scores]) => ({
    studentId,
    average: scores.reduce((a, b) => a + b, 0) / scores.length
  })).sort((a, b) => a.average - b.average)

  const strugglingCount = Math.ceil(studentAverages.length * 0.25)
  const strugglingStudents = studentAverages.slice(0, strugglingCount)

  return res.json({
    courseId,
    totalStudents: studentIds.length,
    averageGrade: parseFloat(average.toFixed(2)),
    attendanceRate: parseFloat(attendanceRate.toFixed(2)),
    onTimeSubmissionRate: parseFloat(onTimeRate.toFixed(2)),
    totalGrades: grades.length,
    strugglingStudents: strugglingStudents.length,
    strugglingStudentIds: strugglingStudents.map(s => s.studentId)
  })
})

// GET /api/academic/comparison - Compare students
router.get('/comparison', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const { studentIds } = req.query

  if (!studentIds) {
    return res.status(400).json({ error: 'studentIds query parameter required' })
  }

  const ids = studentIds.split(',')
  const comparisons = []

  for (const studentId of ids) {
    const grades = await Grade.find({ studentId })
    let gpa = 0
    if (grades.length > 0) {
      const totalWeightedScore = grades.reduce((sum, g) => {
        const percentage = (g.score / g.maxScore) * 100
        return sum + (percentage * (g.weight || 1))
      }, 0)
      const totalWeight = grades.reduce((sum, g) => sum + (g.weight || 1), 0)
      gpa = totalWeight > 0 ? (totalWeightedScore / totalWeight) / 25 : 0
    }

    const attendanceRecords = await Attendance.find({ studentId })
    const attendanceRate = attendanceRecords.length > 0
      ? (attendanceRecords.filter(r => r.status === 'present' || r.status === 'late').length / attendanceRecords.length) * 100
      : 0

    const student = await Student.findById(studentId)

    comparisons.push({
      studentId,
      name: student?.name,
      gpa: parseFloat(gpa.toFixed(2)),
      attendanceRate: parseFloat(attendanceRate.toFixed(2)),
      totalGrades: grades.length,
      totalAttendanceRecords: attendanceRecords.length
    })
  }

  return res.json({ comparisons, totalStudents: comparisons.length })
})

// GET /api/academic/dropout-risk - Students at risk of dropping out
router.get('/dropout-risk', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const { threshold = 2.5 } = req.query

  // Get all students
  const students = await Student.find({})
  const atRisk = []

  for (const student of students) {
    const grades = await Grade.find({ studentId: student._id })
    if (grades.length === 0) continue

    // Calculate GPA
    const totalWeightedScore = grades.reduce((sum, g) => {
      const percentage = (g.score / g.maxScore) * 100
      return sum + (percentage * (g.weight || 1))
    }, 0)
    const totalWeight = grades.reduce((sum, g) => sum + (g.weight || 1), 0)
    const gpa = totalWeight > 0 ? (totalWeightedScore / totalWeight) / 25 : 0

    // Get attendance
    const attendanceRecords = await Attendance.find({ studentId: student._id })
    const attendanceRate = attendanceRecords.length > 0
      ? (attendanceRecords.filter(r => r.status === 'present' || r.status === 'late').length / attendanceRecords.length) * 100
      : 100

    // Risk factors
    const lowGPA = gpa < parseFloat(threshold)
    const poorAttendance = attendanceRate < 70
    const recentGrades = grades.slice(-5).map(g => (g.score / g.maxScore) * 100)
    const decliningGrades = recentGrades.length >= 3 && 
      recentGrades[recentGrades.length - 1] < recentGrades[0] - 10

    if (lowGPA || poorAttendance || decliningGrades) {
      atRisk.push({
        studentId: student._id,
        name: student.name,
        email: student.email,
        gpa: parseFloat(gpa.toFixed(2)),
        attendanceRate: parseFloat(attendanceRate.toFixed(2)),
        riskFactors: {
          lowGPA,
          poorAttendance,
          decliningGrades
        }
      })
    }
  }

  return res.json({
    totalAtRisk: atRisk.length,
    students: atRisk.sort((a, b) => a.gpa - b.gpa)
  })
})

export default router
