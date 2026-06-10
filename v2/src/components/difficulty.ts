// Difficulty → token class maps. Full literal strings so Tailwind's
// scanner sees every class.

import type { Difficulty } from '../engine/types'

export const difficultyText: Record<string, string> = {
  Easy: 'text-easy',
  Medium: 'text-medium',
  Hard: 'text-hard',
}

export const difficultyDot: Record<string, string> = {
  Easy: 'bg-easy',
  Medium: 'bg-medium',
  Hard: 'bg-hard',
}

export function diffTextClass(d: Difficulty | string | undefined): string {
  return (d && difficultyText[d]) || 'text-fg-3'
}

export function diffDotClass(d: Difficulty | string | undefined): string {
  return (d && difficultyDot[d]) || 'bg-fg-4'
}
