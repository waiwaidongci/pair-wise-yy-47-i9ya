export type IssueStatus = '待分配' | '修复中' | '待复测' | '已通过' | '已退回' | '不适用'

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
  retestRecords: Array<{ id: string; actor: string; result: string; note: string; at: string }>
  history: Array<{ at: string; actor: string; action: string; detail: string }>
}

/** 版本差异页中勾选采纳的变更项，冻结时随批次一并存档 */
export type DiffChange = {
  key: string
  field: string
  baseline: string
  candidate: string
  risk: '低' | '中' | '高'
}

/** 冻结瞬间单个问题的结论快照，评审看到的就是这份数据 */
export type BatchIssueSnapshot = {
  key: string
  title: string
  site: string
  version: string
  wcag: string[]
  impact: Issue['impact']
  status: IssueStatus
  priority: Issue['priority']
  team: string
  owner: string
  dueDate: string
  fixNote?: string
  retestEnv?: string
  retestRecords: Issue['retestRecords']
  mergedKeys: string[]
}

/** 把批次挡下的具体原因：冻结口径 vs 当前台账 */
export type BlockerKind = '状态变化' | '责任人变化' | '复测记录' | '合并关系' | '问题缺失'
export type BatchBlocker = {
  kind: BlockerKind
  detail: string
}

/**
 * 批次状态：
 * - 当前有效：快照与台账一致，可作为当前版本结论导出
 * - 需重做：台账已发生复测 / 改派 / 合并，不能继续导出
 * - 已归档：已被更新批次替代，永久保留，仅供追溯，不再实时校验
 */
export type BatchState = '当前有效' | '需重做' | '已归档'

export type ReportBatch = {
  id: string
  name: string
  frozenAt: string
  frozenBy: string
  baselineVersion: string
  candidateVersion: string
  note: string
  items: BatchIssueSnapshot[]
  changes: DiffChange[]
  state: BatchState
  /** 归档瞬间记录的挡批原因，用于追溯是哪些问题把旧批次挡下 */
  archivedBlockers: BatchBlocker[]
  supersededBy?: string
  supersededAt?: string
}
