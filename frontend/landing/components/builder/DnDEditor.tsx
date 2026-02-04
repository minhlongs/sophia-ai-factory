'use client';

import React, { useReducer, useState } from 'react';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, DragStartEvent, DragEndEvent, DragOverEvent, defaultDropAnimationSideEffects, DropAnimation } from '@dnd-kit/core';
import { ComponentPalette } from './ComponentPalette';
import { Canvas } from './Canvas';
import { PropertyPanel } from './PropertyPanel';
import { builderReducer, initialState } from '../../lib/builder/reducer';
import { COMPONENT_DEFINITIONS, ComponentType } from '../../lib/builder/types';
import { HeroBlock, FeaturesBlock, CtaBlock, TextBlock, BlockProps } from '../blocks';
import { cn } from '../../lib/utils';
import { Undo, Redo, Smartphone, Tablet, Monitor, Save, Eye } from 'lucide-react';

const dropAnimation: DropAnimation = { sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) };

const ComponentMap: Record<string, React.FC<BlockProps>> = {
  hero: HeroBlock, features: FeaturesBlock, pricing: TextBlock, cta: CtaBlock,
  testimonials: TextBlock, text: TextBlock, image: TextBlock, button: TextBlock,
};

const DeviceButton = ({ device, current, onClick, icon: Icon, label }: { device: string; current: string; onClick: () => void; icon: React.FC<any>; label: string }) => (
  <button onClick={onClick} className={cn("p-2 rounded", current === device ? "bg-white shadow text-primary" : "text-gray-500 hover:text-gray-900")}>
    <Icon className="w-4 h-4" />
  </button>
);

export default function DnDEditor() {
  const [state, dispatch] = useReducer(builderReducer, initialState);
  const [activeDragItem, setActiveDragItem] = useState<{ type: ComponentType; id?: string } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const type = active.data.current?.type as ComponentType;
    const isPaletteItem = active.data.current?.isPaletteItem;

    if (isPaletteItem) {
      setActiveDragItem({ type });
    } else {
      setActiveDragItem({ type, id: active.id as string });
      dispatch({ type: 'SELECT_COMPONENT', payload: { id: active.id as string } });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);
    if (!over) return;

    if (active.data.current?.isPaletteItem) {
      if (over.id === 'canvas-droppable' || over.data.current?.isCanvasItem) {
        const index = over.data.current?.isCanvasItem ? state.components.findIndex(c => c.id === over.id) + 1 : undefined;
        dispatch({ type: 'ADD_COMPONENT', payload: { type: active.data.current?.type, index } });
      }
    } else if (active.id !== over.id) {
      dispatch({ type: 'MOVE_COMPONENT', payload: { activeId: active.id as string, overId: over.id as string } });
    }
  };

  const selectedComponent = state.components.find(c => c.id === state.selectedId) || null;

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="h-16 border-b flex items-center justify-between px-4 bg-white z-10">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-gray-800">Landing Builder</h1>
          <div className="flex items-center space-x-2 border-l pl-4 ml-4">
            <button onClick={() => dispatch({ type: 'UNDO' })} disabled={state.historyIndex <= 0} className="p-2 text-gray-500 hover:text-gray-900 disabled:opacity-30" title="Undo"><Undo className="w-4 h-4" /></button>
            <button onClick={() => dispatch({ type: 'REDO' })} disabled={state.historyIndex >= state.history.length - 1} className="p-2 text-gray-500 hover:text-gray-900 disabled:opacity-30" title="Redo"><Redo className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg">
          <DeviceButton device="desktop" current={state.device} onClick={() => dispatch({ type: 'SET_DEVICE', payload: { device: 'desktop' } })} icon={Monitor} label="Desktop" />
          <DeviceButton device="tablet" current={state.device} onClick={() => dispatch({ type: 'SET_DEVICE', payload: { device: 'tablet' } })} icon={Tablet} label="Tablet" />
          <DeviceButton device="mobile" current={state.device} onClick={() => dispatch({ type: 'SET_DEVICE', payload: { device: 'mobile' } })} icon={Smartphone} label="Mobile" />
        </div>

        <div className="flex items-center space-x-2">
          <button className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"><Eye className="w-4 h-4 mr-2" />Preview</button>
          <button className="flex items-center px-3 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90"><Save className="w-4 h-4 mr-2" />Publish</button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <ComponentPalette />
          <Canvas components={state.components} selectedId={state.selectedId} onSelect={(id) => dispatch({ type: 'SELECT_COMPONENT', payload: { id } })} device={state.device} />
          <PropertyPanel selectedComponent={selectedComponent} onUpdate={(id, props) => dispatch({ type: 'UPDATE_COMPONENT', payload: { id, props } })} onDelete={(id) => dispatch({ type: 'REMOVE_COMPONENT', payload: { id } })} />
          <DragOverlay dropAnimation={dropAnimation}>
            {activeDragItem ? (
              activeDragItem.id ? (
                <div className="bg-white p-4 border rounded shadow-lg opacity-80 w-64">Dragging Component</div>
              ) : (
                <div className="bg-white p-4 border rounded shadow-lg opacity-80 flex items-center gap-2"><span className="font-bold">{COMPONENT_DEFINITIONS[activeDragItem.type].label}</span></div>
              )
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
