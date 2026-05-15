import type { Constraint, GanttTaskSnapshot, CommandContext, ValidationItem } from '../types'

export const DateOrderConstraint: Constraint = {
  id: 'date-order',
  name: 'Date Order Check',
  priority: 200,
  preValidate(task: GanttTaskSnapshot, _ctx: CommandContext): ValidationItem[] {
    if (task.startDate > task.endDate) {
      return [{
        severity: 'error',
        code: 'DATE_ORDER_INVALID',
        message: `Task "${task.name}" end date (${task.endDate}) is before start date (${task.startDate})`,
        taskIds: [task.id]
      }]
    }
    return []
  },
  postValidate(_tasks: GanttTaskSnapshot[], _ctx: CommandContext): ValidationItem[] {
    return []
  }
}
