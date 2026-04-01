import mongoose from 'mongoose'

const interventionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.ObjectId, ref: 'Student', required: true, index: true },
  mentorId: { type: mongoose.Schema.ObjectId, ref: 'User', required: true, index: true },
  cohortId: { type: mongoose.Schema.ObjectId, ref: 'Cohort' },
  
  // Intervention details
  type: { type: String, enum: ['counseling', 'schedule-break', 'support-group', 'course-adjustment', 'workload-reduction', 'mentoring'], required: true },
  title: { type: String, required: true },
  description: { type: String },
  actionItems: [{ type: String }], // Specific tasks
  
  // Status tracking
  status: { type: String, enum: ['planned', 'in-progress', 'completed', 'paused', 'cancelled'], default: 'planned' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  severity: { type: String, enum: ['mild', 'moderate', 'severe'], default: 'moderate' },
  
  // Timeline
  createdAt: { type: Date, default: Date.now, index: true },
  startDate: { type: Date, index: true },
  targetDate: { type: Date },
  completedAt: { type: Date },
  
  // Outcome tracking
  riskBefore: { type: Number, min: 0, max: 1 },
  riskAfter: { type: Number, min: 0, max: 1 },
  outcome: { type: String, enum: ['improved', 'stable', 'worsened', 'unknown'], default: 'unknown' },
  effectiveness: { type: Number, min: 0, max: 100 }, // Percentage improvement
  
  // Notes & follow-up
  notes: [{ 
    author: mongoose.Schema.ObjectId,
    text: String,
    createdAt: { type: Date, default: Date.now }
  }],
  followUpRequired: { type: Boolean, default: false },
  nextReviewDate: { type: Date },
  
  updatedAt: { type: Date, default: Date.now }
})

interventionSchema.index({ studentId: 1, status: 1 })
interventionSchema.index({ cohortId: 1, createdAt: -1 })
interventionSchema.index({ status: 1, priority: -1 })

export default mongoose.model('Intervention', interventionSchema)
