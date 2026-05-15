export interface DependencyNodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DependencyInput {
  sourceId: string | number;
  targetId: string | number;
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lag: number;
}

export interface DependencyPath {
  id: string;
  sourceId: string | number;
  targetId: string | number;
  path: string;
  arrow: string;
}

export function buildDependencyPaths(
  taskPositions: Map<string | number, DependencyNodePosition>,
  dependencies: DependencyInput[],
  columnWidth: number
): DependencyPath[] {
  const links: DependencyPath[] = [];

  for (const dep of dependencies) {
    const fromNode = taskPositions.get(dep.sourceId);
    const toNode = taskPositions.get(dep.targetId);
    if (!fromNode || !toNode) continue;

    const fromLeft = fromNode.x;
    const fromRight = fromNode.x + fromNode.width;
    const fromMidY = fromNode.y + fromNode.height / 2;
    const toLeft = toNode.x;
    const toRight = toNode.x + toNode.width;
    const toMidY = toNode.y + toNode.height / 2;
    const lagPx = dep.lag * columnWidth;

    let startX: number;
    let endX: number;
    const startY = fromMidY;
    const endY = toMidY;

    switch (dep.type) {
      case 'SS':
        startX = fromLeft + lagPx;
        endX = toLeft;
        break;
      case 'FF':
        startX = fromRight;
        endX = toRight + lagPx;
        break;
      case 'SF':
        startX = fromLeft + lagPx;
        endX = toRight;
        break;
      case 'FS':
      default:
        startX = fromRight + lagPx;
        endX = toLeft;
        break;
    }

    const diffX = endX - startX;

    let path: string;
    if (diffX > 20) {
      path = `M ${startX},${startY} C ${startX + diffX / 2},${startY} ${endX - diffX / 2},${endY} ${endX},${endY}`;
    } else {
      path = `M ${startX},${startY} L ${startX + 10},${startY} C ${startX + 20},${startY} ${startX + 20},${startY + 15} ${startX + 10},${startY + 15} L ${endX - 10},${startY + 15} C ${endX - 20},${startY + 15} ${endX - 20},${endY} ${endX - 10},${endY} L ${endX},${endY}`;
    }

    const arrow = `${endX},${endY} ${endX - 6},${endY - 4} ${endX - 6},${endY + 4}`;

    links.push({
      id: `${dep.sourceId}-${dep.targetId}`,
      sourceId: dep.sourceId,
      targetId: dep.targetId,
      path,
      arrow
    });
  }

  return links;
}
