'use client'
import '../../auth.css'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import axios from 'axios'
import { Eye, EyeOff, ArrowRight, Loader2, Check, X } from 'lucide-react'
import Image from 'next/image'
import { useAuthStore } from '@/store/auth.store'

interface SignupForm {
  name: string
  email: string
  password: string
}

const passwordRules = [
  { label: '8+ characters', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase',     test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase',     test: (p: string) => /[a-z]/.test(p) },
  { label: 'Number',        test: (p: string) => /\d/.test(p) },
]

export default function SignupPage() {
  const router = useRouter()
  const { setUser } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupForm>()

  const password = watch('password', '')

  const onSubmit = async (data: SignupForm) => {
    setIsLoading(true)
    setServerError('')
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/signup`,
        data,
        { withCredentials: true }
      )
      setUser(res.data.data.user, res.data.data.token)
      // New users always go to onboarding first
      router.push('/onboarding')
    } catch (err: any) {
      setServerError(
        err.response?.data?.message || 'Something went wrong. Please try again.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-root">
      {/* ── Left panel — brand ── */}
      <motion.div
        className="auth-brand"
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' as const }}
      >
        <BrandPanel />
      </motion.div>

      {/* ── Right panel — form ── */}
      <motion.div
        className="auth-form-panel"
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' as const, delay: 0.1 }}
      >
        <div className="auth-form-container">
          {/* Mobile logo */}
          <div className="auth-mobile-logo">
            <Image src="/images/appIcon.png" alt="What to Cook?" width={36} height={36} />
            <span>What to Cook?</span>
          </div>

          <div className="auth-form-header">
            <h1>Create your account</h1>
            <p>Your personal kitchen companion awaits</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* Name */}
            <div className="field-group">
              <label htmlFor="name">Full name</label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                placeholder="Jane Smith"
                className={errors.name ? 'input-error' : ''}
                {...register('name', {
                  required: 'Name is required',
                  minLength: { value: 2, message: 'Name must be at least 2 characters' },
                })}
              />
              {errors.name && (
                <span className="field-error">{errors.name.message}</span>
              )}
            </div>

            {/* Email */}
            <div className="field-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={errors.email ? 'input-error' : ''}
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Invalid email address',
                  },
                })}
              />
              {errors.email && (
                <span className="field-error">{errors.email.message}</span>
              )}
            </div>

            {/* Password */}
            <div className="field-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Create a strong password"
                  className={errors.password ? 'input-error' : ''}
                  {...register('password', {
                    required: 'Password is required',
                    minLength: { value: 8, message: 'Password must be at least 8 characters' },
                  })}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <span className="field-error">{errors.password.message}</span>
              )}

              {/* Password strength rules */}
              {password.length > 0 && (
                <ul className="password-rules">
                  {passwordRules.map((rule) => {
                    const pass = rule.test(password)
                    return (
                      <li key={rule.label} className={pass ? 'rule-pass' : 'rule-fail'}>
                        {pass ? <Check size={11} /> : <X size={11} />}
                        {rule.label}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Server error */}
            {serverError && (
              <motion.div
                className="server-error"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {serverError}
              </motion.div>
            )}

            {/* Submit */}
            <motion.button
              type="submit"
              className="btn-primary"
              disabled={isLoading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              {isLoading ? (
                <Loader2 size={18} className="spinner" />
              ) : (
                <>
                  Create account <ArrowRight size={16} />
                </>
              )}
            </motion.button>
          </form>

          <p className="auth-switch">
            Already have an account?{' '}
            <Link href="/login">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}

function BrandPanel() {
  const steps = [
    { num: '01', title: 'Create your profile', desc: 'Set your diet type, goals, and allergies' },
    { num: '02', title: 'Discover recipes',     desc: 'AI generates meals tailored to you' },
    { num: '03', title: 'Plan & track',         desc: 'Weekly planner + nutrition insights' },
  ]

  return (
    <div className="brand-inner">
      <div className="brand-logo">
        <Image src="/images/appIcon.png" alt="What to Cook?" width={52} height={52} />
        <span>What to Cook?</span>
      </div>

      <div className="brand-hero">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          Start eating smarter today
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.6 }}
        >
          Join thousands planning better meals with personalised AI recommendations.
        </motion.p>
      </div>

      <motion.div
        className="brand-steps"
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.12, delayChildren: 0.5 } },
        }}
      >
        {steps.map((s) => (
          <motion.div
            key={s.num}
            className="brand-step"
            variants={{
              hidden: { opacity: 0, x: -16 },
              visible: { opacity: 1, x: 0 },
            }}
          >
            <span className="step-num">{s.num}</span>
            <div>
              <strong>{s.title}</strong>
              <p>{s.desc}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Decorative blobs */}
      <div className="blob blob-1" />
      <div className="blob blob-2" />
    </div>
  )
}