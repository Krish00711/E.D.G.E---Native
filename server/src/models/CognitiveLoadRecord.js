import mongoose from 'mongoose'

const cognitiveLoadRecordSchema = new mongoose.Schema(
  {
    studentId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Student', 
      required: [true, 'Student ID is required'],
      index: true
    },
    sessionId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Session',
      index: true
    },
    recordedAt: { 
      type: Date, 
      default: Date.now,
      index: true
    },
    overallLoad: { 
      type: Number, 
      min: [0, 'Overall load must be at least 0'], 
      max: [100, 'Overall load cannot exceed 100'], 
      required: [true, 'Overall load is required']
    },
    intrinsicLoad: { 
      type: Number, 
      min: [0, 'Intrinsic load must be at least 0'], 
      max: [100, 'Intrinsic load cannot exceed 100']
    },
    extraneousLoad: { 
      type: Number, 
      min: [0, 'Extraneous load must be at least 0'], 
      max: [100, 'Extraneous load cannot exceed 100']
    },
    germaneLoad: { 
      type: Number, 
      min: [0, 'Germane load must be at least 0'], 
      max: [100, 'Germane load cannot exceed 100']
    },
    loadLevel: {
      type: String,
      enum: ['low', 'moderate', 'high', 'critical'],
      index: true
    },
    featuresSnapshot: { 
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    computationMethod: {
      type: String,
      enum: ['sensor', 'self-report', 'hybrid', 'simulated'],
      default: 'hybrid'
    },
    confidence: {
      type: Number,
      min: [0, 'Confidence must be at least 0'],
      max: [1, 'Confidence cannot exceed 1'],
      default: 0.8
    },
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters']
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
)

// Compound indexes for common queries
cognitiveLoadRecordSchema.index({ studentId: 1, recordedAt: -1 })
cognitiveLoadRecordSchema.index({ studentId: 1, loadLevel: 1 })
cognitiveLoadRecordSchema.index({ loadLevel: 1, recordedAt: -1 })
cognitiveLoadRecordSchema.index({ sessionId: 1, recordedAt: -1 })

// Virtual for load distribution balance
cognitiveLoadRecordSchema.virtual('loadBalance').get(function() {
  if (!this.intrinsicLoad || !this.extraneousLoad || !this.germaneLoad) return null
  
  const total = this.intrinsicLoad + this.extraneousLoad + this.germaneLoad
  return {
    intrinsic: ((this.intrinsicLoad / total) * 100).toFixed(1),
    extraneous: ((this.extraneousLoad / total) * 100).toFixed(1),
    germane: ((this.germaneLoad / total) * 100).toFixed(1)
  }
})

// Virtual for load efficiency (germane/overall ratio)
cognitiveLoadRecordSchema.virtual('efficiency').get(function() {
  if (!this.germaneLoad || !this.overallLoad) return null
  return ((this.germaneLoad / this.overallLoad) * 100).toFixed(1)
})

// Instance method to check if load is concerning
cognitiveLoadRecordSchema.methods.isConcerning = function() {
  return this.overallLoad > 75 || this.loadLevel === 'critical' || this.loadLevel === 'high'
}

// Instance method to get recommendations based on load
cognitiveLoadRecordSchema.methods.getRecommendations = function() {
  const recommendations = []
  
  if (this.overallLoad > 80) {
    recommendations.push('Take immediate break')
  }
  if (this.extraneousLoad > 70) {
    recommendations.push('Reduce environmental distractions')
  }
  if (this.intrinsicLoad > 75) {
    recommendations.push('Review foundational concepts')
  }
  if (this.germaneLoad < 40) {
    recommendations.push('Increase active learning strategies')
  }
  
  return recommendations
}

// Static method to find high load records
cognitiveLoadRecordSchema.statics.findHighLoad = function(days = 7) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  return this.find({
    recordedAt: { $gte: startDate },
    overallLoad: { $gte: 75 }
  }).sort({ recordedAt: -1 })
}

// Pre-save hook to determine load level from overallLoad
cognitiveLoadRecordSchema.pre('save', function(next) {
  if (!this.loadLevel && this.overallLoad !== undefined) {
    if (this.overallLoad < 40) this.loadLevel = 'low'
    else if (this.overallLoad < 65) this.loadLevel = 'moderate'
    else if (this.overallLoad < 85) this.loadLevel = 'high'
    else this.loadLevel = 'critical'
  }
  next()
})

export default mongoose.model('CognitiveLoadRecord', cognitiveLoadRecordSchema)
