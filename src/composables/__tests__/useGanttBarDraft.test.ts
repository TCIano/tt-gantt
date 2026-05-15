import { describe, it, expect } from 'vitest'
import { computed } from 'vue'
import { useGanttBarDraft } from '../useGanttBarDraft'

function makeOptions(overrides: Record<string, any> = {}) {
  const baseLeftPx = computed(() => overrides.baseLeftPx ?? 100)
  const baseWidthPx = computed(() => overrides.baseWidthPx ?? 200)
  const minWidthPx = computed(() => overrides.minWidthPx ?? 10)
  const pxPerDay = computed(() => overrides.pxPerDay ?? 44)
  const snapStepDays = computed(() => overrides.snapStepDays ?? 1)
  const taskStartDate = computed(() => overrides.taskStartDate ?? '2026-01-01')
  const taskEndDate = computed(() => overrides.taskEndDate ?? '2026-01-05')

  return { baseLeftPx, baseWidthPx, minWidthPx, pxPerDay, snapStepDays, taskStartDate, taskEndDate }
}

describe('useGanttBarDraft', () => {
  it('starts in idle mode', () => {
    const draft = useGanttBarDraft(makeOptions())
    expect(draft.mode.value).toBe('idle')
    expect(draft.isActive.value).toBe(false)
    expect(draft.isDragging.value).toBe(false)
    expect(draft.isResizing.value).toBe(false)
  })

  it('render positions match base when idle', () => {
    const draft = useGanttBarDraft(makeOptions({ baseLeftPx: 50, baseWidthPx: 100 }))
    expect(draft.renderLeftPx.value).toBe(50)
    expect(draft.renderWidthPx.value).toBe(100)
  })

  describe('drag', () => {
    it('enters drag mode on startDrag', () => {
      const draft = useGanttBarDraft(makeOptions())
      draft.startDrag(200, 250)
      expect(draft.mode.value).toBe('drag')
      expect(draft.isDragging.value).toBe(true)
      expect(draft.isActive.value).toBe(true)
    })

    it('updates draftLeftPx on canvas move', () => {
      const draft = useGanttBarDraft(makeOptions({ baseLeftPx: 100 }))
      draft.startDrag(200, 250)
      // dragAnchorOffsetPx = 250 - 100 = 150
      draft.updateFromCanvas(300, 350)
      // draftLeftPx = 350 - 150 = 200
      expect(draft.draftLeftPx.value).toBe(200)
      expect(draft.draftWidthPx.value).toBe(200) // width unchanged
    })

    it('draftStartDate and draftEndDate shift by dragDeltaDays', () => {
      const draft = useGanttBarDraft(makeOptions({
        baseLeftPx: 100,
        pxPerDay: 44,
        taskStartDate: '2026-01-01',
        taskEndDate: '2026-01-05'
      }))
      draft.startDrag(200, 250)
      // dragAnchorOffsetPx = 150
      // move right by 88px (2 days)
      draft.updateFromCanvas(200 + 88, 250 + 88)
      // draftLeftPx = 338 - 150 = 188, delta = 88
      // snapped delta days = round(88 / 44) = 2
      expect(draft.draftStartDate.value).toBe('2026-01-03')
      expect(draft.draftEndDate.value).toBe('2026-01-07')
    })

    it('finish returns draft state and resets', () => {
      const draft = useGanttBarDraft(makeOptions())
      draft.startDrag(200, 250)
      draft.updateFromCanvas(300, 350)
      const result = draft.finish()
      expect(result.mode).toBe('drag')
      expect(result.maxPointerDeltaPx).toBeGreaterThanOrEqual(100)
      expect(draft.mode.value).toBe('idle')
    })

    it('cancel resets to idle', () => {
      const draft = useGanttBarDraft(makeOptions({ baseLeftPx: 100, baseWidthPx: 200 }))
      draft.startDrag(200, 250)
      draft.updateFromCanvas(300, 350)
      draft.cancel()
      expect(draft.mode.value).toBe('idle')
      expect(draft.renderLeftPx.value).toBe(100)
      expect(draft.renderWidthPx.value).toBe(200)
    })

    it('updateFromCanvas is no-op in idle mode', () => {
      const draft = useGanttBarDraft(makeOptions({ baseLeftPx: 100 }))
      draft.updateFromCanvas(999, 999)
      expect(draft.draftLeftPx.value).toBe(0) // never set
    })

    it('tracks maxPointerDeltaPx during drag', () => {
      const draft = useGanttBarDraft(makeOptions({ baseLeftPx: 100 }))
      draft.startDrag(200, 250)
      draft.updateFromCanvas(220, 270)
      expect(draft.finish().maxPointerDeltaPx).toBeGreaterThanOrEqual(20)
    })
  })

  describe('resize-left', () => {
    it('enters resize-left mode', () => {
      const draft = useGanttBarDraft(makeOptions())
      draft.startResize('left', 200, 250)
      expect(draft.mode.value).toBe('resize-left')
      expect(draft.isResizing.value).toBe(true)
    })

    it('resize left shrinks from left edge', () => {
      const draft = useGanttBarDraft(makeOptions({ baseLeftPx: 100, baseWidthPx: 200, minWidthPx: 10 }))
      draft.startResize('left', 100, 150)
      // drag to the right (canvasX = 200), left moves right, width shrinks
      draft.updateFromCanvas(150, 200)
      expect(draft.draftLeftPx.value).toBe(200)
      expect(draft.draftWidthPx.value).toBe(100) // 100+200-200 = 100
    })

    it('resize-left clamps at minWidthPx', () => {
      const draft = useGanttBarDraft(makeOptions({ baseLeftPx: 100, baseWidthPx: 50, minWidthPx: 10 }))
      draft.startResize('left', 100, 150)
      // maxLeftPx = 100 + 50 - 10 = 140, even if canvasX is 200
      draft.updateFromCanvas(150, 500)
      expect(draft.draftLeftPx.value).toBe(140)
      expect(draft.draftWidthPx.value).toBe(10)
    })
  })

  describe('resize-right', () => {
    it('enters resize-right mode', () => {
      const draft = useGanttBarDraft(makeOptions())
      draft.startResize('right', 200, 250)
      expect(draft.mode.value).toBe('resize-right')
      expect(draft.isResizing.value).toBe(true)
    })

    it('resize right extends width', () => {
      const draft = useGanttBarDraft(makeOptions({ baseLeftPx: 100, baseWidthPx: 200, minWidthPx: 10 }))
      draft.startResize('right', 300, 350)
      draft.updateFromCanvas(400, 500)
      // nextWidthPx = max(10, 500 - 100) = 400
      expect(draft.draftLeftPx.value).toBe(100) // unchanged
      expect(draft.draftWidthPx.value).toBe(400)
    })

    it('resize-right clamps at minWidthPx', () => {
      const draft = useGanttBarDraft(makeOptions({ baseLeftPx: 100, baseWidthPx: 200, minWidthPx: 10 }))
      draft.startResize('right', 300, 350)
      // shrink to left: canvasX - originLeft = 50 - 100 = -50, clamped to minWidthPx = 10
      draft.updateFromCanvas(0, 50)
      expect(draft.draftLeftPx.value).toBe(100)
      expect(draft.draftWidthPx.value).toBe(10)
    })
  })

  describe('timeline shift', () => {
    it('applyTimelineShift updates origin and draft', () => {
      const draft = useGanttBarDraft(makeOptions({ baseLeftPx: 100 }))
      draft.startDrag(200, 250)
      draft.applyTimelineShift(50)
      // originLeftPx = 100 + 50 = 150, draftLeftPx = 100 + 50 = 150
      expect(draft.draftLeftPx.value).toBe(150)
    })

    it('applyTimelineShift is no-op when idle', () => {
      const draft = useGanttBarDraft(makeOptions())
      draft.applyTimelineShift(50)
      expect(draft.draftLeftPx.value).toBe(0)
    })

    it('applyTimelineShift is no-op when shiftPx is 0', () => {
      const draft = useGanttBarDraft(makeOptions({ baseLeftPx: 100 }))
      draft.startDrag(200, 250)
      draft.applyTimelineShift(0)
      expect(draft.draftLeftPx.value).toBe(100)
    })
  })

  describe('snap step', () => {
    it('quantizes to snap step (week)', () => {
      const draft = useGanttBarDraft(makeOptions({
        baseLeftPx: 100,
        pxPerDay: 44,
        snapStepDays: 7,
        taskStartDate: '2026-01-01',
        taskEndDate: '2026-01-05'
      }))
      draft.startDrag(200, 250)
      // move by 100px = ~2.27 days, snap to 0 days (nearest multiple of 7)
      draft.updateFromCanvas(300, 350)
      // Since snapStepDays=7: round(2.27/7)*7 = 0
      expect(draft.draftStartDate.value).toBe('2026-01-01')
      expect(draft.draftEndDate.value).toBe('2026-01-05')
    })

    it('quantizes to snap step (month)', () => {
      const draft = useGanttBarDraft(makeOptions({
        baseLeftPx: 100,
        pxPerDay: 44,
        snapStepDays: 30,
        taskStartDate: '2026-01-01',
        taskEndDate: '2026-01-05'
      }))
      draft.startDrag(200, 250)
      // move by 500px = ~11.36 days, snap to 0 (nearest multiple of 30)
      draft.updateFromCanvas(700, 750)
      expect(draft.draftStartDate.value).toBe('2026-01-01')
    })
  })

  describe('resize draft dates', () => {
    it('resize-left updates draftStartDate', () => {
      const draft = useGanttBarDraft(makeOptions({
        baseLeftPx: 100,
        baseWidthPx: 200,
        pxPerDay: 44,
        taskStartDate: '2026-01-10',
        taskEndDate: '2026-01-15'
      }))
      // start with pointer at the left edge (canvasX = originLeftPx = 100)
      draft.startResize('left', 50, 100)
      // move left by 44px = 1 day earlier
      draft.updateFromCanvas(6, 56)
      // draftLeftPx = min(56, 290) = 56, resizeLeftDays = round((56-100)/44) = -1
      expect(draft.draftStartDate.value).toBe('2026-01-09')
      expect(draft.draftEndDate.value).toBe('2026-01-15')
    })

    it('resize-right updates draftEndDate', () => {
      const draft = useGanttBarDraft(makeOptions({
        baseLeftPx: 100,
        baseWidthPx: 200,
        pxPerDay: 44,
        taskStartDate: '2026-01-10',
        taskEndDate: '2026-01-15'
      }))
      // start with pointer at canvasX = originLeftPx + originWidthPx = 300
      draft.startResize('right', 250, 300)
      // extend right by 88px: canvasX = 300 + 88 = 388, width = 388 - 100 = 288
      // resizeRightDays = round((288 - 200) / 44) = round(88/44) = 2
      draft.updateFromCanvas(338, 388)
      expect(draft.draftStartDate.value).toBe('2026-01-10')
      expect(draft.draftEndDate.value).toBe('2026-01-17')
    })
  })
})
