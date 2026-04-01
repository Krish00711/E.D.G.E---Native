import { Router } from 'express'
import { z } from 'zod'
import mongoose from 'mongoose'
import { requireAuth } from '../middleware/auth.js'
import Communication from '../models/Communication.js'

const router = Router()

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

function handleError(error, defaultMessage = 'Operation failed') {
  console.error('[Communications Error]', error)
  return {
    error: defaultMessage,
    message: error.message,
    type: error.name,
    timestamp: new Date().toISOString()
  }
}

const sendMessageSchema = z.object({
  toUserId: z.string().min(1),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  type: z.enum(['email', 'message', 'announcement', 'feedback']).optional(),
  relatedCourseId: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  parentId: z.string().optional(),
  attachments: z.array(z.string()).max(5).optional()
})

// POST /api/communications - Send message
router.post('/', requireAuth, async (req, res) => {
  try {
    const parsed = sendMessageSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
    }

    if (!isValidObjectId(parsed.data.toUserId)) {
      return res.status(400).json({ error: 'Invalid recipient ID format' })
    }

    const communication = await Communication.create({
      ...parsed.data,
      fromUserId: req.user.id,
      sentAt: new Date()
    })

    return res.status(201).json({
      communication,
      message: 'Message sent successfully'
    })
  } catch (error) {
    console.error('[Send Message Error]', error)
    return res.status(500).json(handleError(error, 'Failed to send message'))
  }
})

// GET /api/communications/inbox - Get user's inbox
router.get('/inbox', requireAuth, async (req, res) => {
  try {
    const { isRead, type, sender, search, page = 1, limit = 50 } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const filter = { toUserId: req.user.id }
    if (isRead !== undefined) filter.isRead = isRead === 'true'
    if (type) filter.type = type
    if (sender && isValidObjectId(sender)) filter.fromUserId = sender
    
    // Search in subject and message content
    if (search) {
      filter.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ]
    }

    const [messages, total, unreadCount] = await Promise.all([
      Communication.find(filter)
        .populate('fromUserId', 'email name')
        .populate('toUserId', 'email name')
        .populate('relatedCourseId', 'code title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Communication.countDocuments(filter),
      Communication.countDocuments({ toUserId: req.user.id, isRead: false })
    ])

    return res.json({
      messages,
      unreadCount,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      },
      metadata: {
        generatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('[Get Inbox Error]', error)
    return res.status(500).json(handleError(error, 'Failed to fetch inbox'))
  }
})

// GET /api/communications/sent - Get sent messages
router.get('/sent', requireAuth, async (req, res) => {
  const { page = 1, limit = 50 } = req.query
  const skip = (parseInt(page) - 1) * parseInt(limit)

  const [messages, total] = await Promise.all([
    Communication.find({ fromUserId: req.user.id })
      .populate('toUserId', 'email name')
      .populate('relatedCourseId', 'code title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Communication.countDocuments({ fromUserId: req.user.id })
  ])

  return res.json({
    messages,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    }
  })
})

// GET /api/communications/:id - Get specific message
router.get('/:id', requireAuth, async (req, res) => {
  const message = await Communication.findById(req.params.id)
    .populate('fromUserId', 'email name')
    .populate('toUserId', 'email name')
    .populate('relatedCourseId', 'code title')

  if (!message) {
    return res.status(404).json({ error: 'Message not found' })
  }

  // Check if user has access
  if (message.fromUserId._id.toString() !== req.user.id && 
      message.toUserId._id.toString() !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' })
  }

  // Mark as read if recipient is viewing
  if (message.toUserId._id.toString() === req.user.id && !message.isRead) {
    message.isRead = true
    message.readAt = new Date()
    message.status = 'read'
    await message.save()
  }

  return res.json(message)
})

// GET /api/communications/:id/thread - Get message thread
router.get('/:id/thread', requireAuth, async (req, res) => {
  // Get original message
  const originalMessage = await Communication.findById(req.params.id)
    .populate('fromUserId', 'email name')
    .populate('toUserId', 'email name')

  if (!originalMessage) {
    return res.status(404).json({ error: 'Message not found' })
  }

  // Get all replies
  const replies = await Communication.find({ parentId: req.params.id })
    .populate('fromUserId', 'email name')
    .populate('toUserId', 'email name')
    .sort({ createdAt: 1 })

  return res.json({
    original: originalMessage,
    replies,
    totalReplies: replies.length
  })
})

// PATCH /api/communications/:id/read - Mark as read
router.patch('/:id/read', requireAuth, async (req, res) => {
  const message = await Communication.findOneAndUpdate(
    { _id: req.params.id, toUserId: req.user.id },
    { isRead: true, readAt: new Date(), status: 'read' },
    { new: true }
  )

  if (!message) {
    return res.status(404).json({ error: 'Message not found' })
  }

  return res.json(message)
})

// DELETE /api/communications/:id - Delete message
router.delete('/:id', requireAuth, async (req, res) => {
  const message = await Communication.findOne({
    _id: req.params.id,
    $or: [{ fromUserId: req.user.id }, { toUserId: req.user.id }]
  })

  if (!message) {
    return res.status(404).json({ error: 'Message not found' })
  }

  await Communication.findByIdAndDelete(req.params.id)
  return res.json({ message: 'Message deleted successfully' })
})

export default router
