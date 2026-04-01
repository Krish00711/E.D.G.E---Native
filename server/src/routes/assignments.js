import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import Assignment from '../models/Assignment.js'
import AssignmentSubmission from '../models/AssignmentSubmission.js'
import Enrollment from '../models/Enrollment.js'

const router = Router()

const createAssignmentSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().min(1),
  dueDate: z.string().optional(),
  maxScore: z.number().min(0).optional()
})

const submitAssignmentSchema = z.object({
  assignmentId: z.string().min(1),
  content: z.string().optional(),
  fileUrls: z.array(z.string()).optional(),
  timeSpent: z.number().optional()
})

// POST /api/assignments - Create assignment (instructor/admin)
router.post('/', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const parsed = createAssignmentSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error })
  }

  const assignment = await Assignment.create(parsed.data)
  return res.status(201).json(assignment)
})

// GET /api/assignments - List assignments
router.get('/', requireAuth, async (req, res) => {
  const { courseId, page = 1, limit = 50 } = req.query
  const skip = (parseInt(page) - 1) * parseInt(limit)

  const filter = {}
  if (courseId) {
    filter.courseId = courseId
  } else if (req.user.role === 'student') {
    // Students see assignments for their enrolled courses only
    const enrollments = await Enrollment.find({ studentId: req.user.studentId }).select('courseId')
    const courseIds = enrollments.map(e => e.courseId)
    filter.courseId = { $in: courseIds }
  }

  const [assignments, total] = await Promise.all([
    Assignment.find(filter)
      .populate('courseId', 'code title')
      .sort({ dueDate: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Assignment.countDocuments(filter)
  ])

  return res.json({
    assignments,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    }
  })
})

// GET /api/assignments/:id - Get specific assignment
router.get('/:id', requireAuth, async (req, res) => {
  const assignment = await Assignment.findById(req.params.id)
    .populate('courseId', 'code title')

  if (!assignment) {
    return res.status(404).json({ error: 'Assignment not found' })
  }

  // Get submission statistics if user is instructor/admin
  if (req.user.role === 'admin' || req.user.role === 'mentor') {
    const submissions = await AssignmentSubmission.find({ assignmentId: assignment._id })
    const stats = {
      totalSubmissions: submissions.length,
      onTime: submissions.filter(s => !s.isLate).length,
      late: submissions.filter(s => s.isLate).length,
      missing: 0, // Would need to compare with enrolled students
      graded: submissions.filter(s => s.status === 'graded').length
    }
    return res.json({ assignment, statistics: stats })
  }

  return res.json(assignment)
})

// PATCH /api/assignments/:id - Update assignment (instructor/admin)
router.patch('/:id', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const assignment = await Assignment.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  )

  if (!assignment) {
    return res.status(404).json({ error: 'Assignment not found' })
  }

  return res.json(assignment)
})

// DELETE /api/assignments/:id - Delete assignment (admin only)
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const assignment = await Assignment.findByIdAndDelete(req.params.id)
  if (!assignment) {
    return res.status(404).json({ error: 'Assignment not found' })
  }
  
  // Also delete all submissions
  await AssignmentSubmission.deleteMany({ assignmentId: req.params.id })
  
  return res.json({ message: 'Assignment and submissions deleted successfully' })
})

// POST /api/assignments/submit - Submit assignment (student)
router.post('/submit', requireAuth, async (req, res) => {
  const parsed = submitAssignmentSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error })
  }

  // Check if assignment exists
  const assignment = await Assignment.findById(parsed.data.assignmentId)
  if (!assignment) {
    return res.status(404).json({ error: 'Assignment not found' })
  }

  // Create submission
  const submission = await AssignmentSubmission.create({
    ...parsed.data,
    studentId: req.user.id,
    submittedAt: new Date()
  })

  return res.status(201).json(submission)
})

// GET /api/assignments/:id/submissions - Get all submissions for assignment (instructor/admin)
router.get('/:id/submissions', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const submissions = await AssignmentSubmission.find({ assignmentId: req.params.id })
    .populate('studentId', 'name email')
    .sort({ submittedAt: -1 })

  return res.json({ submissions, total: submissions.length })
})

// GET /api/assignments/student/:studentId - Get student's submissions
router.get('/student/:studentId', requireAuth, async (req, res) => {
  const { courseId, status } = req.query

  const filter = { studentId: req.params.studentId }
  if (status) filter.status = status

  const submissions = await AssignmentSubmission.find(filter)
    .populate('assignmentId')
    .sort({ submittedAt: -1 })

  // Filter by courseId if provided
  let filteredSubmissions = submissions
  if (courseId) {
    filteredSubmissions = submissions.filter(s => 
      s.assignmentId && s.assignmentId.courseId.toString() === courseId
    )
  }

  return res.json({ submissions: filteredSubmissions, total: filteredSubmissions.length })
})

// PATCH /api/assignments/submissions/:id - Update submission status/feedback (instructor)
router.patch('/submissions/:id', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const { status, feedback, score, maxScore } = req.body

  const updates = {}
  if (status) updates.status = status
  if (feedback) updates.feedback = feedback
  if (score !== undefined) updates.score = score
  if (maxScore !== undefined) updates.maxScore = maxScore

  const submission = await AssignmentSubmission.findByIdAndUpdate(
    req.params.id,
    updates,
    { new: true }
  ).populate('studentId', 'name email').populate('assignmentId')

  if (!submission) {
    return res.status(404).json({ error: 'Submission not found' })
  }

  return res.json(submission)
})

// GET /api/assignments/:id/statistics - Assignment statistics
router.get('/:id/statistics', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const submissions = await AssignmentSubmission.find({ assignmentId: req.params.id })

  const stats = {
    totalSubmissions: submissions.length,
    onTime: submissions.filter(s => !s.isLate).length,
    late: submissions.filter(s => s.isLate).length,
    graded: submissions.filter(s => s.status === 'graded').length,
    averageDaysLate: 0,
    averageTimeSpent: 0
  }

  if (submissions.length > 0) {
    const lateSubmissions = submissions.filter(s => s.isLate)
    if (lateSubmissions.length > 0) {
      stats.averageDaysLate = lateSubmissions.reduce((sum, s) => sum + s.daysLate, 0) / lateSubmissions.length
    }

    const withTimeSpent = submissions.filter(s => s.timeSpent)
    if (withTimeSpent.length > 0) {
      stats.averageTimeSpent = withTimeSpent.reduce((sum, s) => sum + s.timeSpent, 0) / withTimeSpent.length
    }
  }

  return res.json(stats)
})

export default router
