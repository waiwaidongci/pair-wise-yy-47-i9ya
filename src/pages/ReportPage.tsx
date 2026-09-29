import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Descriptions,
  Drawer,
  Empty,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd'
import { DownloadOutlined, FilePdfOutlined, HistoryOutlined, LockOutlined, ReloadOutlined } from '@ant-design/icons'
import { useIssues } from '../api/useIssues'
import { useWorkspaceStore } from '../store/useWorkspaceStore'
import { batchStateColor, blockerColor, getBatchState } from '../api/batches'
import type { BatchBlocker, ReportBatch } from '../api/types'

const impactColor: Record<string, string> = { 致命: 'red', 严重: 'volcano', 中等: 'gold', 轻微: 'blue' }

export default function ReportPage() {
  useIssues()
  const navigate = useNavigate()
  const issues = useWorkspaceStore((state) => state.issues)
  const batches = useWorkspaceStore((state) => state.batches)
  const [searchParams, setSearchParams] = useSearchParams()
  const [detail, setDetail] = useState<ReportBatch | null>(null)
  const [includeEvidence, setIncludeEvidence] = useState(true)
  const [includeRetest, setIncludeRetest] = useState(true)

  const evaluated = useMemo(
    () => batches.map((batch) => ({ batch, ...getBatchState(batch, issues) })),
    [batches, issues],
  )

  const currentId = searchParams.get('batch')
  const current = evaluated.find((item) => item.batch.id === currentId) ?? evaluated[0]

  useEffect(() => {
    if (!currentId && current) setSearchParams({ batch: current.batch.id }, { replace: true })
  }, [currentId, current, setSearchParams])

  const selectBatch = (id: string) => setSearchParams({ batch: id })

  const refuseStale = () => message.warning('该批次已被后续复测 / 改派 / 合并挡下，请重新冻结后再导出当前结论')

  const exportCsv = (batch: ReportBatch, blockers: BatchBlocker[]) => {
    if (blockers.length > 0 && batch.state !== '已归档') return refuseStale()
    const stamp = batch.state === '已归档' ? `（历史归档-${batch.id}）` : ''
    const rows = [
      ['批次编号', '批次名称', '冻结时间', '基线版本', '候选版本'],
      [batch.id, batch.name, batch.frozenAt, batch.baselineVersion, batch.candidateVersion],
      [],
      ['编号', '站点', '版本', '问题', 'WCAG', '影响', '冻结状态', '团队', '负责人', '截止日期', '最近复测'],
      ...batch.items.map((item) => [
        item.key,
        item.site,
        item.version,
        item.title,
        item.wcag.join(' / '),
        item.impact,
        item.status,
        item.team,
        item.owner,
        item.dueDate,
        item.retestRecords.at(-1) ? `${item.retestRecords.at(-1)!.result} · ${item.retestRecords.at(-1)!.actor} · ${item.retestRecords.at(-1)!.at}` : '无',
      ]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `无障碍整改报告-${batch.id}${stamp}.csv`
    link.click()
    URL.revokeObjectURL(url)
    message.success(batch.state === '已归档' ? `已导出历史归档批次 ${batch.id}（不作为当前结论）` : `批次 ${batch.id} 报告已导出`)
  }

  const printReport = (batch: ReportBatch, blockers: BatchBlocker[]) => {
    if (blockers.length > 0 && batch.state !== '已归档') return refuseStale()
    window.print()
  }

  const refreeze = () => {
    if (!current) return navigate('/versions')
    navigate('/versions', { state: { presetKeys: current.batch.items.map((item) => item.key), fromBatch: current.batch.id } })
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">REPORT BATCH / 整改报告批次</p>
          <h1>冻结批次驱动的整改报告</h1>
          <p className="muted">批次冻结时的问题状态、责任人和复测记录即为评审口径；台账变动会实时把失实批次挡下。</p>
        </div>
        <Space>
          <Button icon={<HistoryOutlined />} disabled={!batches.length} onClick={refreeze}>去版本差异重新冻结</Button>
        </Space>
      </div>

      {batches.length === 0 && (
        <div className="panel" style={{ padding: 40 }}>
          <Empty description="还没有冻结过报告批次">
            <Button type="primary" icon={<LockOutlined />} onClick={() => navigate('/versions')}>去版本差异页冻结首批报告</Button>
          </Empty>
        </div>
      )}

      {batches.length > 0 && (
        <div className="batch-layout">
          <div className="panel batch-list">
            <div className="panel-head"><h3>报告批次</h3><Tag color="cyan">{batches.length}</Tag></div>
            <div style={{ padding: 8 }}>
              {evaluated.map(({ batch, state, blockers }) => (
                <button
                  type="button"
                  key={batch.id}
                  className={`batch-card${current?.batch.id === batch.id ? ' active' : ''}`}
                  onClick={() => selectBatch(batch.id)}
                >
                  <div className="batch-card-top">
                    <Typography.Text strong>{batch.id}</Typography.Text>
                    <Tag color={batchStateColor[state]}>{state}</Tag>
                  </div>
                  <div className="batch-card-name">{batch.name}</div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    {batch.frozenAt} · {batch.items.length} 项
                  </div>
                  {state === '需重做' && <div className="batch-card-warn"><Badge status="error" />{blockers.length} 项问题把批次挡下</div>}
                  {state === '已归档' && batch.supersededBy && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>已由 {batch.supersededBy} 替代</div>}
                </button>
              ))}
            </div>
          </div>

          {current && (
            <div className="batch-main">
              <div className="panel" style={{ marginBottom: 14 }}>
                <div className="panel-head">
                  <h3>{current.batch.name}</h3>
                  <Tag color={batchStateColor[current.state]}>{current.state}</Tag>
                </div>
                <div style={{ padding: '14px 16px' }}>
                  <Descriptions size="small" column={{ xs: 1, sm: 2, md: 4 }}>
                    <Descriptions.Item label="批次编号">{current.batch.id}</Descriptions.Item>
                    <Descriptions.Item label="冻结时间">{current.batch.frozenAt}</Descriptions.Item>
                    <Descriptions.Item label="冻结人">{current.batch.frozenBy}</Descriptions.Item>
                    <Descriptions.Item label="版本">{current.batch.baselineVersion} → {current.batch.candidateVersion}</Descriptions.Item>
                  </Descriptions>
                  {current.batch.note && <Typography.Paragraph type="secondary" style={{ marginTop: 10, marginBottom: 0, fontSize: 12 }}>{current.batch.note}</Typography.Paragraph>}
                  <Space wrap style={{ marginTop: 12 }}>
                    <Button
                      icon={<DownloadOutlined />}
                      onClick={() => exportCsv(current.batch, current.blockers)}
                    >
                      导出 CSV
                    </Button>
                    <Button
                      type="primary"
                      icon={<FilePdfOutlined />}
                      onClick={() => printReport(current.batch, current.blockers)}
                    >
                      打印 / PDF
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={refreeze}>重新冻结</Button>
                    <Button type="link" onClick={() => setDetail(current.batch)}>查看批次详情</Button>
                  </Space>
                </div>
              </div>

              {current.state === '需重做' && (
                <Alert
                  type="error"
                  showIcon
                  style={{ marginBottom: 14 }}
                  message={`该批次已失实（${current.blockers.length} 项挡批原因），不能导出为当前版本结论`}
                  description={
                    <div>
                      <div style={{ marginBottom: 8 }}>冻结后问题台账发生了以下变化，请处理后到版本差异页重新冻结；旧批次会自动归档保留。</div>
                      <Space direction="vertical" size={4}>
                        {current.blockers.map((blocker, index) => (
                          <div key={index}><Tag color={blockerColor[blocker.kind]}>{blocker.kind}</Tag>{blocker.detail}</div>
                        ))}
                      </Space>
                    </div>
                  }
                />
              )}

              {current.state === '已归档' && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 14 }}
                  message={`该批次已被 ${current.batch.supersededBy ?? '更新批次'} 替代，仅作历史归档追溯`}
                  description={
                    current.blockers.length > 0 ? (
                      <Space direction="vertical" size={4}>
                        <span>归档时下列问题挡下了该批次（已按归档时点固化）：</span>
                        {current.blockers.map((blocker, index) => (
                          <div key={index}><Tag color={blockerColor[blocker.kind]}>{blocker.kind}</Tag>{blocker.detail}</div>
                        ))}
                      </Space>
                    ) : '归档时台账与冻结口径一致，为被新一轮冻结正常替代。'
                  }
                />
              )}

              <article className="panel report-sheet">
                <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '3px solid #173e4d', paddingBottom: 16 }}>
                  <div>
                    <Typography.Text type="secondary">数字体验无障碍治理项目</Typography.Text>
                    <h2>网站无障碍整改报告</h2>
                    <Typography.Text>批次 {current.batch.id} · 冻结于 {current.batch.frozenAt}</Typography.Text>
                    {current.state === '已归档' && <div><Tag color="default" style={{ marginTop: 6 }}>历史归档 · 非当前结论</Tag></div>}
                    {current.state === '需重做' && <div><Tag color="error" style={{ marginTop: 6 }}>冻结口径已失实 · 禁止作为当前结论导出</Tag></div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Tag color="blue">{current.batch.candidateVersion}</Tag>
                    <div>问题 {current.batch.items.length} 项</div>
                    <div>冻结时通过 {current.batch.items.filter((item) => item.status === '已通过').length} 项</div>
                  </div>
                </header>
                <Space style={{ marginTop: 12 }}>
                  <Checkbox checked={includeEvidence} onChange={(event) => setIncludeEvidence(event.target.checked)}>包含证据链接</Checkbox>
                  <Checkbox checked={includeRetest} onChange={(event) => setIncludeRetest(event.target.checked)}>包含冻结时复测记录</Checkbox>
                </Space>
                <table>
                  <thead><tr><th>编号</th><th>页面 / 范围</th><th>问题与 WCAG</th><th>影响</th><th>冻结状态 / 责任</th><th>截止</th></tr></thead>
                  <tbody>
                    {current.batch.items.map((item) => {
                      const live = issues.find((issue) => issue.key === item.key)
                      const drifted = live && live.status !== item.status
                      return (
                        <tr key={item.key} className={drifted ? 'row-stale' : ''}>
                          <td>{item.key}{drifted && <div><Tag color="error" style={{ marginTop: 4 }}>台账已变为{live?.status}</Tag></div>}</td>
                          <td>{item.site}<br /><Typography.Text type="secondary">{item.version}</Typography.Text></td>
                          <td>
                            <strong>{item.title}</strong><br />{item.wcag.join(' / ')}
                            {includeEvidence && <><br /><Typography.Link href={issues.find((issue) => issue.key === item.key)?.evidence}>查看证据</Typography.Link></>}
                            {includeRetest && item.retestRecords.length > 0 && (
                              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                                最近复测（冻结时）：{item.retestRecords.at(-1)?.result} · {item.retestRecords.at(-1)?.actor} · {item.retestRecords.at(-1)?.at}
                              </div>
                            )}
                          </td>
                          <td><Tag color={impactColor[item.impact]}>{item.impact}</Tag></td>
                          <td>{item.status}<br />{item.team} / {item.owner}</td>
                          <td>{item.dueDate}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </article>
            </div>
          )}
        </div>
      )}

      <Drawer
        title={detail ? `${detail.id} · 批次详情` : ''}
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        width={620}
      >
        {detail && (() => {
          const evaluation = getBatchState(detail, issues)
          return (
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              <Space wrap>
                <Tag color={batchStateColor[evaluation.state]}>{evaluation.state}</Tag>
                <Tag>{detail.baselineVersion} → {detail.candidateVersion}</Tag>
                <Tag>{detail.items.length} 个问题</Tag>
                {detail.supersededBy && <Tag color="default">已由 {detail.supersededBy} 替代 · {detail.supersededAt}</Tag>}
              </Space>
              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="批次名称">{detail.name}</Descriptions.Item>
                <Descriptions.Item label="冻结时间 / 人">{detail.frozenAt} · {detail.frozenBy}</Descriptions.Item>
                <Descriptions.Item label="提交说明">{detail.note || '无'}</Descriptions.Item>
              </Descriptions>

              <div>
                <Typography.Title level={5}>挡批原因（{evaluation.blockers.length}）</Typography.Title>
                {evaluation.blockers.length === 0 ? (
                  <Typography.Text type="secondary">冻结口径与当前台账一致，没有问题挡下该批次。</Typography.Text>
                ) : (
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    {evaluation.blockers.map((blocker, index) => (
                      <div key={index} className="blocker-item">
                        <Tag color={blockerColor[blocker.kind]}>{blocker.kind}</Tag>
                        <span>{blocker.detail}</span>
                      </div>
                    ))}
                  </Space>
                )}
              </div>

              <div>
                <Typography.Title level={5}>冻结的变更清单（{detail.changes.length}）</Typography.Title>
                <Table
                  rowKey="key"
                  size="small"
                  pagination={false}
                  dataSource={detail.changes}
                  columns={[
                    { title: '问题', dataIndex: 'key', width: 100 },
                    { title: '变更项', dataIndex: 'field', width: 100 },
                    { title: '基线', dataIndex: 'baseline', render: (value) => <Typography.Text type="secondary" style={{ fontSize: 12 }}>{value}</Typography.Text> },
                    { title: '采纳为', dataIndex: 'candidate', render: (value) => <Typography.Text style={{ fontSize: 12 }}>{value}</Typography.Text> },
                  ]}
                />
              </div>

              <div>
                <Typography.Title level={5}>冻结时的问题口径</Typography.Title>
                <Table
                  rowKey="key"
                  size="small"
                  pagination={false}
                  dataSource={detail.items}
                  columns={[
                    { title: '编号', dataIndex: 'key', width: 100 },
                    { title: '冻结状态', dataIndex: 'status', width: 90, render: (value) => <Tag>{value}</Tag> },
                    { title: '责任方', render: (_, item) => `${item.team} / ${item.owner}` },
                    { title: '复测记录', render: (_, item) => item.retestRecords.length ? `${item.retestRecords.at(-1)?.result} · ${item.retestRecords.at(-1)?.at}` : '无' },
                  ]}
                />
              </div>

              <div>
                <Typography.Title level={5}>复测记录（冻结时点）</Typography.Title>
                {detail.items.every((item) => item.retestRecords.length === 0) && <Typography.Text type="secondary">冻结时各问题均无复测记录。</Typography.Text>}
                <Timeline
                  items={detail.items.flatMap((item) =>
                    item.retestRecords.map((record) => ({
                      color: record.result === '通过' ? 'green' : record.result === '退回' ? 'red' : 'gray',
                      children: (
                        <div>
                          <Typography.Text strong>{item.key} · {record.result}</Typography.Text>
                          <div>{record.note}</div>
                          <Typography.Text type="secondary" style={{ fontSize: 11 }}>{record.actor} · {record.at} · {item.retestEnv ?? '环境未记录'}</Typography.Text>
                        </div>
                      ),
                    })),
                  )}
                />
              </div>
            </Space>
          )
        })()}
      </Drawer>
    </section>
  )
}
