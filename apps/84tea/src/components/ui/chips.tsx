"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  icon?: string;
  onDelete?: () => void;
}

export function Chip({
  selected = false,
  icon,
  onDelete,
  className,
  children,
  ...props
}: ChipProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-2 h-8 px-4 rounded-lg",
        "text-sm font-medium transition-all duration-200",
        "border",
        selected
          ? "bg-secondary-container text-on-secondary-container border-secondary-container"
          : "bg-transparent text-on-surface border-outline hover:bg-on-surface/8",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        "disabled:opacity-50 disabled:pointer-events-none",
        className
      )}
      {...props}
    >
      {icon && (
        <span className="material-symbols-rounded text-lg">
          {icon}
        </span>
      )}
      <span>{children}</span>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="ml-1 -mr-2 p-1 rounded-full hover:bg-on-secondary-container/12"
          aria-label="Remove"
        >
          <span className="material-symbols-rounded text-base">
            close
          </span>
        </button>
      )}
    </button>
  );
}

interface FilterChipsProps {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
}

export function FilterChips({ categories, selected, onSelect }: FilterChipsProps) {
  return (
    <div
      role="group"
      aria-label="Lọc theo danh mục sản phẩm"
      className="flex flex-wrap gap-2"
    >
      {categories.map((category) => (
        <Chip
          key={category}
          selected={selected === category}
          onClick={() => onSelect(category)}
          aria-pressed={selected === category}
        >
          {category}
        </Chip>
      ))}
    </div>
  );
}
