'use client'

import { useState, useRef } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabaseRef = useRef<ReturnType<typeof createBrowserSupabaseClient> | null>(null)

  function getSupabase() {
    if (!supabaseRef.current) {
      supabaseRef.current = createBrowserSupabaseClient()
    }
    return supabaseRef.current
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: authError } = await getSupabase().auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message)
        return
      }

      router.push('/inbox')
      router.refresh()
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto px-6">
      {/* Logo */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-[#00ff88] rounded-sm" />
          <h1 className="text-3xl font-mono font-bold tracking-[0.3em] text-[#f0f0f0]">
            BLACKOPS
          </h1>
        </div>
        <p className="text-[#444] font-mono text-xs tracking-[0.2em] uppercase">
          Control Tower
        </p>
      </div>

      {/* Login form */}
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-[#666] font-mono text-xs uppercase tracking-wider mb-2">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full bg-[#111] border border-[#222] rounded px-4 py-3 text-[#f0f0f0] font-mono text-sm placeholder-[#333] focus:outline-none focus:border-[#00ff88] transition-colors"
            placeholder="operator@blackops.io"
          />
        </div>

        <div>
          <label className="block text-[#666] font-mono text-xs uppercase tracking-wider mb-2">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full bg-[#111] border border-[#222] rounded px-4 py-3 text-[#f0f0f0] font-mono text-sm placeholder-[#333] focus:outline-none focus:border-[#00ff88] transition-colors"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded px-4 py-3 text-red-400 font-mono text-xs">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#00ff88] text-[#0a0a0a] font-mono font-bold text-sm uppercase tracking-wider py-3 rounded hover:bg-[#00cc6a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Authenticating...
            </span>
          ) : (
            'Enter'
          )}
        </button>
      </form>

      {/* Bottom accent line */}
      <div className="mt-12 flex justify-center">
        <div className="w-12 h-[1px] bg-[#222]" />
      </div>
    </div>
  )
}
