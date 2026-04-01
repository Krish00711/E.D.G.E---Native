import mongoose from 'mongoose'

const instructorSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    department: { type: String, trim: true }
  },
  { timestamps: true }
)

export default mongoose.model('Instructor', instructorSchema)
