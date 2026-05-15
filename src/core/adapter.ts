import cloneDeep from 'lodash.clonedeep';
import type {
  DependencyType,
  EngineState,
  GanttDTO,
  GanttTaskDTO,
  GanttTaskSnapshot,
  ResourceDTO,
  ResourceNode,
  Scenario,
  ScenarioDTO,
  TaskId
} from './types';

export function fromDTO(dto: GanttDTO): EngineState {
  const tasks = dto.tasks.map(toSnapshot);
  const resources = (dto.resources ?? []).map(toResource);
  const scenarios = (dto.scenarios ?? []).map(toScenario);

  return {
    tasks,
    resources,
    scenarios,
    activeScenarioId: scenarios.find((s) => s.isBaseline)?.id ?? null,
    historyDepth: 0,
    futureDepth: 0
  };
}

export function toDTO(state: EngineState): GanttDTO {
  return {
    tasks: state.tasks.map(fromSnapshot),
    resources: state.resources.map(fromResource),
    scenarios: state.scenarios.map(fromScenario)
  };
}

function toSnapshot(task: GanttTaskDTO): GanttTaskSnapshot {
  return {
    id: task.id,
    name: task.name,
    startDate: task.startDate,
    endDate: task.endDate,
    resourceId: task.resourceId,
    dependencies: task.dependencies ? [...task.dependencies] : undefined,
    dependencyTypes: task.dependencyTypes
      ? ({ ...task.dependencyTypes } as Record<TaskId, DependencyType>)
      : undefined,
    status: task.status,
    progress: task.progress,
    type: task.type,
    readOnly: task.readOnly,
    disabled: task.disabled
  };
}

function fromSnapshot(task: GanttTaskSnapshot): GanttTaskDTO {
  return {
    id: task.id,
    name: task.name,
    startDate: task.startDate,
    endDate: task.endDate,
    resourceId: task.resourceId,
    dependencies: task.dependencies,
    dependencyTypes: task.dependencyTypes as Record<string | number, DependencyType> | undefined,
    status: task.status,
    progress: task.progress,
    type: task.type,
    readOnly: task.readOnly,
    disabled: task.disabled
  };
}

function toResource(dto: ResourceDTO): ResourceNode {
  const node: ResourceNode = {
    id: dto.id,
    name: dto.name,
    type: dto.type,
    capacity: dto.capacity ? cloneDeep(dto.capacity) : undefined,
    calendar: dto.calendar ? cloneDeep(dto.calendar) : undefined
  };
  if (dto.children && dto.children.length > 0) {
    node.children = dto.children.map(toResource);
  }
  return node;
}

function fromResource(node: ResourceNode): ResourceDTO {
  const dto: ResourceDTO = {
    id: node.id,
    name: node.name,
    type: node.type,
    capacity: node.capacity ? cloneDeep(node.capacity) : undefined,
    calendar: node.calendar ? cloneDeep(node.calendar) : undefined
  };
  if (node.children && node.children.length > 0) {
    dto.children = node.children.map(fromResource);
  }
  return dto;
}

function toScenario(dto: ScenarioDTO): Scenario {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    createdAt: dto.createdAt,
    isBaseline: dto.isBaseline,
    patches: dto.patches ? [...dto.patches] : []
  };
}

function fromScenario(scenario: Scenario): ScenarioDTO {
  return {
    id: scenario.id,
    name: scenario.name,
    description: scenario.description,
    createdAt: scenario.createdAt,
    isBaseline: scenario.isBaseline,
    patches: scenario.patches ? [...scenario.patches] : []
  };
}
