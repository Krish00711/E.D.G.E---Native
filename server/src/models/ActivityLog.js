import mongoose from 'mongoose'

const activityLogSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' },
    type: {
      type: String,
      enum: ['login', 'quiz', 'assignment', 'study', 'pageview'],
      required: true
    },
    value: { type: Number },
    score: { type: Number },
    timestamp: { type: Date, default: Date.now }
  },
  { timestamps: true }
)

activityLogSchema.index({ studentId: 1, timestamp: 1 })

export default mongoose.model('ActivityLog', activityLogSchema)
