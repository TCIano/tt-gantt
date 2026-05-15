import type {
  Constraint,
  ConstraintEngineLike,
  ValidationResult,
  ValidationItem,
  GanttTaskSnapshot,
  CommandContext
} from './types'

export class ConstraintEngine implements ConstraintEngineLike {
  private rules: Constraint[] = []

  register(rule: Constraint): void {
    const existing = this.rules.findIndex(r => r.id === rule.id)
    if (existing !== -1) {
      this.rules.splice(existing, 1)
    }
    this.rules.push(rule)
    this.rules.sort((a, b) => a.priority - b.priority)
  }

  unregister(ruleId: string): boolean {
    const idx = this.rules.findIndex(r => r.id === ruleId)
    if (idx === -1) return false
    this.rules.splice(idx, 1)
    return true
  }

  getCount(): number {
    return this.rules.length
  }

  preValidate(task: GanttTaskSnapshot, ctx: CommandContext): ValidationResult {
    const allItems: ValidationItem[] = []
    for (const rule of this.rules) {
      const items = rule.preValidate(task, ctx)
      allItems.push(...items)
    }
    const errors = allItems.filter(i => i.severity === 'error')
    return { ok: errors.length === 0, items: allItems }
  }

  postValidate(tasks: GanttTaskSnapshot[], ctx: CommandContext): ValidationResult {
    const allItems: ValidationItem[] = []
    for (const rule of this.rules) {
      const items = rule.postValidate(tasks, ctx)
      allItems.push(...items)
    }
    const errors = allItems.filter(i => i.severity === 'error')
    return { ok: errors.length === 0, items: allItems }
  }
}
