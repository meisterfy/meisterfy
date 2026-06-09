import { useEffect } from 'react'

interface SeoProps {
  title?: string
  description?: string
}

const APP_NAME = import.meta.env.VITE_APP_NAME ?? 'Meisterfy'

export function Seo({ title, description = '' }: SeoProps) {
  useEffect(() => {
    const fullTitle = title ? `${title} - ${APP_NAME}` : APP_NAME
    document.title = fullTitle

    if (description) {
      let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
      if (!meta) {
        meta = document.createElement('meta')
        meta.setAttribute('name', 'description')
        document.head.appendChild(meta)
      }
      meta.setAttribute('content', description)
    }
  }, [title, description])

  return null
}
