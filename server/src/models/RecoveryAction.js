import mongoose from 'mongoose'

const recoveryActionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['break', 'counseling', 'support', 'mindfulness', 'exercise', 'schedule', 'peer'],
      required: true
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    durationMin: { type: Number },
    tags: [{ type: String }],
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
)

export default mongoose.model('RecoveryAction', recoveryActionSchema)
