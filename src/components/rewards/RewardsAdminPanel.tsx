import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  createGiveaway,
  deleteGiveaway,
  listGiveaways,
  updateGiveaway,
} from '../../lib/firebase/giveaways'
import {
  createTask,
  deleteTask,
  listTasks,
  updateTask,
} from '../../lib/firebase/tasks'
import { triggerHapticFeedback } from '../../lib/telegram/webApp'
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

const EMPTY_GIVEAWAY: GiveawayInput = {
  productId: '',
  productName: '',
  productImage: '',
  totalTickets: 100,
  enteredCount: 0,
  endsAt: '',
  isActive: true,
  winnerUsername: null,
}

const EMPTY_TASK: TaskInput = {
  title: '',
  rewardType: 'coupon',
  rewardValue: '',
  status: 'active',
  sortOrder: 0,
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
  const [giveawayForm, setGiveawayForm] = useState<GiveawayInput>(EMPTY_GIVEAWAY)
  const [showGiveawayForm, setShowGiveawayForm] = useState(false)
  const [savingGiveaway, setSavingGiveaway] = useState(false)

  // Editing state for tasks
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [taskForm, setTaskForm] = useState<TaskInput>(EMPTY_TASK)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [savingTask, setSavingTask] = useState(false)

  // Delete confirmations
  const [deleteConfirmGiveawayId, setDeleteConfirmGiveawayId] = useState<string | null>(null)
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState<string | null>(null)

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

  const activeGiveaways = useMemo(
    () => giveaways.filter((g) => g.isActive),
    [giveaways],
  )

  const completedGiveaways = useMemo(
    () => giveaways.filter((g) => !g.isActive),
    [giveaways],
  )

  // ── Giveaway CRUD ──

  function handleOpenNewGiveaway() {
    triggerHapticFeedback('light')
    setEditingGiveaway(null)
    setGiveawayForm(EMPTY_GIVEAWAY)
    setShowGiveawayForm(true)
  }

  function handleEditGiveaway(g: Giveaway) {
    triggerHapticFeedback('light')
    setEditingGiveaway(g)
    setGiveawayForm({
      productId: g.productId,
      productName: g.productName,
      productImage: g.productImage,
      totalTickets: g.totalTickets,
      enteredCount: g.enteredCount,
      endsAt: g.endsAt ?? '',
      isActive: g.isActive,
      winnerUsername: g.winnerUsername,
    })
    setShowGiveawayForm(true)
  }

  function handleCloseGiveawayForm() {
    setShowGiveawayForm(false)
    setEditingGiveaway(null)
    setGiveawayForm(EMPTY_GIVEAWAY)
  }

  async function handleSaveGiveaway() {
    setSavingGiveaway(true)
    setFeedback(null)
    try {
      const payload: GiveawayInput = {
        ...giveawayForm,
        endsAt: giveawayForm.endsAt || null,
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
      await updateGiveaway(initData, g.id, {
        productId: g.productId,
        productName: g.productName,
        productImage: g.productImage,
        totalTickets: g.totalTickets,
        enteredCount: g.enteredCount,
        endsAt: g.endsAt,
        isActive: !g.isActive,
        winnerUsername: g.winnerUsername,
      })
      setGiveaways((prev) =>
        prev.map((item) =>
          item.id === g.id ? { ...item, isActive: !g.isActive } : item,
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

  const GiveawayForm = useCallback(() => {
    if (!showGiveawayForm) return null
    return (
      <form
        onSubmit={(e) => { e.preventDefault(); void handleSaveGiveaway() }}
        className="mb-5 rounded-[24px] border border-white/10 bg-[var(--shop-panel)] p-5"
      >
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
          {editingGiveaway ? 'Edit Giveaway' : '+ New Giveaway'}
        </p>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Product ID</span>
            <input
              value={giveawayForm.productId}
              onChange={(e) => setGiveawayForm((prev) => ({ ...prev, productId: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none"
              placeholder="firestore doc id"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Product Name</span>
            <input
              value={giveawayForm.productName}
              onChange={(e) => setGiveawayForm((prev) => ({ ...prev, productName: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none"
              placeholder="e.g. Drop 01 Hoodie"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Image URL</span>
            <input
              value={giveawayForm.productImage}
              onChange={(e) => setGiveawayForm((prev) => ({ ...prev, productImage: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none"
              placeholder="https://..."
            />
            {giveawayForm.productImage && (
              <div className="mt-2 h-20 w-32 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                <img
                  src={giveawayForm.productImage}
                  alt="Preview"
                  className="h-full w-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
              </div>
            )}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Total Tickets</span>
              <input
                type="number"
                value={giveawayForm.totalTickets}
                onChange={(e) => setGiveawayForm((prev) => ({ ...prev, totalTickets: Number(e.target.value) }))}
                className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none"
                min={1}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Entered Count</span>
              <input
                type="number"
                value={giveawayForm.enteredCount}
                onChange={(e) => setGiveawayForm((prev) => ({ ...prev, enteredCount: Number(e.target.value) }))}
                className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none"
                min={0}
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Ends At</span>
            <input
              type="datetime-local"
              value={giveawayForm.endsAt ? giveawayForm.endsAt.slice(0, 16) : ''}
              onChange={(e) => setGiveawayForm((prev) => ({ ...prev, endsAt: e.target.value ? new Date(e.target.value).toISOString() : '' }))}
              className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none"
            />
          </label>
          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={giveawayForm.isActive}
                onChange={(e) => setGiveawayForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                className="h-4 w-4 accent-[var(--shop-purple)]"
              />
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Active</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Winner Username</span>
              <input
                value={giveawayForm.winnerUsername ?? ''}
                onChange={(e) => setGiveawayForm((prev) => ({ ...prev, winnerUsername: e.target.value || null }))}
                className="w-40 rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none"
                placeholder="@username"
              />
            </label>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={handleCloseGiveawayForm}
            className="flex-1 rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={savingGiveaway}
            className="flex-1 rounded-xl bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white disabled:opacity-50"
          >
            {savingGiveaway ? 'Saving...' : editingGiveaway ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGiveawayForm, giveawayForm, editingGiveaway, savingGiveaway])

  const TaskForm = useCallback(() => {
    if (!showTaskForm) return null
    return (
      <form
        onSubmit={(e) => { e.preventDefault(); void handleSaveTask() }}
        className="mb-5 rounded-[24px] border border-white/10 bg-[var(--shop-panel)] p-5"
      >
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
          {editingTask ? 'Edit Task' : '+ New Task'}
        </p>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Title</span>
            <input
              value={taskForm.title}
              onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none"
              placeholder="e.g. Invite 3 Friends"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Reward Type</span>
              <select
                value={taskForm.rewardType}
                onChange={(e) => setTaskForm((prev) => ({ ...prev, rewardType: e.target.value as 'coupon' | 'ticket' }))}
                className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none"
              >
                <option value="coupon">Coupon (10% OFF)</option>
                <option value="ticket">Giveaway Ticket</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Reward Value</span>
              <input
                value={taskForm.rewardValue}
                onChange={(e) => setTaskForm((prev) => ({ ...prev, rewardValue: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none"
                placeholder="e.g. 10% OFF COUPON"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={taskForm.status === 'active'}
                onChange={(e) => setTaskForm((prev) => ({ ...prev, status: e.target.checked ? 'active' : 'inactive' }))}
                className="h-4 w-4 accent-[var(--shop-purple)]"
              />
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Active</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Sort Order</span>
              <input
                type="number"
                value={taskForm.sortOrder}
                onChange={(e) => setTaskForm((prev) => ({ ...prev, sortOrder: Number(e.target.value) }))}
                className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-sm text-[var(--shop-cream)] outline-none"
                min={0}
              />
            </label>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={handleCloseTaskForm}
            className="flex-1 rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shop-muted)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={savingTask}
            className="flex-1 rounded-xl bg-[linear-gradient(135deg,var(--shop-purple),var(--shop-red))] px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white disabled:opacity-50"
          >
            {savingTask ? 'Saving...' : editingTask ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTaskForm, taskForm, editingTask, savingTask])

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
              <GiveawayForm />

              {/* + ADD NEW GIVEAWAY */}
              {!showGiveawayForm ? (
                <button
                  type="button"
                  onClick={handleOpenNewGiveaway}
                  className="mb-4 flex w-full items-center justify-center gap-3 rounded-[24px] border-2 border-dashed border-white/15 bg-[#1C1622]/80 px-4 py-6 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)] transition-colors hover:border-[var(--shop-purple)]/40 hover:text-[var(--shop-purple)]"
                >
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
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
                        onEdit={() => handleEditGiveaway(g)}
                        onToggle={() => handleToggleGiveawayActive(g)}
                        onDelete={() => setDeleteConfirmGiveawayId(g.id)}
                        onConfirmDelete={() => handleDeleteGiveaway(g.id)}
                        onCancelDelete={() => setDeleteConfirmGiveawayId(null)}
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
                        onEdit={() => handleEditGiveaway(g)}
                        onToggle={() => handleToggleGiveawayActive(g)}
                        onDelete={() => setDeleteConfirmGiveawayId(g.id)}
                        onConfirmDelete={() => handleDeleteGiveaway(g.id)}
                        onCancelDelete={() => setDeleteConfirmGiveawayId(null)}
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
              <TaskForm />

              {/* + ADD NEW TASK */}
              {!showTaskForm ? (
                <button
                  type="button"
                  onClick={handleOpenNewTask}
                  className="mb-4 flex w-full items-center justify-center gap-3 rounded-[24px] border-2 border-dashed border-white/15 bg-[#1C1622]/80 px-4 py-6 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--shop-muted)] transition-colors hover:border-[var(--shop-purple)]/40 hover:text-[var(--shop-purple)]"
                >
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
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

/* ─── Giveaway Card ─── */

type GiveawayCardProps = {
  giveaway: Giveaway
  deleteConfirmId: string | null
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}

function GiveawayCard({
  giveaway,
  deleteConfirmId,
  onEdit,
  onToggle,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
}: GiveawayCardProps) {
  const isDeleting = deleteConfirmId === giveaway.id

  return (
    <div className="flex items-center gap-4 rounded-[24px] border border-white/10 bg-[var(--shop-panel)] px-4 py-4">
      {/* Thumbnail */}
      <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/20">
        <img
          src={giveaway.productImage}
          alt={giveaway.productName}
          className="h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--shop-cream)]">
          {giveaway.productName}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] ${
              giveaway.isActive
                ? 'bg-emerald-300/12 text-emerald-100'
                : 'bg-white/8 text-[var(--shop-muted)]'
            }`}
          >
            {giveaway.isActive ? 'Active' : 'Ended'}
          </span>
          <span className="text-[10px] text-[var(--shop-muted)]">
            {giveaway.enteredCount}/{giveaway.totalTickets} entered
          </span>
        </div>
        {giveaway.winnerUsername ? (
          <p className="mt-0.5 text-[10px] font-semibold text-[var(--shop-purple)]">
            Winner: @{giveaway.winnerUsername}
          </p>
        ) : null}
        {giveaway.endsAt ? (
          <p className="mt-0.5 text-[9px] text-[var(--shop-muted)]/60">
            Ends: {new Date(giveaway.endsAt).toLocaleDateString()}
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
          {giveaway.isActive ? 'Deact.' : 'React.'}
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
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-5 w-5 ${
            task.status === 'active'
              ? 'text-[var(--shop-purple)]'
              : 'text-[var(--shop-muted)]'
          }`}
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 1a5 5 0 00-5 5c0 1.5.55 2.88 1.46 3.93L4.3 13.3a.75.75 0 00.53 1.2h10.34a.75.75 0 00.53-1.2l-1.16-2.37A4.99 4.99 0 0015 6a5 5 0 00-5-5zm0 14a2.5 2.5 0 01-2.12-1.17h4.24A2.5 2.5 0 0110 15z"
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
