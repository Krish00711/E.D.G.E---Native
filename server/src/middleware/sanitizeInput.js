function sanitizeValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item))
  }

  if (value && typeof value === 'object') {
    const sanitizedObject = {}
    for (const [key, nestedValue] of Object.entries(value)) {
      // Block Mongo-style operator and dot-path keys.
      if (key.startsWith('$') || key.includes('.')) {
        continue
      }
      sanitizedObject[key] = sanitizeValue(nestedValue)
    }
    return sanitizedObject
  }

  if (typeof value === 'string') {
    return value.replace(/\u0000/g, '').trim()
  }

  return value
}

export function sanitizeInput(req, res, next) {
  try {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeValue(req.body)
    }

    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeValue(req.query)
    }

    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeValue(req.params)
    }

    return next()
  } catch (error) {
    return res.status(400).json({ error: 'Invalid request payload' })
  }
}
