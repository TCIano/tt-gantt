import type {GanttTask, FlatGanttTask} from '../types/gantt';

export function flattenTasks(
  tasks: GanttTask[],
  level: number = 0,
  parentId?: string | number,
  isVisible: boolean = true
): FlatGanttTask[] {
  const result: FlatGanttTask[] = [];

  for (const task of tasks) {
    const hasChildren = Array.isArray(task.children) && task.children.length > 0;
    
    // 创建不包含 children 属性的扁平化任务
    const { children, ...restTask } = task;
    
    const flatTask: FlatGanttTask = {
      ...restTask,
      _level: level,
      _hasChildren: hasChildren,
      _parent: parentId,
      _visible: isVisible
    };
    
    result.push(flatTask);

    if (hasChildren && children) {
      // 如果当前节点可见且处于展开状态，则其子节点也可见
      // 如果没有显式设置 expanded 为 false，我们默认其为展开状态 (true)
      const childrenVisible = isVisible && task.expanded !== false;
      
      const flattenedChildren = flattenTasks(
        children,
        level + 1,
        task.id,
        childrenVisible
      );
      
      result.push(...flattenedChildren);
    }
  }

  return result;
}
