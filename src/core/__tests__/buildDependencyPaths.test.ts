import { describe, it, expect } from 'vitest'
import { buildDependencyPaths } from '../buildDependencyPaths'
import type { DependencyNodePosition, DependencyInput } from '../buildDependencyPaths'

describe('buildDependencyPaths', () => {
  it('returns empty for no dependencies', () => {
    const result = buildDependencyPaths(new Map(), [], 44)
    expect(result).toHaveLength(0)
  })

  it('builds FS dependency path with bezier', () => {
    const positions = new Map<string | number, DependencyNodePosition>([
      ['a', { x: 0, y: 8, width: 100, height: 24 }],
      ['b', { x: 200, y: 48, width: 100, height: 24 }]
    ])
    const deps: DependencyInput[] = [
      { sourceId: 'a', targetId: 'b', type: 'FS', lag: 0 }
    ]

    const result = buildDependencyPaths(positions, deps, 44)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a-b')
    expect(result[0].sourceId).toBe('a')
    expect(result[0].targetId).toBe('b')
    expect(result[0].path).toContain('M')
    expect(result[0].path).toContain('C')
    expect(result[0].arrow).toContain('200')
  })

  it('skips missing target', () => {
    const positions = new Map<string | number, DependencyNodePosition>([
      ['a', { x: 0, y: 8, width: 100, height: 24 }]
    ])
    const deps: DependencyInput[] = [
      { sourceId: 'a', targetId: 'missing', type: 'FS', lag: 0 }
    ]

    const result = buildDependencyPaths(positions, deps, 44)
    expect(result).toHaveLength(0)
  })

  it('uses routed path when diffX <= 20', () => {
    const positions = new Map<string | number, DependencyNodePosition>([
      ['a', { x: 100, y: 8, width: 100, height: 24 }],
      ['b', { x: 150, y: 48, width: 100, height: 24 }]
    ])
    const deps: DependencyInput[] = [
      { sourceId: 'a', targetId: 'b', type: 'FS', lag: 0 }
    ]

    const result = buildDependencyPaths(positions, deps, 44)
    expect(result[0].path).toContain('L') // routed path uses L
  })

  it('handles SS type correctly', () => {
    const positions = new Map<string | number, DependencyNodePosition>([
      ['a', { x: 0, y: 8, width: 100, height: 24 }],
      ['b', { x: 50, y: 48, width: 100, height: 24 }]
    ])
    const deps: DependencyInput[] = [
      { sourceId: 'a', targetId: 'b', type: 'SS', lag: 0 }
    ]

    const result = buildDependencyPaths(positions, deps, 44)
    expect(result).toHaveLength(1)
    const path = result[0].path
    const match = path.match(/^M (\d+)/)
    expect(match).not.toBeNull()
    // SS: start from source's left edge
    expect(Number(match![1])).toBe(0)
  })

  it('handles FF type correctly', () => {
    const positions = new Map<string | number, DependencyNodePosition>([
      ['a', { x: 0, y: 8, width: 100, height: 24 }],
      ['b', { x: 50, y: 48, width: 100, height: 24 }]
    ])
    const deps: DependencyInput[] = [
      { sourceId: 'a', targetId: 'b', type: 'FF', lag: 0 }
    ]

    const result = buildDependencyPaths(positions, deps, 44)
    expect(result).toHaveLength(1)
    const path = result[0].path
    const match = path.match(/^M (\d+)/)
    expect(match).not.toBeNull()
    // FF: start from source's right edge
    expect(Number(match![1])).toBe(100)
  })

  it('handles SF type correctly', () => {
    const positions = new Map<string | number, DependencyNodePosition>([
      ['a', { x: 0, y: 8, width: 100, height: 24 }],
      ['b', { x: 200, y: 48, width: 100, height: 24 }]
    ])
    const deps: DependencyInput[] = [
      { sourceId: 'a', targetId: 'b', type: 'SF', lag: 0 }
    ]

    const result = buildDependencyPaths(positions, deps, 44)
    expect(result).toHaveLength(1)
    const path = result[0].path
    const match = path.match(/^M (\d+)/)
    expect(match).not.toBeNull()
    // SF: start from source's left edge, end at target's right edge
    expect(Number(match![1])).toBe(0)
  })

  it('incorporates lag in pixel offset', () => {
    const positions = new Map<string | number, DependencyNodePosition>([
      ['a', { x: 0, y: 8, width: 100, height: 24 }],
      ['b', { x: 300, y: 48, width: 100, height: 24 }]
    ])
    const deps: DependencyInput[] = [
      { sourceId: 'a', targetId: 'b', type: 'FS', lag: 3 }
    ]

    const result = buildDependencyPaths(positions, deps, 44)
    const path = result[0].path
    const match = path.match(/^M (\d+)/)
    expect(match).not.toBeNull()
    // FS with lag=3: start from source's right edge + 3 * 44 = 132
    expect(Number(match![1])).toBe(100 + 3 * 44)
  })

  it('builds multiple dependency paths', () => {
    const positions = new Map<string | number, DependencyNodePosition>([
      ['a', { x: 0, y: 8, width: 100, height: 24 }],
      ['b', { x: 200, y: 48, width: 100, height: 24 }],
      ['c', { x: 400, y: 88, width: 100, height: 24 }]
    ])
    const deps: DependencyInput[] = [
      { sourceId: 'a', targetId: 'b', type: 'FS', lag: 0 },
      { sourceId: 'b', targetId: 'c', type: 'SS', lag: 1 }
    ]

    const result = buildDependencyPaths(positions, deps, 44)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('a-b')
    expect(result[1].id).toBe('b-c')
  })
})
