import mongoose from 'mongoose'

const riskPredictionSchema = new mongoose.Schema(
  {
    studentId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Student', 
      required: [true, 'Student ID is required'],
      index: true
    },
    sessionId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Session'
    },
    timestamp: { 
      type: Date, 
      default: Date.now,
      index: true
    },
    riskScore: { 
      type: Number, 
      min: [0, 'Risk score must be at least 0'], 
      max: [1, 'Risk score cannot exceed 1'], 
      required: [true, 'Risk score is required']
    },
    riskLevel: { 
      type: String, 
      enum: {
        values: ['low', 'moderate', 'high'],
        message: '{VALUE} is not a valid risk level'
      },
      required: [true, 'Risk level is required'],
      index: true
    },
    exhaustionScore: { 
      type: Number, 
      min: [0, 'Exhaustion score must be at least 0'], 
      max: [1, 'Exhaustion score cannot exceed 1']
    },
    cynicismScore: { 
      type: Number, 
      min: [0, 'Cynicism score must be at least 0'], 
      max: [1, 'Cynicism score cannot exceed 1']
    },
    efficacyScore: { 
      type: Number, 
      min: [0, 'Efficacy score must be at least 0'], 
      max: [1, 'Efficacy score cannot exceed 1']
    },
    confidence: {
      type: Number,
      min: [0, 'Confidence must be at least 0'],
      max: [1, 'Confidence cannot exceed 1'],
      default: 0.5
    },
    featuresSnapshot: { 
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    modelVersion: { 
      type: String, 
      default: 'v2.1',
      trim: true
    },
    predictionId: {
      type: String,
      index: true
    },
    isReviewed: {
      type: Boolean,
      default: false,
      index: true
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: {
      type: Date
    },
    notes: {
      type: String,
      maxlength: [1000, 'Notes cannot exceed 1000 characters']
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
)

// Compound indexes for common queries
riskPredictionSchema.index({ studentId: 1, timestamp: -1 })
riskPredictionSchema.index({ studentId: 1, riskLevel: 1 })
riskPredictionSchema.index({ riskLevel: 1, timestamp: -1 })
riskPredictionSchema.index({ isReviewed: 1, riskLevel: 1 })

// Virtual for dimension scores average
riskPredictionSchema.virtual('avgDimensionScore').get(function() {
  const scores = [
    this.exhaustionScore,
    this.cynicismScore,
    this.efficacyScore
  ].filter(s => s!== null && s !== undefined)
  
  return scores.length > 0 
    ? scores.reduce((a, b) => a + b) / scores.length 
    : null
})

// Virtual for risk severity (combines score and level)
riskPredictionSchema.virtual('severity').get(function() {
  if (this.riskLevel === 'high' && this.riskScore > 0.8) return 'critical'
  if (this.riskLevel === 'high') return 'high'
  if (this.riskLevel === 'moderate' && this.riskScore > 0.6) return 'elevated'
  if (this.riskLevel === 'moderate') return 'moderate'
  return 'low'
})

// Instance method to check if prediction needs review
riskPredictionSchema.methods.needsReview = function() {
  return !this.isReviewed && (this.riskLevel === 'high' || this.riskScore > 0.75)
}

// Static method to find unreviewed high-risk predictions
riskPredictionSchema.statics.findUnreviewedHighRisk = function() {
  return this.find({ 
    isReviewed: false, 
    riskLevel: 'high' 
  }).sort({ timestamp: -1 })
}

// Static method to get latest prediction for student
riskPredictionSchema.statics.findLatestForStudent = function(studentId) {
  return this.findOne({ studentId }).sort({ timestamp: -1 })
}

// Pre-save hook to auto-determine risk level from score if not provided
riskPredictionSchema.pre('save', function(next) {
  if (!this.riskLevel && this.riskScore !== undefined) {
    if (this.riskScore < 0.33) this.riskLevel = 'low'
    else if (this.riskScore < 0.66) this.riskLevel = 'moderate'
    else this.riskLevel = 'high'
  }
  next()
})

export default mongoose.model('RiskPrediction', riskPredictionSchema)
