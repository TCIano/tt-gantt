import type { Constraint, GanttTaskSnapshot, CommandContext, ValidationItem } from '../types'

export const DependencyConstraint: Constraint = {
  id: 'dependency',
  name: 'Dependency Check',
  priority: 300,
  preValidate(task: GanttTaskSnapshot, ctx: CommandContext): ValidationItem[] {
    if (!task.dependencies || task.dependencies.length === 0) return []
    const items: ValidationItem[] = []
    for (const depId of task.dependencies) {
      const depTask = ctx.tasks.get(depId)
      if (!depTask) continue
      if (depTask.endDate < task.startDate) continue
      items.push({
        severity: 'warning',
        code: 'DEP_VIOLATION',
        message: `Task "${task.name}" starts before dependency "${depTask.name}" finishes`,
        taskIds: [task.id, depId]
      })
    }
    return items
  },
  postValidate(_tasks: GanttTaskSnapshot[], _ctx: CommandContext): ValidationItem[] {
    return []
  }
}
