import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import dayjs from 'dayjs'
import type { DiffChange, Issue, ReportBatch } from '../api/types'
import { seedIssues, seedBatches } from '../api/seed'
import { evaluateBatch, snapshotIssue } from '../api/batches'

type SavedFilter = { id: string; name: string; query: string; site: string; status: string; priority: string }

type FreezeInput = {
  name: string
  keys: string[]
  changes: DiffChange[]
  baselineVersion: string
  candidateVersion: string
  note: string
}

type WorkspaceState = {
  issues: Issue[]
  selectedKeys: string[]
  savedFilters: SavedFilter[]
  draft: string
  mergeKeys: string[]
  batches: ReportBatch[]
  setIssues: (issues: Issue[]) => void
  setSelectedKeys: (keys: string[]) => void
  saveFilter: (filter: Omit<SavedFilter, 'id'>) => void
  removeFilter: (id: string) => void
  setDraft: (draft: string) => void
  mergeIssues: (keys: string[]) => void
  updateIssue: (issue: Issue) => void
  freezeBatch: (input: FreezeInput) => string
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      issues: structuredClone(seedIssues),
      selectedKeys: [],
      savedFilters: [
        { id: 'f1', name: 'P0/P1 未关闭', query: '', site: '', status: '', priority: 'P0' },
        { id: 'f2', name: '基础组件组待复测', query: '基础组件', site: '', status: '待复测', priority: '' },
      ],
      draft: 'A11Y-1048：需同时验证 Esc 关闭与 Tab/Shift+Tab 环绕顺序，移动端抽屉也需复测。',
      mergeKeys: [],
      batches: structuredClone(seedBatches),
      setIssues: (issues) => set({ issues }),
      setSelectedKeys: (selectedKeys) => set({ selectedKeys }),
      saveFilter: (filter) => set((state) => ({ savedFilters: [...state.savedFilters, { ...filter, id: crypto.randomUUID() }] })),
      removeFilter: (id) => set((state) => ({ savedFilters: state.savedFilters.filter((item) => item.id !== id) })),
      setDraft: (draft) => set({ draft }),
      mergeIssues: (keys) =>
        set((state) => {
          const primary = state.issues.find((issue) => issue.key === keys[0])
          if (!primary) return state
          return {
            issues: state.issues.map((issue) =>
              keys.includes(issue.key)
                ? {
                    ...issue,
                    rootCause: primary.rootCause,
                    status: issue.key === primary.key ? issue.status : '不适用',
                    mergedKeys: issue.key === primary.key ? keys.slice(1) : [primary.key],
                    history: [...issue.history, { at: '刚刚', actor: '当前用户', action: '重复问题合并', detail: `合并至 ${primary.key}` }],
                  }
                : issue,
            ),
            selectedKeys: [],
          }
        }),
      updateIssue: (updated) => set((state) => ({ issues: state.issues.map((issue) => (issue.key === updated.key ? updated : issue)) })),
      freezeBatch: (input) => {
        const id = `RPT-${dayjs().format('YYYYMMDD-HHmmss')}`
        const frozenAt = dayjs().format('YYYY-MM-DD HH:mm')
        const { issues, batches } = get()
        const items = input.keys
          .map((key) => issues.find((issue) => issue.key === key))
          .filter((issue): issue is Issue => Boolean(issue))
          .map(snapshotIssue)

        const newBatch: ReportBatch = {
          id,
          name: input.name,
          frozenAt,
          frozenBy: '当前用户 / 审核员',
          baselineVersion: input.baselineVersion,
          candidateVersion: input.candidateVersion,
          note: input.note,
          items,
          changes: input.changes,
          state: '当前有效',
          archivedBlockers: [],
        }

        // 旧批次全部归档保留，并在归档瞬间固化挡批原因，详情可追溯
        const archived = batches.map((batch) =>
          batch.state === '已归档'
            ? batch
            : {
                ...batch,
                state: '已归档' as const,
                supersededBy: id,
                supersededAt: frozenAt,
                archivedBlockers: evaluateBatch(batch, issues),
              },
        )

        set({ batches: [newBatch, ...archived] })
        return id
      },
    }),
    {
      name: 'accessibility-remediation-v1',
      version: 1,
    },
  ),
)
