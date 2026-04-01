import { Router } from 'express'
import fetch from 'node-fetch'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import Student from '../models/Student.js'
import RiskPrediction from '../models/RiskPrediction.js'
import ActivityLog from '../models/ActivityLog.js'
import Attendance from '../models/Attendance.js'
import Grade from '../models/Grade.js'
import Assignment from '../models/Assignment.js'
import AssignmentSubmission from '../models/AssignmentSubmission.js'
import DiscussionForum from '../models/DiscussionForum.js'
import CognitiveLoadRecord from '../models/CognitiveLoadRecord.js'
import SelfReport from '../models/SelfReport.js'

const router = Router()
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001'

/**
 * ML Enhanced Prediction Endpoints
 */

// POST /api/ml/predict/ensemble - Enhanced ensemble prediction
router.post('/predict/ensemble', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const { studentId } = req.body
    
    // Gather comprehensive student data
    const studentData = await gatherStudentData(studentId)
    
    // Call ML service
    const mlResponse = await fetch(`${ML_SERVICE_URL}/predict/ensemble`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studentData)
    })
    
    if (!mlResponse.ok) {
      throw new Error(`ML Service error: ${mlResponse.status}`)
    }
    
    const prediction = await mlResponse.json()
    
    // Save prediction to database
    await RiskPrediction.create({
      studentId,
      riskScore: prediction.ensemble_prediction.risk_score,
      riskLevel: prediction.ensemble_prediction.risk_level,
      confidence: prediction.ensemble_prediction.confidence,
      modelVersion: 'ensemble_v2',
      features: prediction.feature_values,
      metadata: {
        individualModels: prediction.individual_models,
        timestamp: prediction.timestamp
      }
    })
    
    return res.json(prediction)
  } catch (error) {
    console.error('[ML Ensemble Error]', error)
    return res.status(500).json({
      error: 'Ensemble prediction failed',
      message: error.message
    })
  }
})

// POST /api/ml/predict/explain - Get explainable AI prediction
router.post('/predict/explain', requireAuth, async (req, res) => {
  try {
    const { studentId } = req.body
    const studentData = await gatherStudentData(studentId)
    
    const mlResponse = await fetch(`${ML_SERVICE_URL}/predict/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studentData)
    })
    
    const explanation = await mlResponse.json()
    return res.json(explanation)
  } catch (error) {
    console.error('[ML Explain Error]', error)
    return res.status(500).json({
      error: 'Explanation generation failed',
      message: error.message
    })
  }
})

// POST /api/ml/predict/forecast - Time-series forecasting
router.post('/predict/forecast', requireAuth, async (req, res) => {
  try {
    const { studentId, forecastDays = 14 } = req.body
    
    // Get historical predictions
    const historical = await RiskPrediction.find({ studentId })
      .sort({ createdAt: 1 })
      .limit(30)
      .lean()
    
    const mlResponse = await fetch(`${ML_SERVICE_URL}/predict/forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        historical_predictions: historical,
        forecast_days: forecastDays
      })
    })
    
    const forecast = await mlResponse.json()
    return res.json(forecast)
  } catch (error) {
    console.error('[ML Forecast Error]', error)
    return res.status(500).json({
      error: 'Forecasting failed',
      message: error.message
    })
  }
})

// POST /api/ml/detect/anomaly - Anomaly detection
router.post('/detect/anomaly', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const { studentId } = req.body
    const studentData = await gatherStudentData(studentId)
    
    const mlResponse = await fetch(`${ML_SERVICE_URL}/predict/anomaly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_data: studentData })
    })
    
    const anomalyResult = await mlResponse.json()
    return res.json(anomalyResult)
  } catch (error) {
    console.error('[ML Anomaly Error]', error)
    return res.status(500).json({
      error: 'Anomaly detection failed',
      message: error.message
    })
  }
})

// POST /api/ml/predict/engagement - Engagement prediction
router.post('/predict/engagement', requireAuth, async (req, res) => {
  try {
    const { studentId } = req.body
    
    // Gather engagement-specific data
    const engagementData = await gatherEngagementData(studentId)
    
    // Get historical engagement scores if available
    const historical = await ActivityLog.find({ studentId })
      .sort({ timestamp: -1 })
      .limit(30)
      .lean()
    
    const historicalScores = historical.map(h => h.engagementScore || 0)
    
    const mlResponse = await fetch(`${ML_SERVICE_URL}/predict/engagement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_data: engagementData,
        historical_engagement: historicalScores
      })
    })
    
    const engagementPrediction = await mlResponse.json()
    return res.json(engagementPrediction)
  } catch (error) {
    console.error('[ML Engagement Error]', error)
    return res.status(500).json({
      error: 'Engagement prediction failed',
      message: error.message
    })
  }
})

