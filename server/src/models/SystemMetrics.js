import mongoose from 'mongoose'

const systemMetricsSchema = new mongoose.Schema({
  period: { type: String, required: true, index: true }, // 'daily', 'weekly', 'monthly'
  date: { type: Date, default: Date.now, index: true },
  
  // Prediction metrics
  totalPredictions: { type: Number, default: 0 },
  predictionAccuracy: { type: Number, min: 0, max: 100 }, // Compared to outcomes
  avgConfidence: { type: Number, min: 0, max: 1 },
  
  // Student metrics
  totalStudents: { type: Number, default: 0 },
  activeStudents: { type: Number, default: 0 },
  riskDistribution: {
    low: { type: Number, default: 0 },
    moderate: { type: Number, default: 0 },
    high: { type: Number, default: 0 }
  },
  
  // Alert metrics
  alertsGenerated: { type: Number, default: 0 },
  criticalAlerts: { type: Number, default: 0 },
  alertResponseTime: { type: Number }, // minutes
  
  // Intervention metrics
  interventionsCreated: { type: Number, default: 0 },
  interventionsCompleted: { type: Number, default: 0 },
  avgEffectiveness: { type: Number, min: 0, max: 100 },
  
  // System health
  apiResponseTime: { type: Number }, // milliseconds
  errorRate: { type: Number, min: 0, max: 100 }, // percentage
  databaseSize: { type: Number }, // bytes
  
  createdAt: { type: Date, default: Date.now }
})

systemMetricsSchema.index({ date: -1 })
systemMetricsSchema.index({ period: 1, date: -1 })

export default mongoose.model('SystemMetrics', systemMetricsSchema)
