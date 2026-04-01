import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

import User from './models/User.js'
import Student from './models/Student.js'
import Course from './models/Course.js'
import Enrollment from './models/Enrollment.js'
import Grade from './models/Grade.js'
import Attendance from './models/Attendance.js'
import Assignment from './models/Assignment.js'
import AssignmentSubmission from './models/AssignmentSubmission.js'
import SelfReport from './models/SelfReport.js'
import Notification from './models/Notification.js'
import RiskPrediction from './models/RiskPrediction.js'
import Alert from './models/Alert.js'
import RecoveryAction from './models/RecoveryAction.js'
import Intervention from './models/Intervention.js'

const MONGO_URI = process.env.MONGO_URI
const SALT_ROUNDS = 10

if (!MONGO_URI) {
  throw new Error('MONGO_URI is required to run seed')
}

const randomFloat = (min, max, decimals = 1) => {
  const factor = 10 ** decimals
  const value = Math.random() * (max - min) + min
  return Math.round(value * factor) / factor
}

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

const daysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

async function clearAllCollections() {
  console.log('[Seed] Clearing all collections...')
  const collections = await mongoose.connection.db.collections()
  for (const collection of collections) {
    await collection.deleteMany({})
  }
  console.log(`[Seed] Cleared ${collections.length} collections.`)
}

