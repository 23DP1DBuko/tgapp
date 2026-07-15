import { useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent } from 'react'

import {
  createGiveaway,
  deleteGiveaway,
  drawGiveaway,
  listGiveaways,
  updateGiveaway,
} from '../../lib/firebase/giveaways'
import {
  createTask,
  deleteTask,
  listTasks,
  updateTask,
} from '../../lib/firebase/tasks'
import { uploadGiveawayImage } from '../../lib/firebase/storage'
import { triggerHapticFeedback } from '../../lib/telegram/webApp'
import { ProductPickerModal } from './ProductPickerModal'
import type {
  Giveaway,
  GiveawayInput,
  RewardTab,
  Task,
  TaskInput,
} from '../../types/rewards'

type RewardsAdminPanelProps = {
  initData: string
}

// ── Helper types for the multi-product prize list ──
type PrizeFormItem = {
  productId: string
  productName: string
  productImage: string
}

// ── Helper types for the task picker ──
type SelectedTaskFormItem = {
  taskId: string
  taskTitle: string
  ticketsGranted: number
}

// Local form type that extends GiveawayInput with extra UI-only fields
interface GiveawayFormState extends GiveawayInput {
  enteredCount: number
}

const EMPTY_GIVEAWAY_FORM: GiveawayFormState = {
  title: '',
  description: '',
  imageUrl: '',
  status: 'draft',
  startAt: null,
  endAt: '',
  prizes: [],
  accessLevel: 'public',
  entryTasks: [],
  baseEntryTickets: 1,
  taskIds: [],
  taskTickets: {},
  enteredCount: 0,
}

function giveawayToForm(g: Giveaway): GiveawayFormState {
  return {
    title: g.title,
    description: g.description,
    imageUrl: g.imageUrl ?? '',
    status: g.status,
    startAt: g.startAt,
    endAt: g.endAt,
    prizes: g.prizes.map((p) => ({
      productId: p.productId,
      place: p.place,
    })),
    accessLevel: g.accessLevel,
    entryTasks: g.entryTasks.map((t) => ({
      type: t.type,
      label: t.label,
      ticketsGranted: t.ticketsGranted,
      verifyMethod: t.verifyMethod,
      metadata: t.metadata,
    })),
    baseEntryTickets: g.baseEntryTickets,
    taskIds: g.taskIds ?? [],
    taskTickets: g.taskTickets ?? {},
    enteredCount: g.enteredCount,
  }
}

function formToGiveawayInput(form: GiveawayFormState): GiveawayInput {
  return {
    title: form.title,
    description: form.description,
    imageUrl: form.imageUrl,
    status: form.status,
    startAt: form.startAt,
    endAt: form.endAt,
    prizes: form.prizes,
    accessLevel: form.accessLevel,
    entryTasks: form.entryTasks,
    baseEntryTickets: form.baseEntryTickets,
    taskIds: form.taskIds,
    taskTickets: form.taskTickets,
  }
}

const EMPTY_TASK: TaskInput = {
  title: '',
  rewardType: 'coupon',
  rewardValue: '',
  status: 'active',
  sortOrder: 0,
  actionUrl: '',
  actionLabel: '',
}

