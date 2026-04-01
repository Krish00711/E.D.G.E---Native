/**
 * Comprehensive System Health Check
 * Verifies all system connections and services
 */

import { Router } from 'express'
import mongoose from 'mongoose'

const router = Router()

/**
 * Check Database Health
 */
async function checkDatabaseHealth() {
  try {
    const state = mongoose.connection.readyState
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    }

    return {
      status: states[state],
      isHealthy: state === 1,
      message: state === 1 ? 'Database connection healthy' : `Database ${states[state]}`
    }
  } catch (error) {
    return {
      status: 'error',
      isHealthy: false,
      message: error.message
    }
  }
}

/**
 * Check ML Service Health
 */
async function checkMLServiceHealth() {
  try {
    const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:5001'
    
    // Use dynamic import for fetch if needed
    const response = await fetch(`${mlServiceUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    }).catch(() => null)

    if (!response || !response.ok) {
      return {
        status: 'unhealthy',
        isHealthy: false,
        message: response ? `ML service returned status ${response.status}` : 'ML service unreachable'
      }
    }

    const data = await response.json()

    return {
      status: 'healthy',
      isHealthy: true,
      message: 'ML service operational',
      details: {
        modelStatus: data.model_status || 'unknown',
        modelVersion: data.model_version || 'unknown',
        totalPredictions: data.total_predictions || 0
      }
    }
  } catch (error) {
    return {
      status: 'unreachable',
      isHealthy: false,
      message: 'ML service unreachable',
      error: error.message
    }
  }
}

/**
 * Check Models Health
 */
async function checkModelsHealth() {
  try {
    const modelNames = [
      'Student',
      'RiskPrediction',
      'CognitiveLoadRecord',
      'Notification',
      'Assignment',
      'Grade',
      'Course'
    ]

    const modelStatuses = await Promise.all(
      modelNames.map(async (name) => {
        try {
          const model = mongoose.model(name)
          await model.countDocuments({}).limit(1)
          return { model: name, accessible: true }
        } catch (error) {
          return { model: name, accessible: false, error: error.message }
        }
      })
    )

    const operational = modelStatuses.filter(m => m.accessible).length
    const total = modelStatuses.length

    return {
      status: operational === total ? 'healthy' : 'partial',
      isHealthy: operational === total,
      message: `${operational}/${total} models operational`,
      models: modelStatuses
    }
  } catch (error) {
    return {
      status: 'error',
      isHealthy: false,
      message: 'Model health check failed',
      error: error.message
    }
  }
}

/**
 * GET /api/health - Comprehensive health check
 */
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now()

    const [database, mlService, models] = await Promise.all([
      checkDatabaseHealth(),
      checkMLServiceHealth(),
      checkModelsHealth()
    ])

    const responseTime = Date.now() - startTime

    const allHealthy = [database.isHealthy, models.isHealthy].every(h => h === true)
    const criticalHealthy = database.isHealthy && models.isHealthy

    const overallStatus = allHealthy && mlService.isHealthy
      ? 'healthy'
      : criticalHealthy
      ? 'degraded'
      : 'unhealthy'

    const statusCode = allHealthy && mlService.isHealthy ? 200 : criticalHealthy ? 207 : 503

    res.status(statusCode).json({
      status: overallStatus,
      service: 'edge-backend',  
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      services: {
        database,
        mlService,
        models
      },
      system: {
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          unit: 'MB'
        },
        node: process.version
      },
      summary: {
        allServicesHealthy: allHealthy && mlService.isHealthy,
        criticalServicesHealthy: criticalHealthy,
        degraded: mlService.isHealthy ? [] : ['mlService']
      }
    })
  } catch (error) {
    console.error('[Health Check Error]', error)
    res.status(500).json({
      status: 'error',
      service: 'edge-backend',
      timestamp: new Date().toISOString(),
      error: {
        message: 'Health check failed',
        details: error.message
      }
    })
  }
})

/**
 * GET /api/health/ping - Simple ping for monitoring
 */
router.get('/ping', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

export default router

