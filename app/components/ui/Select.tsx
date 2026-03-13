'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';

interface SelectContextType {
  value?: string;
  onValueChange?: (value: string) => void;
}

const SelectContext = React.createContext<SelectContextType>({});

interface SelectProps {
  children: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
}

export function Select({ children, value, onValueChange, defaultValue }: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const controlledValue = value !== undefined ? value : internalValue;

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (value === undefined) {
        setInternalValue(newValue);
      }
      onValueChange?.(newValue);
    },
    [value, onValueChange]
  );

  return (
    <SelectContext.Provider value={{ value: controlledValue, onValueChange: handleValueChange }}>
      {children}
    </SelectContext.Provider>
  );
}

interface SelectTriggerProps extends Omit<React.HTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> {
  children: React.ReactNode;
}

const SelectTrigger = React.forwardRef<HTMLSelectElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const { value, onValueChange } = React.useContext(SelectContext);

    return (
      <select
        ref={ref}
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
SelectTrigger.displayName = 'SelectTrigger';

const SelectContent: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div className={cn('relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover shadow-md', className)}>
    {children}
  </div>
);

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  children: React.ReactNode;
}

const SelectItem: React.FC<SelectItemProps> = ({ className, children, value, ...props }) => (
  <div
    className={cn(
      'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
      className
    )}
    data-value={value}
    {...props}
  >
    {children}
  </div>
);

const SelectValue: React.FC<{ children?: React.ReactNode; className?: string; placeholder?: string }> = ({
  children,
  className = '',
  placeholder = 'Select an option',
}) => (
  <span className={cn('block', className)}>
    {children || placeholder}
  </span>
);

export { SelectTrigger, SelectContent, SelectItem, SelectValue };
