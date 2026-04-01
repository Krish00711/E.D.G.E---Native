import mongoose from 'mongoose'

const selfReportSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    timestamp: { type: Date, default: Date.now },
    loadScore: { type: Number, min: 1, max: 10 },
    stressScore: { type: Number, min: 1, max: 10 },
    sleepHours: { type: Number, min: 0, max: 24 },
    notes: { type: String, trim: true },
    isBaseline: { type: Boolean, default: false }
  },
  { timestamps: true }
)

selfReportSchema.index({ studentId: 1, timestamp: 1 })

export default mongoose.model('SelfReport', selfReportSchema)
