import type { BatchBlocker, BatchIssueSnapshot, BatchState, BlockerKind, DiffChange, Issue } from './types'

export const blockerColor: Record<BlockerKind, string> = {
  状态变化: 'volcano',
  复测记录: 'orange',
  责任人变化: 'gold',
  合并关系: 'purple',
  问题缺失: 'default',
}

export const batchStateColor: Record<BatchState, string> = {
  当前有效: 'success',
  需重做: 'error',
  已归档: 'default',
}

/** 冻结瞬间拷贝评审需要的问题口径，后续台账再变也不会影响这份快照 */
export function snapshotIssue(issue: Issue): BatchIssueSnapshot {
  return {
    key: issue.key,
    title: issue.title,
    site: issue.site,
    version: issue.version,
    wcag: [...issue.wcag],
    impact: issue.impact,
    status: issue.status,
    priority: issue.priority,
    team: issue.team,
    owner: issue.owner,
    dueDate: issue.dueDate,
    fixNote: issue.fixNote,
    retestEnv: issue.retestEnv,
    retestRecords: structuredClone(issue.retestRecords),
    mergedKeys: [...issue.mergedKeys],
  }
}

const mergedSignature = (keys: string[]) => [...keys].sort().join('、')

/**
 * 用当前台账实时比对批次快照：
 * 复测、改派、合并 / 拆分、删除都会立刻产生挡批原因。
 */
export function evaluateBatch(batch: { items: BatchIssueSnapshot[] }, issues: Issue[]): BatchBlocker[] {
  const liveByKey = new Map(issues.map((issue) => [issue.key, issue]))
  const blockers: BatchBlocker[] = []

  for (const snapshot of batch.items) {
    const live = liveByKey.get(snapshot.key)
    if (!live) {
      blockers.push({ kind: '问题缺失', detail: `${snapshot.key} 已不在问题台账中，冻结结论失去对应记录。` })
      continue
    }

    if (live.status !== snapshot.status) {
      blockers.push({
        kind: '状态变化',
        detail: `${snapshot.key} 冻结时为「${snapshot.status}」，台账已变为「${live.status}」。`,
      })
    }

    if (live.team !== snapshot.team || live.owner !== snapshot.owner) {
      blockers.push({
        kind: '责任人变化',
        detail: `${snapshot.key} 冻结责任方为 ${snapshot.team} / ${snapshot.owner}，现已改派给 ${live.team} / ${live.owner}。`,
      })
    }

    if (live.retestRecords.length !== snapshot.retestRecords.length) {
      const added = live.retestRecords.slice(snapshot.retestRecords.length)
      const latest = added[added.length - 1]
      blockers.push({
        kind: '复测记录',
        detail: `${snapshot.key} 冻结后新增 ${added.length} 条复测记录（最近：${latest?.result ?? '未知'} · ${latest?.at ?? ''}），冻结结论未包含该复测。`,
      })
    }

    if (mergedSignature(live.mergedKeys) !== mergedSignature(snapshot.mergedKeys)) {
      blockers.push({
        kind: '合并关系',
        detail:
          `${snapshot.key} 冻结时合并关系为「${snapshot.mergedKeys.length ? snapshot.mergedKeys.join('、') : '无'}」，` +
          `台账现为「${live.mergedKeys.length ? live.mergedKeys.join('、') : '无'}」。`,
      })
    }
  }

  return blockers
}

export type BatchEvaluation = {
  state: BatchState
  blockers: BatchBlocker[]
}

/** 已归档批次沿用归档时记录的原因；其余批次每次渲染都用台账实时校验 */
export function getBatchState(batch: { state: BatchState; items: BatchIssueSnapshot[]; archivedBlockers: BatchBlocker[] }, issues: Issue[]): BatchEvaluation {
  if (batch.state === '已归档') return { state: '已归档', blockers: batch.archivedBlockers }
  const blockers = evaluateBatch(batch, issues)
  return { state: blockers.length ? '需重做' : '当前有效', blockers }
}

/** 版本差异清单中各问题的候选 / 基线描述，供版本差异页与冻结弹窗复用 */
export const diffDescriptions: Record<string, { field: string; baseline: string; candidate: string; risk: DiffChange['risk'] }> = {
  'A11Y-1048': { field: '修复状态', baseline: '待复测', candidate: '已提交复测材料', risk: '低' },
  'A11Y-1074': { field: '图表色板', baseline: '#98B7AF / 对比度 2.6:1', candidate: '#1D6570 / 对比度 5.1:1 + 纹理', risk: '低' },
  'A11Y-1083': { field: '错误提示实现', baseline: '视觉错误颜色', candidate: 'aria-live + aria-describedby', risk: '中' },
}
