import { nanoid } from 'nanoid';
import type {
  Command,
  CommandContext,
  CommandId,
  DependencyType,
  PatchRecord,
  TaskId,
  ValidationItem,
  ValidationResult
} from './types';

// ========== Abstract Base ==========

export abstract class BaseCommand implements Command {
  readonly id: CommandId;
  readonly type: string;
  readonly timestamp: number;

  constructor(type: string) {
    this.id = nanoid();
    this.type = type;
    this.timestamp = Date.now();
  }

  abstract execute(ctx: CommandContext): ValidationResult;
  abstract undo(ctx: CommandContext): void;
  abstract toPatch(): PatchRecord;

  canUndo(): boolean {
    return true;
  }
}

// ========== MoveTaskCommand ==========

export interface MoveTaskPayload {
  taskId: TaskId;
  newStartDate: string;
  newEndDate: string;
}

export class MoveTaskCommand extends BaseCommand {
  private taskId: TaskId;
  private newStartDate: string;
  private newEndDate: string;
  private prevStartDate: string | null = null;
  private prevEndDate: string | null = null;

  constructor(payload: MoveTaskPayload) {
    super('MoveTask');
    this.taskId = payload.taskId;
    this.newStartDate = payload.newStartDate;
    this.newEndDate = payload.newEndDate;
  }

  execute(ctx: CommandContext): ValidationResult {
    const task = ctx.tasks.get(this.taskId);
    if (!task) {
      return {
        ok: false,
        items: [
          {
            severity: 'error',
            code: 'TASK_NOT_FOUND',
            message: `Task ${this.taskId} not found`,
            taskIds: [this.taskId]
          }
        ]
      };
    }

    this.prevStartDate = task.startDate;
    this.prevEndDate = task.endDate;

    task.startDate = this.newStartDate;
    task.endDate = this.newEndDate;

    return { ok: true, items: [] };
  }

  undo(ctx: CommandContext): void {
    const task = ctx.tasks.get(this.taskId);
    if (task && this.prevStartDate !== null && this.prevEndDate !== null) {
      task.startDate = this.prevStartDate;
      task.endDate = this.prevEndDate;
    }
  }

  toPatch(): PatchRecord {
    return {
      commandId: this.id,
      commandType: this.type,
      timestamp: this.timestamp,
      before: { taskId: this.taskId, startDate: this.prevStartDate, endDate: this.prevEndDate },
      after: { taskId: this.taskId, startDate: this.newStartDate, endDate: this.newEndDate }
    };
  }
}

// ========== ResizeTaskCommand ==========

export interface ResizeTaskPayload {
  taskId: TaskId;
  newStartDate: string;
  newEndDate: string;
}

export class ResizeTaskCommand extends BaseCommand {
  private taskId: TaskId;
  private newStartDate: string;
  private newEndDate: string;
  private prevStartDate: string | null = null;
  private prevEndDate: string | null = null;

  constructor(payload: ResizeTaskPayload) {
    super('ResizeTask');
    this.taskId = payload.taskId;
    this.newStartDate = payload.newStartDate;
    this.newEndDate = payload.newEndDate;
  }

  execute(ctx: CommandContext): ValidationResult {
    const task = ctx.tasks.get(this.taskId);
    if (!task) {
      return {
        ok: false,
        items: [
          {
            severity: 'error',
            code: 'TASK_NOT_FOUND',
            message: `Task ${this.taskId} not found`,
            taskIds: [this.taskId]
          }
        ]
      };
    }

    this.prevStartDate = task.startDate;
    this.prevEndDate = task.endDate;
    task.startDate = this.newStartDate;
    task.endDate = this.newEndDate;
    return { ok: true, items: [] };
  }

  undo(ctx: CommandContext): void {
    const task = ctx.tasks.get(this.taskId);
    if (task && this.prevStartDate !== null && this.prevEndDate !== null) {
      task.startDate = this.prevStartDate;
      task.endDate = this.prevEndDate;
    }
  }

  toPatch(): PatchRecord {
    return {
      commandId: this.id,
      commandType: this.type,
      timestamp: this.timestamp,
      before: { taskId: this.taskId, startDate: this.prevStartDate, endDate: this.prevEndDate },
      after: { taskId: this.taskId, startDate: this.newStartDate, endDate: this.newEndDate }
    };
  }
}

// ========== CreateDependencyCommand ==========

export interface CreateDependencyPayload {
  sourceId: TaskId;
  targetId: TaskId;
  dependencyType?: DependencyType;
}

export class CreateDependencyCommand extends BaseCommand {
  private sourceId: TaskId;
  private targetId: TaskId;
  private dependencyType: DependencyType;

