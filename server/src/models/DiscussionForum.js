import mongoose from 'mongoose'

const discussionForumSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    posts: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      content: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
      likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      replies: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        content: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
      }],
      isPinned: { type: Boolean, default: false },
      isResolved: { type: Boolean, default: false }
    }],
    tags: [{ type: String, trim: true }],
    viewCount: { type: Number, default: 0 }
  },
  { timestamps: true }
)

// Indexes
discussionForumSchema.index({ courseId: 1, isActive: 1, createdAt: -1 })
discussionForumSchema.index({ courseId: 1, 'posts.userId': 1 })

export default mongoose.model('DiscussionForum', discussionForumSchema)
