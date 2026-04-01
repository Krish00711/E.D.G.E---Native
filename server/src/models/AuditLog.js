import mongoose from 'mongoose'

const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.ObjectId, ref: 'User', index: true },
  action: { type: String, required: true },
  resource: { type: String, required: true }, // 'student', 'intervention', 'alert', etc.
  resourceId: { type: mongoose.Schema.ObjectId, required: true, index: true },
  
  // Changes
  changes: {
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed
  },
  
  // Context
  cohortId: { type: mongoose.Schema.ObjectId, ref: 'Cohort', index: true },
  ipAddress: String,
  userAgent: String,
  
  // Metadata
  status: { type: String, enum: ['success', 'failed'], default: 'success' },
  details: String,
  
  createdAt: { type: Date, default: Date.now, index: true, expires: 7776000 } // Auto-delete after 90 days
})

auditLogSchema.index({ userId: 1, createdAt: -1 })
auditLogSchema.index({ resource: 1, createdAt: -1 })

export default mongoose.model('AuditLog', auditLogSchema)
