import mongoose from 'mongoose'

const cohortAggregateSchema = new mongoose.Schema(
  {
    cohortId: { type: String, required: true },
    period: { type: String, required: true },
    avgRisk: { type: Number, default: 0 },
    highRiskCount: { type: Number, default: 0 },
    avgLoad: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
)

cohortAggregateSchema.index({ cohortId: 1, period: 1 }, { unique: true })

export default mongoose.model('CohortAggregate', cohortAggregateSchema)
