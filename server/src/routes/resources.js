import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import Resource from '../models/Resource.js'
import ResourceUsage from '../models/ResourceUsage.js'

const router = Router()

const createResourceSchema = z.object({
  title: z.string().min(1),
  type: z.enum(['document', 'video', 'link', 'book', 'article', 'tutorial', 'counseling', 'tutoring']),
  description: z.string().optional(),
  url: z.string().optional(),
  fileUrl: z.string().optional(),
  courseId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  category: z.enum(['academic', 'mental-health', 'physical-health', 'career', 'financial', 'social']).optional(),
  accessLevel: z.enum(['public', 'student', 'registered']).optional(),
  contactInfo: z.object({
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    availableHours: z.string().optional()
  }).optional()
})

// POST /api/resources - Create resource (admin/mentor)
router.post('/', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const parsed = createResourceSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error })
  }

  const resource = await Resource.create({
    ...parsed.data,
    uploadedBy: req.user.id
  })

  return res.status(201).json(resource)
})

// GET /api/resources - List resources
router.get('/', requireAuth, async (req, res) => {
  const { type, category, courseId, tags, page = 1, limit = 50 } = req.query
  const skip = (parseInt(page) - 1) * parseInt(limit)

  const filter = { isActive: true }
  if (type) filter.type = type
  if (category) filter.category = category
  if (courseId) filter.courseId = courseId
  if (tags) filter.tags = { $in: tags.split(',') }

  const [resources, total] = await Promise.all([
    Resource.find(filter)
      .populate('courseId', 'code title')
      .populate('uploadedBy', 'email name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Resource.countDocuments(filter)
  ])

  return res.json({
    resources,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    }
  })
})

// GET /api/resources/popular - Get most popular resources
router.get('/popular', requireAuth, async (req, res) => {
  const { category, type, limit = 10 } = req.query

  const filter = { isActive: true }
  if (category) filter.category = category
  if (type) filter.type = type

  const resources = await Resource.find(filter)
    .sort({ viewCount: -1, usefulCount: -1 })
    .limit(parseInt(limit))
    .populate('courseId', 'code title')

  return res.json({ resources, total: resources.length })
})

// GET /api/resources/student/:studentId/usage - Resource usage history
router.get('/student/:studentId/usage', requireAuth, async (req, res) => {
  const { category, days = 30 } = req.query

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - parseInt(days))

  const filter = {
    studentId: req.params.studentId,
    accessedAt: { $gte: startDate }
  }

  const usages = await ResourceUsage.find(filter)
    .populate('resourceId')
    .sort({ accessedAt: -1 })

  // Filter by category if provided
  let filteredUsages = usages
  if (category) {
    filteredUsages = usages.filter(u => u.resourceId?.category === category)
  }

  return res.json({
    usages: filteredUsages,
    total: filteredUsages.length
  })
})

// GET /api/resources/:id - Get specific resource
router.get('/:id', requireAuth, async (req, res) => {
  const resource = await Resource.findByIdAndUpdate(
    req.params.id,
    { $inc: { viewCount: 1 } },
    { new: true }
  )
    .populate('courseId', 'code title')
    .populate('uploadedBy', 'email name')

  if (!resource) {
    return res.status(404).json({ error: 'Resource not found' })
  }

  // Log resource usage
  await ResourceUsage.create({
    studentId: req.user.id,
    resourceId: resource._id
  })

  return res.json(resource)
})

// PATCH /api/resources/:id - Update resource (admin/mentor)
router.patch('/:id', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const resource = await Resource.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  )

  if (!resource) {
    return res.status(404).json({ error: 'Resource not found' })
  }

  return res.json(resource)
})

// DELETE /api/resources/:id - Delete resource (admin only)
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const resource = await Resource.findByIdAndDelete(req.params.id)
  if (!resource) {
    return res.status(404).json({ error: 'Resource not found' })
  }
  return res.json({ message: 'Resource deleted successfully' })
})

// POST /api/resources/:id/helpful - Mark resource as helpful
router.post('/:id/helpful', requireAuth, async (req, res) => {
  const { wasHelpful, notes } = req.body

  const resource = await Resource.findById(req.params.id)
  if (!resource) {
    return res.status(404).json({ error: 'Resource not found' })
  }

  // Update usage record
  await ResourceUsage.updateOne(
    { studentId: req.user.id, resourceId: req.params.id },
    { wasHelpful, notes },
    { upsert: true }
  )

  // Increment useful count if helpful
  if (wasHelpful) {
    await Resource.findByIdAndUpdate(req.params.id, {
      $inc: { usefulCount: 1 }
    })
  }

  return res.json({ message: 'Feedback recorded' })
})

export default router
