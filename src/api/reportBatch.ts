import dayjs from 'dayjs'
import type { Issue, ReportBatch, ReportBatchChange, ReportBatchIssue } from './types'

const batchIssueKeys: Array<keyof ReportBatchIssue> = [
  'key',
  'title',
  'site',
  'version',
  'wcag',
  'impact',
  'affected',
  'evidence',
  'status',
  'priority',
  'team',
  'owner',
  'dueDate',
  'mergedKeys',
  'fixNote',
  'retestEnv',
  'retestRecords',
  'history',
]

export function snapshotIssue(issue: Issue, change?: Pick<ReportBatchIssue, 'changeField' | 'baselineValue' | 'candidateValue' | 'risk'>): ReportBatchIssue {
  const snapshot = Object.fromEntries(batchIssueKeys.map((field) => [field, structuredClone(issue[field as keyof Issue])])) as ReportBatchIssue
  return { ...snapshot, ...change }
}

export function getBatchChanges(batch: ReportBatch, issues: Issue[]): ReportBatchChange[] {
  return batch.items.flatMap((item) => {
    const current = issues.find((issue) => issue.key === item.key)
    if (!current) {
      return [{
        issueKey: item.key,
        field: 'missing',
        label: '问题已不在台账',
        frozenValue: `${item.status} / ${item.team} / ${item.owner}`,
        currentValue: '未找到当前记录',
      }]
    }

    const changes: ReportBatchChange[] = []
    if (current.status !== item.status) {
      changes.push({
        issueKey: item.key,
        field: 'status',
        label: '问题状态变化',
        frozenValue: item.status,
        currentValue: current.status,
      })
    }

    const currentResponsible = `${current.team} / ${current.owner}`
    const frozenResponsible = `${item.team} / ${item.owner}`
    if (currentResponsible !== frozenResponsible) {
      changes.push({
        issueKey: item.key,
        field: 'owner',
        label: '责任人改派',
        frozenValue: frozenResponsible,
        currentValue: currentResponsible,
      })
    }

    const latestRetest = current.retestRecords[current.retestRecords.length - 1]
    const frozenLatestRetest = item.retestRecords[item.retestRecords.length - 1]
    const latestRetestKey = (record?: { id: string; at: string }) => (record ? `${record.id}-${record.at}` : '')
    if (current.retestRecords.length !== item.retestRecords.length || latestRetestKey(latestRetest) !== latestRetestKey(frozenLatestRetest)) {
      changes.push({
        issueKey: item.key,
        field: 'retest',
        label: '产生新的复测记录',
        frozenValue: frozenLatestRetest ? `${frozenLatestRetest.at} · ${frozenLatestRetest.result}` : '尚无复测记录',
        currentValue: latestRetest ? `${latestRetest.at} · ${latestRetest.result}` : '尚无复测记录',
      })
    }

    const currentMerged = [...current.mergedKeys].sort().join('、')
    const frozenMerged = [...item.mergedKeys].sort().join('、')
    if (currentMerged !== frozenMerged) {
      changes.push({
        issueKey: item.key,
        field: 'merge',
        label: '合并关系变化',
        frozenValue: item.mergedKeys.length ? item.mergedKeys.join('、') : '无关联问题',
        currentValue: current.mergedKeys.length ? current.mergedKeys.join('、') : '无关联问题',
      })
    }

    return changes
  })
}

export function isBatchStale(batch: ReportBatch, issues: Issue[]) {
  return getBatchChanges(batch, issues).length > 0
}

export function createReportBatch(input: {
  issues: Issue[]
  selectedKeys: string[]
  changes: Array<{ key: string; field: string; baseline: string; candidate: string; risk: string }>
  baselineVersion: string
  candidateVersion: string
}) {
  const now = dayjs()
  const changeByKey = new Map(input.changes.filter((change) => input.selectedKeys.includes(change.key)).map((change) => [change.key, change]))
  return {
    id: `RB-${now.format('MMDDHHmmss')}-${Math.random().toString(36).slice(2, 6)}`,
    name: `${input.candidateVersion} 评审批次`,
    frozenAt: now.format('YYYY-MM-DD HH:mm:ss'),
    frozenBy: '当前用户',
    baselineVersion: input.baselineVersion,
    candidateVersion: input.candidateVersion,
    selectedKeys: input.selectedKeys,
    items: input.issues
      .filter((issue) => input.selectedKeys.includes(issue.key))
      .map((issue) => {
        const change = changeByKey.get(issue.key)
        return snapshotIssue(issue, change ? {
          changeField: change.field,
          baselineValue: change.baseline,
          candidateValue: change.candidate,
          risk: change.risk,
        } : undefined)
      }),
  } satisfies ReportBatch
}
