import { useState, useEffect, useRef } from 'react'
import { Loader2, ExternalLink } from 'lucide-react'
import { fetchDocumentBlobUrl } from '@/lib/api'
import { toast } from '@/hooks/useToast'

/**
 * Opens a private candidate document.
 *
 * Documents are not served statically — they come back from an authorised
 * endpoint, so the file is fetched with the access token and opened as a blob
 * URL rather than linked to directly.
 */
export function SecureDocLink({
  docId,
  label = 'View',
  className = '',
}: {
  docId: number
  label?: string
  className?: string
}) {
  const [loading, setLoading] = useState(false)
  const urlRef = useRef<string | null>(null)

  // Release the blob when this link unmounts so the file does not linger in memory.
  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [])

  const open = async () => {
    if (loading) return
    setLoading(true)
    try {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      const url = await fetchDocumentBlobUrl(docId)
      urlRef.current = url
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      toast({ title: 'Could not open document', description: (e as Error).message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={open}
      disabled={loading}
      className={`inline-flex items-center gap-1 text-xs font-semibold text-[#F7A607]
        hover:underline disabled:opacity-50 ${className}`}
    >
      {loading
        ? <Loader2 className='w-3 h-3 animate-spin' />
        : <ExternalLink className='w-3 h-3' />}
      {label}
    </button>
  )
}
