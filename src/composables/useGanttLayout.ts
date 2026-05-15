import { computed, type ComputedRef, type Ref } from 'vue'
import { parseLocalDate } from '../utils/date'
import {
  computeDateRange,
  computeVirtualScroll,
  computeColumnScroll,
  computeActiveDates
} from '../core/layout'
import type { DateRange, VirtualScrollIndices, ColumnScrollIndices } from '../core/layout'
import type { FlatGanttTask, GanttScale } from '../types/gantt'

export interface LayoutInputs {
  flatTasks: ComputedRef<FlatGanttTask[]>;
  resourceRows: ComputedRef<{ id: string }[]>;
  scale: Ref<GanttScale>;
  scrollTop: Ref<number>;
  scrollLeft: Ref<number>;
  viewportHeight: Ref<number>;
  viewportWidth: Ref<number>;
  rowHeight: Ref<number>;
  columnWidth: Ref<number>;
  weekStartsOn: Ref<number>;
  hideHolidays: Ref<boolean>;
  manualStartDate: Ref<Date | null>;
  manualEndDate: Ref<Date | null>;
  isResourceMode: ComputedRef<boolean>;
  isNonWorkingDay: (date: Date) => boolean;
  bufferSize?: number;
}

export function useGanttLayout(inputs: LayoutInputs) {
  const bufferSize = inputs.bufferSize ?? 2

  const computedDateRange = computed<DateRange>(() => {
    const tasks = inputs.flatTasks.value.map(t => ({
      startDate: String(t.startDate),
      endDate: String(t.endDate)
    }))
    return computeDateRange(tasks, inputs.scale.value, {
      weekStartsOn: inputs.weekStartsOn.value,
      manualStartDate: inputs.manualStartDate.value,
      manualEndDate: inputs.manualEndDate.value,
      paddingDays: 7
    })
  })

  const startDate = computed(() => computedDateRange.value.startDate)
  const endDate = computed(() => computedDateRange.value.endDate)

  const totalHeight = computed(() => {
    if (inputs.isResourceMode.value) return inputs.resourceRows.value.length * inputs.rowHeight.value
    return inputs.flatTasks.value.filter(t => t._visible).length * inputs.rowHeight.value
  })

  const rowCount = computed(() => {
    if (inputs.isResourceMode.value) return inputs.resourceRows.value.length
    return inputs.flatTasks.value.filter(t => t._visible).length
  })

  const virtualScroll = computed<VirtualScrollIndices>(() =>
    computeVirtualScroll(
      inputs.scrollTop.value,
      inputs.viewportHeight.value,
      inputs.rowHeight.value,
      rowCount.value,
      bufferSize
    )
  )

  const columnScroll = computed<ColumnScrollIndices>(() =>
    computeColumnScroll(
      inputs.scrollLeft.value,
      inputs.viewportWidth.value,
      inputs.columnWidth.value,
      totalCols.value,
      bufferSize
    )
  )

  const totalWidth = computed(() => totalCols.value * inputs.columnWidth.value)

  const activeDates = computed<Date[]>(() =>
    computeActiveDates(startDate.value, endDate.value, inputs.scale.value, {
      hideHolidays: inputs.hideHolidays.value,
      isNonWorkingDay: inputs.isNonWorkingDay
    })
  )

  const totalCols = computed(() => activeDates.value.length)

  const visibleDates = computed(() =>
    activeDates.value.slice(columnScroll.value.renderStartColIndex, columnScroll.value.renderEndColIndex)
  )

  const getVisibleDayIndex = (date: Date): number => {
    const d = parseLocalDate(date)
    const scale = inputs.scale.value
    const hide = inputs.hideHolidays.value
    
    if (scale !== 'day' || !hide) {
      if (scale === 'week') {
        const start = startDate.value
        const diff = (d.getTime() - start.getTime()) / 86400000
        return Math.floor(diff / 7)
      }
      if (scale === 'month') {
        const start = startDate.value
        return (d.getFullYear() - start.getFullYear()) * 12 + (d.getMonth() - start.getMonth())
      }
      const diff = (d.getTime() - startDate.value.getTime()) / 86400000
      return Math.floor(diff)
    }

    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const index = activeDates.value.findIndex(ad => {
      const adStr = `${ad.getFullYear()}-${String(ad.getMonth() + 1).padStart(2, '0')}-${String(ad.getDate()).padStart(2, '0')}`
      return adStr >= dateStr
    })
    return index === -1 ? activeDates.value.length : index
  }

  const getDateByVisibleIndex = (index: number): Date => {
    const scale = inputs.scale.value
    const hide = inputs.hideHolidays.value
    if (scale !== 'day' || !hide) {
      if (scale === 'week') {
        const d = new Date(startDate.value)
        d.setDate(d.getDate() + index * 7)
        return d
      }
      if (scale === 'month') {
        const d = new Date(startDate.value)
        d.setMonth(d.getMonth() + index)
        return d
      }
      const d = new Date(startDate.value)
      d.setDate(d.getDate() + index)
      return d
    }
    if (index < 0) return activeDates.value[0] || startDate.value
    if (index >= activeDates.value.length) return activeDates.value[activeDates.value.length - 1] || endDate.value
    return activeDates.value[index]
  }

  const getVisibleDaysCount = (start: Date, end: Date): number => {
    const s = parseLocalDate(start)
    const e = parseLocalDate(end)
    const scale = inputs.scale.value
    const hide = inputs.hideHolidays.value
    if (scale !== 'day' || !hide) {
      return Math.round((e.getTime() - s.getTime()) / 86400000) + 1
    }
    const sStr = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`
    const eStr = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`
    return activeDates.value.filter(ad => {
      const adStr = `${ad.getFullYear()}-${String(ad.getMonth() + 1).padStart(2, '0')}-${String(ad.getDate()).padStart(2, '0')}`
      return adStr >= sStr && adStr <= eStr
    }).length
  }

  return {
    computedDateRange,
    startDate,
    endDate,
    totalHeight,
    rowCount,
    virtualScroll,
    columnScroll,
    activeDates,
    totalCols,
    totalWidth,
    visibleDates,
    offsetX: computed(() => columnScroll.value.offsetX),
    offsetY: computed(() => virtualScroll.value.offsetY),
    getVisibleDayIndex,
    getDateByVisibleIndex,
    getVisibleDaysCount
  }
}
