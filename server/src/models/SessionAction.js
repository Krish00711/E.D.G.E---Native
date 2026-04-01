import mongoose from 'mongoose'

const sessionActionSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' },
    actionId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecoveryAction', required: true },
    status: { type: String, enum: ['recommended', 'taken', 'ignored'], default: 'recommended' },
    recommendedAt: { type: Date, default: Date.now },
    takenAt: { type: Date }
  },
  { timestamps: true }
)

sessionActionSchema.index({ studentId: 1, recommendedAt: -1 })

export default mongoose.model('SessionAction', sessionActionSchema)
