import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Checkbox, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { useIssues } from '../api/useIssues'
import { useWorkspaceStore } from '../store/useWorkspaceStore'
import { batchStateColor, diffDescriptions, getBatchState } from '../api/batches'

export default function VersionsPage() {
  useIssues()
  const navigate = useNavigate()
  const location = useLocation()
  const issues = useWorkspaceStore((state) => state.issues)
  const batches = useWorkspaceStore((state) => state.batches)
  const freezeBatch = useWorkspaceStore((state) => state.freezeBatch)

  const [baselineVersion, setBaselineVersion] = useState('v4.18')
  const [candidateVersion, setCandidateVersion] = useState('v4.18-rc2')
  const diffKeys = useMemo(() => issues.map((issue) => issue.key).filter((key) => key in diffDescriptions), [issues])
  const presetKeys = (location.state as { presetKeys?: string[] } | null)?.presetKeys
  const [accepted, setAccepted] = useState<string[]>(presetKeys ?? diffKeys)
  const [freezeOpen, setFreezeOpen] = useState(false)
  const [form] = Form.useForm()

  const diffs = diffKeys
    .map((key) => ({ key, ...diffDescriptions[key as keyof typeof diffDescriptions] }))

  const toggle = (key: string, checked: boolean) => {
    setAccepted((current) => checked ? [...new Set([...current, key])] : current.filter((item) => item !== key))
  }

  const selectedChanges = diffs.filter((item) => accepted.includes(item.key))

  const submitFreeze = (values: { name: string; note: string }) => {
    const id = freezeBatch({
      name: values.name,
      keys: accepted,
      changes: selectedChanges,
      baselineVersion,
      candidateVersion,
      note: values.note?.trim() ?? '',
    })
    message.success(`报告批次 ${id} 已冻结，台账后续变动将使该批次标记为需重做`)
    setFreezeOpen(false)
    form.resetFields()
    navigate(`/report?batch=${id}`)
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">VERSION DIFF / 版本差异</p>
          <h1>比较整改版本并冻结提交</h1>
          <p className="muted">勾选要提交评审的变更并冻结为报告批次；冻结后再复测、改派或合并，批次会立刻标记需重做。</p>
        </div>
        <Space>
          <Select value={baselineVersion} onChange={setBaselineVersion} options={[{ value: 'v4.18' }, { value: 'v4.17' }]} style={{ width: 110 }} />
          <span>对比</span>
          <Select value={candidateVersion} onChange={setCandidateVersion} options={[{ value: 'v4.18-rc2' }, { value: 'v4.19-dev' }]} style={{ width: 130 }} />
          <Button
            type="primary"
            icon={<LockOutlined />}
            disabled={!accepted.length}
            onClick={() => {
              form.setFieldsValue({
                name: `${candidateVersion} 无障碍评审结论`,
                note: '',
              })
              setFreezeOpen(true)
            }}
          >
            冻结为报告批次（{accepted.length} 项）
          </Button>
        </Space>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>变更清单</h3><Tag color="blue">基线 {baselineVersion}</Tag></div>
        <Table
          rowKey="key"
          dataSource={diffs}
          pagination={false}
          scroll={{ x: 850 }}
          columns={[
            { title: '提交', width: 70, render: (_, record) => <Checkbox checked={accepted.includes(record.key)} onChange={(event) => toggle(record.key, event.target.checked)} /> },
            { title: '问题', dataIndex: 'key', width: 110, render: (value) => <Typography.Text strong>{value}</Typography.Text> },
            { title: '变更项', dataIndex: 'field', width: 130 },
            { title: '当前基线', dataIndex: 'baseline', width: 280, render: (value) => <span style={{ color: '#9a4d35' }}>{value}</span> },
            { title: '候选版本', dataIndex: 'candidate', width: 330, render: (value) => <span style={{ color: '#26705a' }}>{value}</span> },
            { title: '风险', dataIndex: 'risk', width: 80, render: (value) => <Tag color={value === '中' ? 'gold' : value === '高' ? 'red' : 'green'}>{value}</Tag> },
          ]}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
        <div className="panel"><div className="panel-head"><h3>被接受变更的影响</h3></div><div style={{ padding: 16 }}><Typography.Paragraph>预计关闭 2 个开放问题，新增 1 次复测任务。基础组件组无需额外排期。</Typography.Paragraph><Space><Tag color="green">减少 5 次键盘操作</Tag><Tag color="blue">覆盖 3 个页面</Tag></Space></div></div>
        <div className="panel">
          <div className="panel-head"><h3>冻结批次说明</h3><Tag color="cyan">{batches.length} 个批次</Tag></div>
          <div style={{ padding: 16 }}>
            <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
              冻结会记录每个问题当时的状态、责任人和复测记录。冻结后若在问题台账中复测、改派或合并这些问题，原批次会立刻显示「需重做」，不能再导出为当前结论；重新冻结会保留上一批报告并归档。
            </Typography.Paragraph>
            <Space wrap>
              {batches.slice(0, 3).map((batch) => {
                const evaluation = getBatchState(batch, issues)
                return (
                  <Tag
                    key={batch.id}
                    color={batchStateColor[evaluation.state]}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/report?batch=${batch.id}`)}
                  >
                    {batch.id} · {evaluation.state}
                  </Tag>
                )
              })}
            </Space>
          </div>
        </div>
      </div>

      <Modal
        title="冻结为报告批次"
        open={freezeOpen}
        onCancel={() => setFreezeOpen(false)}
        onOk={() => form.submit()}
        okText="确认冻结"
        cancelText="取消"
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          将冻结 {accepted.length} 个问题当前的状态、责任人与复测记录，提交给版本评审。冻结后这些问题在台账中再被复测、改派或合并时，本批次会立刻标记为「需重做」。
        </Typography.Paragraph>
        <Space wrap style={{ marginBottom: 16 }}>
          {selectedChanges.map((item) => <Tag key={item.key}>{item.key}</Tag>)}
        </Space>
        <Form form={form} layout="vertical" onFinish={submitFreeze}>
          <Form.Item name="name" label="批次名称" rules={[{ required: true, message: '请填写批次名称' }]}>
            <Input placeholder="例如：v4.18-rc2 无障碍评审结论" />
          </Form.Item>
          <Form.Item name="note" label="提交说明（可选）">
            <Input.TextArea rows={3} placeholder="说明本轮提交的评审范围、结论或注意事项" />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  )
}