export function RewardsAdminPanel({ initData }: RewardsAdminPanelProps) {
  const [tab, setTab] = useState<RewardTab>('giveaways')
  const [giveaways, setGiveaways] = useState<Giveaway[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error'
    message: string
  } | null>(null)

  // Editing state for giveaways
  const [editingGiveaway, setEditingGiveaway] = useState<Giveaway | null>(null)
  const [giveawayForm, setGiveawayForm] = useState<GiveawayFormState>(EMPTY_GIVEAWAY_FORM)
  const [showGiveawayForm, setShowGiveawayForm] = useState(false)
  const [savingGiveaway, setSavingGiveaway] = useState(false)

  // Editing state for tasks
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [taskForm, setTaskForm] = useState<TaskInput>(EMPTY_TASK)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [savingTask, setSavingTask] = useState(false)

  // ── Multi-product prize list state ──
  const [prizeItems, setPrizeItems] = useState<PrizeFormItem[]>([])
  const dragItemRef = useRef<number | null>(null)

  // ── Task picker state ──
  const [selectedTaskItems, setSelectedTaskItems] = useState<SelectedTaskFormItem[]>([])

  // ── Image upload state ──
  const [uploadingImage, setUploadingImage] = useState(false)

  // Product picker modal & cached products
  const [showProductPicker, setShowProductPicker] = useState(false)
  const [cachedProducts, setCachedProducts] = useState<Array<{ id: string; name: string; image: string; category: string }> | null>(null)

  function handleProductSelect(product: { id: string; name: string; image: string }) {
    triggerHapticFeedback('light')
    // Add to prize list — duplicates allowed (admin can add same product for multiple places? no)
    if (prizeItems.length >= 10) return
    setPrizeItems((prev) => [...prev, { productId: product.id, productName: product.name, productImage: product.image }])
    // Auto-fill title from first product name
    if (prizeItems.length === 0 && !giveawayForm.title) {
      setGiveawayForm((prev) => ({ ...prev, title: product.name }))
    }
  }

  function handleRemovePrize(index: number) {
    triggerHapticFeedback('light')
    setPrizeItems((prev) => prev.filter((_, i) => i !== index))
  }

  function handleDragStart(index: number) {
    dragItemRef.current = index
  }

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault()
    const from = dragItemRef.current
    if (from === null || from === index) return
    setPrizeItems((prev) => {
      const copy = [...prev]
      const item = copy.splice(from, 1)[0]
      copy.splice(index, 0, item)
      return copy
    })
    dragItemRef.current = index
  }

  function handleDragEnd() {
    dragItemRef.current = null
  }

  function handleOpenProductPicker() {
    triggerHapticFeedback('light')
    setShowProductPicker(true)
  }

  // ── Image upload ──
  async function handleImageFileUpload(file: File) {
    triggerHapticFeedback('light')
    if (!file.type.startsWith('image/')) return
    setUploadingImage(true)
    try {
      const url = await uploadGiveawayImage(initData, file)
      setGiveawayForm((prev) => ({ ...prev, imageUrl: url }))
    } catch (err) {
      setFeedback({ tone: 'error', message: err instanceof Error ? err.message : 'Failed to upload image' })
    } finally {
      setUploadingImage(false)
    }
  }

  // ── Task selection toggle ──
  function handleToggleTask(task: Task) {
    triggerHapticFeedback('light')
    setSelectedTaskItems((prev) => {
      const exists = prev.find((t) => t.taskId === task.id)
      if (exists) return prev.filter((t) => t.taskId !== task.id)
      if (prev.length >= 2) return prev
      return [...prev, { taskId: task.id, taskTitle: task.title, ticketsGranted: 5 }]
    })
  }

  function handleTaskTicketChange(taskId: string, tickets: number) {
    setSelectedTaskItems((prev) =>
      prev.map((t) => (t.taskId === taskId ? { ...t, ticketsGranted: tickets } : t)),
    )
  }

  // Delete confirmations
  const [deleteConfirmGiveawayId, setDeleteConfirmGiveawayId] = useState<string | null>(null)
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState<string | null>(null)

  // Draw confirmation
  const [drawConfirmGiveawayId, setDrawConfirmGiveawayId] = useState<string | null>(null)
  const [drawingGiveawayId, setDrawingGiveawayId] = useState<string | null>(null)

  // ── Data loading ──

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [g, t] = await Promise.all([listGiveaways(50), listTasks(50)])
      setGiveaways(g)
      setTasks(t)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  // Pre-load the product list once so the modal opens instantly
  useEffect(() => {
    async function preloadProducts() {
      try {
        const { listAllProducts } = await import('../../lib/firebase/products')
        const products = await listAllProducts()
        setCachedProducts(
          products.map((p) => ({
            id: p.id,
            name: p.name,
            image: p.images[0] ?? '',
            category: p.category,
          })),
        )
      } catch {
        // Non-critical — modal will load on open
      }
    }
    void preloadProducts()
  }, [])

  const activeGiveaways = useMemo(
    () => giveaways.filter((g) => g.status === 'live'),
    [giveaways],
  )

  const completedGiveaways = useMemo(
    () => giveaways.filter((g) => g.status !== 'live'),
    [giveaways],
  )

  // ── Giveaway CRUD ──

  function handleOpenNewGiveaway() {
    triggerHapticFeedback('light')
    setEditingGiveaway(null)
    setGiveawayForm(EMPTY_GIVEAWAY_FORM)
    setPrizeItems([])
    setSelectedTaskItems([])
    setShowGiveawayForm(true)
  }

  function handleEditGiveaway(g: Giveaway) {
    triggerHapticFeedback('light')
    setEditingGiveaway(g)
    setGiveawayForm(giveawayToForm(g))

    // Populate prize items with hydrated product data from cached products
    const sortedPrizes = [...g.prizes].sort((a, b) => a.place - b.place)
    setPrizeItems(
      sortedPrizes.map((p) => ({
        productId: p.productId,
        // Hydrate from cached products if stored data is empty
        productName: p.productName || (cachedProducts?.find((cp) => cp.id === p.productId)?.name ?? ''),
        productImage: p.productImage || (cachedProducts?.find((cp) => cp.id === p.productId)?.image ?? ''),
      })),
    )

    // Populate selected task items from taskIds array (hydrated from tasks collection)
    const taskTickets = g.taskTickets ?? {}
    if (g.taskIds.length > 0) {
      setSelectedTaskItems(
        g.taskIds.map((taskId) => {
          const task = tasks.find((t) => t.id === taskId)
          return {
            taskId,
            taskTitle: task?.title ?? 'Unknown Task',
            ticketsGranted: taskTickets[taskId] ?? 5,
          }
        }),
      )
    } else {
      // Fallback for giveaways saved before taskIds schema was added
      setSelectedTaskItems(
        g.entryTasks.map((t) => ({
          taskId: t.id,
          taskTitle: t.label,
          ticketsGranted: t.ticketsGranted,
        })),
      )
    }

    setShowGiveawayForm(true)
  }

  function handleCloseGiveawayForm() {
    setShowGiveawayForm(false)
    setEditingGiveaway(null)
    setGiveawayForm(EMPTY_GIVEAWAY_FORM)
    setPrizeItems([])
    setSelectedTaskItems([])
  }

  async function handleSaveGiveaway() {
    setSavingGiveaway(true)
    setFeedback(null)
    try {
      // Convert prize items to proper prizes array with place numbers
      const prizes = prizeItems.map((item, index) => ({
        productId: item.productId,
        place: index + 1,
      }))

      // Convert selected task items to taskIds array + taskTickets map
      const taskIds = selectedTaskItems.map((t) => t.taskId)
      const taskTickets: Record<string, number> = {}
      selectedTaskItems.forEach((t) => { taskTickets[t.taskId] = t.ticketsGranted })

      const payload: GiveawayInput = {
        ...formToGiveawayInput(giveawayForm),
        prizes,
        entryTasks: [],
        taskIds,
        taskTickets,
      }

      if (editingGiveaway) {
        await updateGiveaway(initData, editingGiveaway.id, payload)
        setFeedback({ tone: 'success', message: 'Giveaway updated.' })
      } else {
        await createGiveaway(initData, payload)
        setFeedback({ tone: 'success', message: 'New giveaway created.' })
      }

      handleCloseGiveawayForm()
      void loadData()
    } catch (err) {
      setFeedback({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Failed to save giveaway',
      })
    } finally {
      setSavingGiveaway(false)
    }
  }

  async function handleToggleGiveawayActive(g: Giveaway) {
    triggerHapticFeedback('light')
    try {
      const newStatus: Giveaway['status'] = g.status === 'live' ? 'finished' : 'live'
      await updateGiveaway(initData, g.id, {
        ...formToGiveawayInput(giveawayToForm(g)),
        status: newStatus,
      })
      setGiveaways((prev) =>
        prev.map((item) =>
          item.id === g.id ? { ...item, status: newStatus } : item,
        ),
      )
    } catch {
      setFeedback({ tone: 'error', message: 'Failed to toggle status' })
    }
  }

  async function handleDeleteGiveaway(id: string) {
    setDeleteConfirmGiveawayId(null)
    triggerHapticFeedback('light')
    try {
      await deleteGiveaway(initData, id)
      setGiveaways((prev) => prev.filter((g) => g.id !== id))
      setFeedback({ tone: 'success', message: 'Giveaway deleted.' })
    } catch (err) {
      setFeedback({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Failed to delete',
      })
    }
  }

  // ── Draw Winners ──

  async function handleDrawWinners(id: string) {
    setDrawConfirmGiveawayId(null)
    setDrawingGiveawayId(id)
    triggerHapticFeedback('medium')
    try {
      const result = await drawGiveaway(initData, id)
      const drawnWinners = result.winners ?? []
      if (result.ok && drawnWinners.length > 0) {
        setGiveaways((prev) =>
          prev.map((g) =>
            g.id === id
              ? {
                  ...g,
                  status: 'finished',
                  winners: drawnWinners,
                  finishedAt: new Date().toISOString(),
                }
              : g,
          ),
        )
        setFeedback({
          tone: 'success',
          message: `Draw complete! ${drawnWinners.length} winner${drawnWinners.length !== 1 ? 's' : ''} selected.`,
        })
        // Refresh from server to get authoritative state
        void loadData()
      } else {
        setFeedback({
          tone: 'error',
          message: `Draw failed: ${result.reason}`,
        })
      }
    } catch (err) {
      setFeedback({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Failed to draw winners',
      })
    } finally {
      setDrawingGiveawayId(null)
    }
  }

  // ── Task CRUD ──

  function handleOpenNewTask() {
    triggerHapticFeedback('light')
    setEditingTask(null)
    setTaskForm({ ...EMPTY_TASK, sortOrder: tasks.length })
    setShowTaskForm(true)
  }

  function handleEditTask(t: Task) {
    triggerHapticFeedback('light')
    setEditingTask(t)
    setTaskForm({
      title: t.title,
      rewardType: t.rewardType,
      rewardValue: t.rewardValue,
      status: t.status,
      sortOrder: t.sortOrder,
      actionUrl: t.actionUrl ?? '',
      actionLabel: t.actionLabel ?? '',
    })
    setShowTaskForm(true)
  }

  function handleCloseTaskForm() {
    setShowTaskForm(false)
    setEditingTask(null)
    setTaskForm(EMPTY_TASK)
  }

  async function handleSaveTask() {
    setSavingTask(true)
    setFeedback(null)
    try {
      if (editingTask) {
        await updateTask(initData, editingTask.id, taskForm)
        setFeedback({ tone: 'success', message: 'Task updated.' })
      } else {
        await createTask(initData, taskForm)
        setFeedback({ tone: 'success', message: 'New task created.' })
      }
      handleCloseTaskForm()
      void loadData()
    } catch (err) {
      setFeedback({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Failed to save task',
      })
    } finally {
      setSavingTask(false)
    }
  }

  async function handleToggleTaskActive(t: Task) {
    triggerHapticFeedback('light')
    try {
      const newStatus = t.status === 'active' ? 'inactive' : 'active'
      await updateTask(initData, t.id, {
        title: t.title,
        rewardType: t.rewardType,
        rewardValue: t.rewardValue,
        status: newStatus,
        sortOrder: t.sortOrder,
      })
      setTasks((prev) =>
        prev.map((item) =>
          item.id === t.id ? { ...item, status: newStatus } : item,
        ),
      )
    } catch {
      setFeedback({ tone: 'error', message: 'Failed to toggle status' })
    }
  }

  async function handleDeleteTask(id: string) {
    setDeleteConfirmTaskId(null)
    triggerHapticFeedback('light')
    try {
      await deleteTask(initData, id)
      setTasks((prev) => prev.filter((t) => t.id !== id))
      setFeedback({ tone: 'success', message: 'Task deleted.' })
    } catch (err) {
      setFeedback({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Failed to delete',
      })
    }
  }

  return (
    <article className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(28,14,34,0.94),rgba(18,10,22,0.96))] shadow-[0_25px_70px_rgba(0,0,0,0.35)]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--shop-muted)]">
          Rewards Manager
        </p>
        <span className="rounded-full bg-[var(--shop-purple)]/18 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-purple)]">
          Live
        </span>
      </div>

      {/* ── Tab Toggle ── */}
      <div className="flex border-b border-white/10">
        <button
          type="button"
          onClick={() => { setTab('giveaways'); setFeedback(null) }}
          className={`flex-1 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] transition-colors ${
            tab === 'giveaways'
              ? 'bg-white/6 text-[var(--shop-cream)]'
              : 'text-[var(--shop-muted)]'
          }`}
        >
          Giveaways ({giveaways.length})
        </button>
        <button
          type="button"
          onClick={() => { setTab('tasks'); setFeedback(null) }}
          className={`flex-1 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] transition-colors ${
            tab === 'tasks'
              ? 'bg-white/6 text-[var(--shop-cream)]'
              : 'text-[var(--shop-muted)]'
          }`}
        >
          Tasks ({tasks.length})
        </button>
      </div>

      {/* ── Feedback Banner ── */}
      {feedback ? (
        <div
          className={`mx-5 mt-4 rounded-2xl px-4 py-3 text-sm ${
            feedback.tone === 'success'
              ? 'bg-emerald-300/18 text-emerald-100'
              : 'bg-[var(--shop-red)]/18 text-[var(--shop-cream)]'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {error ? (
        <div className="mx-5 mt-4 rounded-2xl bg-[var(--shop-red)]/18 px-4 py-3 text-sm text-[var(--shop-cream)]">
          {error}
        </div>
      ) : null}

      {/* ── Loading ── */}
      {loading ? (
        <div className="p-5">
          <div className="rounded-2xl bg-white/8 px-4 py-3 text-sm text-[var(--shop-muted)]">
            Loading rewards data...
          </div>
        </div>
      ) : (
        <div className="p-5">
          {tab === 'giveaways' ? (
            <>
              <GiveawayFormComponent
                open={showGiveawayForm}
                form={giveawayForm}
                editingGiveaway={editingGiveaway}
                saving={savingGiveaway}
                prizeItems={prizeItems}
                selectedTaskItems={selectedTaskItems}
                uploadingImage={uploadingImage}
                activeTasks={tasks.filter((t) => t.status === 'active')}
                showProductPicker={showProductPicker}
                cachedProducts={cachedProducts}
                onClose={handleCloseGiveawayForm}
                onSave={handleSaveGiveaway}
                onFormChange={setGiveawayForm}
                onPrizeAdd={handleProductSelect}
                onPrizeRemove={handleRemovePrize}
                onPrizeDragStart={handleDragStart}
                onPrizeDragOver={handleDragOver}
                onPrizeDragEnd={handleDragEnd}
                onOpenProductPicker={handleOpenProductPicker}
                onCloseProductPicker={() => setShowProductPicker(false)}
                onImageUpload={handleImageFileUpload}
                onToggleTask={handleToggleTask}
                onTaskTicketChange={handleTaskTicketChange}
              />

              {/* + ADD NEW GIVEAWAY */}
              {!showGiveawayForm ? (
                <button
                  type="button"
                  onClick={handleOpenNewGiveaway}
                  className="mb-4 flex w-full items-center justify-center gap-3 rounded-[24px] border-2 border-dashed border-white/15 bg-[#1C1622]/80 px-4 py-6 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)] transition-colors hover:border-[var(--shop-purple)]/40 hover:text-[var(--shop-purple)]"
                >
                  <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                    <path d="M8 2v12M2 8h12" />
                  </svg>
                  + Add New Giveaway
                </button>
              ) : null}

              {/* Active Giveaways */}
              {activeGiveaways.length > 0 ? (
                <div className="mb-6">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100/60">
                    Active Giveaways
                  </p>
                  <div className="space-y-3">
                    {activeGiveaways.map((g) => (
                      <GiveawayCard
                        key={g.id}
                        giveaway={g}
                        deleteConfirmId={deleteConfirmGiveawayId}
                        drawConfirmId={drawConfirmGiveawayId}
                        drawingId={drawingGiveawayId}
                        onEdit={() => handleEditGiveaway(g)}
                        onToggle={() => handleToggleGiveawayActive(g)}
                        onDelete={() => setDeleteConfirmGiveawayId(g.id)}
                        onConfirmDelete={() => handleDeleteGiveaway(g.id)}
                        onCancelDelete={() => setDeleteConfirmGiveawayId(null)}
                        onDraw={() => setDrawConfirmGiveawayId(g.id)}
                        onConfirmDraw={() => handleDrawWinners(g.id)}
                        onCancelDraw={() => setDrawConfirmGiveawayId(null)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Completed / Past Giveaways */}
              {completedGiveaways.length > 0 ? (
                <div>
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]/60">
                    Past Giveaways
                  </p>
                  <div className="space-y-3">
                    {completedGiveaways.map((g) => (
                      <GiveawayCard
                        key={g.id}
                        giveaway={g}
                        deleteConfirmId={deleteConfirmGiveawayId}
                        drawConfirmId={drawConfirmGiveawayId}
                        drawingId={drawingGiveawayId}
                        onEdit={() => handleEditGiveaway(g)}
                        onToggle={() => handleToggleGiveawayActive(g)}
                        onDelete={() => setDeleteConfirmGiveawayId(g.id)}
                        onConfirmDelete={() => handleDeleteGiveaway(g.id)}
                        onCancelDelete={() => setDeleteConfirmGiveawayId(null)}
                        onDraw={() => setDrawConfirmGiveawayId(g.id)}
                        onConfirmDraw={() => handleDrawWinners(g.id)}
                        onCancelDraw={() => setDrawConfirmGiveawayId(null)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {!loading && giveaways.length === 0 && !showGiveawayForm ? (
                <div className="rounded-2xl bg-white/8 px-4 py-8 text-center text-sm text-[var(--shop-muted)]">
                  No giveaways yet. Create your first one above.
                </div>
              ) : null}
            </>
          ) : (
            <>
              <TaskFormComponent
                open={showTaskForm}
                form={taskForm}
                editingTask={editingTask}
                saving={savingTask}
                onClose={handleCloseTaskForm}
                onSave={handleSaveTask}
                onFormChange={setTaskForm}
              />

              {/* + ADD NEW TASK */}
              {!showTaskForm ? (
                <button
                  type="button"
                  onClick={handleOpenNewTask}
                  className="mb-4 flex w-full items-center justify-center gap-3 rounded-[24px] border-2 border-dashed border-white/15 bg-[#1C1622]/80 px-4 py-6 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)] transition-colors hover:border-[var(--shop-purple)]/40 hover:text-[var(--shop-purple)]"
                >
                  <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                    <path d="M8 2v12M2 8h12" />
                  </svg>
                  + Add New Task
                </button>
              ) : null}

              {/* All Tasks */}
              {tasks.length > 0 ? (
                <div className="space-y-3">
                  {/* Active Tasks */}
                  {tasks.filter((t) => t.status === 'active').length > 0 ? (
                    <>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100/60">
                        Active Tasks
                      </p>
                      {tasks
                        .filter((t) => t.status === 'active')
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((t) => (
                          <TaskCard
                            key={t.id}
                            task={t}
                            deleteConfirmId={deleteConfirmTaskId}
                            onEdit={() => handleEditTask(t)}
                            onToggle={() => handleToggleTaskActive(t)}
                            onDelete={() => setDeleteConfirmTaskId(t.id)}
                            onConfirmDelete={() => handleDeleteTask(t.id)}
                            onCancelDelete={() => setDeleteConfirmTaskId(null)}
                          />
                        ))}
                    </>
                  ) : null}

                  {/* Inactive Tasks */}
                  {tasks.filter((t) => t.status === 'inactive').length > 0 ? (
                    <div className="mt-5">
                      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)]/60">
                        Inactive Tasks
                      </p>
                      {tasks
                        .filter((t) => t.status === 'inactive')
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((t) => (
                          <TaskCard
                            key={t.id}
                            task={t}
                            deleteConfirmId={deleteConfirmTaskId}
                            onEdit={() => handleEditTask(t)}
                            onToggle={() => handleToggleTaskActive(t)}
                            onDelete={() => setDeleteConfirmTaskId(t.id)}
                            onConfirmDelete={() => handleDeleteTask(t.id)}
                            onCancelDelete={() => setDeleteConfirmTaskId(null)}
                          />
                        ))}
                    </div>
                  ) : null}
                </div>
              ) : !showTaskForm ? (
                <div className="rounded-2xl bg-white/8 px-4 py-8 text-center text-sm text-[var(--shop-muted)]">
                  No tasks yet. Create your first one above.
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </article>
  )
}

// ── GiveawayFormComponent ──
// Extracted as a standalone component to prevent input focus loss on every keystroke.
// When defined inline (via useCallback inside RewardsAdminPanel), the component
// reference changes on every render, causing React to unmount/remount the form.

type GiveawayFormComponentProps = {
  open: boolean
  form: GiveawayFormState
  editingGiveaway: Giveaway | null
  saving: boolean
  prizeItems: PrizeFormItem[]
  selectedTaskItems: SelectedTaskFormItem[]
  uploadingImage: boolean
  activeTasks: Task[]
  showProductPicker: boolean
  cachedProducts: Array<{ id: string; name: string; image: string; category: string }> | null
  onClose: () => void
  onSave: () => Promise<void>
  onFormChange: (form: GiveawayFormState) => void
  onPrizeAdd: (product: { id: string; name: string; image: string }) => void
  onPrizeRemove: (index: number) => void
  onPrizeDragStart: (index: number) => void
  onPrizeDragOver: (e: DragEvent, index: number) => void
  onPrizeDragEnd: () => void
  onOpenProductPicker: () => void
  onCloseProductPicker: () => void
  onImageUpload: (file: File) => Promise<void>
  onToggleTask: (task: Task) => void
  onTaskTicketChange: (taskId: string, tickets: number) => void
}

function GiveawayFormComponent({
  open,
  form,
  editingGiveaway,
  saving,
  prizeItems,
  selectedTaskItems,
  uploadingImage,
  activeTasks,
  showProductPicker,
  cachedProducts,
  onClose,
  onSave,
  onFormChange,
  onPrizeAdd,
  onPrizeRemove,
  onPrizeDragStart,
  onPrizeDragOver,
  onPrizeDragEnd,
  onOpenProductPicker,
  onCloseProductPicker,
  onImageUpload,
  onToggleTask,
  onTaskTicketChange,
}: GiveawayFormComponentProps) {
  if (!open) return null

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void onSave() }}
      className="mb-5 rounded-[24px] border border-white/10 bg-[var(--shop-panel)] p-5"
    >
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
        {editingGiveaway ? 'Edit Giveaway' : '+ New Giveaway'}
      </p>

      <div className="space-y-4">
        {/* ── Giveaway Name ── */}
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Giveaway Name</span>
          <input
            value={form.title}
            onChange={(e) => onFormChange({ ...form, title: e.target.value })}
            className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none"
            placeholder="e.g. Drop 01 Giveaway"
          />
        </label>

        {/* ── Image Upload (replace URL input) ── */}
        <div className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Giveaway Image</span>
          <div className="relative">
            {form.imageUrl ? (
              <div className="relative h-40 w-full overflow-hidden rounded-xl border border-white/10 bg-black/20">
                <img
                  src={form.imageUrl}
                  alt="Giveaway preview"
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
                <button
                  type="button"
                  onClick={() => onFormChange({ ...form, imageUrl: '' })}
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white/80 backdrop-blur-sm transition-colors hover:text-white"
                  aria-label="Remove image"
                >
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/15 bg-white/5 px-4 py-8 transition-colors hover:border-[var(--shop-purple)]/40 hover:bg-white/8">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void onImageUpload(file)
                    e.target.value = ''
                  }}
                />
                {uploadingImage ? (
                  <>
                    <svg className="h-6 w-6 animate-spin text-[var(--shop-muted)]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">Uploading...</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 20 20" className="h-6 w-6 text-[var(--shop-muted)]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                      <path d="M10 2v12M4 8l6-6 6 6" />
                      <path d="M2 16v2h16v-2" />
                    </svg>
                    <span className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shop-muted)]">Tap to upload image</span>
                  </>
                )}
              </label>
            )}
          </div>
        </div>

        {/* ── Prizes: Multi-Product with Drag-to-Reorder ── */}
        <div className="block">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
              Prizes ({prizeItems.length})
            </span>
            <button
              type="button"
              onClick={onOpenProductPicker}
              className="rounded-full border border-white/10 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)] transition-colors hover:bg-white/10"
            >
              + Add Product
            </button>
          </div>

          <ProductPickerModal
            open={showProductPicker}
            onSelect={onPrizeAdd}
            onClose={onCloseProductPicker}
            cachedProducts={cachedProducts}
          />

          {prizeItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                No prizes added yet. Tap &quot;+ Add Product&quot; above.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {prizeItems.map((item, index) => {
                const placeLabels = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th']
                const label = placeLabels[index] ?? `#${index + 1}`
                return (
                  <div
                    key={`${item.productId}-${index}`}
                    draggable
                    onDragStart={() => onPrizeDragStart(index)}
                    onDragOver={(e) => onPrizeDragOver(e, index)}
                    onDragEnd={onPrizeDragEnd}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/6 px-3 py-2.5 transition-colors hover:bg-white/10"
                  >
                    {/* Drag handle */}
                    <div className="flex cursor-grab items-center text-[var(--shop-muted)] active:cursor-grabbing" aria-label="Drag to reorder">
                      <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
                        <circle cx="5" cy="3" r="1.5" /><circle cx="11" cy="3" r="1.5" />
                        <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
                        <circle cx="5" cy="13" r="1.5" /><circle cx="11" cy="13" r="1.5" />
                      </svg>
                    </div>

                    {/* Thumbnail */}
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/20">
                      {item.productImage ? (
                        <img
                          src={item.productImage}
                          alt={item.productName}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none' }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[9px] text-[var(--shop-muted)]">
                          No img
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--shop-cream)]">
                        {item.productName || 'Unnamed Product'}
                      </p>
                      <p className="truncate text-[9px] font-mono text-[var(--shop-muted)]">
                        {item.productId}
                      </p>
                    </div>

                    {/* Place badge */}
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] ${
                      index === 0 ? 'bg-amber-500/20 text-amber-300' :
                      index === 1 ? 'bg-zinc-400/15 text-zinc-300' :
                      index === 2 ? 'bg-amber-700/20 text-amber-600' :
                      'bg-white/8 text-[var(--shop-muted)]'
                    }`}>
                      {label}
                    </span>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => onPrizeRemove(index)}
                      className="shrink-0 rounded-full p-1 text-[var(--shop-muted)] transition-colors hover:text-[var(--shop-red)]"
                      aria-label={`Remove ${item.productName}`}
                    >
                      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M4 4l8 8M12 4l-8 8" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Task Picker (up to 2 existing tasks) ── */}
        <div className="block">
          <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
            Tasks ({selectedTaskItems.length}/2 max)
          </span>
          {activeTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                No active tasks available. Create tasks in the Tasks tab first.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeTasks.map((task) => {
                const isSelected = selectedTaskItems.find((t) => t.taskId === task.id)
                const isDisabled = !isSelected && selectedTaskItems.length >= 2
                return (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                      isSelected
                        ? 'border-[var(--shop-purple)]/30 bg-[var(--shop-purple)]/8'
                        : isDisabled
                          ? 'border-white/6 bg-white/4 opacity-40'
                          : 'border-white/10 bg-white/6 hover:bg-white/10'
                    }`}
                  >
                    {/* Task icon */}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/8">
                      <svg viewBox="0 0 24 24" fill="currentColor" className={`h-5 w-5 shrink-0 ${isSelected ? 'text-[var(--shop-purple)]' : 'text-[var(--shop-muted)]'}`} aria-hidden="true">
                        <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6a3 3 0 003 3h10.5a3 3 0 003-3v-6a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                      </svg>
                    </div>

                    {/* Task info */}
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-semibold ${isSelected ? 'text-[var(--shop-cream)]' : 'text-[var(--shop-muted)]'}`}>
                        {task.title}
                      </p>
                      <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]">
                        {task.rewardType === 'ticket' ? task.rewardValue : 'Coupon'}
                      </p>
                    </div>

                    {/* Tickets per completion input */}
                    {isSelected && (
                      <div className="flex shrink-0 items-center gap-1">
                        <input
                          type="number"
                          value={selectedTaskItems.find((t) => t.taskId === task.id)?.ticketsGranted ?? 5}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => onTaskTicketChange(task.id, Math.max(1, Number(e.target.value)))}
                          className="w-14 rounded-lg border border-white/10 bg-white/8 px-2 py-1 text-[10px] font-semibold text-[var(--shop-cream)] outline-none text-center"
                          min={1}
                          max={100}
                        />
                        <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-[var(--shop-muted)]">tix</span>
                      </div>
                    )}

                    {/* Select/deselect toggle */}
                    <button
                      type="button"
                      disabled={isDisabled && !isSelected}
                      onClick={() => onToggleTask(task)}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-[var(--shop-purple)]/20 text-[var(--shop-purple)]'
                          : 'border border-white/10 bg-white/8 text-[var(--shop-muted)] hover:bg-white/12'
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {isSelected ? '✓ Selected' : 'Select'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Base Entry / End Date row ── */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Base Entry Tickets</span>
            <input
              type="number"
              value={form.baseEntryTickets}
              onChange={(e) => onFormChange({ ...form, baseEntryTickets: Number(e.target.value) })}
              className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none"
              min={1}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Ends At</span>
            <input
              type="datetime-local"
              value={form.endAt ? form.endAt.slice(0, 16) : ''}
              onChange={(e) => onFormChange({ ...form, endAt: e.target.value ? new Date(e.target.value).toISOString() : '' })}
              className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none"
            />
          </label>
        </div>

        {/* ── Active / Access row ── */}
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={form.status === 'live'}
              onChange={(e) => onFormChange({ ...form, status: e.target.checked ? 'live' : 'draft' })}
              className="h-4 w-4 accent-[var(--shop-purple)]"
            />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Active</span>
          </label>
          <label className="flex items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Access</span>
            <select
              value={form.accessLevel}
              onChange={(e) => onFormChange({ ...form, accessLevel: e.target.value as 'public' | 'early_access_only' })}
              className="rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none"
            >
              <option value="public">Public</option>
              <option value="early_access_only">Early Access</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || prizeItems.length === 0}
          className="flex-1 rounded-xl bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white disabled:opacity-50"
        >
          {saving ? 'Saving...' : editingGiveaway ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  )
}

// ── TaskFormComponent ──
// Extracted as a standalone component to prevent input focus loss on every keystroke.

type TaskFormComponentProps = {
  open: boolean
  form: TaskInput
  editingTask: Task | null
  saving: boolean
  onClose: () => void
  onSave: () => Promise<void>
  onFormChange: (form: TaskInput) => void
}

function TaskFormComponent({
  open,
  form,
  editingTask,
  saving,
  onClose,
  onSave,
  onFormChange,
}: TaskFormComponentProps) {
  if (!open) return null

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void onSave() }}
      className="mb-5 rounded-[24px] border border-white/10 bg-[var(--shop-panel)] p-5"
    >
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
        {editingTask ? 'Edit Task' : '+ New Task'}
      </p>

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Title</span>
          <input
            value={form.title}
            onChange={(e) => onFormChange({ ...form, title: e.target.value })}
            className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none"
            placeholder="e.g. Invite 3 Friends"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Reward Type</span>
            <select
              value={form.rewardType}
              onChange={(e) => onFormChange({ ...form, rewardType: e.target.value as 'coupon' | 'ticket' })}
              className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none"
            >
              <option value="coupon">Coupon (10% OFF)</option>
              <option value="ticket">Giveaway Ticket</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Reward Value</span>
            <input
              value={form.rewardValue}
              onChange={(e) => onFormChange({ ...form, rewardValue: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none"
              placeholder="e.g. 10% OFF COUPON"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Action URL (optional)</span>
            <input
              value={form.actionUrl ?? ''}
              onChange={(e) => onFormChange({ ...form, actionUrl: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none"
              placeholder="e.g. https://instagram.com/..."
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Button Label (optional)</span>
            <input
              value={form.actionLabel ?? ''}
              onChange={(e) => onFormChange({ ...form, actionLabel: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none"
              placeholder="e.g. Follow, Subscribe, Join"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={form.status === 'active'}
              onChange={(e) => onFormChange({ ...form, status: e.target.checked ? 'active' : 'inactive' })}
              className="h-4 w-4 accent-[var(--shop-purple)]"
            />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Active</span>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Sort Order</span>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => onFormChange({ ...form, sortOrder: Number(e.target.value) })}
              className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none"
              min={0}
            />
          </label>
        </div>
      </div>

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-xl bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white disabled:opacity-50"
        >
          {saving ? 'Saving...' : editingTask ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  )
}

/* ─── Giveaway Card ─── */

type GiveawayCardProps = {
  giveaway: Giveaway
  deleteConfirmId: string | null
  drawConfirmId: string | null
  drawingId: string | null
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
  onDraw: () => void
  onConfirmDraw: () => void
  onCancelDraw: () => void
}

function GiveawayCard({
  giveaway,
  deleteConfirmId,
  drawConfirmId,
  drawingId,
  onEdit,
  onToggle,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  onDraw,
  onConfirmDraw,
  onCancelDraw,
}: GiveawayCardProps) {
  const isDeleting = deleteConfirmId === giveaway.id
  const isDrawConfirming = drawConfirmId === giveaway.id
  const isDrawing = drawingId === giveaway.id

  const firstPrize = giveaway.prizes[0]
  const hasWinners = (giveaway.winners?.length ?? 0) > 0
  const isLive = giveaway.status === 'live'
  const displayImage = giveaway.imageUrl || firstPrize?.productImage || ''

  return (
    <div className="flex items-center gap-4 rounded-[24px] border border-white/10 bg-[var(--shop-panel)] px-4 py-4">
      {/* Thumbnail */}
      <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/20">
        {displayImage ? (
          <img
            src={displayImage}
            alt={giveaway.title || firstPrize?.productName || ''}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--shop-muted)]">
            No image
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--shop-cream)]">
          {giveaway.title || firstPrize?.productName || 'Untitled Giveaway'}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] ${
              isLive
                ? 'bg-emerald-300/12 text-emerald-100'
                : 'bg-white/8 text-[var(--shop-muted)]'
            }`}
          >
            {isLive ? 'Active' : giveaway.status}
          </span>
          <span className="text-[10px] text-[var(--shop-muted)]">
            {giveaway.enteredCount} Participant{giveaway.enteredCount !== 1 ? 's' : ''} • {giveaway.totalTicketsPool} Ticket{giveaway.totalTicketsPool !== 1 ? 's' : ''}
          </span>
        </div>
        {/* Winners summary */}
        {hasWinners && giveaway.winners ? (
          <div className="mt-1 space-y-0.5">
            {giveaway.winners.slice(0, 3).map((w) => (
              <p key={w.place} className="text-[10px] font-semibold text-emerald-100">
                {w.place === 1 ? '🥇' : w.place === 2 ? '🥈' : w.place === 3 ? '🥉' : `#${w.place}`}{' '}
                {w.telegramUsername ? `@${w.telegramUsername}` : `User #${w.telegramUserId}`}
              </p>
            ))}
            {giveaway.winners.length > 3 && (
              <p className="text-[9px] text-[var(--shop-muted)]">
                +{giveaway.winners.length - 3} more
              </p>
            )}
          </div>
        ) : null}
        {giveaway.endAt ? (
          <p className="mt-0.5 text-[9px] text-[var(--shop-muted)]/60">
            {isLive ? 'Ends: ' : 'Ended: '}{new Date(giveaway.endAt).toLocaleDateString()}
          </p>
        ) : null}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-col gap-1.5">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-xl border border-white/10 bg-white/8 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)]"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-xl border border-white/10 bg-white/8 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]"
        >
          {isLive ? 'Deact.' : 'React.'}
        </button>
        {/* Draw Winners button (only for active giveaways) */}
        {isLive ? (
          isDrawConfirming ? (
            <div className="flex gap-1">
              <button
                type="button"
                disabled={isDrawing}
                onClick={onConfirmDraw}
                className="rounded-xl bg-emerald-300/18 px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.14em] text-emerald-100 disabled:opacity-50"
              >
                {isDrawing ? 'Draw...' : 'Draw!'}
              </button>
              <button
                type="button"
                onClick={onCancelDraw}
                className="rounded-xl bg-white/8 px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.14em] text-[var(--shop-muted)]"
              >
                X
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onDraw}
              disabled={isDrawing}
              className="rounded-xl bg-emerald-300/12 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-100 disabled:opacity-50"
            >
              Draw
            </button>
          )
        ) : null}
        {isDeleting ? (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onConfirmDelete}
              className="rounded-xl bg-[var(--shop-red)]/18 px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.14em] text-[var(--shop-cream)]"
            >
              Del.
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="rounded-xl bg-white/8 px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.14em] text-[var(--shop-muted)]"
            >
              X
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-xl bg-white/8 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]"
          >
            Del
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── Task Card ─── */

