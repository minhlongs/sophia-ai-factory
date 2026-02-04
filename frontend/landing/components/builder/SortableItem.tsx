import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LandingComponent } from '../../lib/builder/types';
import { cn } from '../../lib/utils';
import { HeroBlock, FeaturesBlock, CtaBlock, TextBlock, ImageBlock, ButtonBlock, FormBlock, BlockProps } from '../blocks';

interface SortableItemProps {
  component: LandingComponent;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const COMPONENT_MAP: Record<string, React.FC<BlockProps>> = {
  hero: HeroBlock, features: FeaturesBlock, pricing: TextBlock, cta: CtaBlock,
  testimonials: TextBlock, text: TextBlock, image: ImageBlock, button: ButtonBlock, form: FormBlock,
};

const DragHandle = () => (
  <div className="bg-white shadow-sm border rounded p-1 cursor-grab active:cursor-grabbing hover:bg-gray-50 text-gray-500">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
  </div>
);

export const SortableItem: React.FC<SortableItemProps> = ({ component, isSelected, onSelect }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: component.id, data: { type: component.type, isCanvasItem: true } });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const Block = COMPONENT_MAP[component.type] || TextBlock;

  return (
    <div ref={setNodeRef} style={style} className={cn("relative group mb-4", isDragging && "opacity-50 z-50", isSelected && "z-10")}>
      <div className={cn("relative", !isSelected && !isDragging && "hover:outline hover:outline-2 hover:outline-primary/30 hover:outline-dashed")}>
        <Block component={component} isSelected={isSelected} onClick={() => onSelect(component.id)} />
        <div className={cn("absolute top-0 right-0 p-2 opacity-0 transition-opacity flex gap-2", (isSelected || isDragging) ? "opacity-100" : "group-hover:opacity-100")}>
          <DragHandle {...attributes} {...listeners} />
        </div>
      </div>
    </div>
  );
};
