export function getCanvasX(clientX: number, scrollContainer: HTMLElement) {
  const rect = scrollContainer.getBoundingClientRect();
  return clientX - rect.left + scrollContainer.scrollLeft;
}
