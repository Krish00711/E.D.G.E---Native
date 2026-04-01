import Grade from '../models/Grade.js'
import Attendance from '../models/Attendance.js'
import AssignmentSubmission from '../models/AssignmentSubmission.js'
import ActivityLog from '../models/ActivityLog.js'
import SelfReport from '../models/SelfReport.js'
import Session from '../models/Session.js'
import RiskPrediction from '../models/RiskPrediction.js'
import { getIo } from './socketService.js'
import { sendBurnoutAlert } from './pushNotificationService.js'
import User from '../models/User.js'
import Alert from '../models/Alert.js'
import Student from '../models/Student.js'

const ONBOARDING_FEATURE_DEFAULTS = {
  screen_time_hours: 4,
  social_media_hours: 2,
  physical_activity_hours: 1,
  anxiety_score: 5,
  mood_score: 7,
  social_interaction_hours: 3,
  academic_pressure_score: 5,
  extracurricular_load: 2,
  placement_pressure: 5,
  peer_stress: 5,
  sleep_quality: 3,
  financial_stress: 5
}

function parseOnboardingNotes(notes) {
  if (!notes || typeof notes !== 'string') {
    return {}
  }

  try {
    const parsed = JSON.parse(notes)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (error) {
    console.warn('[Prediction] Failed to parse SelfReport notes JSON')
    return {}
  }
}

export async function getStudentFeatures(studentId) {
  // Gather behavioral features
  const sessions = await Session.find({ studentId })
    .sort({ createdAt: -1 })
    .limit(10)
  const avgSessionDuration = sessions.length > 0
    ? sessions.reduce((sum, s) => sum + (s.durationMin || 0), 0) / sessions.length
    : 120

  const activities = await ActivityLog.find({ studentId })
    .sort({ createdAt: -1 })
    .limit(30)
  const activityFrequency = activities.length > 0
    ? activities.length / 4
    : 5

  const lastActivity = activities[0]
  const daysSinceLastActivity = lastActivity
    ? Math.floor((Date.now() - new Date(lastActivity.createdAt)) / (1000 * 60 * 60 * 24))
    : 7

  const selfReports = await SelfReport.find({ studentId })
    .sort({ createdAt: -1 })
    .limit(5)

  const avgSleepHours = selfReports.length > 0
    ? selfReports.reduce((sum, sr) => sum + (sr.sleepHours || 7), 0) / selfReports.length
    : 7

  const avgStressScore = selfReports.length > 0
    ? selfReports.reduce((sum, sr) => sum + (sr.stressScore || 5), 0) / selfReports.length
    : 5

  const avgLoadScore = selfReports.length > 0
    ? selfReports.reduce((sum, sr) => sum + (sr.loadScore || 5), 0) / selfReports.length
    : 5

  // Academic features
  const grades = await Grade.find({ studentId })
  let gpa = 3.0
  if (grades.length > 0) {
    const totalWeightedScore = grades.reduce((sum, g) => {
      const percentage = (g.score / g.maxScore) * 100
      return sum + (percentage * (g.weight || 1))
    }, 0)
    const totalWeight = grades.reduce((sum, g) => sum + (g.weight || 1), 0)
    gpa = totalWeight > 0 ? (totalWeightedScore / totalWeight) / 25 : 3.0
  }

  const attendanceRecords = await Attendance.find({ studentId })
  let attendanceRate = 80
  if (attendanceRecords.length > 0) {
    const attended = attendanceRecords.filter(r =>
      r.status === 'present' || r.status === 'late'
    ).length
    attendanceRate = (attended / attendanceRecords.length) * 100
  }

  const submissions = await AssignmentSubmission.find({ studentId })
  let assignmentCompletionRate = 85
  let avgSubmissionLateness = 0
  if (submissions.length > 0) {
    assignmentCompletionRate = (submissions.filter(s => s.status !== 'missing').length / submissions.length) * 100
    const lateSubmissions = submissions.filter(s => s.isLate && s.daysLate > 0)
    avgSubmissionLateness = lateSubmissions.length > 0
      ? lateSubmissions.reduce((sum, s) => sum + s.daysLate, 0) / lateSubmissions.length
      : 0
  }

  let gradeTrend = 0
  if (grades.length >= 3) {
    const recentGrades = grades.slice(-5).map(g => (g.score / g.maxScore) * 100)
    if (recentGrades.length >= 3) {
      const firstHalf = recentGrades.slice(0, Math.ceil(recentGrades.length / 2))
      const secondHalf = recentGrades.slice(Math.ceil(recentGrades.length / 2))
      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
      const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
      gradeTrend = avgSecond - avgFirst
    }
  }

  const quizGrades = grades.filter(g => g.gradeType === 'quiz')
  const avgQuizScore = quizGrades.length > 0
    ? quizGrades.reduce((sum, g) => sum + ((g.score / g.maxScore) * 100), 0) / quizGrades.length
    : 75

  // Additional 12 onboarding features from latest SelfReport notes JSON
  const latestSelfReport = await SelfReport.findOne({ studentId })
    .sort({ createdAt: -1 })
    .select('notes')

  const onboardingNotes = parseOnboardingNotes(latestSelfReport?.notes)
  const additionalFeatures = {
    screen_time_hours: Number(onboardingNotes.screen_time_hours ?? ONBOARDING_FEATURE_DEFAULTS.screen_time_hours),
    social_media_hours: Number(onboardingNotes.social_media_hours ?? ONBOARDING_FEATURE_DEFAULTS.social_media_hours),
    physical_activity_hours: Number(onboardingNotes.physical_activity_hours ?? ONBOARDING_FEATURE_DEFAULTS.physical_activity_hours),
    anxiety_score: Number(onboardingNotes.anxiety_score ?? ONBOARDING_FEATURE_DEFAULTS.anxiety_score),
    mood_score: Number(onboardingNotes.mood_score ?? ONBOARDING_FEATURE_DEFAULTS.mood_score),
    social_interaction_hours: Number(onboardingNotes.social_interaction_hours ?? ONBOARDING_FEATURE_DEFAULTS.social_interaction_hours),
    academic_pressure_score: Number(onboardingNotes.academic_pressure_score ?? ONBOARDING_FEATURE_DEFAULTS.academic_pressure_score),
    extracurricular_load: Number(onboardingNotes.extracurricular_load ?? ONBOARDING_FEATURE_DEFAULTS.extracurricular_load),
    placement_pressure: Number(onboardingNotes.placement_pressure ?? ONBOARDING_FEATURE_DEFAULTS.placement_pressure),
    peer_stress: Number(onboardingNotes.peer_stress ?? ONBOARDING_FEATURE_DEFAULTS.peer_stress),
    sleep_quality: Number(onboardingNotes.sleep_quality ?? ONBOARDING_FEATURE_DEFAULTS.sleep_quality),
    financial_stress: Number(onboardingNotes.financial_stress ?? ONBOARDING_FEATURE_DEFAULTS.financial_stress)
  }

  return {
    session_duration: avgSessionDuration,
    quiz_scores: avgQuizScore,
    load_score: avgLoadScore,
    activity_frequency: activityFrequency,
    sleep_hours: avgSleepHours,
    stress_score: avgStressScore,
    submission_lateness: avgSubmissionLateness,
    gpa,
    attendance_rate: attendanceRate,
    assignment_completion_rate: assignmentCompletionRate,
    grade_trend: gradeTrend,
    days_since_last_activity: daysSinceLastActivity,
    ...additionalFeatures
  }
}

export async function calculatePredictionForStudent(studentId) {
  const features = await getStudentFeatures(studentId)

  const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:5001'
  const mlResponse = await fetch(`${mlServiceUrl}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(features)
  })

  if (!mlResponse.ok) {
    throw new Error('ML service prediction failed')
  }

  const mlResult = await mlResponse.json()

  const prediction = await RiskPrediction.create({
    studentId,
    riskScore: mlResult.risk_score,
    riskLevel: mlResult.risk_level,
    confidence: mlResult.confidence,
    exhaustionScore: mlResult.dimension_scores?.exhaustion,
    cynicismScore: mlResult.dimension_scores?.cynicism,
    efficacyScore: mlResult.dimension_scores?.efficacy,
    featuresSnapshot: features,
    modelVersion: mlResult.model_version || '2.0'
  })

  return { prediction, features, mlResult }
}

export async function triggerPredictionUpdate(studentId) {
  const result = await calculatePredictionForStudent(studentId)

  let previousPrediction = null
  try {
    previousPrediction = await RiskPrediction.findOne({
      studentId,
      _id: { $ne: result.prediction._id }
    }).sort({ timestamp: -1 })
  } catch (error) {
    console.error('[Prediction] Failed to fetch previous prediction:', error)
  }

  const oldRiskLevel = previousPrediction?.riskLevel
  const newRiskLevel = result.prediction?.riskLevel
  const riskLevelChanged = Boolean(oldRiskLevel && newRiskLevel && oldRiskLevel !== newRiskLevel)

  if (riskLevelChanged && (newRiskLevel === 'high' || newRiskLevel === 'moderate')) {
    const requestedSeverity = newRiskLevel === 'high' ? 'high' : 'medium'
    const fallbackSeverity = newRiskLevel === 'high' ? 'critical' : 'warning'

    try {
      await Alert.create({
        studentId,
        predictionId: result.prediction._id,
        severity: requestedSeverity,
        message: `Risk level changed from ${oldRiskLevel} to ${newRiskLevel}.`,
        deliveredVia: 'app'
      })
    } catch (error) {
      // Fallback for current Alert schema enum compatibility.
      try {
        await Alert.create({
          studentId,
          predictionId: result.prediction._id,
          severity: fallbackSeverity,
          message: `Risk level changed from ${oldRiskLevel} to ${newRiskLevel}.`,
          deliveredVia: 'app'
        })
      } catch (fallbackError) {
        console.error('[Prediction] Failed to create alert:', fallbackError)
      }
    }
  }

  try {
    const io = getIo()
    io.to(studentId.toString()).emit('prediction_updated', { prediction: result.prediction })
  } catch (error) {
    console.error('[Prediction] Socket emit failed:', error)
  }

  try {
    const student = await Student.findById(studentId).select('userId')
    const userId = student?.userId || studentId
    const user = await User.findById(userId).select('expoPushToken')
    const expoPushToken = user?.expoPushToken

    if (expoPushToken && (newRiskLevel === 'high' || newRiskLevel === 'moderate')) {
      await sendBurnoutAlert(expoPushToken, newRiskLevel, result.prediction?.riskScore)
    }
  } catch (error) {
    console.error('[Prediction] Push notification failed:', error)
  }

  return result
}

export default {
  getStudentFeatures,
  calculatePredictionForStudent,
  triggerPredictionUpdate
}