async function seed() {
  console.log('[Seed] Connecting to MongoDB...')
  await mongoose.connect(MONGO_URI)
  console.log('[Seed] Connected.')

  try {
    await clearAllCollections()

    console.log('[Seed] Creating users...')
    const [adminPasswordHash, mentorPasswordHash, studentPasswordHash] = await Promise.all([
      bcrypt.hash('Admin123456', SALT_ROUNDS),
      bcrypt.hash('Mentor123456', SALT_ROUNDS),
      bcrypt.hash('Student123456', SALT_ROUNDS)
    ])

    const adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@edge.com',
      passwordHash: adminPasswordHash,
      role: 'admin',
      onboardingComplete: true
    })

    const mentorUser = await User.create({
      name: 'Dr. Sarah Johnson',
      email: 'mentor@edge.com',
      passwordHash: mentorPasswordHash,
      role: 'mentor',
      onboardingComplete: true
    })

    const studentUser = await User.create({
      name: 'John Doe',
      email: 'student@edge.com',
      passwordHash: studentPasswordHash,
      role: 'student',
      onboardingComplete: true
    })
    console.log('[Seed] Users created.')

    console.log('[Seed] Creating student profile...')
    const student = await Student.create({
      userId: studentUser._id,
      name: 'John Doe',
      email: 'student@edge.com',
      major: 'Computer Science',
      year: 2,
      cohortId: 'CS2024'
    })
    console.log('[Seed] Student profile created.')

    console.log('[Seed] Creating courses...')
    const courses = await Course.insertMany([
      { code: 'CS101', title: 'Data Structures', credits: 4 },
      { code: 'CS201', title: 'Algorithms', credits: 3 },
      { code: 'MATH101', title: 'Calculus', credits: 3 }
    ])
    console.log('[Seed] Courses created (3).')

    console.log('[Seed] Creating enrollments...')
    await Enrollment.insertMany(courses.map((course) => ({
      studentId: student._id,
      courseId: course._id
    })))
    console.log('[Seed] Enrollments created (3).')

    console.log('[Seed] Creating assignments for grading context...')
    const assignments = await Assignment.insertMany(courses.map((course, idx) => ({
      courseId: course._id,
      title: `Core Assessment ${idx + 1}`,
      description: `Seed assignment for ${course.code}`,
      dueDate: daysAgo(-(idx + 1)),
      maxScore: 100,
      weight: 1,
      type: 'homework',
      status: 'published'
    })))
    console.log('[Seed] Assignments created (3).')

    console.log('[Seed] Creating grades (10)...')
    const gradeTypes = ['quiz', 'assignment', 'midterm', 'final']
    const gradesPayload = Array.from({ length: 10 }, (_, idx) => {
      const course = courses[idx % courses.length]
      const assignment = assignments[idx % assignments.length]
      return {
        studentId: student._id,
        courseId: course._id,
        assignmentId: assignment._id,
        score: randomInt(65, 95),
        maxScore: 100,
        weight: 1,
        gradeType: gradeTypes[idx % gradeTypes.length],
        feedback: 'Auto-seeded sample grade data'
      }
    })
    await Grade.insertMany(gradesPayload)
    console.log('[Seed] Grades created (10).')

    console.log('[Seed] Creating attendance records (30 days)...')
    const attendancePayload = Array.from({ length: 30 }, (_, idx) => {
      const roll = Math.random()
      let status = 'present'
      if (roll >= 0.8 && roll < 0.9) status = 'late'
      if (roll >= 0.9) status = 'absent'

      return {
        studentId: student._id,
        courseId: courses[idx % courses.length]._id,
        date: daysAgo(29 - idx),
        status,
        notes: 'Seeded attendance record'
      }
    })
    await Attendance.insertMany(attendancePayload)
    console.log('[Seed] Attendance created (30).')

    console.log('[Seed] Creating self-reports (7 days) with 24-feature notes JSON...')
    const selfReportsPayload = Array.from({ length: 7 }, (_, idx) => {
      const noteFeatures = {
        sleep_hours: randomFloat(5, 8),
        stress_score: randomFloat(4, 8),
        load_score: randomFloat(4, 8),
        anxiety_score: randomFloat(3, 7),
        academic_pressure_score: randomFloat(4, 8),
        screen_time_hours: randomFloat(3, 7),
        physical_activity_hours: randomFloat(0.5, 2),
        financial_stress: randomFloat(3, 7),
        placement_pressure: randomFloat(4, 8),
        mood_score: randomFloat(5, 8),
        social_interaction_hours: randomFloat(1, 4),
        activity_frequency: randomFloat(3, 8),
        session_duration: randomFloat(60, 180),
        quiz_scores: randomFloat(65, 90),
        gpa: randomFloat(2.8, 3.6, 2),
        attendance_rate: randomFloat(70, 90),
        assignment_completion_rate: randomFloat(75, 95),
        social_media_hours: randomFloat(1, 4),
        peer_stress: randomFloat(3, 7),
        sleep_quality: randomFloat(2, 4),
        extracurricular_load: randomFloat(1, 3),
        submission_lateness: randomFloat(0, 3),
        grade_trend: randomFloat(-3, 3),
        days_since_last_activity: randomFloat(0, 2)
      }

      return {
        studentId: student._id,
        timestamp: daysAgo(6 - idx),
        sleepHours: noteFeatures.sleep_hours,
        stressScore: noteFeatures.stress_score,
        loadScore: noteFeatures.load_score,
        notes: JSON.stringify(noteFeatures),
        isBaseline: idx === 0
      }
    })
    await SelfReport.insertMany(selfReportsPayload)
    console.log('[Seed] Self-reports created (7).')

    console.log('[Seed] Creating risk predictions (low -> moderate -> high)...')
    const predictions = await RiskPrediction.insertMany([
      {
        studentId: student._id,
        riskLevel: 'low',
        riskScore: 0.25,
        timestamp: daysAgo(3),
        modelVersion: 'seed-v1'
      },
      {
        studentId: student._id,
        riskLevel: 'moderate',
        riskScore: 0.48,
        timestamp: daysAgo(2),
        modelVersion: 'seed-v1'
      },
      {
        studentId: student._id,
        riskLevel: 'high',
        riskScore: 0.72,
        timestamp: daysAgo(1),
        modelVersion: 'seed-v1'
      }
    ])
    console.log('[Seed] Risk predictions created (3).')

    console.log('[Seed] Creating alerts (2)...')
    await Alert.insertMany([
      {
        studentId: student._id,
        predictionId: predictions[2]._id,
        severity: 'critical',
        message: 'high_risk: Burnout risk escalated to HIGH',
        deliveredVia: 'app'
      },
      {
        studentId: student._id,
        predictionId: predictions[2]._id,
        severity: 'warning',
        message: 'low_engagement: Low activity detected for 3 days',
        deliveredVia: 'app'
      }
    ])
    console.log('[Seed] Alerts created (2).')

    console.log('[Seed] Creating recovery actions (2)...')
    await RecoveryAction.insertMany([
      {
        type: 'exercise',
        title: 'Take a 15-minute walk',
        description: 'Step outside for fresh air'
      },
      {
        type: 'mindfulness',
        title: 'Deep breathing exercise',
        description: '5 minutes of box breathing'
      }
    ])
    console.log('[Seed] Recovery actions created (2).')

    console.log('[Seed] Creating intervention (1)...')
    await Intervention.create({
      studentId: student._id,
      mentorId: mentorUser._id,
      type: 'counseling',
      status: 'in-progress',
      title: 'Urgent burnout counseling check-in',
      description: 'Immediate support intervention triggered by rising risk trend.',
      notes: [{
        author: mentorUser._id,
        text: 'Student showing high burnout risk'
      }]
    })
    console.log('[Seed] Intervention created (1).')

    console.log('[Seed] Creating notifications for student...')
    await Notification.insertMany([
      {
        userId: studentUser._id,
        title: 'Burnout Risk Alert',
        message: 'Your burnout risk has risen to HIGH. Please review recovery actions.',
        type: 'alert',
        priority: 'high',
        channels: ['in-app']
      },
      {
        userId: studentUser._id,
        title: 'Mentor Intervention Started',
        message: 'Your mentor has started a counseling intervention.',
        type: 'intervention',
        priority: 'medium',
        channels: ['in-app']
      }
    ])
    console.log('[Seed] Notifications created (2).')

    console.log('\n[Seed] Done.')
    console.log('[Seed] Admin login: admin@edge.com / Admin123456')
    console.log('[Seed] Mentor login: mentor@edge.com / Mentor123456')
    console.log('[Seed] Student login: student@edge.com / Student123456')
    console.log(`[Seed] IDs -> student: ${student._id}, mentor: ${mentorUser._id}, admin: ${adminUser._id}`)
  } finally {
    console.log('[Seed] Disconnecting MongoDB...')
    await mongoose.disconnect()
    console.log('[Seed] Disconnected.')
  }
}

seed().catch((error) => {
  console.error('[Seed] Fatal error:', error)
  process.exit(1)
})
