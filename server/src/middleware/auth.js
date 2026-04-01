import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: 'Missing token' })
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    // id = user's _id (from sub), studentId = student's _id (if role is student)
    req.user = { 
      ...payload, 
      id: payload.sub,
      studentId: payload.studentId || payload.sub
    }
    return next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}
