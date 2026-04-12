'use client'

import './profile.css'
import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Activity, Target, Save, Loader2, Check, Camera } from 'lucide-react'
import { profileApi, DietType, Gender } from '@/services/profile.service'
import { useAuthStore } from '@/store/auth.store'
import AvatarCropModal from '@/components/AvatarCropModal'

const DIET_OPTIONS: { value: DietType; label: string }[] = [
  { value: 'NONE',       label: 'No restriction' },
  { value: 'VEGETARIAN', label: 'Vegetarian' },
  { value: 'VEGAN',      label: 'Vegan' },
  { value: 'KETO',       label: 'Keto' },
  { value: 'PALEO',      label: 'Paleo' },
]

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'MALE',              label: 'Male' },
  { value: 'FEMALE',            label: 'Female' },
  { value: 'OTHER',             label: 'Other' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
]

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

export default function ProfilePage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showToast, setShowToast] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: profileApi.getProfile,
  })

  const [form, setForm] = useState({
    age:             '',
    gender:          '' as Gender | '',
    heightCm:        '',
    weightKg:        '',
    targetWeightKg:  '',
    dietType:        'NONE' as DietType,
    calorieGoal:     '',
    proteinGoal:     '',
    carbGoal:        '',
    fatGoal:         '',
    healthConditions: '',
    allergies:        '',
    foodPreferences:  '',
  })

  useEffect(() => {
    if (!profile) return
    setForm({
      age:              profile.age?.toString()            ?? '',
      gender:           profile.gender                     ?? '',
      heightCm:         profile.heightCm?.toString()       ?? '',
      weightKg:         profile.weightKg != null ? String(profile.weightKg) : '',
      targetWeightKg:   profile.targetWeightKg != null ? String(profile.targetWeightKg) : '',
      dietType:         profile.dietType                   ?? 'NONE',
      calorieGoal:      profile.calorieGoal?.toString()    ?? '',
      proteinGoal:      profile.proteinGoal?.toString()    ?? '',
      carbGoal:         profile.carbGoal?.toString()       ?? '',
      fatGoal:          profile.fatGoal?.toString()        ?? '',
      healthConditions: profile.healthConditions            ?? '',
      allergies:        profile.allergies                   ?? '',
      foodPreferences:  profile.foodPreferences             ?? '',
    })
  }, [profile])

  const { mutate: save, isPending: isSaving } = useMutation({
    mutationFn: () =>
      profileApi.updateProfile({
        age:             form.age ? parseInt(form.age) : null,
        gender:          form.gender || null,
        heightCm:        form.heightCm ? parseInt(form.heightCm) : null,
        weightKg:        form.weightKg ? parseFloat(form.weightKg) : null,
        targetWeightKg:  form.targetWeightKg ? parseFloat(form.targetWeightKg) : null,
        dietType:        form.dietType,
        calorieGoal:     form.calorieGoal ? parseInt(form.calorieGoal) : null,
        proteinGoal:     form.proteinGoal ? parseInt(form.proteinGoal) : null,
        carbGoal:        form.carbGoal ? parseInt(form.carbGoal) : null,
        fatGoal:         form.fatGoal ? parseInt(form.fatGoal) : null,
        healthConditions: form.healthConditions || null,
        allergies:        form.allergies || null,
        foodPreferences:  form.foodPreferences || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      setSaveError('')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
    },
    onError: (err: any) => {
      setSaveError(err?.response?.data?.message ?? 'Failed to save. Please try again.')
    },
  })

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Open crop modal instead of uploading directly
    setCropSrc(URL.createObjectURL(file))
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  const handleCropConfirm = async (blob: Blob) => {
    setCropSrc(null)
    setAvatarPreview(URL.createObjectURL(blob))
    setIsUploadingAvatar(true)
    try {
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
      await profileApi.uploadAvatar(file)
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const set = (key: string, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  // avatarUrl from Vercel Blob is already a full CDN URL — use as-is
  const avatarSrc = avatarPreview ?? profile?.avatarUrl ?? null

  if (isLoading) {
    return (
      <div className="profile-root profile-loading">
        <Loader2 size={28} className="spin-icon" />
      </div>
    )
  }

  return (
    <div className="profile-root">
      {/* ── Header ── */}
      <motion.div
        className="profile-header"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1>Your Profile</h1>
        <p>Personalise your experience — the AI uses this to tailor every recommendation.</p>
      </motion.div>

      {/* ── Avatar strip ── */}
      <motion.div
        className="profile-avatar-strip"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <div className="avatar-wrap" onClick={() => fileInputRef.current?.click()}>
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt="Avatar"
              className="avatar-img"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                e.currentTarget.nextElementSibling?.classList.remove('hidden')
              }}
            />
          ) : null}
          <div className={`avatar-circle ${avatarSrc ? 'hidden' : ''}`}>
            {user?.name?.charAt(0).toUpperCase() ?? 'U'}
          </div>
          <div className="avatar-overlay">
            {isUploadingAvatar
              ? <Loader2 size={18} className="spin-icon" />
              : <Camera size={18} />
            }
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="avatar-file-input"
            onChange={handleAvatarChange}
          />
        </div>
        <div className="avatar-info">
          <h2>{user?.name}</h2>
          <p>{user?.email}</p>
          <span className="avatar-hint">Click photo to change</span>
        </div>
      </motion.div>

      {/* ── Personal details ── */}
      <motion.div
        className="profile-section"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="section-title">
          <User size={13} />
          Personal details
        </div>
        <div className="form-grid cols-3">
          <div className="field">
            <label>Age</label>
            <input type="number" placeholder="e.g. 28" value={form.age}
              onChange={(e) => set('age', e.target.value)} />
          </div>
          <div className="field">
            <label>Gender</label>
            <select value={form.gender} onChange={(e) => set('gender', e.target.value)}>
              <option value="">Select gender</option>
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Height (cm)</label>
            <input type="number" placeholder="e.g. 175" value={form.heightCm}
              onChange={(e) => set('heightCm', e.target.value)} />
          </div>
          <div className="field">
            <label>Current weight (kg)</label>
            <input type="number" step="0.1" placeholder="e.g. 72.5" value={form.weightKg}
              onChange={(e) => set('weightKg', e.target.value)} />
          </div>
          <div className="field">
            <label>Target weight (kg)</label>
            <input type="number" step="0.1" placeholder="e.g. 68.0" value={form.targetWeightKg}
              onChange={(e) => set('targetWeightKg', e.target.value)} />
          </div>
        </div>
      </motion.div>

      {/* ── Diet & preferences ── */}
      <motion.div
        className="profile-section"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <div className="section-title">
          <Activity size={13} />
          Diet &amp; preferences
        </div>
        <div className="field" style={{ marginBottom: '1.25rem' }}>
          <label>Diet type</label>
          <div className="diet-pills">
            {DIET_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`diet-pill ${form.dietType === o.value ? 'active' : ''}`}
                onClick={() => set('dietType', o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="form-grid cols-1">
          <div className="field">
            <label>Allergies</label>
            <input type="text" placeholder="e.g. peanuts, shellfish, gluten"
              value={form.allergies} onChange={(e) => set('allergies', e.target.value)} />
            <span className="field-hint">Separate multiple allergies with commas</span>
          </div>
          <div className="field">
            <label>Food preferences</label>
            <input type="text" placeholder="e.g. spicy food, Mediterranean, no mushrooms"
              value={form.foodPreferences} onChange={(e) => set('foodPreferences', e.target.value)} />
          </div>
          <div className="field">
            <label>Health conditions</label>
            <input type="text" placeholder="e.g. diabetes, hypertension, IBS"
              value={form.healthConditions} onChange={(e) => set('healthConditions', e.target.value)} />
            <span className="field-hint">Used by AI to tailor health insights — kept private</span>
          </div>
        </div>
      </motion.div>

      {/* ── Nutrition goals ── */}
      <motion.div
        className="profile-section"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <div className="section-title">
          <Target size={13} />
          Daily nutrition goals
        </div>
        <div className="macro-row">
          <div className="macro-card calories">
            <label>Calories</label>
            <input type="number" placeholder="2000" value={form.calorieGoal}
              onChange={(e) => set('calorieGoal', e.target.value)} />
            <span>kcal / day</span>
          </div>
          <div className="macro-card protein">
            <label>Protein</label>
            <input type="number" placeholder="150" value={form.proteinGoal}
              onChange={(e) => set('proteinGoal', e.target.value)} />
            <span>g / day</span>
          </div>
          <div className="macro-card carbs">
            <label>Carbs</label>
            <input type="number" placeholder="200" value={form.carbGoal}
              onChange={(e) => set('carbGoal', e.target.value)} />
            <span>g / day</span>
          </div>
          <div className="macro-card fat">
            <label>Fat</label>
            <input type="number" placeholder="65" value={form.fatGoal}
              onChange={(e) => set('fatGoal', e.target.value)} />
            <span>g / day</span>
          </div>
        </div>
      </motion.div>

      {/* ── Bottom save button ── */}
      <motion.div
        className="profile-save-bar"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
      >
        {saveError && <p className="save-error">{saveError}</p>}
        <button
          className="save-btn"
          onClick={() => save()}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 size={16} className="spin-icon" /> : <Save size={16} />}
          {isSaving ? 'Saving...' : 'Save changes'}
        </button>
      </motion.div>

      {/* ── Crop modal ── */}
      {cropSrc && (
        <AvatarCropModal
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}

      {/* ── Success toast ── */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            className="toast"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
          >
            <Check size={15} />
            Profile saved successfully
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
