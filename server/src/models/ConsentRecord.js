import mongoose from 'mongoose'

const consentRecordSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, unique: true },
    consentedAt: { type: Date, default: Date.now },
    revokedAt: { type: Date },
    version: { type: String, default: 'v1' },
    scopes: [{ type: String }]
  },
  { timestamps: true }
)

export default mongoose.model('ConsentRecord', consentRecordSchema)
