'use client'

import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react'

interface Props {
  imageSrc: string
  onConfirm: (croppedBlob: Blob) => void
  onCancel: () => void
}

async function getCroppedBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await createImageBitmap(await fetch(imageSrc).then(r => r.blob()))
  const canvas = document.createElement('canvas')
  const size = 300 // output size in px
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y,
    pixelCrop.width, pixelCrop.height,
    0, 0,
    size, size
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas empty')), 'image/jpeg', 0.92)
  })
}

export default function AvatarCropModal({ imageSrc, onConfirm, onCancel }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels)
  }, [])

  const handleConfirm = async () => {
    if (!croppedArea) return
    setIsProcessing(true)
    try {
      const blob = await getCroppedBlob(imageSrc, croppedArea)
      onConfirm(blob)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="crop-backdrop">
      <div className="crop-modal">
        <div className="crop-header">
          <span>Adjust your photo</span>
          <button className="crop-close" onClick={onCancel}><X size={18} /></button>
        </div>

        <div className="crop-area">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="crop-controls">
          <div className="zoom-row">
            <ZoomOut size={15} />
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="zoom-slider"
            />
            <ZoomIn size={15} />
          </div>
          <p className="crop-hint">Drag to reposition · Scroll or slide to zoom</p>
        </div>

        <div className="crop-actions">
          <button className="crop-btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="crop-btn-confirm" onClick={handleConfirm} disabled={isProcessing}>
            <Check size={15} />
            {isProcessing ? 'Processing...' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  )
}
