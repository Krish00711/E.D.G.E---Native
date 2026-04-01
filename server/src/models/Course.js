import mongoose from 'mongoose'

const courseSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, unique: true },
    title: { type: String, required: true, trim: true },
    instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Instructor' },
    description: { type: String, trim: true },
    credits: { type: Number, default: 3, min: 0 },
    department: { type: String, trim: true },
    difficultyLevel: { 
      type: String, 
      enum: ['beginner', 'intermediate', 'advanced'], 
      default: 'intermediate' 
    },
    maxEnrollment: { type: Number },
    semester: { type: String }, // e.g., "Fall 2024"
    year: { type: Number },
    prerequisites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    syllabus: { type: String }, // URL or text
    schedule: {
      days: [{ type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] }],
      startTime: { type: String }, // e.g., "09:00"
      endTime: { type: String }, // e.g., "10:30"
      location: { type: String }
    },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
)

// Index for efficient queries
courseSchema.index({ code: 1, semester: 1, year: 1 })

export default mongoose.model('Course', courseSchema)
