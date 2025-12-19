'use client'

import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center font-bold transition-all duration-150 active:scale-[0.98]',
          'rounded-2xl border-b-4 active:border-b-2 active:translate-y-[2px]',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:active:translate-y-0',
          {
            // Primary - Duolingo green
            'bg-duo-green border-duo-green-dark text-white hover:bg-duo-green-light':
              variant === 'primary',
            // Secondary - Duolingo blue
            'bg-duo-blue border-duo-blue-dark text-white hover:bg-duo-blue-light':
              variant === 'secondary',
            // Outline
            'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 border-2 border-b-4':
              variant === 'outline',
            // Ghost
            'bg-transparent border-transparent text-duo-blue hover:bg-duo-blue/10 border-b-0 active:border-b-0 active:translate-y-0':
              variant === 'ghost',
          },
          {
            'px-4 py-2 text-sm': size === 'sm',
            'px-6 py-3 text-base': size === 'md',
            'px-8 py-4 text-lg': size === 'lg',
            'px-10 py-5 text-xl': size === 'xl',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
