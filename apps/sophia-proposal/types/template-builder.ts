/**
 * Template Builder Types
 */

// Template section type
export type SectionType = 'text' | 'image' | 'video' | 'pricing' | 'timeline' | 'testimonials';

// Template section
export interface TemplateSection {
  id: string;
  type: SectionType;
  title: string;
  content: string;
  order: number;
  settings: Record<string, any>;
}

// Template
export interface ProposalTemplate {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  sections: TemplateSection[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

// Drag-and-drop state
export interface DragState {
  draggingId: string | null;
  overId: string | null;
}
