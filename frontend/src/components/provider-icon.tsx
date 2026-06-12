import type React from 'react'
import { cn } from '@/lib/utils'

interface ProviderIconProps {
  provider: string
  logoSvg?: string
  logoPng?: string
  className?: string
  style?: React.CSSProperties
}

export function ProviderIcon({
  provider,
  logoSvg,
  logoPng,
  className,
  style,
}: ProviderIconProps) {
  if (logoSvg) {
    return (
      // logoSvg is admin-configured SVG from the DB — never user-provided content,
      // so dangerouslySetInnerHTML is safe here
      <div
        style={style}
        className={cn(
          'h-full w-full object-contain [&>svg]:h-full [&>svg]:w-full [&>svg]:object-contain',
          className,
        )}
        dangerouslySetInnerHTML={{ __html: logoSvg }}
      />
    )
  }

  if (logoPng) {
    const src = logoPng.startsWith('data:')
      ? logoPng
      : `data:image/png;base64,${logoPng}`
    return (
      <img
        src={src}
        alt={provider}
        style={style}
        className={cn('h-full w-full object-contain', className)}
      />
    )
  }

  return null
}
