import { Router } from 'express'
import mongoose from 'mongoose'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import Intervention from '../models/Intervention.js'
import Student from '../models/Student.js'
import RiskPrediction from '../models/RiskPrediction.js'

const router = Router()

/**
 * INTERVENTION MANAGEMENT
 */

// POST /api/interventions - Create new intervention
router.post('/', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const { studentId, type, title, description, actionItems, priority, severity, targetDate } = req.body
    
    const student = await Student.findById(studentId)
    if (!student) return res.status(404).json({ error: 'Student not found' })
    
    const interventionData = {
      studentId,
      mentorId: req.user.id,
      type,
      title,
      description,
      actionItems,
      priority,
      severity,
      targetDate,
      startDate: new Date(),
      riskBefore: null
    }

    // Some datasets use string cohort IDs (e.g., "cohort-2024").
    // Only persist cohortId when it is a valid ObjectId.
    if (student.cohortId && mongoose.Types.ObjectId.isValid(student.cohortId)) {
      interventionData.cohortId = student.cohortId
    }

    const intervention = await Intervention.create(interventionData)
    
    return res.status(201).json(intervention)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/interventions - List interventions with filters
router.get('/', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const { studentId, cohortId, status, priority, page = 1, limit = 20 } = req.query
    
    const filter = {}
    if (studentId) filter.studentId = studentId
    if (cohortId) filter.cohortId = cohortId
    if (status) filter.status = status
    if (priority) filter.priority = priority
    
    const interventions = await Intervention.find(filter)
      .populate('studentId', 'email name')
      .populate('mentorId', 'email name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean()
    
    const total = await Intervention.countDocuments(filter)
    
    return res.json({
      interventions,
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

// GET /api/interventions/:id - Get single intervention
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const intervention = await Intervention.findById(req.params.id)
      .populate('studentId', 'email name cohortId')
      .populate('mentorId', 'email name')
      .lean()
    
    if (!intervention) return res.status(404).json({ error: 'Intervention not found' })
    
    return res.json(intervention)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// PATCH /api/interventions/:id - Update intervention
router.patch('/:id', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const { status, outcome, effectiveness, riskAfter, notes } = req.body
    
    const intervention = await Intervention.findById(req.params.id)
    if (!intervention) return res.status(404).json({ error: 'Intervention not found' })
    
    // Update fields
    if (status) intervention.status = status
    if (outcome) intervention.outcome = outcome
    if (effectiveness !== undefined) intervention.effectiveness = effectiveness
    if (riskAfter !== undefined) intervention.riskAfter = riskAfter
    
    // Handle completion
    if (status === 'completed') {
      intervention.completedAt = new Date()
    }
    
    // Add note if provided
    if (notes) {
      intervention.notes.push({
        author: req.user.id,
        text: notes,
        createdAt: new Date()
      })
    }
    
    await intervention.save()
    
    return res.json(intervention)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// PATCH /api/interventions/:id/status - Update intervention status
router.patch('/:id/status', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const { status } = req.body
    
    const intervention = await Intervention.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        completedAt: status === 'completed' ? new Date() : undefined
      },
      { new: true }
    )
    
    if (!intervention) return res.status(404).json({ error: 'Intervention not found' })
    
    return res.json(intervention)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// POST /api/interventions/:id/notes - Add note to intervention
router.post('/:id/notes', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const { text } = req.body
    if (!text) return res.status(400).json({ error: 'Note text required' })
    
    const intervention = await Intervention.findById(req.params.id)
    if (!intervention) return res.status(404).json({ error: 'Intervention not found' })
    
    intervention.notes.push({
      author: req.user.id,
      text,
      createdAt: new Date()
    })
    
    await intervention.save()
    
    return res.json(intervention)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/interventions/:id/effectiveness - Calculate intervention effectiveness
router.get('/:id/effectiveness', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  try {
    const intervention = await Intervention.findById(req.params.id)
    if (!intervention) return res.status(404).json({ error: 'Intervention not found' })
    
    if (!intervention.riskBefore || !intervention.riskAfter) {
      return res.json({ effectiveness: null, message: 'Before/after risk not set' })
    }
    
    const effectiveness = ((intervention.riskBefore - intervention.riskAfter) / intervention.riskBefore) * 100
    const duration = Math.ceil((intervention.completedAt - intervention.createdAt) / (1000 * 60 * 60 * 24)) // days
    
    return res.json({
      effectiveness: Math.max(0, effectiveness),
      riskReduction: intervention.riskBefore - intervention.riskAfter,
      duration,
      outcome: intervention.outcome
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/interventions/student/:studentId - Get all interventions for a student
router.get('/student/:studentId', requireAuth, async (req, res) => {
  try {
    const interventions = await Intervention.find({ studentId: req.params.studentId })
      .populate('mentorId', 'email name')
      .sort({ createdAt: -1 })
      .lean()
    
    return res.json({ interventions })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// POST /api/interventions/batch/create - Create multiple interventions
router.post('/batch/create', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { interventions } = req.body
    if (!Array.isArray(interventions)) {
      return res.status(400).json({ error: 'interventions array required' })
    }
    
    const created = await Intervention.insertMany(interventions.map(i => ({
      ...i,
      mentorId: req.user.id,
      startDate: new Date()
    })))
    
    return res.status(201).json({ created: created.length, interventions: created })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

// GET /api/interventions/stats/summary - Intervention statistics
router.get('/stats/summary', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const total = await Intervention.countDocuments()
    const byStatus = await Intervention.collection.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray()
    
    const byPriority = await Intervention.collection.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]).toArray()
    
    const effectiveInterventions = await Intervention.find({ effectiveness: { $gte: 50 } })
      .countDocuments()
    
    const avgEffectiveness = await Intervention.collection.aggregate([
      { $match: { effectiveness: { $exists: true, $ne: null } } },
      { $group: { _id: null, avg: { $avg: '$effectiveness' } } }
    ]).toArray()
    
    return res.json({
      total,
      byStatus: Object.fromEntries(byStatus.map(s => [s._id, s.count])),
      byPriority: Object.fromEntries(byPriority.map(p => [p._id, p.count])),
      effectiveCount: effectiveInterventions,
      avgEffectiveness: avgEffectiveness[0]?.avg || 0
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

export default router
