import mongoose from 'mongoose'

const sessionSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    startAt: { type: Date, required: true },
    endAt: { type: Date },
    durationMin: { type: Number },
    context: {
      examWeek: { type: Boolean, default: false }
    }
  },
  { timestamps: true }
)

sessionSchema.index({ studentId: 1, startAt: 1 })

export default mongoose.model('Session', sessionSchema)
