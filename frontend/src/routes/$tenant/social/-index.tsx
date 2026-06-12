import { useEffect, useState } from 'react'
import { getPosts } from '@/lib/api/posts'
import { normalizePost } from '@/lib/utils/transforms'
import type { PostShape } from '@/lib/social'
import { CalendarWidget } from '@/components/social/calendar-widget'
import { NewPostDrawer } from '@/components/social/new-post-drawer'
import { EditPostDrawer } from '@/components/social/edit-post-drawer'
import { Route } from './index'

export function SocialPlannerRoute() {
  const { tenant } = Route.useParams()

  const [scheduled, setScheduled] = useState<PostShape[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    getPosts(tenant, 'scheduled')
      .then((data) => {
        if (!active) return
        setScheduled(data.map(normalizePost))
        setIsLoading(false)
      })
      .catch(() => {
        if (!active) return
        setScheduled([])
        setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [tenant])

  // ── Drawer state ──────────────────────────────────────────────────────────
  const [showNewPostDrawer, setShowNewPostDrawer] = useState(false)
  const [newPostDate, setNewPostDate] = useState('')
  const [showEditDrawer, setShowEditDrawer] = useState(false)
  const [selectedPost, setSelectedPost] = useState<PostShape | null>(null)

  function openNewPostDrawer(date: string) {
    setNewPostDate(date)
    setShowNewPostDrawer(true)
  }

  function openPostDrawer(post: PostShape) {
    setSelectedPost(post)
    setShowEditDrawer(true)
  }

  useEffect(() => {
    if (!showEditDrawer) setSelectedPost(null)
  }, [showEditDrawer])

  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <CalendarWidget
          posts={scheduled}
          isLoading={isLoading}
          onCreatePost={openNewPostDrawer}
          onEditPost={openPostDrawer}
        />
      </div>

      <NewPostDrawer
        open={showNewPostDrawer}
        onOpenChange={setShowNewPostDrawer}
        tenant={tenant}
        defaultDate={newPostDate}
        onCreated={(p) => setScheduled((prev) => [...prev, p])}
      />

      <EditPostDrawer
        open={showEditDrawer}
        onOpenChange={setShowEditDrawer}
        post={selectedPost}
        tenant={tenant}
        onSaved={(updated) =>
          setScheduled((prev) =>
            prev.map((p) => (p.id === updated.id ? updated : p)),
          )
        }
        onDeleted={(id) =>
          setScheduled((prev) => prev.filter((p) => p.id !== id))
        }
      />
    </>
  )
}
