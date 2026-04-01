import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import User from '../models/User.js'
import Student from '../models/Student.js'
import Instructor from '../models/Instructor.js'
import ConsentRecord from '../models/ConsentRecord.js'
import SelfReport from '../models/SelfReport.js'

const router = Router()

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['student', 'mentor', 'admin']).optional(),
  major: z.string().optional(),
  program: z.string().optional(),
  year: z.number().optional(),
  cohortId: z.string().optional(),
  department: z.string().optional(),
  baselineLoadScore: z.number().min(1).max(10).optional(),
  baselineStressScore: z.number().min(1).max(10).optional(),
  baselineSleepHours: z.number().min(0).max(24).optional(),
  consented: z.boolean().optional()
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

router.post('/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload' })
    }

    const {
      name,
      email,
      password,
      role,
      major,
      program,
      year,
      cohortId,
      department,
      baselineLoadScore,
      baselineStressScore,
      baselineSleepHours,
      consented
    } = parsed.data
    const existing = await User.findOne({ email }).maxTimeMS(5000)
    if (existing) {
      return res.status(409).json({ error: 'Email already in use' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await User.create({ name, email, passwordHash, role: role || 'student' })

    let studentId = null
    let instructorId = null

    if (user.role === 'student') {
      const validPrograms = ['undergraduate', 'graduate', 'phd', 'certificate']
      const student = await Student.create({
        _id: user._id,
        userId: user._id,
        name: user.name,
        email: user.email,
        major: major || 'Undeclared',
        program: validPrograms.includes(program) ? program : 'undergraduate',
        year: year && Number.isInteger(year) && year >= 1 && year <= 8 ? year : 1,
        cohortId: cohortId || `cohort-${new Date().getFullYear()}`
      })
      studentId = student._id.toString()

      if (consented) {
        await ConsentRecord.findOneAndUpdate(
          { studentId: student._id },
          {
            studentId: student._id,
            scopes: ['sensors', 'lms', 'notifications'],
            version: 'v1',
            consentedAt: new Date(),
            revokedAt: null
          },
          { upsert: true, new: true }
        )
      }

      if (baselineLoadScore || baselineStressScore || baselineSleepHours) {
        await SelfReport.create({
          studentId: student._id,
          loadScore: baselineLoadScore,
          stressScore: baselineStressScore,
          sleepHours: baselineSleepHours,
          isBaseline: true,
          notes: 'Baseline onboarding survey.'
        })
      }
    }

    if (user.role === 'mentor') {
      const instructor = await Instructor.create({
        userId: user._id,
        department: department || 'General'
      })
      instructorId = instructor._id.toString()
    }

    // Generate JWT token
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET not set in environment')
      return res.status(500).json({ error: 'Server configuration error' })
    }

    const tokenPayload = { sub: user._id.toString(), role: user.role, email: user.email }
    if (studentId) tokenPayload.studentId = studentId
    if (instructorId) tokenPayload.instructorId = instructorId

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    return res.status(201).json({ 
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        onboardingComplete: Boolean(user.onboardingComplete),
        studentId,
        instructorId
      }
    })
  } catch (error) {
    console.error('Register error:', error)
    return res.status(500).json({ error: error.message || 'Registration failed' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload' })
    }

    const { email, password } = parsed.data
    const user = await User.findOne({ email }).lean().maxTimeMS(5000)
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET not set in environment')
      return res.status(500).json({ error: 'Server configuration error' })
    }

    let studentId = null
    let instructorId = null

    if (user.role === 'student') {
      const student = await Student.findOne({ userId: user._id })
      studentId = student?._id?.toString() || null
    }

    if (user.role === 'mentor') {
      const instructor = await Instructor.findOne({ userId: user._id })
      instructorId = instructor?._id?.toString() || null
    }

    const loginPayload = { sub: user._id.toString(), role: user.role, email: user.email }
    if (studentId) loginPayload.studentId = studentId
    if (instructorId) loginPayload.instructorId = instructorId

    const token = jwt.sign(
      loginPayload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    return res.json({ 
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        onboardingComplete: Boolean(user.onboardingComplete),
        studentId,
        instructorId
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    return res.status(500).json({ error: error.message || 'Login failed' })
  }
})

// GET /api/auth/me - Current user profile
router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.sub)
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  let studentId = null
  let instructorId = null

  if (user.role === 'student') {
    const student = await Student.findOne({ userId: user._id })
    studentId = student?._id?.toString() || null
  }

  if (user.role === 'mentor') {
    const instructor = await Instructor.findOne({ userId: user._id })
    instructorId = instructor?._id?.toString() || null
  }

  return res.json({
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    onboardingComplete: Boolean(user.onboardingComplete),
    studentId,
    instructorId
  })
})

// POST /api/auth/refresh - Issue a new token for an already-authenticated user
router.post('/refresh', requireAuth, async (req, res) => {
  try {
    const payload = { sub: req.user.id, role: req.user.role, email: req.user.email }
    if (req.user.studentId && req.user.role === 'student') payload.studentId = req.user.studentId
    if (req.user.instructorId && req.user.role === 'mentor') payload.instructorId = req.user.instructorId

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' })

    // Fire and forget — update lastActive without blocking response
    User.findByIdAndUpdate(req.user.id, { lastActive: new Date() }).catch(() => {})

    return res.json({ token, expiresIn: '7d' })
  } catch (error) {
    return res.status(500).json({ error: 'Token refresh failed' })
  }
})

export default router
