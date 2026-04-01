import mongoose from 'mongoose'

const sensorDataSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' },
    type: {
      type: String,
      enum: [
        'heartRate',
        'hrv',
        'eegTheta',
        'eegAlpha',
        'eegBeta',
        'blinkRate',
        'pupilDilation',
        'gsr',
        'facialStress'
      ],
      required: true
    },
    value: { type: Number, required: true },
    unit: { type: String },
    recordedAt: { type: Date, default: Date.now, index: true },
    source: { type: String, default: 'simulated' }
  },
  { timestamps: true }
)

sensorDataSchema.index({ studentId: 1, recordedAt: -1 })

export default mongoose.model('SensorData', sensorDataSchema)
