import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import Grade from '../models/Grade.js'
import Attendance from '../models/Attendance.js'
import Assignment from '../models/Assignment.js'
import AssignmentSubmission from '../models/AssignmentSubmission.js'
import Enrollment from '../models/Enrollment.js'
import Student from '../models/Student.js'
import Course from '../models/Course.js'

const router = Router()

// POST /api/bulk/grades - Bulk import grades from CSV (admin/mentor)
router.post('/grades', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const { grades } = req.body

  if (!Array.isArray(grades)) {
    return res.status(400).json({ error: 'grades must be an array' })
  }

  const created = []
  const errors = []

  for (const grade of grades) {
    try {
      const gradeDoc = await Grade.create({
        ...grade,
        gradedBy: req.user.id
      })
      created.push(gradeDoc)
    } catch (error) {
      errors.push({ grade, error: error.message })
    }
  }

  return res.json({
    success: created.length,
    failed: errors.length,
    created,
    errors
  })
})

// POST /api/bulk/attendance - Bulk import attendance records (admin/mentor)
router.post('/attendance', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const { records } = req.body

  if (!Array.isArray(records)) {
    return res.status(400).json({ error: 'records must be an array' })
  }

  const created = []
  const errors = []

  for (const record of records) {
    try {
      const attendance = await Attendance.create({
        ...record,
        markedBy: req.user.id,
        isExcused: record.status === 'excused'
      })
      created.push(attendance)
    } catch (error) {
      errors.push({ 
        record, 
        error: error.code === 11000 ? 'Duplicate' : error.message 
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

// POST /api/bulk/assignments - Bulk create assignments (admin/mentor)
router.post('/assignments', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const { assignments } = req.body

  if (!Array.isArray(assignments)) {
    return res.status(400).json({ error: 'assignments must be an array' })
  }

  const created = []
  const errors = []

  for (const assignment of assignments) {
    try {
      const doc = await Assignment.create(assignment)
      created.push(doc)
    } catch (error) {
      errors.push({ assignment, error: error.message })
    }
  }

  return res.json({
    success: created.length,
    failed: errors.length,
    created,
    errors
  })
})

// POST /api/bulk/enrollments - Bulk enroll students (admin only)
router.post('/enrollments', requireAuth, requireRole('admin'), async (req, res) => {
  const { enrollments } = req.body

  if (!Array.isArray(enrollments)) {
    return res.status(400).json({ error: 'enrollments must be an array' })
  }

  const created = []
  const errors = []

  for (const enrollment of enrollments) {
    try {
      const existing = await Enrollment.findOne({
        studentId: enrollment.studentId,
        courseId: enrollment.courseId
      })
      
      if (!existing) {
        const doc = await Enrollment.create(enrollment)
        created.push(doc)
      } else {
        errors.push({ enrollment, error: 'Already enrolled' })
      }
    } catch (error) {
      errors.push({ enrollment, error: error.message })
    }
  }

  return res.json({
    success: created.length,
    failed: errors.length,
    created,
    errors
  })
})

// POST /api/bulk/students - Bulk import students (admin only)
router.post('/students', requireAuth, requireRole('admin'), async (req, res) => {
  const { students } = req.body

  if (!Array.isArray(students)) {
    return res.status(400).json({ error: 'students must be an array' })
  }

  const created = []
  const errors = []

  for (const student of students) {
    try {
      // Check if student with email already exists
      const existing = await Student.findOne({ email: student.email })
      if (existing) {
        errors.push({ student, error: 'Email already exists' })
        continue
      }

      const doc = await Student.create(student)
      created.push(doc)
    } catch (error) {
      errors.push({ student, error: error.message })
    }
  }

  return res.json({
    success: created.length,
    failed: errors.length,
    created,
    errors
  })
})

// POST /api/bulk/courses - Bulk import courses (admin only)
router.post('/courses', requireAuth, requireRole('admin'), async (req, res) => {
  const { courses } = req.body

  if (!Array.isArray(courses)) {
    return res.status(400).json({ error: 'courses must be an array' })
  }

  const created = []
  const errors = []

  for (const course of courses) {
    try {
      const existing = await Course.findOne({ code: course.code })
      if (existing) {
        errors.push({ course, error: 'Course code already exists' })
        continue
      }

      const doc = await Course.create(course)
      created.push(doc)
    } catch (error) {
      errors.push({ course, error: error.message })
    }
  }

  return res.json({
    success: created.length,
    failed: errors.length,
    created,
    errors
  })
})

// GET /api/bulk/export/grades - Export all grades to JSON
router.get('/export/grades', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const { studentId, courseId, startDate, endDate } = req.query

  const filter = {}
  if (studentId) filter.studentId = studentId
  if (courseId) filter.courseId = courseId
  if (startDate || endDate) {
    filter.createdAt = {}
    if (startDate) filter.createdAt.$gte = new Date(startDate)
    if (endDate) filter.createdAt.$lte = new Date(endDate)
  }

  const grades = await Grade.find(filter)
    .populate('studentId', 'name email')
    .populate('courseId', 'code title')
    .populate('assignmentId', 'title')
    .lean()

  return res.json({
    exportDate: new Date(),
    totalRecords: grades.length,
    data: grades
  })
})

// GET /api/bulk/export/attendance - Export attendance to JSON
router.get('/export/attendance', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const { studentId, courseId, startDate, endDate } = req.query

  const filter = {}
  if (studentId) filter.studentId = studentId
  if (courseId) filter.courseId = courseId
  if (startDate || endDate) {
    filter.date = {}
    if (startDate) filter.date.$gte = new Date(startDate)
    if (endDate) filter.date.$lte = new Date(endDate)
  }

  const records = await Attendance.find(filter)
    .populate('studentId', 'name email')
    .populate('courseId', 'code title')
    .lean()

  return res.json({
    exportDate: new Date(),
    totalRecords: records.length,
    data: records
  })
})

// POST /api/bulk/validate - Validate bulk data before import (admin/mentor)
router.post('/validate', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const { type, data } = req.body

  if (!type || !Array.isArray(data)) {
    return res.status(400).json({ error: 'type and data (array) required' })
  }

  const validationErrors = []
  const validRecords = []

  for (let i = 0; i <data.length; i++) {
    const record = data[i]
    const errors = []

    switch (type) {
      case 'grades':
        if (!record.studentId) errors.push('studentId required')
        if (!record.courseId) errors.push('courseId required')
        if (record.score === undefined) errors.push('score required')
        if (record.maxScore === undefined) errors.push('maxScore required')
        break
      
      case 'attendance':
        if (!record.studentId) errors.push('studentId required')
        if (!record.courseId) errors.push('courseId required')
        if (!record.status) errors.push('status required')
        break
      
      case 'students':
        if (!record.name) errors.push('name required')
        if (!record.email) errors.push('email required')
        break
      
      case 'enrollments':
        if (!record.studentId) errors.push('studentId required')
        if (!record.courseId) errors.push('courseId required')
        break
    }

    if (errors.length > 0) {
      validationErrors.push({ index: i, record, errors })
    } else {
      validRecords.push(record)
    }
  }

  return res.json({
    totalRecords: data.length,
    valid: validRecords.length,
    invalid: validationErrors.length,
    validationErrors,
    readyToImport: validationErrors.length === 0
  })
})

export default router
