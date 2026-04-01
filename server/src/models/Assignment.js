import mongoose from 'mongoose'

const assignmentSchema = new mongoose.Schema(
  {
    courseId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Course', 
      required: [true, 'Course ID is required'],
      index: true
    },
    title: { 
      type: String, 
      required: [true, 'Assignment title is required'], 
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
      index: 'text' // Text index for search
    },
    description: { 
      type: String, 
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    instructions: {
      type: String,
      trim: true,
      maxlength: [5000, 'Instructions cannot exceed 5000 characters']
    },
    dueDate: { 
      type: Date,
      required: [true, 'Due date is required'],
      index: true
    },
    maxScore: { 
      type: Number,
      required: [true, 'Max score is required'],
      min: [0, 'Max score must be at least 0'],
      max: [1000, 'Max score cannot exceed 1000']
    },
    weight: {
      type: Number,
      min: [0, 'Weight must be at least 0'],
      max: [100, 'Weight cannot exceed 100'],
      default: 1
    },
    type: {
      type: String,
      enum: ['homework', 'quiz', 'exam', 'project', 'lab', 'discussion', 'presentation'],
      default: 'homework',
      index: true
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'closed', 'graded'],
      default: 'draft',
      index: true
    },
    publishedAt: {
      type: Date
    },
    closedAt: {
      type: Date
    },
    allowLateSubmissions: {
      type: Boolean,
      default: true
    },
    latePenaltyRate: {
      type: Number,
      min: [0, 'Late penalty rate must be at least 0'],
      max: [100, 'Late penalty rate cannot exceed 100'],
      default: 10 // 10% per day
    },
    attachments: [{
      filename: String,
      url: String,
      fileType: String,
      uploadedAt: { type: Date, default: Date.now }
    }],
    rubric: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
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
assignmentSchema.index({ courseId: 1, dueDate: 1 })
assignmentSchema.index({ courseId: 1, status: 1 })
assignmentSchema.index({ status: 1, dueDate: 1 })
assignmentSchema.index({ dueDate: 1, status: 1 })

// Virtual for isOverdue
assignmentSchema.virtual('isOverdue').get(function() {
  return this.dueDate && new Date() > this.dueDate && this.status !== 'closed'
})

// Virtual for daysUntilDue
assignmentSchema.virtual('daysUntilDue').get(function() {
  if (!this.dueDate) return null
  const diff = this.dueDate - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
})

// Virtual for urgency level
assignmentSchema.virtual('urgency').get(function() {
  const days = this.daysUntilDue
  if (days === null) return 'none'
  if (days < 0) return 'overdue'
  if (days <= 1) return 'urgent'
  if (days <= 3) return 'soon'
  return 'normal'
})

// Instance method to check if accepting submissions
assignmentSchema.methods.isAcceptingSubmissions = function() {
  if (this.status !== 'published') return false
  if (!this.dueDate) return true
  if (this.isOverdue && !this.allowLateSubmissions) return false
  return true
}

// Instance method to calculate late penalty
assignmentSchema.methods.calculateLatePenalty = function(submissionDate) {
  if (!this.dueDate || submissionDate <= this.dueDate) return 0
  
  const daysLate = Math.ceil((submissionDate - this.dueDate) / (1000 * 60 * 60 * 24))
  const penalty = Math.min(daysLate * this.latePenaltyRate, 100)
  return penalty
}

// Static method to find upcoming assignments
assignmentSchema.statics.findUpcoming = function(courseId, days = 7) {
  const now = new Date()
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
  
  return this.find({
    courseId,
    status: 'published',
    dueDate: { $gte: now, $lte: future }
  }).sort({ dueDate: 1 })
}

// Static method to find overdue assignments
assignmentSchema.statics.findOverdue = function(courseId) {
  return this.find({
    courseId,
    status: 'published',
    dueDate: { $lt: new Date() }
  }).sort({ dueDate: -1 })
}

// Pre-save hook to set publishedAt when status changes to published
assignmentSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date()
  }
  if (this.isModified('status') && this.status === 'closed' && !this.closedAt) {
    this.closedAt = new Date()
  }
  next()
})

export default mongoose.model('Assignment', assignmentSchema)
