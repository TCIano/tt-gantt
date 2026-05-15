import type { Constraint, GanttTaskSnapshot, CommandContext, ValidationItem } from '../types'

export const ReadOnlyConstraint: Constraint = {
  id: 'read-only',
  name: 'ReadOnly Check',
  priority: 100,
  preValidate(task: GanttTaskSnapshot, _ctx: CommandContext): ValidationItem[] {
    if (task.readOnly === true || task.disabled === true) {
      return [{
        severity: 'error',
        code: 'TASK_READONLY',
        message: `Task "${task.name}" is read-only and cannot be modified`,
        taskIds: [task.id]
      }]
    }
    return []
  },
  postValidate(_tasks: GanttTaskSnapshot[], _ctx: CommandContext): ValidationItem[] {
    return []
  }
}
