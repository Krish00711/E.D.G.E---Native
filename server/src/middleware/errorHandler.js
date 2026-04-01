/**
 * Comprehensive Error Handling Middleware
 * Handles all types of errors: Validation, Database, Authentication, ML Service, etc.
 */

import mongoose from 'mongoose'

/**
 * Custom Application Error class
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, errorType = 'ApplicationError') {
    super(message)
    this.statusCode = statusCode
    this.errorType = errorType
    this.isOperational = true
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Async Route Wrapper
 * Wraps async route handlers to catch errors automatically
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/**
 * Mongoose Validation Error Handler
 */
const handleMongooseValidationError = (err) => {
  const errors = Object.values(err.errors).map(el => ({
    field: el.path,
    message: el.message,
    value: el.value,
    kind: el.kind
  }))

  return {
    statusCode: 400,
    errorType: 'ValidationError',
    message: 'Invalid input data',
    errors
  }
}

/**
 * Mongoose Cast Error Handler (Invalid ObjectId)
 */
const handleMongooseCastError = (err) => {
  return {
    statusCode: 400,
    errorType: 'CastError',
    message: `Invalid ${err.path}: ${err.value}`,
    field: err.path,
    value: err.value
  }
}

/**
 * Mongoose Duplicate Key Error Handler
 */
const handleMongooseDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0]
  const value = err.keyValue[field]

  return {
    statusCode: 409,
    errorType: 'DuplicateKeyError',
    message: `${field} '${value}' already exists`,
    field,
    value
  }
}

/**
 * Zod Validation Error Handler
 */
const handleZodError = (err) => {
  const errors = err.errors.map(e => ({
    field: e.path.join('.'),
    message: e.message,
    code: e.code
  }))

  return {
    statusCode: 400,
    errorType: 'ValidationError',
    message: 'Input validation failed',
    errors
  }
}

/**
 * JWT Error Handlers
 */
const handleJWTError = () => {
  return {
    statusCode: 401,
    errorType: 'AuthenticationError',
    message: 'Invalid token. Please log in again.'
  }
}

const handleJWTExpiredError = () => {
  return {
    statusCode: 401,
    errorType: 'AuthenticationError',
    message: 'Your token has expired. Please log in again.'
  }
}

/**
 * ML Service Error Handler
 */
const handleMLServiceError = (err) => {
  return {
    statusCode: 503,
    errorType: 'MLServiceError',
    message: 'Machine learning service temporarily unavailable',
    details: err.message
  }
}

/**
 * Database Connection Error Handler
 */
const handleDatabaseError = (err) => {
  return {
    statusCode: 503,
    errorType: 'DatabaseError',
    message: 'Database connection failed',
    details: process.env.NODE_ENV === 'development' ? err.message : 'Please try again later'
  }
}

/**
 * Development Error Response
 * Includes full error details and stack trace
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode || 500).json({
    status: 'error',
    error: {
      type: err.errorType || err.name || 'Error',
      message: err.message,
      statusCode: err.statusCode || 500,
      errors: err.errors || null,
      stack: err.stack,
      details: err
    },
    timestamp: new Date().toISOString()
  })
}

/**
 * Production Error Response
 * Sanitized error response without sensitive information
 */
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode || 500).json({
      status: 'error',
      error: {
        type: err.errorType || 'Error',
        message: err.message,
        statusCode: err.statusCode || 500,
        errors: err.errors || null
      },
      timestamp: new Date().toISOString()
    })
  }
  // Programming or unknown error: don't leak details
  else {
    console.error('[CRITICAL ERROR]', err)

    res.status(500).json({
      status: 'error',
      error: {
        type: 'InternalServerError',
        message: 'Something went wrong. Please try again later.',
        statusCode: 500
      },
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * Global Error Handling Middleware
 * Catches all errors and sends appropriate response
 */
export const globalErrorHandler = (err, req, res, next) => {
  let error = { ...err }
  error.message = err.message
  error.name = err.name
  error.statusCode = err.statusCode || 500
  error.errorType = err.errorType || err.name

  // Log error for debugging
  console.error('[Error Handler]', {
    type: error.name,
    message: error.message,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  })

  // Mongoose validation error
  if (err.name === 'ValidationError' && err instanceof mongoose.Error.ValidationError) {
    const handled = handleMongooseValidationError(err)
    error = { ...error, ...handled, isOperational: true }
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    const handled = handleMongooseCastError(err)
    error = { ...error, ...handled, isOperational: true }
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const handled = handleMongooseDuplicateKeyError(err)
    error = { ...error, ...handled, isOperational: true }
  }

  // Zod validation error
  if (err.name === 'ZodError') {
    const handled = handleZodError(err)
    error = { ...error, ...handled, isOperational: true }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const handled = handleJWTError()
    error = { ...error, ...handled, isOperational: true }
  }

  if (err.name === 'TokenExpiredError') {
    const handled = handleJWTExpiredError()
    error = { ...error, ...handled, isOperational: true }
  }

  // ML Service errors (axios/fetch errors from ML service)
  if (err.code === 'ECONNREFUSED' || err.message?.includes('ML') || err.message?.includes('prediction')) {
    const handled = handleMLServiceError(err)
    error = { ...error, ...handled, isOperational: true }
  }

  // Database connection errors
  if (err.name === 'MongoServerError' || err.name === 'MongoError') {
    const handled = handleDatabaseError(err)
    error = { ...error, ...handled, isOperational: true }
  }

  // Send response based on environment
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, res)
  } else {
    sendErrorProd(error, res)
  }
}

/**
 * 404 Not Found Handler
 * Catches all unmatched routes
 */
export const notFoundHandler = (req, res, next) => {
  const error = new AppError(
    `Route not found: ${req.method} ${req.originalUrl}`,
    404,
    'NotFoundError'
  )
  next(error)
}

/**
 * Validation Helper Functions
 */
export const validateObjectId = (id, fieldName = 'ID') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName} format`, 400, 'ValidationError')
  }
  return true
}

export const validateRequired = (value, fieldName) => {
  if (!value) {
    throw new AppError(`${fieldName} is required`, 400, 'ValidationError')
  }
  return true
}

export const validatePositiveNumber = (value, fieldName) => {
  if (typeof value !== 'number' || value < 0) {
    throw new AppError(`${fieldName} must be a positive number`, 400, 'ValidationError')
  }
  return true
}

export const validateDateRange = (startDate, endDate) => {
  if (new Date(startDate) > new Date(endDate)) {
    throw new AppError('Start date must be before end date', 400, 'ValidationError')
  }
  return true
}

/**
 * Rate Limiting Error Handler
 */
export const handleRateLimitError = (req, res) => {
  res.status(429).json({
    status: 'error',
    error: {
      type: 'RateLimitError',
      message: 'Too many requests. Please try again later.',
      statusCode: 429,
      retryAfter: req.rateLimit?.resetTime || '1 minute'
    },
    timestamp: new Date().toISOString()
  })
}

/**
 * Database Health Check
 */
export const checkDatabaseHealth = async () => {
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

export default {
  AppError,
  asyncHandler,
  globalErrorHandler,
  notFoundHandler,
  validateObjectId,
  validateRequired,
  validatePositiveNumber,
  validateDateRange,
  handleRateLimitError,
  checkDatabaseHealth
}
