import mongoose from 'mongoose'

const resourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    type: { 
      type: String, 
      enum: ['document', 'video', 'link', 'book', 'article', 'tutorial', 'counseling', 'tutoring'], 
      required: true 
    },
    description: { type: String },
    url: { type: String },
    fileUrl: { type: String },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' }, // Optional course association
    tags: [{ type: String, trim: true }],
    category: { 
      type: String, 
      enum: ['academic', 'mental-health', 'physical-health', 'career', 'financial', 'social'], 
      default: 'academic' 
    },
    isActive: { type: Boolean, default: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    accessLevel: { type: String, enum: ['public', 'student', 'registered'], default: 'registered' },
    viewCount: { type: Number, default: 0 },
    usefulCount: { type: Number, default: 0 }, // How many found it useful
    contactInfo: { // For services like counseling
      email: String,
      phone: String,
      location: String,
      availableHours: String
    }
  },
  { timestamps: true }
)

// Indexes
resourceSchema.index({ type: 1, category: 1, isActive: 1 })
resourceSchema.index({ courseId: 1, isActive: 1 })
resourceSchema.index({ tags: 1 })

export default mongoose.model('Resource', resourceSchema)
