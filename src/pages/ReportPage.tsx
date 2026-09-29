import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Checkbox, Empty, Select, Space, Table, Tag, Typography, message } from 'antd'
import { DownloadOutlined, FilePdfOutlined, ReloadOutlined } from '@ant-design/icons'
import { useIssues } from '../api/useIssues'
import { getBatchChanges } from '../api/reportBatch'
import type { ReportBatch } from '../api/types'
import { useWorkspaceStore } from '../store/useWorkspaceStore'

const impactColor: Record<string, string> = { 致命: 'red', 严重: 'volcano', 中等: 'gold', 轻微: 'blue' }
const statusColor: Record<string, string> = { 待分配: 'default', 修复中: 'processing', 待复测: 'orange', 已通过: 'success', 已退回: 'error', 不适用: 'default' }

export default function ReportPage() {
  useIssues()
  const navigate = useNavigate()
  const issues = useWorkspaceStore((state) => state.issues)
  const reportBatches = useWorkspaceStore((state) => state.reportBatches)
  const [selectedBatchId, setSelectedBatchId] = useState<string>()
  const [site, setSite] = useState('全部站点')
  const [includeEvidence, setIncludeEvidence] = useState(true)
  const [includeHistory, setIncludeHistory] = useState(true)
  const latestBatch = reportBatches[reportBatches.length - 1]
  const selectedBatch = reportBatches.find((batch) => batch.id === selectedBatchId) ?? latestBatch ?? null
  const blockingChanges = selectedBatch ? getBatchChanges(selectedBatch, issues) : []
  const stale = blockingChanges.length > 0
  const visible = selectedBatch?.items.filter((item) => site === '全部站点' || item.site === site) ?? []
  const sites = selectedBatch ? [...new Set(selectedBatch.items.map((item) => item.site))] : []

  const exportCsv = (batch: ReportBatch) => {
    if (stale) {
      message.warning('该批次已被复测、改派或合并挡下，请重新冻结后再导出当前结论')
      return
    }

    const rows = [
      ['批次', '站点', '版本', '编号', '问题', 'WCAG', '影响', '冻结状态', '团队', '负责人', '截止日期', '复测结论', '复测时间', '复测记录'],
      ...visible.map((issue) => {
        const retest = issue.retestRecords[issue.retestRecords.length - 1]
        return [
          batch.id,
          issue.site,
          issue.version,
          issue.key,
          issue.title,
          issue.wcag.join(' / '),
          issue.impact,
          issue.status,
          issue.team,
          issue.owner,
          issue.dueDate,
          retest?.result ?? '',
          retest?.at ?? '',
          retest?.note ?? '',
        ]
      }),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `无障碍整改报告-${batch.id}-${site}.csv`
    link.click()
    URL.revokeObjectURL(url)
    message.success(`已导出冻结批次 ${batch.id}`)
  }

  const printReport = () => {
    if (!selectedBatch) return
    if (stale) {
      message.warning('过期批次不能打印为当前结论，请重新冻结')
      return
    }
    window.print()
  }

  const selectBatch = (batchId: string) => {
    setSelectedBatchId(batchId)
    setSite('全部站点')
  }

  return (
    <section className={`page${stale ? ' stale-report-page' : ''}`}>
      <div className="page-head no-print">
        <div>
          <p className="eyebrow">REPORT / 整改报告</p>
          <h1>按冻结批次输出评审报告</h1>
          <p className="muted">报告只使用冻结时的问题状态、责任人和复测记录；台账后续变化会立即阻断旧批次导出。</p>
        </div>
        <Space>
          <Button icon={<DownloadOutlined />} disabled={!selectedBatch || stale} onClick={() => selectedBatch && exportCsv(selectedBatch)}>导出 CSV</Button>
          <Button type="primary" icon={<FilePdfOutlined />} disabled={!selectedBatch || stale} onClick={printReport}>打印 / PDF</Button>
        </Space>
      </div>

      <div className="panel no-print" style={{ padding: 12, marginBottom: 14 }}>
        <Space wrap>
          <span>报告批次</span>
          <Select
            style={{ width: 300 }}
            placeholder="选择冻结批次"
            value={selectedBatch?.id}
            onChange={selectBatch}
            options={[...reportBatches].reverse().map((batch) => ({
              value: batch.id,
              label: `${batch.id} · ${batch.name} · ${batch.frozenAt}`,
            }))}
          />
          {selectedBatch && <Tag color={stale ? 'error' : 'success'}>{stale ? '需要重做' : selectedBatch.id === latestBatch?.id ? '当前批次' : '历史批次'}</Tag>}
          <span>站点范围</span>
          <Select value={site} onChange={setSite} style={{ width: 150 }} options={['全部站点', ...sites].map((value) => ({ value }))} disabled={!selectedBatch} />
          <Checkbox checked={includeEvidence} onChange={(event) => setIncludeEvidence(event.target.checked)}>包含证据链接</Checkbox>
          <Checkbox checked={includeHistory} onChange={(event) => setIncludeHistory(event.target.checked)}>包含操作历史</Checkbox>
        </Space>
      </div>

      {!selectedBatch && (
        <div className="panel" style={{ padding: 42, textAlign: 'center' }}>
          <Empty description="还没有可导出的冻结批次">
            <Button type="primary" onClick={() => navigate('/versions')}>去版本差异页冻结</Button>
          </Empty>
        </div>
      )}

      {selectedBatch && stale && (
        <Alert
          className="no-print"
          style={{ marginBottom: 14 }}
          type="error"
          showIcon
          action={<Button danger icon={<ReloadOutlined />} onClick={() => navigate('/versions')}>去重新冻结</Button>}
          message={`批次 ${selectedBatch.id} 已被台账变化挡下，不能继续导出成当前结论`}
          description={
            <div>
              <div>重新冻结会保留本批次，并生成一套新的评审报告。阻断项如下：</div>
              <Space wrap style={{ marginTop: 8 }}>
                {blockingChanges.map((change) => (
                  <Tag key={`${change.issueKey}-${change.field}`} color="error">{change.issueKey} · {change.label}</Tag>
                ))}
              </Space>
            </div>
          }
        />
      )}

      {selectedBatch && !stale && selectedBatch.id !== latestBatch?.id && (
        <Alert
          className="no-print"
          style={{ marginBottom: 14 }}
          type="info"
          showIcon
          message="正在查看历史冻结批次"
          description="该批次与当前台账一致，可按历史冻结口径导出；最新批次已另存为新记录，不会覆盖本批。"
        />
      )}

      {selectedBatch && (
        <article className={`panel report-sheet${stale ? ' stale-report' : ''}`}>
          <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, borderBottom: '3px solid #173e4d', paddingBottom: 16 }}>
            <div>
              <Typography.Text type="secondary">数字体验无障碍治理项目</Typography.Text>
              <h2>网站无障碍整改报告</h2>
              <Typography.Text>
                批次 {selectedBatch.id} · 冻结时间：{selectedBatch.frozenAt} · 冻结人：{selectedBatch.frozenBy}
              </Typography.Text>
              <div><Typography.Text type="secondary">{selectedBatch.baselineVersion} → {selectedBatch.candidateVersion} · WCAG 2.2 AA</Typography.Text></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Tag color={stale ? 'error' : 'success'}>{stale ? '需要重做' : '冻结结论有效'}</Tag>
              <div>{site}</div>
              <div>问题 {visible.length} 项</div>
              <div>通过 {visible.filter((item) => item.status === '已通过').length} 项</div>
            </div>
          </header>
          <table>
            <thead><tr><th>编号</th><th>页面 / 范围</th><th>问题与 WCAG</th><th>影响</th><th>冻结状态 / 责任</th><th>冻结复测记录</th><th>截止</th></tr></thead>
            <tbody>
              {visible.map((issue) => {
                const blocked = blockingChanges.filter((change) => change.issueKey === issue.key)
                return (
                  <tr key={issue.key} className={blocked.length ? 'batch-blocked-row' : ''}>
                    <td>
                      {issue.key}
                      {blocked.length > 0 && <div style={{ marginTop: 4 }}>{blocked.map((change) => <Tag key={change.field} color="error">{change.label}</Tag>)}</div>}
                    </td>
                    <td>{issue.site}<br /><Typography.Text type="secondary">{issue.version}</Typography.Text></td>
                    <td>
                      <strong>{issue.title}</strong><br />
                      {issue.wcag.join(' / ')}
                      {includeEvidence && <><br /><Typography.Link href={issue.evidence}>查看证据</Typography.Link></>}
                      {issue.changeField && <><br /><Typography.Text type="secondary">提交变更：{issue.changeField}（{issue.baselineValue} → {issue.candidateValue}）</Typography.Text></>}
                    </td>
                    <td><Tag color={impactColor[issue.impact]}>{issue.impact}</Tag></td>
                    <td><Tag color={statusColor[issue.status]}>{issue.status}</Tag><br />{issue.team} / {issue.owner}</td>
                    <td>
                      {issue.retestRecords.length ? (
                        <div style={{ display: 'grid', gap: 6 }}>
                          {issue.retestRecords.map((record) => (
                            <div key={record.id}>
                              <Tag color={record.result === '通过' ? 'success' : record.result === '退回' ? 'error' : 'default'}>{record.result}</Tag>
                              <div>{record.actor} · {record.at}</div>
                              <Typography.Text type="secondary" style={{ fontSize: 11 }}>{record.note}</Typography.Text>
                            </div>
                          ))}
                        </div>
                      ) : <Typography.Text type="secondary">冻结时暂无复测记录</Typography.Text>}
                    </td>
                    <td>{issue.dueDate}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {stale && (
            <div className="stale-block no-print">
              <Typography.Title level={5}>阻断详情</Typography.Title>
              <Table
                rowKey={(record) => `${record.issueKey}-${record.field}`}
                size="small"
                pagination={false}
                dataSource={blockingChanges}
                columns={[
                  { title: '问题', dataIndex: 'issueKey', width: 130 },
                  { title: '阻断原因', dataIndex: 'label', width: 150 },
                  { title: '冻结时', dataIndex: 'frozenValue' },
                  { title: '当前台账', dataIndex: 'currentValue' },
                ]}
              />
            </div>
          )}

          {includeHistory && (
            <div style={{ marginTop: 20 }}>
              <Typography.Title level={5}>冻结时操作历史</Typography.Title>
              {visible.flatMap((issue) => issue.history.slice(-1).map((event) => (
                <div className="timeline-item" key={`${issue.key}-${event.at}-${event.action}`}>
                  <strong>{issue.key} · {event.action}</strong>
                  <div>{event.detail}</div>
                  <span className="muted">{event.actor} · {event.at}</span>
                </div>
              )))}
            </div>
          )}
        </article>
      )}
    </section>
  )
}
