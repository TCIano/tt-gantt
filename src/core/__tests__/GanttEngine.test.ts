import { describe, it, expect } from 'vitest'
import { GanttEngine } from '../GanttEngine'
import { MoveTaskCommand } from '../Command'
import { ReadOnlyConstraint, DateOrderConstraint } from '../constraints'
import { fromDTO } from '../adapter'
import type { GanttDTO } from '../types'

function makeEngine(dto?: GanttDTO): GanttEngine {
  const engine = new GanttEngine()
  if (dto) {
    engine.setState(fromDTO(dto))
  }
  engine.constraintEngine.register(DateOrderConstraint)
  engine.constraintEngine.register(ReadOnlyConstraint)
  return engine
}

describe('GanttEngine', () => {
  it('executes command and updates state', () => {
    const engine = makeEngine({
      tasks: [{ id: '1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05' }]
    })
    const cmd = new MoveTaskCommand({ taskId: '1', newStartDate: '2026-01-10', newEndDate: '2026-01-15' })
    const result = engine.execute(cmd)
    expect(result.ok).toBe(true)
    const state = engine.getState()
    expect(state.tasks[0].startDate).toBe('2026-01-10')
    expect(state.historyDepth).toBe(1)
  })

  it('blocks read-only task modification', () => {
    const engine = makeEngine({
      tasks: [{ id: '1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05', readOnly: true }]
    })
    const cmd = new MoveTaskCommand({ taskId: '1', newStartDate: '2026-01-10', newEndDate: '2026-01-15' })
    const result = engine.execute(cmd)
    expect(result.ok).toBe(false)
    const state = engine.getState()
    expect(state.tasks[0].startDate).toBe('2026-01-01')
  })

  it('blocks invalid date order', () => {
    const engine = makeEngine({
      tasks: [{ id: '1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05' }]
    })
    const cmd = new MoveTaskCommand({ taskId: '1', newStartDate: '2026-01-10', newEndDate: '2026-01-05' })
    const result = engine.execute(cmd)
    expect(result.ok).toBe(false)
    const state = engine.getState()
    expect(state.tasks[0].startDate).toBe('2026-01-01')
  })

  it('undo and redo work', () => {
    const engine = makeEngine({
      tasks: [{ id: '1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05' }]
    })
    engine.execute(new MoveTaskCommand({ taskId: '1', newStartDate: '2026-01-10', newEndDate: '2026-01-15' }))

    engine.undo()
    expect(engine.getState().tasks[0].startDate).toBe('2026-01-01')

    engine.redo()
    expect(engine.getState().tasks[0].startDate).toBe('2026-01-10')
  })

  it('subscribes to state changes', () => {
    const engine = makeEngine({
      tasks: [{ id: '1', name: 'Task 1', startDate: '2026-01-01', endDate: '2026-01-05' }]
    })

    let captured: Readonly<ReturnType<typeof engine.getState>> | null = null
    engine.subscribe((s) => { captured = s })

    engine.execute(new MoveTaskCommand({ taskId: '1', newStartDate: '2026-01-10', newEndDate: '2026-01-15' }))

    expect(captured).not.toBeNull()
    expect(captured!.tasks[0].startDate).toBe('2026-01-10')
  })
})