  constructor(payload: CreateDependencyPayload) {
    super('CreateDependency');
    this.sourceId = payload.sourceId;
    this.targetId = payload.targetId;
    this.dependencyType = payload.dependencyType ?? 'FS';
  }

  execute(ctx: CommandContext): ValidationResult {
    const target = ctx.tasks.get(this.targetId);
    if (!target) {
      return {
        ok: false,
        items: [
          {
            severity: 'error',
            code: 'TASK_NOT_FOUND',
            message: `Target task ${this.targetId} not found`,
            taskIds: [this.targetId]
          }
        ]
      };
    }
    if (!target.dependencies) {
      target.dependencies = [];
    }
    if (target.dependencies.includes(this.sourceId)) {
      return {
        ok: false,
        items: [
          {
            severity: 'error',
            code: 'DEP_ALREADY_EXISTS',
            message: 'Dependency already exists',
            taskIds: [this.sourceId, this.targetId]
          }
        ]
      };
    }
    target.dependencies.push(this.sourceId);
    if (target.dependencyTypes) {
      target.dependencyTypes[this.sourceId] = this.dependencyType;
    } else {
      target.dependencyTypes = { [this.sourceId]: this.dependencyType };
    }
    return { ok: true, items: [] };
  }

  undo(ctx: CommandContext): void {
    const target = ctx.tasks.get(this.targetId);
    if (target && target.dependencies) {
      target.dependencies = target.dependencies.filter((d) => d !== this.sourceId);
      if (target.dependencyTypes) {
        delete target.dependencyTypes[this.sourceId];
      }
    }
  }

  toPatch(): PatchRecord {
    return {
      commandId: this.id,
      commandType: this.type,
      timestamp: this.timestamp,
      before: {},
      after: {
        sourceId: this.sourceId,
        targetId: this.targetId,
        dependencyType: this.dependencyType
      }
    };
  }
}

// ========== RemoveDependencyCommand ==========

export interface RemoveDependencyPayload {
  sourceId: TaskId;
  targetId: TaskId;
}

export class RemoveDependencyCommand extends BaseCommand {
  private sourceId: TaskId;
  private targetId: TaskId;
  private removedType: DependencyType | undefined;

  constructor(payload: RemoveDependencyPayload) {
    super('RemoveDependency');
    this.sourceId = payload.sourceId;
    this.targetId = payload.targetId;
  }

  execute(ctx: CommandContext): ValidationResult {
    const target = ctx.tasks.get(this.targetId);
    if (!target) {
      return {
        ok: false,
        items: [
          {
            severity: 'error',
            code: 'TASK_NOT_FOUND',
            message: `Target task ${this.targetId} not found`,
            taskIds: [this.targetId]
          }
        ]
      };
    }
    if (!target.dependencies || !target.dependencies.includes(this.sourceId)) {
      return {
        ok: false,
        items: [
          {
            severity: 'error',
            code: 'DEP_NOT_FOUND',
            message: 'Dependency not found',
            taskIds: [this.sourceId, this.targetId]
          }
        ]
      };
    }
    this.removedType = target.dependencyTypes?.[this.sourceId];
    target.dependencies = target.dependencies.filter((d) => d !== this.sourceId);
    if (target.dependencyTypes) {
      delete target.dependencyTypes[this.sourceId];
    }
    return { ok: true, items: [] };
  }

  undo(ctx: CommandContext): void {
    const target = ctx.tasks.get(this.targetId);
    if (target) {
      if (!target.dependencies) target.dependencies = [];
      target.dependencies.push(this.sourceId);
      if (this.removedType) {
        if (!target.dependencyTypes) target.dependencyTypes = {};
        target.dependencyTypes[this.sourceId] = this.removedType;
      }
    }
  }

  toPatch(): PatchRecord {
    return {
      commandId: this.id,
      commandType: this.type,
      timestamp: this.timestamp,
      before: { sourceId: this.sourceId, targetId: this.targetId },
      after: { removed: true }
    };
  }
}

// ========== ChangeDependencyTypeCommand ==========

export interface ChangeDependencyTypePayload {
  sourceId: TaskId;
  targetId: TaskId;
  newType: DependencyType;
}

export class ChangeDependencyTypeCommand extends BaseCommand {
  private sourceId: TaskId;
  private targetId: TaskId;
  private newType: DependencyType;
  private prevType: DependencyType | undefined;

  constructor(payload: ChangeDependencyTypePayload) {
    super('ChangeDependencyType');
    this.sourceId = payload.sourceId;
    this.targetId = payload.targetId;
    this.newType = payload.newType;
  }

