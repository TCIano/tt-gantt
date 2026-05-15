import type { Constraint, GanttTaskSnapshot, CommandContext, ValidationItem } from '../types'

export const OverlapConstraint: Constraint = {
  id: 'overlap',
  name: 'Overlap Check',
  priority: 400,
  preValidate(_task: GanttTaskSnapshot, _ctx: CommandContext): ValidationItem[] {
    return []
  },
  postValidate(tasks: GanttTaskSnapshot[], _ctx: CommandContext): ValidationItem[] {
    const items: ValidationItem[] = []
    const grouped = new Map<string, GanttTaskSnapshot[]>()
    for (const t of tasks) {
      const key = t.resourceId ?? '__no_resource__'
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(t)
    }
    for (const [resourceId, resourceTasks] of grouped) {
      if (resourceId === '__no_resource__') continue
      for (let i = 0; i < resourceTasks.length; i++) {
        for (let j = i + 1; j < resourceTasks.length; j++) {
          const a = resourceTasks[i]
          const b = resourceTasks[j]
          if (a.endDate < b.startDate || b.endDate < a.startDate) continue
          items.push({
            severity: 'warning',
            code: 'TASK_OVERLAP',
            message: `Tasks "${a.name}" and "${b.name}" overlap on resource ${resourceId}`,
            taskIds: [a.id, b.id],
            resourceIds: [resourceId]
          })
        }
      }
    }
    return items
  }
}
