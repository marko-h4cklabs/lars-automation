'use client'

import { Component } from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-6 max-w-md w-full text-center">
            <div className="w-10 h-10 rounded-full bg-[#f05050]/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-[#f05050] text-lg font-mono">!</span>
            </div>
            <h2 className="text-[#f0f0f0] font-mono text-sm font-bold mb-2">
              Something went wrong
            </h2>
            <p className="text-[#555] font-mono text-[10px] mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              className="px-4 py-2 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded text-[10px] font-mono text-[#00ff88] hover:bg-[#00ff88]/20 transition-colors"
            >
              RELOAD PAGE
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
