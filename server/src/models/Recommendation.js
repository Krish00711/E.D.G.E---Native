import mongoose from 'mongoose'

const recommendationSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    predictionId: { type: mongoose.Schema.Types.ObjectId, ref: 'RiskPrediction' },
    timestamp: { type: Date, default: Date.now },
    type: { type: String, enum: ['break', 'schedule', 'support', 'counseling'], required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ['shown', 'accepted', 'ignored'], default: 'shown' }
  },
  { timestamps: true }
)

recommendationSchema.index({ studentId: 1, timestamp: 1 })

export default mongoose.model('Recommendation', recommendationSchema)
