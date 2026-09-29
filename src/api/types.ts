export type IssueStatus = '待分配' | '修复中' | '待复测' | '已通过' | '已退回' | '不适用'

export type RetestRecord = { id: string; actor: string; result: string; note: string; at: string }

export type IssueHistoryRecord = { at: string; actor: string; action: string; detail: string }

export type Issue = {
  key: string
  title: string
  site: string
  version: string
  wcag: string[]
  issueType: string
  impact: '致命' | '严重' | '中等' | '轻微'
  affected: string
  reproduction: string
  evidence: string
  rootCause: string
  status: IssueStatus
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  team: string
  owner: string
  dueDate: string
  mergedKeys: string[]
  fixNote?: string
  retestEnv?: string
  retestRecords: RetestRecord[]
  history: IssueHistoryRecord[]
}

export type ReportBatchIssue = Pick<
  Issue,
  | 'key'
  | 'title'
  | 'site'
  | 'version'
  | 'wcag'
  | 'impact'
  | 'affected'
  | 'evidence'
  | 'status'
  | 'priority'
  | 'team'
  | 'owner'
  | 'dueDate'
  | 'mergedKeys'
  | 'fixNote'
  | 'retestEnv'
  | 'retestRecords'
  | 'history'
> & {
  changeField?: string
  baselineValue?: string
  candidateValue?: string
  risk?: string
}

export type ReportBatchChange = {
  issueKey: string
  field: 'missing' | 'status' | 'owner' | 'retest' | 'merge'
  label: string
  frozenValue: string
  currentValue: string
}

export type ReportBatch = {
  id: string
  name: string
  frozenAt: string
  frozenBy: string
  baselineVersion: string
  candidateVersion: string
  selectedKeys: string[]
  items: ReportBatchIssue[]
}
