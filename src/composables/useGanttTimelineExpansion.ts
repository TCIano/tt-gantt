import { nextTick, onUnmounted, type ComputedRef, type Ref } from 'vue';
import type { GanttScale } from '../types/gantt';

interface UseGanttTimelineExpansionOptions {
  columnWidth: ComputedRef<number>;
  scale: Ref<GanttScale>;
  prependTimeline: (days: number) => void;
  appendTimeline: (days: number) => void;
  setScrollLeft?: (val: number) => void;
}

interface SyncOptions {
  container: HTMLElement;
  clientX: number;
  onViewportChange: (clientX: number, timelineShiftPx?: number) => void;
}

const EDGE_TRIGGER_PX = 60;
const PRE_EXPAND_THRESHOLD_PX = 24;
const AUTO_SCROLL_SPEED = 10;

export function useGanttTimelineExpansion(options: UseGanttTimelineExpansionOptions) {
  let autoScrollInterval: number | null = null;
  let lastClientX = 0;
  let isExpanding = false;
  let lifecycleToken = 0;
  let activeContainer: HTMLElement | null = null;
  let activeViewportCallback: ((clientX: number) => void) | null = null;

  const getExpansionDays = () => {
    if (options.scale.value === 'week') return 7;
    if (options.scale.value === 'month') return 30;
    return 7;
  };

  const getScrollSpeed = (container: HTMLElement, clientX: number) => {
    const rect = container.getBoundingClientRect();

    if (clientX > rect.right - EDGE_TRIGGER_PX) return AUTO_SCROLL_SPEED;
    if (clientX < rect.left + EDGE_TRIGGER_PX) return -AUTO_SCROLL_SPEED;
    return 0;
  };

  const maybeExpand = (container: HTMLElement, scrollSpeed: number, onViewportChange: (clientX: number, timelineShiftPx?: number) => void) => {
    if (isExpanding || scrollSpeed === 0) return false;

    const remainingLeftPx = container.scrollLeft;
    const remainingRightPx = container.scrollWidth - container.clientWidth - container.scrollLeft;

    if (scrollSpeed < 0 && remainingLeftPx > PRE_EXPAND_THRESHOLD_PX) return false;
    if (scrollSpeed > 0 && remainingRightPx > PRE_EXPAND_THRESHOLD_PX) return false;

    isExpanding = true;
    const currentToken = lifecycleToken;

    if (scrollSpeed < 0) {
      const previousScrollLeft = container.scrollLeft;
      const previousScrollWidth = container.scrollWidth;
      options.prependTimeline(getExpansionDays());

      nextTick(() => {
        if (currentToken !== lifecycleToken) return;
        const newScrollWidth = container.scrollWidth;
        const actualWidthDiff = newScrollWidth - previousScrollWidth;
        
        const newScrollLeft = previousScrollLeft + actualWidthDiff;
        container.scrollLeft = newScrollLeft;
        if (options.setScrollLeft) {
          options.setScrollLeft(newScrollLeft);
        }
        isExpanding = false;
        onViewportChange(lastClientX, actualWidthDiff);
      });
      return true;
    }

    options.appendTimeline(getExpansionDays());

    nextTick(() => {
      if (currentToken !== lifecycleToken) return;
      isExpanding = false;
      onViewportChange(lastClientX);
    });
    return true;
  };

  const stopAutoScroll = () => {
    lifecycleToken += 1;
    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      autoScrollInterval = null;
    }
    isExpanding = false;
    activeContainer = null;
    activeViewportCallback = null;
  };

  const runAutoScrollTick = () => {
    if (!activeContainer || !activeViewportCallback) return;

    const scrollSpeed = getScrollSpeed(activeContainer, lastClientX);
    if (scrollSpeed === 0) {
      stopAutoScroll();
      return;
    }

    maybeExpand(activeContainer, scrollSpeed, activeViewportCallback);

    const previousScrollLeft = activeContainer.scrollLeft;
    activeContainer.scrollLeft += scrollSpeed;
    const actualScroll = activeContainer.scrollLeft - previousScrollLeft;

    if (actualScroll === 0) {
      maybeExpand(activeContainer, scrollSpeed, activeViewportCallback);
      return;
    }

    activeViewportCallback(lastClientX);
  };

  const syncPointer = ({ container, clientX, onViewportChange }: SyncOptions) => {
    lastClientX = clientX;
    activeContainer = container;
    activeViewportCallback = onViewportChange;

    const scrollSpeed = getScrollSpeed(container, clientX);
    if (scrollSpeed === 0) {
      stopAutoScroll();
      return;
    }

    maybeExpand(container, scrollSpeed, onViewportChange);

    if (autoScrollInterval) return;
    autoScrollInterval = window.setInterval(runAutoScrollTick, 16);
  };

  onUnmounted(() => {
    stopAutoScroll();
  });

  return {
    syncPointer,
    stopAutoScroll
  };
}