type TaskCardProps = {
  task: Task
  deleteConfirmId: string | null
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}

function TaskCard({
  task,
  deleteConfirmId,
  onEdit,
  onToggle,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
}: TaskCardProps) {
  const isDeleting = deleteConfirmId === task.id

  return (
    <div className="flex items-center gap-4 rounded-[24px] border border-white/10 bg-[var(--shop-panel)] px-4 py-4">
      {/* Icon */}
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/8">
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className={`h-6 w-6 shrink-0 ${
            task.status === 'active'
              ? 'text-[var(--shop-purple)]'
              : 'text-[var(--shop-muted)]'
          }`}
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M12 2.25A6.75 6.75 0 005.25 9v.75a8.217 8.217 0 01-2.119 5.52.75.75 0 00.594 1.23h12.55a.75.75 0 00.594-1.23A8.217 8.217 0 0114.25 9.75V9A6.75 6.75 0 0012 2.25zm0 15a3 3 0 01-2.58-1.46H14.58A3 3 0 0112 17.25z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--shop-cream)]">
          {task.title}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] ${
              task.rewardType === 'coupon'
                ? 'bg-amber-300/12 text-amber-100'
                : 'bg-[var(--shop-purple)]/12 text-[var(--shop-purple)]'
            }`}
          >
            {task.rewardValue}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] ${
              task.status === 'active'
                ? 'bg-emerald-300/12 text-emerald-100'
                : 'bg-white/8 text-[var(--shop-muted)]'
            }`}
          >
            {task.status}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-col gap-1.5">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-xl border border-white/10 bg-white/8 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-cream)]"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-xl border border-white/10 bg-white/8 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]"
        >
          {task.status === 'active' ? 'Pause' : 'Act.'}
        </button>
        {isDeleting ? (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onConfirmDelete}
              className="rounded-xl bg-[var(--shop-red)]/18 px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.14em] text-[var(--shop-cream)]"
            >
              Del.
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="rounded-xl bg-white/8 px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-[0.14em] text-[var(--shop-muted)]"
            >
              X
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-xl bg-white/8 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]"
          >
            Del
          </button>
        )}
      </div>
    </div>
  )
}
