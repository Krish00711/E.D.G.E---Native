import mongoose from 'mongoose'

const resourceUsageSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    resourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', required: true },
    accessedAt: { type: Date, default: Date.now },
    durationMinutes: { type: Number }, // How long they used it
    wasHelpful: { type: Boolean }, // Student feedback
    notes: { type: String, trim: true }
  },
  { timestamps: true }
)

// Indexes
resourceUsageSchema.index({ studentId: 1, accessedAt: -1 })
resourceUsageSchema.index({ resourceId: 1, accessedAt: -1 })

export default mongoose.model('ResourceUsage', resourceUsageSchema)
