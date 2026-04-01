import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import Attendance from '../models/Attendance.js'

const router = Router()

const markAttendanceSchema = z.object({
  studentId: z.string().min(1),
  courseId: z.string().min(1),
  date: z.string().optional(),
  status: z.enum(['present', 'absent', 'late', 'excused']),
  notes: z.string().optional(),
  duration: z.number().optional()
})

// POST /api/attendance - Mark attendance (instructor/admin)
router.post('/', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const parsed = markAttendanceSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error })
  }

  const attendanceData = {
    ...parsed.data,
    date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
    markedBy: req.user.id,
    isExcused: parsed.data.status === 'excused'
  }

  try {
    const attendance = await Attendance.create(attendanceData)
    return res.status(201).json(attendance)
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Attendance already marked for this student, course, and date' })
    }
    throw error
  }
})

// GET /api/attendance - List attendance records
router.get('/', requireAuth, async (req, res) => {
  const { studentId, courseId, status, startDate, endDate, page = 1, limit = 100 } = req.query
  const skip = (parseInt(page) - 1) * parseInt(limit)

  const filter = {}
  // Students can only see their own attendance
  if (req.user.role === 'student') {
    filter.studentId = req.user.studentId
  } else if (studentId) {
    filter.studentId = studentId
  }
  if (courseId) filter.courseId = courseId
  if (status) filter.status = status
  
  if (startDate || endDate) {
    filter.date = {}
    if (startDate) filter.date.$gte = new Date(startDate)
    if (endDate) filter.date.$lte = new Date(endDate)
  }

  const [records, total] = await Promise.all([
    Attendance.find(filter)
      .populate('studentId', 'name email')
      .populate('courseId', 'code title')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Attendance.countDocuments(filter)
  ])

  return res.json({
    records,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    }
  })
})

// GET /api/attendance/:id - Get specific attendance record
router.get('/:id', requireAuth, async (req, res) => {
  const attendance = await Attendance.findById(req.params.id)
    .populate('studentId', 'name email')
    .populate('courseId', 'code title')
    .populate('markedBy', 'email')

  if (!attendance) {
    return res.status(404).json({ error: 'Attendance record not found' })
  }

  return res.json(attendance)
})

// PATCH /api/attendance/:id - Update attendance record
router.patch('/:id', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const { status, notes, duration, isExcused } = req.body

  const updates = {}
  if (status) updates.status = status
  if (notes !== undefined) updates.notes = notes
  if (duration !== undefined) updates.duration = duration
  if (isExcused !== undefined) updates.isExcused = isExcused

  const attendance = await Attendance.findByIdAndUpdate(
    req.params.id,
    updates,
    { new: true, runValidators: true }
  )

  if (!attendance) {
    return res.status(404).json({ error: 'Attendance record not found' })
  }

  return res.json(attendance)
})

// DELETE /api/attendance/:id - Delete attendance record (admin only)
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const attendance = await Attendance.findByIdAndDelete(req.params.id)
  if (!attendance) {
    return res.status(404).json({ error: 'Attendance record not found' })
  }
  return res.json({ message: 'Attendance record deleted successfully' })
})

// GET /api/attendance/student/:studentId/rate - Calculate attendance rate
router.get('/student/:studentId/rate', requireAuth, async (req, res) => {
  const { courseId, startDate, endDate } = req.query

  const filter = { studentId: req.params.studentId }
  if (courseId) filter.courseId = courseId
  
  if (startDate || endDate) {
    filter.date = {}
    if (startDate) filter.date.$gte = new Date(startDate)
    if (endDate) filter.date.$lte = new Date(endDate)
  }

  const records = await Attendance.find(filter)

  if (records.length === 0) {
    return res.json({ 
      attendanceRate: 0, 
      totalClasses: 0, 
      present: 0, 
      absent: 0, 
      late: 0, 
      excused: 0 
    })
  }

  const stats = {
    totalClasses: records.length,
    present: records.filter(r => r.status === 'present').length,
    absent: records.filter(r => r.status === 'absent' && !r.isExcused).length,
    late: records.filter(r => r.status === 'late').length,
    excused: records.filter(r => r.isExcused).length
  }

  // Calculate attendance rate (present + late counts as attended)
  const attended = stats.present + stats.late
  stats.attendanceRate = parseFloat(((attended / stats.totalClasses) * 100).toFixed(2))

  return res.json(stats)
})

// GET /api/attendance/course/:courseId/summary - Course attendance summary
router.get('/course/:courseId/summary', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const { date } = req.query

  const filter = { courseId: req.params.courseId }
  if (date) {
    const targetDate = new Date(date)
    filter.date = {
      $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
      $lte: new Date(targetDate.setHours(23, 59, 59, 999))
    }
  }

  const records = await Attendance.find(filter)
    .populate('studentId', 'name email')

  const summary = {
    totalRecords: records.length,
    present: records.filter(r => r.status === 'present').length,
    absent: records.filter(r => r.status === 'absent' && !r.isExcused).length,
    late: records.filter(r => r.status === 'late').length,
    excused: records.filter(r => r.isExcused).length,
    attendanceRate: 0
  }

  if (records.length > 0) {
    const attended = summary.present + summary.late
    summary.attendanceRate = parseFloat(((attended / records.length) * 100).toFixed(2))
  }

  return res.json({ summary, records })
})

// POST /api/attendance/bulk - Mark attendance for multiple students
router.post('/bulk', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const { courseId, date, records } = req.body

  if (!courseId || !Array.isArray(records)) {
    return res.status(400).json({ error: 'courseId and records (array) required' })
  }

  const attendanceDate = date ? new Date(date) : new Date()
  const created = []
  const errors = []

  for (const record of records) {
    try {
      const attendance = await Attendance.create({
        studentId: record.studentId,
        courseId,
        date: attendanceDate,
        status: record.status || 'present',
        notes: record.notes,
        markedBy: req.user.id,
        isExcused: record.status === 'excused'
      })
      created.push(attendance)
    } catch (error) {
      errors.push({ 
        studentId: record.studentId, 
        error: error.code === 11000 ? 'Already marked' : error.message 
      })
    }
  }

  return res.json({
    success: created.length,
    failed: errors.length,
    created,
    errors
  })
})

// GET /api/attendance/student/:studentId/history - Student attendance history
router.get('/student/:studentId/history', requireAuth, async (req, res) => {
  const { courseId, days = 30 } = req.query

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - parseInt(days))

  const filter = {
    studentId: req.params.studentId,
    date: { $gte: startDate }
  }
  if (courseId) filter.courseId = courseId

  const records = await Attendance.find(filter)
    .populate('courseId', 'code title')
    .sort({ date: -1 })

  const byDate = records.reduce((acc, record) => {
    const dateKey = record.date.toISOString().split('T')[0]
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push({
      course: record.courseId?.code,
      status: record.status,
      notes: record.notes
    })
    return acc
  }, {})

  return res.json({
    history: byDate,
    totalRecords: records.length,
    dateRange: { start: startDate, end: new Date() }
  })
})

export default router
