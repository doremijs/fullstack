import type { SelectProps } from 'antd'
import { Select, Spin } from 'antd'
import { useDict } from '@/hooks/useDict'

export interface DictSelectProps extends Omit<SelectProps, 'options' | 'loading'> {
  typeCode: string
  autoload?: boolean
}

const DictSelect = ({ typeCode, autoload = true, ...rest }: DictSelectProps) => {
  const { options, loading } = useDict(autoload ? typeCode : '__none__')

  const selectOptions = (options ?? []).map((item) => ({
    label: item.label,
    value: item.value,
  }))

  if (loading) {
    return <Select {...rest} loading options={[]} suffixIcon={<Spin size="small" />} />
  }

  return <Select {...rest} options={selectOptions} />
}

export default DictSelect