// POST /api/ml/predict/mental-health - Mental health risk scoring
router.post('/predict/mental-health', requireAuth, async (req, res) => {
  try {
    const { studentId } = req.body
    
    // Gather mental health indicators
    const mentalHealthData = await gatherMentalHealthData(studentId)
    
    const mlResponse = await fetch(`${ML_SERVICE_URL}/predict/mental-health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_data: mentalHealthData })
    })
    
    const mentalHealthScore = await mlResponse.json()
    return res.json(mentalHealthScore)
  } catch (error) {
    console.error('[ML Mental Health Error]', error)
    return res.status(500).json({
      error: 'Mental health scoring failed',
      message: error.message
    })
  }
})

// POST /api/ml/simulate/what-if - What-if scenario simulation
router.post('/simulate/what-if', requireAuth, async (req, res) => {
  try {
    const { studentId, changes } = req.body
    
    const baseline = await gatherStudentData(studentId)
    
    const mlResponse = await fetch(`${ML_SERVICE_URL}/simulate/what-if`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseline, changes })
    })
    
    const simulation = await mlResponse.json()
    return res.json(simulation)
  } catch (error) {
    console.error('[ML What-If Error]', error)
    return res.status(500).json({
      error: 'What-if simulation failed',
      message: error.message
    })
  }
})

// GET /api/ml/models/performance - Model performance metrics
router.get('/models/performance', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const mlResponse = await fetch(`${ML_SERVICE_URL}/models/performance`)
    const performance = await mlResponse.json()
    return res.json(performance)
  } catch (error) {
    console.error('[ML Performance Error]', error)
    return res.status(500).json({
      error: 'Failed to fetch performance metrics',
      message: error.message
    })
  }
})

// GET /api/ml/models/feature-importance - Feature importance
router.get('/models/feature-importance', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const mlResponse = await fetch(`${ML_SERVICE_URL}/models/feature-importance`)
    const importance = await mlResponse.json()
    return res.json(importance)
  } catch (error) {
    console.error('[ML Feature Importance Error]', error)
    return res.status(500).json({
      error: 'Failed to fetch feature importance',
      message: error.message
    })
  }
})

/**
 * Helper Functions
 */

async function gatherStudentData(studentId) {
  const student = await Student.findById(studentId).lean()
  
  // Get attendance data
  const attendanceRecords = await Attendance.find({ studentId }).lean()
  const attendanceRate = attendanceRecords.length > 0
    ? attendanceRecords.filter(a => a.status === 'present').length / attendanceRecords.length
    : 0.85
  
  // Get grade data
  const grades = await Grade.find({ studentId }).lean()
  const avgGrade = grades.length > 0
    ? grades.reduce((sum, g) => sum + g.score, 0) / grades.length
    : 75
  
  // Get assignment data
  const submissions = await AssignmentSubmission.find({ studentId }).lean()
  const assignments = await Assignment.find({}).lean()
  const completionRate = assignments.length > 0
    ? submissions.length / assignments.length
    : 0.9
  
  const lateSubmissions = submissions.filter(s => s.submittedAt > s.dueDate).length
  
  // Get forum participation
  const forums = await DiscussionForum.find({}).lean()
  let forumPosts = 0
  forums.forEach(forum => {
    forumPosts += forum.posts?.filter(p => p.userId?.toString() === studentId.toString()).length || 0
  })
  
  // Get cognitive load data
  const cognitiveRecords = await CognitiveLoadRecord.find({ studentId })
    .sort({ recordedAt: -1 })
    .limit(10)
    .lean()
  const avgCognitiveLoad = cognitiveRecords.length > 0
    ? cognitiveRecords.reduce((sum, r) => sum + r.loadScore, 0) / cognitiveRecords.length
    : 5
  
  // Get self-reported data
  const selfReports = await SelfReport.find({ studentId })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean()
  const avgStress = selfReports.length > 0
    ? selfReports.reduce((sum, r) => sum + (r.stressLevel || 5), 0) / selfReports.length
    : 5
  const avgSleep = selfReports.length > 0
    ? selfReports.reduce((sum, r) => sum + (r.sleepHours || 7), 0) / selfReports.length
    : 7
  
  // Get activity data
  const recentActivities = await ActivityLog.find({ studentId })
    .sort({ timestamp: -1 })
    .limit(1)
    .lean()
  const daysSinceLastActivity = recentActivities.length > 0
    ? Math.floor((Date.now() - new Date(recentActivities[0].timestamp).getTime()) / (1000 * 60 * 60 * 24))
    : 0
  
  const totalActivities = await ActivityLog.countDocuments({ studentId })
  
  return {
    attendance_rate: attendanceRate,
    avg_grade: avgGrade,
    assignment_completion_rate: completionRate,
    forum_participation: forumPosts / 20,  // Normalized
    cognitive_load_avg: avgCognitiveLoad,
    stress_level: avgStress,
    sleep_hours_avg: avgSleep,
    days_since_last_activity: daysSinceLastActivity,
    total_activities: totalActivities,
    submission_delays: lateSubmissions,
    peer_interaction_score: forumPosts > 5 ? 0.7 : 0.3
  }
}

async function gatherEngagementData(studentId) {
  const activities = await ActivityLog.find({ studentId })
    .sort({ timestamp: -1 })
    .limit(30)
    .lean()
  
  const forums = await DiscussionForum.find({}).lean()
  let forumPosts = 0
  forums.forEach(forum => {
    forumPosts += forum.posts?.filter(p => p.userId?.toString() === studentId.toString()).length || 0
  })
  
  const submissions = await AssignmentSubmission.find({ studentId }).lean()
  
  const daysSinceLastActive = activities.length > 0
    ? Math.floor((Date.now() - new Date(activities[0].timestamp).getTime()) / (1000 * 60 * 60 * 24))
    : 0
  
  return {
    recent_logins: activities.filter(a => a.actionType === 'login').length,
    forum_posts: forumPosts,
    assignment_submissions: submissions.length,
    resource_views: activities.filter(a => a.actionType === 'resource_view').length,
    discussion_replies: forumPosts,
    peer_interactions: forumPosts * 2,
    avg_session_duration: 45,  // Default
    days_since_last_active: daysSinceLastActive
  }
}

async function gatherMentalHealthData(studentId) {
  const selfReports = await SelfReport.find({ studentId })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean()
  
  const cognitiveRecords = await CognitiveLoadRecord.find({ studentId })
    .sort({ recordedAt: -1 })
    .limit(10)
    .lean()
  
  const studentData = await gatherStudentData(studentId)
  
  return {
    stress_level: selfReports.length > 0
      ? selfReports.reduce((sum, r) => sum + (r.stressLevel || 5), 0) / selfReports.length
      : 5,
    sleep_hours_avg: selfReports.length > 0
      ? selfReports.reduce((sum, r) => sum + (r.sleepHours || 7), 0) / selfReports.length
      : 7,
    cognitive_load_avg: cognitiveRecords.length > 0
      ? cognitiveRecords.reduce((sum, r) => sum + r.loadScore, 0) / cognitiveRecords.length
      : 5,
    peer_interaction_score: studentData.peer_interaction_score,
    avg_grade: studentData.avg_grade,
    submission_delays: studentData.submission_delays,
    assignment_completion_rate: studentData.assignment_completion_rate,
    self_reported_wellbeing: selfReports.length > 0 && selfReports[0].wellbeingScore
      ? selfReports[0].wellbeingScore
      : 5
  }
}

export default router
