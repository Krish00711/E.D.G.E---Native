import mongoose from 'mongoose'

const attendanceSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    date: { type: Date, required: true, default: Date.now },
    status: { 
      type: String, 
      enum: ['present', 'absent', 'late', 'excused'], 
      required: true,
      default: 'present'
    },
    notes: { type: String, trim: true },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    duration: { type: Number }, // minutes attended (for partial attendance)
    isExcused: { type: Boolean, default: false }
  },
  { timestamps: true }
)

// Indexes for efficient queries
attendanceSchema.index({ studentId: 1, courseId: 1, date: -1 })
attendanceSchema.index({ studentId: 1, date: -1 })
attendanceSchema.index({ courseId: 1, date: -1 })

// Prevent duplicate attendance records for same student, course, date
attendanceSchema.index({ studentId: 1, courseId: 1, date: 1 }, { unique: true })

export default mongoose.model('Attendance', attendanceSchema)
