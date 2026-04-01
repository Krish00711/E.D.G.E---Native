import User from '../models/User.js'

export function updateLastActive(req, res, next) {
  if (req.user?.id) {
    User.findByIdAndUpdate(req.user.id, { lastActive: new Date() }).catch(() => {})
  }
  next()
}
