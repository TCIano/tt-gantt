import { onMounted, onUnmounted } from 'vue'
import type { GanttEventBus, GanttEventPayloads } from './useGanttPlugin'

type EventHandlerMap = {
  [K in keyof GanttEventPayloads]?: (payload: GanttEventPayloads[K]) => void
}

export function useDefaultEventHandlers(
  eventBus: GanttEventBus,
  handlers: EventHandlerMap
) {
  const entries = Object.entries(handlers) as [keyof GanttEventPayloads, Function][]

  onMounted(() => {
    for (const [event, handler] of entries) {
      eventBus.on(event, handler as any)
    }
  })

  onUnmounted(() => {
    for (const [event, handler] of entries) {
      eventBus.off(event, handler as any)
    }
  })
}
