import mongoose from 'mongoose'

const gradeSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' },
    score: { type: Number, required: true, min: 0 },
    maxScore: { type: Number, required: true, min: 1 },
    weight: { type: Number, default: 1, min: 0 }, // Weight of this grade in final calculation
    gradeType: { 
      type: String, 
      enum: ['assignment', 'quiz', 'exam', 'project', 'participation', 'final', 'midterm'], 
      default: 'assignment' 
    },
    feedback: { type: String, trim: true },
    gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    gradedAt: { type: Date, default: Date.now },
    letterGrade: { type: String, enum: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'] }
  },
  { timestamps: true }
)

// Indexes for efficient queries
gradeSchema.index({ studentId: 1, courseId: 1 })
gradeSchema.index({ studentId: 1, createdAt: -1 })
gradeSchema.index({ courseId: 1, createdAt: -1 })

// Calculate percentage
gradeSchema.virtual('percentage').get(function() {
  return (this.score / this.maxScore) * 100
})

// Auto-calculate letter grade before saving
gradeSchema.pre('save', function(next) {
  const percentage = (this.score / this.maxScore) * 100
  if (percentage >= 97) this.letterGrade = 'A+'
  else if (percentage >= 93) this.letterGrade = 'A'
  else if (percentage >= 90) this.letterGrade = 'A-'
  else if (percentage >= 87) this.letterGrade = 'B+'
  else if (percentage >= 83) this.letterGrade = 'B'
  else if (percentage >= 80) this.letterGrade = 'B-'
  else if (percentage >= 77) this.letterGrade = 'C+'
  else if (percentage >= 73) this.letterGrade = 'C'
  else if (percentage >= 70) this.letterGrade = 'C-'
  else if (percentage >= 60) this.letterGrade = 'D'
  else this.letterGrade = 'F'
  next()
})

gradeSchema.set('toJSON', { virtuals: true })

export default mongoose.model('Grade', gradeSchema)
