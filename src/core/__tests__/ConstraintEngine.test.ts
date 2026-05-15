import { describe, it, expect } from 'vitest'
import { ConstraintEngine } from '../ConstraintEngine'
import {
  ReadOnlyConstraint,
  DateOrderConstraint,
  DependencyConstraint,
  OverlapConstraint
} from '../constraints'
import type { CommandContext, GanttTaskSnapshot, Constraint } from '../types'

function makeContext(tasks: GanttTaskSnapshot[]): CommandContext {
  return {
    tasks: new Map(tasks.map(t => [t.id, { ...t }])),
    resources: new Map(),
    flatTasks: tasks.map(t => ({ ...t, _level: 0, _hasChildren: false, _visible: true }))
  }
}

describe('ConstraintEngine', () => {
  it('registers and executes rules in priority order', () => {
    const engine = new ConstraintEngine()
    const calls: string[] = []

    const ruleA: Constraint = {
      id: 'a', name: 'A', priority: 200,
      preValidate(_t: GanttTaskSnapshot, _c: CommandContext) { calls.push('A'); return [] },
      postValidate() { return [] }
    }
    const ruleB: Constraint = {
      id: 'b', name: 'B', priority: 100,
      preValidate(_t: GanttTaskSnapshot, _c: CommandContext) { calls.push('B'); return [] },
      postValidate() { return [] }
    }

    engine.register(ruleA)
    engine.register(ruleB)

    const task: GanttTaskSnapshot = { id: '1', name: 'T', startDate: '2026-01-01', endDate: '2026-01-05' }
    engine.preValidate(task, makeContext([]))
    expect(calls).toEqual(['B', 'A'])
  })

  it('unregisters rules', () => {
    const engine = new ConstraintEngine()
    engine.register(ReadOnlyConstraint)
    expect(engine.unregister('read-only')).toBe(true)
    expect(engine.unregister('read-only')).toBe(false)
  })

  it('collects errors from all rules', () => {
    const engine = new ConstraintEngine()
    engine.register(ReadOnlyConstraint)
    engine.register(DateOrderConstraint)

    const task: GanttTaskSnapshot = { id: '1', name: 'T', startDate: '2026-01-10', endDate: '2026-01-01', readOnly: true }
    const result = engine.preValidate(task, makeContext([task]))
    expect(result.ok).toBe(false)
    expect(result.items.length).toBe(2)
    expect(result.items.map(i => i.code)).toContain('TASK_READONLY')
    expect(result.items.map(i => i.code)).toContain('DATE_ORDER_INVALID')
  })
})

describe('ReadOnlyConstraint', () => {
  it('blocks read-only tasks', () => {
    const task: GanttTaskSnapshot = { id: '1', name: 'T', startDate: '2026-01-01', endDate: '2026-01-05', readOnly: true }
    const items = ReadOnlyConstraint.preValidate(task, makeContext([]))
    expect(items.length).toBe(1)
    expect(items[0].code).toBe('TASK_READONLY')
  })

  it('blocks disabled tasks', () => {
    const task: GanttTaskSnapshot = { id: '1', name: 'T', startDate: '2026-01-01', endDate: '2026-01-05', disabled: true }
    const items = ReadOnlyConstraint.preValidate(task, makeContext([]))
    expect(items.length).toBe(1)
  })

  it('allows normal tasks', () => {
    const task: GanttTaskSnapshot = { id: '1', name: 'T', startDate: '2026-01-01', endDate: '2026-01-05' }
    const items = ReadOnlyConstraint.preValidate(task, makeContext([]))
    expect(items.length).toBe(0)
  })
})

describe('DateOrderConstraint', () => {
  it('rejects end before start', () => {
    const task: GanttTaskSnapshot = { id: '1', name: 'T', startDate: '2026-01-10', endDate: '2026-01-01' }
    const items = DateOrderConstraint.preValidate(task, makeContext([]))
    expect(items.length).toBe(1)
    expect(items[0].code).toBe('DATE_ORDER_INVALID')
  })

  it('allows valid date range', () => {
    const task: GanttTaskSnapshot = { id: '1', name: 'T', startDate: '2026-01-01', endDate: '2026-01-10' }
    const items = DateOrderConstraint.preValidate(task, makeContext([]))
    expect(items.length).toBe(0)
  })
})

describe('DependencyConstraint', () => {
  it('warns when successor starts before predecessor finishes', () => {
    const tasks: GanttTaskSnapshot[] = [
      { id: '1', name: 'Predecessor', startDate: '2026-01-01', endDate: '2026-01-10' },
      { id: '2', name: 'Successor', startDate: '2026-01-05', endDate: '2026-01-15', dependencies: ['1'] }
    ]
    const ctx = makeContext(tasks)
    const items = DependencyConstraint.preValidate(tasks[1], ctx)
    expect(items.length).toBe(1)
    expect(items[0].code).toBe('DEP_VIOLATION')
  })

  it('allows valid dependency order', () => {
    const tasks: GanttTaskSnapshot[] = [
      { id: '1', name: 'Predecessor', startDate: '2026-01-01', endDate: '2026-01-05' },
      { id: '2', name: 'Successor', startDate: '2026-01-10', endDate: '2026-01-15', dependencies: ['1'] }
    ]
    const ctx = makeContext(tasks)
    const items = DependencyConstraint.preValidate(tasks[1], ctx)
    expect(items.length).toBe(0)
  })
})

describe('OverlapConstraint', () => {
  it('detects overlapping tasks on same resource', () => {
    const tasks: GanttTaskSnapshot[] = [
      { id: '1', name: 'A', startDate: '2026-01-01', endDate: '2026-01-10', resourceId: 'r1' },
      { id: '2', name: 'B', startDate: '2026-01-05', endDate: '2026-01-15', resourceId: 'r1' }
    ]
    const items = OverlapConstraint.postValidate(tasks, makeContext([]))
    expect(items.length).toBe(1)
    expect(items[0].code).toBe('TASK_OVERLAP')
  })

  it('allows non-overlapping tasks', () => {
    const tasks: GanttTaskSnapshot[] = [
      { id: '1', name: 'A', startDate: '2026-01-01', endDate: '2026-01-05', resourceId: 'r1' },
      { id: '2', name: 'B', startDate: '2026-01-10', endDate: '2026-01-15', resourceId: 'r1' }
    ]
    const items = OverlapConstraint.postValidate(tasks, makeContext([]))
    expect(items.length).toBe(0)
  })

  it('allows overlapping on different resources', () => {
    const tasks: GanttTaskSnapshot[] = [
      { id: '1', name: 'A', startDate: '2026-01-01', endDate: '2026-01-10', resourceId: 'r1' },
      { id: '2', name: 'B', startDate: '2026-01-05', endDate: '2026-01-15', resourceId: 'r2' }
    ]
    const items = OverlapConstraint.postValidate(tasks, makeContext([]))
    expect(items.length).toBe(0)
  })
})
