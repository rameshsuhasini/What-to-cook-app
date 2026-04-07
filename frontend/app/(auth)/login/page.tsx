'use client'
import '../../auth.css'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import axios from 'axios'
import { Eye, EyeOff, ChefHat, ArrowRight, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'

interface LoginForm {
  email: string
  password: string
}

export default function LoginPage() {
  const router = useRouter()
  const { setUser } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>()

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    setServerError('')
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`,
        data,
        { withCredentials: true }
      )
      setUser(res.data.data.user)
      router.push('/dashboard')
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
        transition={{ duration: 0.7, ease: 'easeOut' }}
      >
        <BrandPanel />
      </motion.div>

      {/* ── Right panel — form ── */}
      <motion.div
        className="auth-form-panel"
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
      >
        <div className="auth-form-container">
          {/* Mobile logo */}
          <div className="auth-mobile-logo">
            <ChefHat size={28} strokeWidth={1.5} />
            <span>What to Cook?</span>
          </div>

          <div className="auth-form-header">
            <h1>Welcome back</h1>
            <p>Sign in to your kitchen</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
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
              <div className="label-row">
                <label htmlFor="password">Password</label>
                <Link href="/forgot-password" className="forgot-link">
                  Forgot password?
                </Link>
              </div>
              <div className="input-wrapper">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={errors.password ? 'input-error' : ''}
                  {...register('password', {
                    required: 'Password is required',
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
                  Sign in <ArrowRight size={16} />
                </>
              )}
            </motion.button>
          </form>

          <p className="auth-switch">
            New here?{' '}
            <Link href="/signup">Create a free account</Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}

function BrandPanel() {
  const features = [
    { icon: '🍳', label: 'AI Recipe Generator' },
    { icon: '📅', label: 'Weekly Meal Planner' },
    { icon: '🛒', label: 'Smart Grocery Lists' },
    { icon: '📊', label: 'Nutrition Tracking' },
  ]

  return (
    <div className="brand-inner">
      <div className="brand-logo">
        <ChefHat size={36} strokeWidth={1.5} />
        <span>What to Cook?</span>
      </div>

      <div className="brand-hero">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          Your AI-powered kitchen companion
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.6 }}
        >
          Plan meals, discover recipes, and track your nutrition — all personalised to you.
        </motion.p>
      </div>

      <motion.ul
        className="brand-features"
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.1, delayChildren: 0.5 } },
        }}
      >
        {features.map((f) => (
          <motion.li
            key={f.label}
            variants={{
              hidden: { opacity: 0, x: -16 },
              visible: { opacity: 1, x: 0 },
            }}
          >
            <span className="feature-icon">{f.icon}</span>
            <span>{f.label}</span>
          </motion.li>
        ))}
      </motion.ul>

      {/* Decorative blobs */}
      <div className="blob blob-1" />
      <div className="blob blob-2" />
    </div>
  )
}
