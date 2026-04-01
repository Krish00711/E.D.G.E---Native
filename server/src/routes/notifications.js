import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import Notification from '../models/Notification.js'

const router = Router()

const createNotificationSchema = z.object({
  userId: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.enum(['alert', 'warning', 'info', 'success', 'intervention', 'grade', 'assignment', 'attendance']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  actionUrl: z.string().optional(),
  relatedId: z.string().optional(),
  relatedType: z.string().optional(),
  channels: z.array(z.enum(['in-app', 'email', 'sms', 'push'])).optional()
})

// POST /api/notifications - Create notification (admin/mentor)
router.post('/', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const parsed = createNotificationSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error })
  }

  const notification = await Notification.create(parsed.data)
  return res.status(201).json(notification)
})

// GET /api/notifications - Get user's notifications
router.get('/', requireAuth, async (req, res) => {
  const { isRead, type, priority, page = 1, limit = 50 } = req.query
  const skip = (parseInt(page) - 1) * parseInt(limit)

  const filter = { userId: req.user.id }
  if (isRead !== undefined) filter.isRead = isRead === 'true'
  if (type) filter.type = type
  if (priority) filter.priority = priority

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId: req.user.id, isRead: false })
  ])

  return res.json({
    notifications,
    unreadCount,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    }
  })
})

// GET /api/notifications/:id - Get specific notification
router.get('/:id', requireAuth, async (req, res) => {
  const notification = await Notification.findById(req.params.id)

  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' })
  }

  // Check if user owns this notification
  if (notification.userId.toString() !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' })
  }

  return res.json(notification)
})

// PATCH /api/notifications/:id/read - Mark notification as read
router.patch('/:id/read', requireAuth, async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { isRead: true, readAt: new Date() },
    { new: true }
  )

  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' })
  }

  return res.json(notification)
})

// PATCH /api/notifications/mark-all-read - Mark all as read
router.patch('/mark-all-read', requireAuth, async (req, res) => {
  const result = await Notification.updateMany(
    { userId: req.user.id, isRead: false },
    { isRead: true, readAt: new Date() }
  )

  return res.json({ 
    message: 'All notifications marked as read', 
    modifiedCount: result.modifiedCount 
  })
})

// DELETE /api/notifications/:id - Delete notification
router.delete('/:id', requireAuth, async (req, res) => {
  const notification = await Notification.findOneAndDelete({
    _id: req.params.id,
    userId: req.user.id
  })

  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' })
  }

  return res.json({ message: 'Notification deleted successfully' })
})

// DELETE /api/notifications - Delete all read notifications
router.delete('/', requireAuth, async (req, res) => {
  const result = await Notification.deleteMany({
    userId: req.user.id,
    isRead: true
  })

  return res.json({
    message: 'Read notifications deleted',
    deletedCount: result.deletedCount
  })
})

// POST /api/notifications/broadcast - Broadcast notification to multiple users (admin)
router.post('/broadcast', requireAuth, requireRole('admin'), async (req, res) => {
  const { userIds, title, message, type, priority } = req.body

  if (!Array.isArray(userIds) || !title || !message) {
    return res.status(400).json({ error: 'userIds (array), title, and message required' })
  }

  const notifications = []
  for (const userId of userIds) {
    const notification = await Notification.create({
      userId,
      title,
      message,
      type: type || 'info',
      priority: priority || 'medium'
    })
    notifications.push(notification)
  }

  return res.json({
    message: 'Notifications sent',
    count: notifications.length,
    notifications
  })
})

export default router
