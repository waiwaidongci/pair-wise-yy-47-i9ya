import { useState } from 'react'
import { Button, Checkbox, Select, Space, Table, Tag, Typography, message } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { useIssues } from '../api/useIssues'
import { createReportBatch, getBatchChanges } from '../api/reportBatch'
import type { ReportBatch } from '../api/types'
import { useWorkspaceStore } from '../store/useWorkspaceStore'

const impactColor: Record<string, string> = { 致命: 'red', 严重: 'volcano', 中等: 'gold', 轻微: 'blue' }

export default function VersionsPage() {
  useIssues()
  const issues = useWorkspaceStore((state) => state.issues)
  const reportBatches = useWorkspaceStore((state) => state.reportBatches)
  const addReportBatch = useWorkspaceStore((state) => state.addReportBatch)
  const [baselineVersion, setBaselineVersion] = useState('v4.18')
  const [candidateVersion, setCandidateVersion] = useState('v4.18-rc2')
  const [accepted, setAccepted] = useState<string[]>(['A11Y-1074'])

  const diffSpecs = [
    { key: 'A11Y-1048', field: '修复状态', baseline: '待复测', candidate: '已提交复测材料', risk: '低' },
    { key: 'A11Y-1074', field: '图表色板', baseline: '#98B7AF / 对比度 2.6:1', candidate: '#1D6570 / 对比度 5.1:1 + 纹理', risk: '低' },
    { key: 'A11Y-1083', field: '错误提示实现', baseline: '视觉错误颜色', candidate: 'aria-live + aria-describedby', risk: '中' },
  ]
  const diffs = diffSpecs
    .map((spec) => {
      const issue = issues.find((item) => item.key === spec.key)
      return issue ? { ...spec, issue } : null
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  const toggle = (key: string, checked: boolean) => {
    setAccepted((current) => checked ? [...new Set([...current, key])] : current.filter((item) => item !== key))
  }

  const freezeBatch = () => {
    const batch = createReportBatch({
      issues,
      selectedKeys: accepted,
      changes: diffs.map((diff) => ({ key: diff.key, field: diff.field, baseline: diff.baseline, candidate: diff.candidate, risk: diff.risk })),
      baselineVersion,
      candidateVersion,
    })
    addReportBatch(batch)
    message.success(`已冻结报告批次 ${batch.id}，后续台账变化不会改动该快照`)
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">VERSION DIFF / 版本差异</p>
          <h1>比较整改版本并冻结评审结论</h1>
          <p className="muted">先选择本次提交的变更，再冻结问题状态、责任人和复测记录；重新冻结会保留历史批次。</p>
        </div>
        <Space>
          <Select value={baselineVersion} onChange={setBaselineVersion} options={[{ value: 'v4.18' }, { value: 'v4.17' }]} style={{ width: 110 }} />
          <span>对比</span>
          <Select value={candidateVersion} onChange={setCandidateVersion} options={[{ value: 'v4.18-rc2' }, { value: 'v4.19-dev' }]} style={{ width: 130 }} />
          <Button type="primary" icon={<LockOutlined />} disabled={!accepted.length} onClick={freezeBatch}>冻结所选为报告批次</Button>
        </Space>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>待提交变更清单</h3>
          <Space>
            <Tag color="blue">基线 {baselineVersion}</Tag>
            <Tag color="green">候选 {candidateVersion}</Tag>
            <Typography.Text type="secondary">已选 {accepted.length} 项</Typography.Text>
          </Space>
        </div>
        <Table
          rowKey="key"
          dataSource={diffs}
          pagination={false}
          scroll={{ x: 1080 }}
          columns={[
            { title: '纳入批次', width: 90, render: (_, record) => <Checkbox checked={accepted.includes(record.key)} onChange={(event) => toggle(record.key, event.target.checked)} /> },
            { title: '问题', width: 250, render: (_, record) => <div><Typography.Text strong>{record.key}</Typography.Text><div>{record.issue.title}</div><Typography.Text type="secondary" style={{ fontSize: 11 }}>{record.issue.team} / {record.issue.owner}</Typography.Text></div> },
            { title: '变更项', dataIndex: 'field', width: 130 },
            { title: '当前基线', dataIndex: 'baseline', width: 260, render: (value) => <span style={{ color: '#9a4d35' }}>{value}</span> },
            { title: '候选版本', dataIndex: 'candidate', width: 300, render: (value) => <span style={{ color: '#26705a' }}>{value}</span> },
            { title: '冻结时状态 / 复测', width: 180, render: (_, record) => <div><Tag color={record.issue.status === '已通过' ? 'success' : record.issue.status === '已退回' ? 'error' : 'orange'}>{record.issue.status}</Tag><div className="muted" style={{ fontSize: 11 }}>{record.issue.retestRecords.length ? `复测 ${record.issue.retestRecords.length} 次` : '暂无复测记录'}</div></div> },
            { title: '风险', dataIndex: 'risk', width: 80, render: (value) => <Tag color={value === '中' ? 'gold' : 'green'}>{value}</Tag> },
          ]}
        />
      </div>

      <div className="report-grid" style={{ marginTop: 14 }}>
        <div className="panel">
          <div className="panel-head"><h3>冻结快照内容</h3></div>
          <div style={{ padding: 16 }}>
            <Typography.Paragraph>批次将保存所选问题当时的状态、团队 / 负责人、合并关系、复测环境与历史复测记录。冻结后再复测、改派或合并，系统会立即把批次标记为“需要重做”。</Typography.Paragraph>
            <Space wrap>
              <Tag color="cyan">状态快照</Tag>
              <Tag color="geekblue">责任人快照</Tag>
              <Tag color="purple">复测记录快照</Tag>
              <Tag color="gold">合并关系快照</Tag>
            </Space>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><h3>版本操作历史</h3></div>
          <div style={{ padding: 16 }}>
            <div className="timeline-item"><strong>{candidateVersion} 创建</strong><div>仅包含无障碍修复，不影响业务功能。</div><span className="muted">何沐 · 09-28 16:20</span></div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="panel-head">
          <h3>报告批次</h3>
          <Typography.Text type="secondary">重新冻结不会覆盖上一批</Typography.Text>
        </div>
        <Table<ReportBatch>
          rowKey="id"
          dataSource={[...reportBatches].reverse()}
          pagination={false}
          locale={{ emptyText: '尚未冻结报告批次。请在上方勾选要提交的变更。' }}
          expandable={{
            expandedRowRender: (batch) => {
              const changes = getBatchChanges(batch, issues)
              return (
                <div style={{ padding: '6px 8px' }}>
                  {changes.length ? (
                    <>
                      <Typography.Text strong type="danger">以下问题把该批次挡下，需回到版本差异页重新冻结：</Typography.Text>
                      <Table
                        rowKey={(record) => `${record.issueKey}-${record.field}`}
                        size="small"
                        dataSource={changes}
                        pagination={false}
                        style={{ marginTop: 10 }}
                        columns={[
                          { title: '问题', dataIndex: 'issueKey', width: 130, render: (value) => <Typography.Text strong>{value}</Typography.Text> },
                          { title: '阻断原因', dataIndex: 'label', width: 150 },
                          { title: '冻结时', dataIndex: 'frozenValue' },
                          { title: '当前台账', dataIndex: 'currentValue' },
                        ]}
                      />
                    </>
                  ) : (
                    <Typography.Text type="success">快照与当前台账一致，可作为当前版本结论导出。</Typography.Text>
                  )}
                  <div style={{ marginTop: 12 }}>
                    <Typography.Text strong>冻结问题：</Typography.Text>
                    <Space wrap style={{ marginTop: 8 }}>
                      {batch.items.map((item) => (
                        <Tag key={item.key} color={changes.some((change) => change.issueKey === item.key) ? 'error' : impactColor[item.impact]}>
                          {item.key} · {item.status} · {item.owner}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                  <Typography.Title level={5} style={{ marginTop: 16 }}>冻结复测记录</Typography.Title>
                  {batch.items.flatMap((item) => item.retestRecords.map((record) => (
                    <div className="timeline-item" key={`${item.key}-${record.id}`}>
                      <strong>{item.key} · {record.result}</strong>
                      <div>{record.note}</div>
                      <span className="muted">{record.actor} · {record.at} · {item.retestEnv ?? item.version}</span>
                    </div>
                  )))}
                  {batch.items.every((item) => item.retestRecords.length === 0) && <Typography.Text type="secondary">冻结时所选问题暂无复测记录</Typography.Text>}
                </div>
              )
            },
            rowExpandable: () => true,
          }}
          columns={[
            { title: '批次', dataIndex: 'id', width: 145, render: (value) => <Typography.Text strong>{value}</Typography.Text> },
            { title: '报告名称', dataIndex: 'name' },
            { title: '版本', width: 180, render: (_, record) => <span>{record.baselineVersion} → {record.candidateVersion}</span> },
            { title: '冻结时间', dataIndex: 'frozenAt', width: 175 },
            { title: '冻结人', dataIndex: 'frozenBy', width: 100 },
            { title: '问题数', width: 80, render: (_, record) => record.items.length },
            {
              title: '当前状态',
              width: 115,
              render: (_, record) => {
                const stale = getBatchChanges(record, issues).length > 0
                return <Tag color={stale ? 'error' : 'success'}>{stale ? '需要重做' : '可导出'}</Tag>
              },
            },
          ]}
        />
      </div>
    </section>
  )
}
