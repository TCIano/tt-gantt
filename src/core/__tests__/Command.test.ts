import { describe, it, expect } from 'vitest'
import {
  MoveTaskCommand,
  CreateDependencyCommand,
  RemoveDependencyCommand,
  BatchCommand
} from '../Command'
import type { CommandContext, GanttTaskSnapshot } from '../types'

function makeContext(tasks: GanttTaskSnapshot[]): CommandContext {
  return {
    tasks: new Map(tasks.map(t => [t.id, { ...t }])),
    resources: new Map(),
    flatTasks: tasks.map(t => ({ ...t, _level: 0, _hasChildren: false, _visible: true }))
  }
}

describe('MoveTaskCommand', () => {
  it('moves task dates', () => {
    const task: GanttTaskSnapshot = { id: '1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05' }
    const ctx = makeContext([task])
    const cmd = new MoveTaskCommand({ taskId: '1', newStartDate: '2026-01-10', newEndDate: '2026-01-15' })

    const result = cmd.execute(ctx)
    expect(result.ok).toBe(true)
    expect(ctx.tasks.get('1')!.startDate).toBe('2026-01-10')
    expect(ctx.tasks.get('1')!.endDate).toBe('2026-01-15')
  })

  it('undo restores original dates', () => {
    const task: GanttTaskSnapshot = { id: '1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05' }
    const ctx = makeContext([task])
    const cmd = new MoveTaskCommand({ taskId: '1', newStartDate: '2026-01-10', newEndDate: '2026-01-15' })

    cmd.execute(ctx)
    cmd.undo(ctx)
    expect(ctx.tasks.get('1')!.startDate).toBe('2026-01-01')
    expect(ctx.tasks.get('1')!.endDate).toBe('2026-01-05')
  })

  it('returns error for missing task', () => {
    const ctx = makeContext([])
    const cmd = new MoveTaskCommand({ taskId: '99', newStartDate: '2026-01-10', newEndDate: '2026-01-15' })
    const result = cmd.execute(ctx)
    expect(result.ok).toBe(false)
    expect(result.items[0].code).toBe('TASK_NOT_FOUND')
  })

  it('generates patch', () => {
    const cmd = new MoveTaskCommand({ taskId: '1', newStartDate: '2026-01-10', newEndDate: '2026-01-15' })
    const patch = cmd.toPatch()
    expect(patch.commandType).toBe('MoveTask')
    expect(patch.after).toEqual({ taskId: '1', startDate: '2026-01-10', endDate: '2026-01-15' })
  })
})

describe('CreateDependencyCommand', () => {
  it('creates dependency', () => {
    const tasks: GanttTaskSnapshot[] = [
      { id: '1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05' },
      { id: '2', name: 'Task 2', startDate: '2026-01-06', endDate: '2026-01-10' }
    ]
    const ctx = makeContext(tasks)
    const cmd = new CreateDependencyCommand({ sourceId: '1', targetId: '2' })

    const result = cmd.execute(ctx)
    expect(result.ok).toBe(true)
    expect(ctx.tasks.get('2')!.dependencies).toContain('1')
    expect(ctx.tasks.get('2')!.dependencyTypes!['1']).toBe('FS')
  })

  it('prevents duplicate dependency', () => {
    const tasks: GanttTaskSnapshot[] = [
      { id: '1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05' },
      { id: '2', name: 'Task 2', startDate: '2026-01-06', endDate: '2026-01-10', dependencies: ['1'] }
    ]
    const ctx = makeContext(tasks)
    const cmd = new CreateDependencyCommand({ sourceId: '1', targetId: '2' })
    const result = cmd.execute(ctx)
    expect(result.ok).toBe(false)
  })

  it('undo removes dependency', () => {
    const tasks: GanttTaskSnapshot[] = [
      { id: '1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05' },
      { id: '2', name: 'Task 2', startDate: '2026-01-06', endDate: '2026-01-10' }
    ]
    const ctx = makeContext(tasks)
    const cmd = new CreateDependencyCommand({ sourceId: '1', targetId: '2' })
    cmd.execute(ctx)
    cmd.undo(ctx)
    expect(ctx.tasks.get('2')!.dependencies).not.toContain('1')
  })
})

describe('RemoveDependencyCommand', () => {
  it('removes dependency', () => {
    const tasks: GanttTaskSnapshot[] = [
      { id: '1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05' },
      { id: '2', name: 'Task 2', startDate: '2026-01-06', endDate: '2026-01-10', dependencies: ['1'] }
    ]
    const ctx = makeContext(tasks)
    const cmd = new RemoveDependencyCommand({ sourceId: '1', targetId: '2' })
    const result = cmd.execute(ctx)
    expect(result.ok).toBe(true)
    expect(ctx.tasks.get('2')!.dependencies).not.toContain('1')
  })
})

describe('BatchCommand', () => {
  it('executes multiple commands atomically', () => {
    const tasks: GanttTaskSnapshot[] = [
      { id: '1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05' },
      { id: '2', name: 'Task 2', startDate: '2026-01-06', endDate: '2026-01-10' }
    ]
    const ctx = makeContext(tasks)
    const batch = new BatchCommand([
      new MoveTaskCommand({ taskId: '1', newStartDate: '2026-01-10', newEndDate: '2026-01-15' }),
      new CreateDependencyCommand({ sourceId: '1', targetId: '2' })
    ])
    const result = batch.execute(ctx)
    expect(result.ok).toBe(true)
    expect(ctx.tasks.get('1')!.startDate).toBe('2026-01-10')
    expect(ctx.tasks.get('2')!.dependencies).toContain('1')
  })

  it('rolls back on failure', () => {
    const tasks: GanttTaskSnapshot[] = [
      { id: '1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05' },
      { id: '2', name: 'Task 2', startDate: '2026-01-06', endDate: '2026-01-10' }
    ]
    const ctx = makeContext(tasks)
    const batch = new BatchCommand([
      new MoveTaskCommand({ taskId: '1', newStartDate: '2026-01-10', newEndDate: '2026-01-15' }),
      new MoveTaskCommand({ taskId: '99', newStartDate: '2026-01-10', newEndDate: '2026-01-15' })
    ])
    const result = batch.execute(ctx)
    expect(result.ok).toBe(false)
    expect(ctx.tasks.get('1')!.startDate).toBe('2026-01-01')
  })
})
