import { describe, it, expect } from 'vitest'
import { flattenResources } from '../gantt'
import type { ResourceNode } from '../../core/types'

describe('flattenResources', () => {
  it('flattens flat resource list', () => {
    const resources: ResourceNode[] = [
      { id: 'r1', name: 'Factory A', type: 'factory' },
      { id: 'r2', name: 'Workshop 1', type: 'workshop' }
    ]
    const result = flattenResources(resources)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].id).toBe('r1')
    expect(result.rows[0]._level).toBe(0)
    expect(result.rows[1].id).toBe('r2')
    expect(result.rows[1]._level).toBe(0)
  })

  it('flattens nested hierarchy', () => {
    const resources: ResourceNode[] = [
      {
        id: 'f1', name: 'Factory A', type: 'factory',
        children: [
          { id: 'w1', name: 'Workshop 1', type: 'workshop' },
          { id: 'w2', name: 'Workshop 2', type: 'workshop' }
        ]
      }
    ]
    const result = flattenResources(resources)
    expect(result.rows).toHaveLength(3)
    expect(result.rows[0].id).toBe('f1')
    expect(result.rows[0]._level).toBe(0)
    expect(result.rows[1].id).toBe('w1')
    expect(result.rows[1]._level).toBe(1)
    expect(result.rows[1]._parent).toBe('f1')
    expect(result.rows[2].id).toBe('w2')
    expect(result.rows[2]._level).toBe(1)
  })

  it('marks hasChildren correctly', () => {
    const resources: ResourceNode[] = [
      {
        id: 'f1', name: 'Factory A', type: 'factory',
        children: [
          { id: 'w1', name: 'Workshop 1', type: 'workshop' }
        ]
      }
    ]
    const result = flattenResources(resources)
    expect(result.rows[0]._hasChildren).toBe(true)
    expect(result.rows[1]._hasChildren).toBe(false)
  })

  it('collapses children when expanded is false', () => {
    const resources: ResourceNode[] = [
      {
        id: 'f1', name: 'Factory A', type: 'factory',
        children: [
          { id: 'w1', name: 'Workshop 1', type: 'workshop' }
        ]
      } as ResourceNode & { expanded: boolean }
    ]
    ;(resources[0] as any).expanded = false
    const result = flattenResources(resources as any)
    // Children should be excluded since parent is collapsed
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].id).toBe('f1')
  })

  it('assigns sequential indices', () => {
    const resources: ResourceNode[] = [
      { id: 'r1', name: 'A', type: 'machine' },
      { id: 'r2', name: 'B', type: 'machine' },
      { id: 'r3', name: 'C', type: 'machine' }
    ]
    const result = flattenResources(resources)
    expect(result.rows[0]._index).toBe(0)
    expect(result.rows[1]._index).toBe(1)
    expect(result.rows[2]._index).toBe(2)
  })
})
