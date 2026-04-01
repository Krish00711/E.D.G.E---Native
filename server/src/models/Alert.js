import mongoose from 'mongoose'

const alertSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    predictionId: { type: mongoose.Schema.Types.ObjectId, ref: 'RiskPrediction' },
    timestamp: { type: Date, default: Date.now },
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'warning' },
    message: { type: String, required: true },
    deliveredVia: { type: String, enum: ['app', 'email'], default: 'app' }
  },
  { timestamps: true }
)

alertSchema.index({ studentId: 1, timestamp: 1 })

export default mongoose.model('Alert', alertSchema)
