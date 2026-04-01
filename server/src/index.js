import 'dotenv/config'
import http from 'http'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { Server } from 'socket.io'
import { connectDb } from './config/db.js'
import { requireAuth } from './middleware/auth.js'
import { sanitizeInput } from './middleware/sanitizeInput.js'
import { setIo } from './services/socketService.js'
import healthRoutes from './routes/health.js'
import authRoutes from './routes/auth.js'
import studentsRoutes from './routes/students.js'
import coursesRoutes from './routes/courses.js'
import sessionsRoutes from './routes/sessions.js'
import activityRoutes from './routes/activity.js'
import selfReportsRoutes from './routes/selfReports.js'
import predictionsRoutes from './routes/predictions.js'
import recommendationsRoutes from './routes/recommendations.js'
import alertsRoutes from './routes/alerts.js'
import cohortsRoutes from './routes/cohorts.js'
import featuresRoutes from './routes/features.js'
import analyticsRoutes from './routes/analytics.js'
import adminRoutes from './routes/admin.js'
import interventionsRoutes from './routes/interventions.js'
import reportsRoutes from './routes/reports.js'
import insightsRoutes from './routes/insights.js'
import gradesRoutes from './routes/grades.js'
import assignmentsRoutes from './routes/assignments.js'
import enrollmentsRoutes from './routes/enrollments.js'
import attendanceRoutes from './routes/attendance.js'
import instructorsRoutes from './routes/instructors.js'
import notificationsRoutes from './routes/notifications.js'
import communicationsRoutes from './routes/communications.js'
import resourcesRoutes from './routes/resources.js'
import bulkRoutes from './routes/bulk.js'
import academicRoutes from './routes/academic.js'
import forumsRoutes from './routes/forums.js'
import sensorsRoutes from './routes/sensors.js'
import cognitiveLoadRoutes from './routes/cognitiveLoad.js'
import recoveryRoutes from './routes/recovery.js'
import consentRoutes from './routes/consent.js'
import mlRoutes from './routes/ml.js'
import onboardingRoutes from './routes/onboarding.js'
import syncRoutes from './routes/sync.js'

const app = express()
const httpServer = http.createServer(app)
export let io = null

io = new Server(httpServer, {
  cors: {
    origin: '*'
  }
})

setIo(io)

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`)

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`)
  })
})

const port = process.env.PORT || 5000

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
})

app.use(cors())
app.use(helmet({
  crossOriginResourcePolicy: false
}))
app.use(express.json())
app.use(sanitizeInput)
app.use(apiLimiter)

app.use('/api/health', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/students', studentsRoutes)
app.use('/api/courses', coursesRoutes)
app.use('/api/sessions', sessionsRoutes)
app.use('/api/activity', activityRoutes)
app.use('/api/self-reports', selfReportsRoutes)
app.use('/api/predictions', predictionsRoutes)
app.use('/api/recommendations', recommendationsRoutes)
app.use('/api/alerts', alertsRoutes)
app.use('/api/cohorts', cohortsRoutes)
app.use('/api/features', featuresRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/interventions', interventionsRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/insights', insightsRoutes)
app.use('/api/grades', gradesRoutes)
app.use('/api/assignments', assignmentsRoutes)
app.use('/api/enrollments', enrollmentsRoutes)
app.use('/api/attendance', attendanceRoutes)
app.use('/api/instructors', instructorsRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/communications', communicationsRoutes)
app.use('/api/resources', resourcesRoutes)
app.use('/api/bulk', bulkRoutes)
app.use('/api/academic', academicRoutes)
app.use('/api/forums', forumsRoutes)
app.use('/api/sensors', sensorsRoutes)
app.use('/api/cognitive-load', cognitiveLoadRoutes)
app.use('/api/recovery', recoveryRoutes)
app.use('/api/consent', consentRoutes)
app.use('/api/ml', mlRoutes)
app.use('/api/onboarding', onboardingRoutes)
app.use('/api/sync', syncRoutes)

app.use((err, req, res, next) => {
  const status = err.status || 500
  const isProduction = process.env.NODE_ENV === 'production'

  if (status >= 500) {
    console.error(err)
  }

  return res.status(status).json({
    error: isProduction && status === 500
      ? 'Internal server error'
      : (err.message || 'Server error'),
    ...(isProduction ? {} : { stack: err.stack })
  })
})

async function start() {
  const mongoUri = process.env.MONGO_URI
  if (!mongoUri) {
    throw new Error('MONGO_URI is required')
  }
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required')
  }

  await connectDb(mongoUri)
  httpServer.listen(port, () => {
    console.log(`EDGE backend listening on ${port}`)
  })
}

start().catch((error) => {
  console.error(error)
  process.exit(1)
})
