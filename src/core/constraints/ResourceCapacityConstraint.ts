import type { Constraint, GanttTaskSnapshot, CommandContext, ValidationItem } from '../types'

function dateOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && aEnd >= bStart
}

function collectValidationItemsForUnavailablePeriods(
  task: GanttTaskSnapshot,
  ctx: CommandContext
): ValidationItem[] {
  const items: ValidationItem[] = []
  if (!task.resourceId) return items
  const resource = ctx.resources.get(task.resourceId)
  if (!resource?.calendar) return items

  for (const period of resource.calendar.unavailablePeriods) {
    if (dateOverlap(task.startDate, task.endDate, period.start, period.end)) {
      items.push({
        severity: 'error',
        code: 'RESOURCE_UNAVAILABLE',
        message: `Resource "${resource.name}" is unavailable during ${period.start} ~ ${period.end}`,
        taskIds: [task.id],
        resourceIds: [resource.id]
      })
    }
  }
  for (const mw of resource.calendar.maintenanceWindows) {
    if (dateOverlap(task.startDate, task.endDate, mw.start, mw.end)) {
      items.push({
        severity: 'error',
        code: 'RESOURCE_MAINTENANCE',
        message: `Resource "${resource.name}" has maintenance during ${mw.start} ~ ${mw.end}`,
        taskIds: [task.id],
        resourceIds: [resource.id]
      })
    }
  }
  return items
}

export const ResourceCapacityConstraint: Constraint = {
  id: 'resource-capacity',
  name: 'Resource Capacity Check',
  priority: 500,

  preValidate(task: GanttTaskSnapshot, ctx: CommandContext): ValidationItem[] {
    return collectValidationItemsForUnavailablePeriods(task, ctx)
  },

  postValidate(tasks: GanttTaskSnapshot[], ctx: CommandContext): ValidationItem[] {
    const items: ValidationItem[] = []
    const grouped = new Map<string, GanttTaskSnapshot[]>()

    // Check unavailable periods for all tasks
    for (const t of tasks) {
      items.push(...collectValidationItemsForUnavailablePeriods(t, ctx))

      if (!t.resourceId) continue
      const key = String(t.resourceId)
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(t)
    }

    // Check capacity: for each resource, count concurrent tasks per day
    for (const [resourceId, resourceTasks] of grouped) {
      const resource = ctx.resources.get(resourceId)
      if (!resource?.capacity) continue
      const capacityPerDay = resource.capacity.default

      if (capacityPerDay <= 0) continue

      // Collect all unique dates across these tasks
      const dateSet = new Set<string>()
      for (const t of resourceTasks) {
        let current = t.startDate
        while (current <= t.endDate) {
          dateSet.add(current)
          const [y, m, d] = current.split('-').map(Number)
          const next = new Date(y, m - 1, d + 1)
          current = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
        }
      }

      for (const dateStr of dateSet) {
        let count = 0
        const dateTasks: (string | number)[] = []
        for (const t of resourceTasks) {
          if (t.startDate <= dateStr && t.endDate >= dateStr) {
            count++
            dateTasks.push(t.id)
          }
        }
        if (count > capacityPerDay) {
          items.push({
            severity: 'error',
            code: 'RESOURCE_OVERLOAD',
            message: `Resource "${resource.name}" exceeds capacity on ${dateStr}: ${count} tasks (capacity: ${capacityPerDay})`,
            taskIds: dateTasks,
            resourceIds: [resourceId]
          })
        }
      }
    }

    return items
  }
}
