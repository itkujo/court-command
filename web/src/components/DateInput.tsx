import { forwardRef, type InputHTMLAttributes } from 'react'
import { Input } from './Input'

interface DateInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  error?: boolean
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  (props, ref) => {
    return <Input ref={ref} type="date" {...props} />
  },
)
DateInput.displayName = 'DateInput'