  execute(ctx: CommandContext): ValidationResult {
    const target = ctx.tasks.get(this.targetId);
    if (!target) {
      return {
        ok: false,
        items: [
          {
            severity: 'error',
            code: 'TASK_NOT_FOUND',
            message: `Target task ${this.targetId} not found`,
            taskIds: [this.targetId]
          }
        ]
      };
    }
    if (!target.dependencies?.includes(this.sourceId)) {
      return {
        ok: false,
        items: [
          {
            severity: 'error',
            code: 'DEP_NOT_FOUND',
            message: 'Dependency not found',
            taskIds: [this.sourceId, this.targetId]
          }
        ]
      };
    }
    this.prevType = target.dependencyTypes?.[this.sourceId];
    if (!target.dependencyTypes) target.dependencyTypes = {};
    target.dependencyTypes[this.sourceId] = this.newType;
    return { ok: true, items: [] };
  }

  undo(ctx: CommandContext): void {
    const target = ctx.tasks.get(this.targetId);
    if (target?.dependencyTypes) {
      if (this.prevType != null) {
        target.dependencyTypes[this.sourceId] = this.prevType;
      } else {
        delete target.dependencyTypes[this.sourceId];
      }
    }
  }

  toPatch(): PatchRecord {
    return {
      commandId: this.id,
      commandType: this.type,
      timestamp: this.timestamp,
      before: { sourceId: this.sourceId, targetId: this.targetId, type: this.prevType },
      after: { sourceId: this.sourceId, targetId: this.targetId, type: this.newType }
    };
  }
}

// ========== SetDependencyLagCommand ==========

export interface SetDependencyLagPayload {
  sourceId: TaskId;
  targetId: TaskId;
  lag: number;
}

export class SetDependencyLagCommand extends BaseCommand {
  private sourceId: TaskId;
  private targetId: TaskId;
  private lag: number;
  private prevLag: number | undefined;

  constructor(payload: SetDependencyLagPayload) {
    super('SetDependencyLag');
    this.sourceId = payload.sourceId;
    this.targetId = payload.targetId;
    this.lag = payload.lag;
  }

  execute(ctx: CommandContext): ValidationResult {
    const target = ctx.tasks.get(this.targetId);
    if (!target) {
      return {
        ok: false,
        items: [
          {
            severity: 'error',
            code: 'TASK_NOT_FOUND',
            message: `Target task ${this.targetId} not found`,
            taskIds: [this.targetId]
          }
        ]
      };
    }
    if (!target.dependencies?.includes(this.sourceId)) {
      return {
        ok: false,
        items: [
          {
            severity: 'error',
            code: 'DEP_NOT_FOUND',
            message: 'Dependency not found',
            taskIds: [this.sourceId, this.targetId]
          }
        ]
      };
    }
    this.prevLag = target.dependencyLags?.[this.sourceId];
    if (!target.dependencyLags) target.dependencyLags = {};
    target.dependencyLags[this.sourceId] = this.lag;
    return { ok: true, items: [] };
  }

  undo(ctx: CommandContext): void {
    const target = ctx.tasks.get(this.targetId);
    if (target?.dependencyLags) {
      if (this.prevLag != null) {
        target.dependencyLags[this.sourceId] = this.prevLag;
      } else {
        delete target.dependencyLags[this.sourceId];
      }
    }
  }

  toPatch(): PatchRecord {
    return {
      commandId: this.id,
      commandType: this.type,
      timestamp: this.timestamp,
      before: { sourceId: this.sourceId, targetId: this.targetId, lag: this.prevLag },
      after: { sourceId: this.sourceId, targetId: this.targetId, lag: this.lag }
    };
  }
}

// ========== BatchCommand ==========

export class BatchCommand extends BaseCommand {
  private children: Command[];
  private executedCount = 0;

  constructor(children: Command[]) {
    super('BatchCommand');
    this.children = children;
  }

  execute(ctx: CommandContext): ValidationResult {
    const allItems: ValidationItem[] = [];

    for (const child of this.children) {
      const result = child.execute(ctx);
      allItems.push(...result.items);
      if (!result.ok) {
        this.rollbackExecuted(ctx);
        return { ok: false, items: allItems };
      }
      this.executedCount++;
    }

    return { ok: true, items: allItems };
  }

  undo(ctx: CommandContext): void {
    for (let i = this.executedCount - 1; i >= 0; i--) {
      this.children[i].undo(ctx);
    }
  }

  toPatch(): PatchRecord {
    return {
      commandId: this.id,
      commandType: this.type,
      timestamp: this.timestamp,
      before: { childCount: this.children.length },
      after: { executedCount: this.executedCount }
    };
  }

  private rollbackExecuted(ctx: CommandContext): void {
    for (let i = this.executedCount - 1; i >= 0; i--) {
      this.children[i].undo(ctx);
    }
  }
}
