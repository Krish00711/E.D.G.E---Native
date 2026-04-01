import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import ConsentRecord from '../models/ConsentRecord.js'
import AuditLog from '../models/AuditLog.js'

const router = Router()

const consentSchema = z.object({
  scopes: z.array(z.string()).optional(),
  version: z.string().optional()
})

router.get('/me', requireAuth, async (req, res) => {
  const record = await ConsentRecord.findOne({ studentId: req.user.studentId })
  return res.json(record || null)
})

router.post('/accept', requireAuth, async (req, res) => {
  const parsed = consentSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error })
  }

  const record = await ConsentRecord.findOneAndUpdate(
    { studentId: req.user.studentId },
    {
      studentId: req.user.studentId,
      scopes: parsed.data.scopes || ['sensors', 'lms', 'notifications'],
      version: parsed.data.version || 'v1',
      consentedAt: new Date(),
      revokedAt: null
    },
    { upsert: true, new: true }
  )

  await AuditLog.create({
    userId: req.user.id,
    action: 'consent.accept',
    resource: 'consent',
    resourceId: record._id,
    status: 'success'
  })

  return res.json(record)
})

router.post('/revoke', requireAuth, async (req, res) => {
  const record = await ConsentRecord.findOne({ studentId: req.user.studentId })
  if (!record) {
    return res.status(404).json({ error: 'Consent record not found' })
  }

  record.revokedAt = new Date()
  await record.save()

  await AuditLog.create({
    userId: req.user.id,
    action: 'consent.revoke',
    resource: 'consent',
    resourceId: record._id,
    status: 'success'
  })

  return res.json(record)
})

export default router
