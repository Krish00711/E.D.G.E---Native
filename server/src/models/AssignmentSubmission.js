import mongoose from 'mongoose'

const assignmentSubmissionSchema = new mongoose.Schema(
  {
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    submittedAt: { type: Date, default: Date.now },
    status: { 
      type: String, 
      enum: ['submitted', 'late', 'missing', 'draft', 'graded'], 
      default: 'submitted' 
    },
    content: { type: String }, // Text content or description
    fileUrls: [{ type: String }], // Array of file URLs
    attemptNumber: { type: Number, default: 1 },
    timeSpent: { type: Number }, // minutes spent on assignment
    isLate: { type: Boolean, default: false },
    daysLate: { type: Number, default: 0 },
    grade: { type: mongoose.Schema.Types.ObjectId, ref: 'Grade' }, // Link to grade record
    feedback: { type: String, trim: true },
    score: { type: Number },
    maxScore: { type: Number }
  },
  { timestamps: true }
)

// Indexes
assignmentSubmissionSchema.index({ studentId: 1, assignmentId: 1 })
assignmentSubmissionSchema.index({ assignmentId: 1, status: 1 })
assignmentSubmissionSchema.index({ studentId: 1, submittedAt: -1 })

// Calculate if submission is late
assignmentSubmissionSchema.pre('save', async function(next) {
  if (this.isNew && this.assignmentId) {
    const Assignment = mongoose.model('Assignment')
    const assignment = await Assignment.findById(this.assignmentId)
    if (assignment && assignment.dueDate) {
      const dueDate = new Date(assignment.dueDate)
      const submittedAt = new Date(this.submittedAt)
      if (submittedAt > dueDate) {
        this.isLate = true
        this.daysLate = Math.ceil((submittedAt - dueDate) / (1000 * 60 * 60 * 24))
        this.status = 'late'
      }
    }
  }
  next()
})

export default mongoose.model('AssignmentSubmission', assignmentSubmissionSchema)
