import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: [true, 'User ID is required'],
      index: true
    },
    title: { 
      type: String, 
      required: [true, 'Title is required'], 
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    message: { 
      type: String, 
      required: [true, 'Message is required'], 
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters']
    },
    type: { 
      type: String, 
      enum: {
        values: ['alert', 'warning', 'info', 'success', 'intervention', 'grade', 'assignment', 'attendance', 'message', 'system'],
        message: '{VALUE} is not a valid notification type'
      },
      default: 'info',
      index: true
    },
    priority: { 
      type: String, 
      enum: {
        values: ['low', 'medium', 'high', 'critical'],
        message: '{VALUE} is not a valid priority level'
      },
      default: 'medium',
      index: true
    },
    isRead: { 
      type: Boolean, 
      default: false,
      index: true
    },
    readAt: { 
      type: Date 
    },
    actionUrl: { 
      type: String,
      trim: true,
      maxlength: [500, 'Action URL cannot exceed 500 characters']
    },
    relatedId: { 
      type: mongoose.Schema.Types.ObjectId
    },
    relatedType: { 
      type: String,
      enum: ['alert', 'grade', 'assignment', 'course', 'prediction', 'intervention', 'communication'],
      trim: true
    },
    channels: [{ 
      type: String, 
      enum: ['in-app', 'email', 'sms', 'push']
    }],
    sentVia: [{ 
      type: String, 
      enum: ['in-app', 'email', 'sms', 'push']
    }],
    expiresAt: { 
      type: Date
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
)

// Compound indexes for common query patterns
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 })
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 })
notificationSchema.index({ userId: 1, priority: 1, isRead: 1 })
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }) // Auto-delete expired

// Virtual for age in hours
notificationSchema.virtual('ageHours').get(function() {
  return Math.floor((new Date() - this.createdAt) / (1000 * 60 * 60))
})

// Virtual for isExpired
notificationSchema.virtual('isExpired').get(function() {
  return this.expiresAt && new Date() > this.expiresAt
})

// Virtual for urgency score (combines priority and age)
notificationSchema.virtual('urgencyScore').get(function() {
  const priorityScores = { low: 1, medium: 2, high: 3, critical: 4 }
  const baseScore = priorityScores[this.priority] || 1
  const ageFactor = Math.min(this.ageHours / 24, 2) // Max 2x for age
  return baseScore * (1 + ageFactor)
})

// Instance method to mark as read
notificationSchema.methods.markAsRead = function() {
  this.isRead = true
  this.readAt = new Date()
  return this.save()
}

// Instance method to check if urgent
notificationSchema.methods.isUrgent = function() {
  return this.priority === 'critical' || (this.priority === 'high' && !this.isRead)
}

// Static method to find unread for user
notificationSchema.statics.findUnreadForUser = function(userId, limit = 50) {
  return this.find({ userId, isRead: false })
    .sort({ priority: -1, createdAt: -1 })
    .limit(limit)
}

// Static method to count unread by priority
notificationSchema.statics.countUnreadByPriority = async function(userId) {
  const result = await this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId), isRead: false } },
    { $group: { _id: '$priority', count: { $sum: 1 } } }
  ])
  
  return result.reduce((acc, item) => {
    acc[item._id] = item.count
    return acc
  }, { low: 0, medium: 0, high: 0, critical: 0 })
}

export default mongoose.model('Notification', notificationSchema)
