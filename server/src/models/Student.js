import mongoose from 'mongoose'

const studentSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: [true, 'User ID is required'],
      unique: true,
      index: true
    },
    name: { 
      type: String, 
      trim: true,
      required: [true, 'Student name is required'],
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: { 
      type: String, 
      lowercase: true, 
      trim: true,
      required: [true, 'Email is required'],
      unique: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
      index: true
    },
    major: { 
      type: String, 
      trim: true,
      maxlength: [100, 'Major cannot exceed 100 characters']
    },
    program: { 
      type: String, 
      trim: true,
      enum: {
        values: ['undergraduate', 'graduate', 'phd', 'certificate'],
        message: '{VALUE} is not a valid program type'
      }
    },
    year: { 
      type: Number,
      min: [1, 'Year must be at least 1'],
      max: [8, 'Year cannot exceed 8'],
      validate: {
        validator: Number.isInteger,
        message: 'Year must be an integer'
      }
    },
    cohortId: { 
      type: String, 
      index: true,
      required: [true, 'Cohort ID is required']
    },
    baselineRisk: { 
      type: Number, 
      default: 0.0,
      min: [0, 'Baseline risk must be at least 0'],
      max: [1, 'Baseline risk cannot exceed 1']
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'graduated', 'withdrawn'],
      default: 'active',
      index: true
    },
    enrollmentDate: {
      type: Date,
      default: Date.now
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
)

// Compound indexes for common queries
studentSchema.index({ cohortId: 1, status: 1 })
studentSchema.index({ cohortId: 1, createdAt: -1 })

// Virtual for full name display
studentSchema.virtual('displayName').get(function() {
  return this.name || this.email.split('@')[0]
})

// Virtual for program level
studentSchema.virtual('programLevel').get(function() {
  if (!this.year) return 'unknown'
  if (this.year <= 4) return 'undergraduate'
  return 'graduate'
})

// Instance method to check if student is at risk
studentSchema.methods.isAtRisk = function() {
  return this.baselineRisk > 0.5
}

// Static method to find active students in cohort
studentSchema.statics.findActiveByCohort = function(cohortId) {
  return this.find({ cohortId, status: 'active' })
}

export default mongoose.model('Student', studentSchema)
