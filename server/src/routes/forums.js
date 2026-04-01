import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/roles.js'
import DiscussionForum from '../models/DiscussionForum.js'

const router = Router()

const createForumSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional()
})

const addPostSchema = z.object({
  content: z.string().min(1)
})

// POST /api/forums - Create discussion forum (instructor/admin)
router.post('/', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const parsed = createForumSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error })
  }

  const forum = await DiscussionForum.create({
    ...parsed.data,
    createdBy: req.user.id
  })

  return res.status(201).json(forum)
})

// GET /api/forums - List forums
router.get('/', requireAuth, async (req, res) => {
  const { courseId, page = 1, limit = 20 } = req.query
  const skip = (parseInt(page) - 1) * parseInt(limit)

  const filter = { isActive: true }
  if (courseId) filter.courseId = courseId

  const [forums, total] = await Promise.all([
    DiscussionForum.find(filter)
      .populate('courseId', 'code title')
      .populate('createdBy', 'email name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    DiscussionForum.countDocuments(filter)
  ])

  return res.json({
    forums,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    }
  })
})

// GET /api/forums/:id - Get specific forum with posts
router.get('/:id', requireAuth, async (req, res) => {
  const forum = await DiscussionForum.findByIdAndUpdate(
    req.params.id,
    { $inc: { viewCount: 1 } },
    { new: true }
  )
    .populate('courseId', 'code title')
    .populate('createdBy', 'email name')
    .populate('posts.userId', 'email name')
    .populate('posts.replies.userId', 'email name')

  if (!forum) {
    return res.status(404).json({ error: 'Forum not found' })
  }

  return res.json(forum)
})

// POST /api/forums/:id/posts - Add post to forum
router.post('/:id/posts', requireAuth, async (req, res) => {
  const parsed = addPostSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error })
  }

  const forum = await DiscussionForum.findById(req.params.id)
  if (!forum) {
    return res.status(404).json({ error: 'Forum not found' })
  }

  forum.posts.push({
    userId: req.user.id,
    content: parsed.data.content,
    createdAt: new Date(),
    likes: [],
    replies: []
  })

  await forum.save()
  await forum.populate('posts.userId', 'email name')

  return res.status(201).json({ post: forum.posts[forum.posts.length - 1] })
})

// POST /api/forums/:id/posts/:postId/replies - Reply to post
router.post('/:id/posts/:postId/replies', requireAuth, async (req, res) => {
  const parsed = addPostSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error })
  }

  const forum = await DiscussionForum.findById(req.params.id)
  if (!forum) {
    return res.status(404).json({ error: 'Forum not found' })
  }

  const post = forum.posts.id(req.params.postId)
  if (!post) {
    return res.status(404).json({ error: 'Post not found' })
  }

  post.replies.push({
    userId: req.user.id,
    content: parsed.data.content,
    createdAt: new Date(),
    likes: []
  })

  await forum.save()
  await forum.populate('posts.replies.userId', 'email name')

  const updatedPost = forum.posts.id(req.params.postId)
  return res.status(201).json({ reply: updatedPost.replies[updatedPost.replies.length - 1] })
})

// POST /api/forums/:id/posts/:postId/like - Like a post
router.post('/:id/posts/:postId/like', requireAuth, async (req, res) => {
  const forum = await DiscussionForum.findById(req.params.id)
  if (!forum) {
    return res.status(404).json({ error: 'Forum not found' })
  }

  const post = forum.posts.id(req.params.postId)
  if (!post) {
    return res.status(404).json({ error: 'Post not found' })
  }

  // Toggle like
  const likeIndex = post.likes.indexOf(req.user.id)
  if (likeIndex > -1) {
    post.likes.splice(likeIndex, 1)
  } else {
    post.likes.push(req.user.id)
  }

  await forum.save()
  return res.json({ likes: post.likes.length, isLiked: likeIndex === -1 })
})

// PATCH /api/forums/:id/posts/:postId - Mark post as resolved (instructor/admin)
router.patch('/:id/posts/:postId', requireAuth, requireRole('admin', 'mentor'), async (req, res) => {
  const { isResolved, isPinned } = req.body

  const forum = await DiscussionForum.findById(req.params.id)
  if (!forum) {
    return res.status(404).json({ error: 'Forum not found' })
  }

  const post = forum.posts.id(req.params.postId)
  if (!post) {
    return res.status(404).json({ error: 'Post not found' })
  }

  if (isResolved !== undefined) post.isResolved = isResolved
  if (isPinned !== undefined) post.isPinned = isPinned

  await forum.save()
  return res.json({ post })
})

// DELETE /api/forums/:id/posts/:postId - Delete post
router.delete('/:id/posts/:postId', requireAuth, async (req, res) => {
  const forum = await DiscussionForum.findById(req.params.id)
  if (!forum) {
    return res.status(404).json({ error: 'Forum not found' })
  }

  const post = forum.posts.id(req.params.postId)
  if (!post) {
    return res.status(404).json({ error: 'Post not found' })
  }

  // Only post author, instructor, or admin can delete
  if (post.userId.toString() !== req.user.id && 
      req.user.role !== 'admin' && 
      req.user.role !== 'mentor') {
    return res.status(403).json({ error: 'Access denied' })
  }

  post.remove()
  await forum.save()

  return res.json({ message: 'Post deleted successfully' })
})

export default router
