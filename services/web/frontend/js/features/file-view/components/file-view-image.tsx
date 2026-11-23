import { useEffect, useState } from 'react'
import { useProjectContext } from '../../../shared/context/project-context'
import { BinaryFile } from '@/features/file-view/types/binary-file'

const isSvg = (name: string) => name.toLowerCase().endsWith('.svg')

export default function FileViewImage({
  file,
  onLoad,
  onError,
}: {
  file: BinaryFile
  onLoad: () => void
  onError: () => void
}) {
  const { projectId } = useProjectContext()
  const url = `/project/${projectId}/blob/${file.hash}`

  // Blobs are served as application/octet-stream, which browsers sniff for
  // PNG/JPEG/GIF but not for SVG. An SVG is fetched and shown through a Blob
  // URL with the right type. Inside <img> it can not run scripts.
  const [svgUrl, setSvgUrl] = useState<string | null>(null)
  const svg = isSvg(file.name)

  useEffect(() => {
    if (!svg) return
    let objectUrl: string | null = null
    let cancelled = false
    setSvgUrl(null)
    fetch(url)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.arrayBuffer()
      })
      .then(data => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(
          new Blob([data], { type: 'image/svg+xml' })
        )
        setSvgUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) onError()
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [svg, url, onError])

  if (svg && !svgUrl) return null

  return (
    <img
      src={svg ? (svgUrl as string) : url}
      onLoad={onLoad}
      onError={onError}
      alt={file.name}
    />
  )
}
