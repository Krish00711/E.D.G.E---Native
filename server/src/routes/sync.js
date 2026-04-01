import express from 'express'
import { requireAuth } from '../middleware/auth.js'
import Student from '../models/Student.js'
import SelfReport from '../models/SelfReport.js'
import Grade from '../models/Grade.js'
import Assignment from '../models/Assignment.js'
import AssignmentSubmission from '../models/AssignmentSubmission.js'
import Attendance from '../models/Attendance.js'
import Notification from '../models/Notification.js'
import RiskPrediction from '../models/RiskPrediction.js'
import User from '../models/User.js'

const router = express.Router()

// GET /api/sync/delta
router.get('/delta', requireAuth, async (req, res) => {
  try {
    const fallbackDate = new Date(Date.now() - (24 * 60 * 60 * 1000))
    const parsedDate = req.query.lastSyncedAt ? new Date(req.query.lastSyncedAt) : fallbackDate
    const lastSyncedAt = Number.isNaN(parsedDate.getTime()) ? fallbackDate : parsedDate

    const student = await Student.findOne({ userId: req.user.id }).select('_id userId')
    if (!student) {
      return res.status(404).json({ error: 'Student profile not found' })
    }

    const updatedAfter = { $gt: lastSyncedAt }

    const [
      selfReports,
      grades,
      assignments,
      attendance,
      notifications,
      predictions
    ] = await Promise.all([
      SelfReport.find({ studentId: student._id, updatedAt: updatedAfter }).sort({ updatedAt: -1 }),
      Grade.find({ studentId: student._id, updatedAt: updatedAfter }).sort({ updatedAt: -1 }),
      Assignment.find({ updatedAt: updatedAfter }).sort({ updatedAt: -1 }),
      Attendance.find({ studentId: student._id, updatedAt: updatedAfter }).sort({ updatedAt: -1 }),
      Notification.find({ userId: student.userId, updatedAt: updatedAfter }).sort({ updatedAt: -1 }),
      RiskPrediction.find({ studentId: student._id, updatedAt: updatedAfter }).sort({ updatedAt: -1 })
    ])

    return res.json({
      selfReports,
      grades,
      assignments,
      attendance,
      notifications,
      predictions,
      syncedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Sync] Delta sync failed:', error)
    return res.status(500).json({ error: 'Failed to fetch delta sync data' })
  }
})

// POST /api/sync/push
router.post('/push', requireAuth, async (req, res) => {
  try {
    const changes = Array.isArray(req.body?.changes) ? req.body.changes : []
    const student = await Student.findOne({ userId: req.user.id }).select('_id')

    if (!student) {
      return res.status(404).json({ error: 'Student profile not found' })
    }

    let synced = 0
    let failed = 0
    const errors = []

    for (let i = 0; i < changes.length; i += 1) {
      const change = changes[i]
      try {
        if (change?.type === 'selfReport') {
          await SelfReport.create({ ...change.data, studentId: student._id })
          synced += 1
        } else if (change?.type === 'grade') {
          await Grade.create({ ...change.data, studentId: student._id })
          synced += 1
        } else if (change?.type === 'attendance') {
          await Attendance.create({ ...change.data, studentId: student._id })
          synced += 1
        } else {
          failed += 1
          errors.push({ index: i, error: `Unsupported change type: ${change?.type || 'unknown'}` })
        }
      } catch (changeError) {
        failed += 1
        errors.push({ index: i, type: change?.type, error: changeError.message })
      }
    }

    return res.json({ synced, failed, errors })
  } catch (error) {
    console.error('[Sync] Push sync failed:', error)
    return res.status(500).json({
      synced: 0,
      failed: Array.isArray(req.body?.changes) ? req.body.changes.length : 0,
      errors: [{ error: 'Failed to process push sync changes' }]
    })
  }
})

// POST /api/sync/push-token
router.post('/push-token', requireAuth, async (req, res) => {
  try {
    const token = req.body?.token
    if (typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({ error: 'Valid token is required' })
    }

    await User.findByIdAndUpdate(req.user.id, {
      expoPushToken: token.trim(),
      lastActive: new Date()
    })

    return res.json({ success: true })
  } catch (error) {
    console.error('[Sync] Push token update failed:', error)
    return res.status(500).json({ error: 'Failed to update push token' })
  }
})

export default router
