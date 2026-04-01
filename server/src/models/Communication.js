import mongoose from 'mongoose'

const communicationSchema = new mongoose.Schema(
  {
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    type: { 
      type: String, 
      enum: ['email', 'message', 'announcement', 'feedback'], 
      default: 'message' 
    },
    status: { type: String, enum: ['sent', 'delivered', 'read', 'archived'], default: 'sent' },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Communication' }, // For threaded messages
    relatedCourseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    attachments: [{ 
      fileName: String, 
      fileUrl: String, 
      fileSize: Number 
    }],
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' }
  },
  { timestamps: true }
)

// Indexes
communicationSchema.index({ toUserId: 1, isRead: 1, createdAt: -1 })
communicationSchema.index({ fromUserId: 1, createdAt: -1 })
communicationSchema.index({ relatedCourseId: 1, createdAt: -1 })

export default mongoose.model('Communication', communicationSchema)
