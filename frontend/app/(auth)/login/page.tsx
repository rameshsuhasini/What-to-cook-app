"use client";
import "../../auth.css";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import axios from "axios";
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import Image from "next/image";

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setServerError("");
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`,
        data,
        { withCredentials: true },
      );
      setUser(res.data.data.user);
      // Check if profile is complete — redirect to onboarding if not
      try {
        const profileRes = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/api/profile`,
          { withCredentials: true },
        )
        const profile = profileRes.data.data.profile
        const isIncomplete = profile.dietType === 'NONE' && profile.calorieGoal === null
        router.push(isIncomplete ? '/onboarding' : '/dashboard')
      } catch {
        // Profile fetch failed — go to dashboard, guard will handle it
        router.push('/dashboard')
      }
    } catch (err: any) {
      setServerError(
        err.response?.data?.message ||
          "Something went wrong. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-root">
      {/* ── Left panel — brand ── */}
      <motion.div
        className="auth-brand"
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <BrandPanel />
      </motion.div>

      {/* ── Right panel — form ── */}
      <motion.div
        className="auth-form-panel"
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
      >
        <div className="auth-form-container">
          {/* Mobile logo */}
          <div className="auth-mobile-logo">
            <Image
              src="/images/appIcon.png"
              alt="logo"
              width={40}
              height={40}
            />
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
                className={errors.email ? "input-error" : ""}
                {...register("email", {
                  required: "Email is required",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "Invalid email address",
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
              </div>
              <div className="input-wrapper">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={errors.password ? "input-error" : ""}
                  {...register("password", {
                    required: "Password is required",
                  })}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
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
            New here? <Link href="/signup">Create a free account</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function BrandPanel() {
  return (
    <div className="brand-inner">
      {/* Logo */}
      <div className="brand-logo">
        <Image src="/images/appIcon.png" alt="What to Cook?" width={44} height={44} style={{ objectFit: 'contain', borderRadius: 8 }} />
        <span>What to Cook?</span>
      </div>

      {/* Headline */}
      <motion.div
        className="brand-headline"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.65 }}
      >
        <h2>
          Eat well.
          <br />
          <em>Every single day.</em>
        </h2>
        <p>Personalised recipes, smart meal plans, grocery lists and nutrition tracking — all powered by AI.</p>
      </motion.div>

      {/* Feature pills */}
      <motion.div
        className="brand-pills"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.55 }}
      >
        {['🍳 AI Recipes', '📅 Meal Planner', '🛒 Grocery Lists', '📊 Nutrition Tracking'].map(pill => (
          <span key={pill} className="brand-pill">{pill}</span>
        ))}
      </motion.div>

      {/* Ambient blobs */}
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
    </div>
  );
}
