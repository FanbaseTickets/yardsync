'use client'

import { useState } from 'react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { Camera, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * Business logo uploader.
 *
 * Self-contained: handles file picker, validation, Firebase Storage upload,
 * download URL retrieval, and emits the final URL via onChange.
 *
 * Storage path: `users/{uid}/logo.{png|jpg|webp}` — the file extension is
 * derived from the upload's content-type so subsequent uploads of the same
 * type overwrite cleanly. Different-type uploads leave orphans at the old
 * path (acceptable — minor storage cost, no functional impact).
 *
 * Requires Storage Rules that allow:
 *   - write: request.auth.uid == uid (owner only)
 *   - read:  public (so the payment page, which has no auth context, can
 *            render the contractor's logo to clients tapping payment links)
 *
 * Props:
 *   value:     current logoUrl string (or empty)
 *   onChange:  (newUrl: string) => void  — called with download URL or '' on remove
 *   label:     optional label above the upload
 *   hint:      optional helper text below
 */

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB
const ACCEPT_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export default function LogoUpload({
  value,
  onChange,
  label,
  hint,
  storageName = 'logo',   // Storage filename stem: users/{uid}/{storageName}.{ext}
  noun = 'logo',          // word used in buttons/toasts ("Upload {noun}")
  rounded = 'rounded-xl',  // image shape — pass 'rounded-full' for a headshot
  disabled = false,        // lock the controls (edit/lock mode)
}) {
  const { user } = useAuth()
  const [uploading, setUploading] = useState(false)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ACCEPT_TYPES.includes(file.type)) {
      toast.error('Logo must be a PNG, JPG, or WebP image')
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error('Logo must be under 2MB')
      return
    }
    if (!user?.uid) {
      toast.error('Sign in required')
      return
    }

    setUploading(true)
    try {
      const ext = file.type === 'image/png'  ? 'png'
                : file.type === 'image/jpeg' ? 'jpg'
                :                              'webp'
      const path = `users/${user.uid}/${storageName}.${ext}`
      const storageRef = ref(storage, path)
      const snapshot = await uploadBytes(storageRef, file, { contentType: file.type })
      const url = await getDownloadURL(snapshot.ref)
      onChange(url)
      toast.success(`${noun.charAt(0).toUpperCase()}${noun.slice(1)} uploaded ✓`)
    } catch (err) {
      console.error('Logo upload failed:', err)
      const msg = err.code === 'storage/unauthorized'
        ? 'Upload denied — Storage rules may need to be published'
        : 'Upload failed — try again'
      toast.error(msg)
    } finally {
      setUploading(false)
      // Reset the input so re-selecting the same file fires onChange again
      e.target.value = ''
    }
  }

  function handleRemove() {
    onChange('')
  }

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-[13px] font-medium text-gray-700">{label}</label>
      )}

      <div className="flex items-center gap-4">
        {value ? (
          <div className="relative flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt={noun}
              className={`w-20 h-20 ${rounded} object-cover border border-gray-200 bg-gray-50`}
            />
            {!disabled && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={uploading}
                aria-label={`Remove ${noun}`}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
              >
                <X size={12} className="text-gray-500" />
              </button>
            )}
          </div>
        ) : (
          <div className={`w-20 h-20 ${rounded} border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 flex-shrink-0`}>
            <Camera size={20} className="text-gray-300" />
          </div>
        )}

        {!disabled && (
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFile}
              disabled={uploading}
              className="hidden"
            />
            <span className="inline-flex items-center gap-2 px-3 py-2 text-[13px] font-medium bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              {uploading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Uploading…
                </>
              ) : (
                <>{value ? `Change ${noun}` : `Upload ${noun}`}</>
              )}
            </span>
          </label>
        )}
      </div>

      {hint && (
        <p className="text-[12px] text-gray-400">{hint}</p>
      )}
    </div>
  )
}
