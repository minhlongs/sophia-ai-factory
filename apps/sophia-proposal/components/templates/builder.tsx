/**
 * Template Builder Component
 */

'use client';

import { useState } from 'react';
import type { ProposalTemplate, TemplateSection, SectionType } from '@/types/template-builder';

interface TemplateBuilderProps {
  template?: ProposalTemplate;
  onSave: (template: ProposalTemplate) => void;
}

const SECTION_TYPES: { type: SectionType; label: string; icon: string }[] = [
  { type: 'text', label: 'Text Block', icon: '📝' },
  { type: 'image', label: 'Image', icon: '🖼️' },
  { type: 'video', label: 'Video', icon: '🎥' },
  { type: 'pricing', label: 'Pricing Table', icon: '💰' },
  { type: 'timeline', label: 'Timeline', icon: '📅' },
  { type: 'testimonials', label: 'Testimonials', icon: '⭐' },
];

export function TemplateBuilder({ template, onSave }: TemplateBuilderProps) {
  const [name, setName] = useState(template?.name || 'New Template');
  const [sections, setSections] = useState<TemplateSection[]>(
    template?.sections || []
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const handleAddSection = (type: SectionType) => {
    const newSection: TemplateSection = {
      id: `section-${Date.now()}`,
      type,
      title: `New ${type} Section`,
      content: '',
      order: sections.length,
      settings: {},
    };
    setSections([...sections, newSection]);
  };

  const handleUpdateSection = (id: string, updates: Partial<TemplateSection>) => {
    setSections(
      sections.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const handleDeleteSection = (id: string) => {
    setSections(sections.filter((s) => s.id !== id));
  };

  const handleDragStart = (id: string) => {
    setDraggingId(id);
  };

  const handleDrop = (targetId: string) => {
    if (!draggingId || draggingId === targetId) return;

    const dragIndex = sections.findIndex((s) => s.id === draggingId);
    const dropIndex = sections.findIndex((s) => s.id === targetId);

    const newSections = [...sections];
    const [removed] = newSections.splice(dragIndex, 1);
    newSections.splice(dropIndex, 0, removed);

    // Update order
    newSections.forEach((s, i) => (s.order = i));

    setSections(newSections);
    setDraggingId(null);
  };

  const handleSave = () => {
    const savedTemplate: ProposalTemplate = {
      id: template?.id || `template-${Date.now()}`,
      orgId: 'current-org',
      name,
      sections,
      isSystem: false,
      createdAt: template?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSave(savedTemplate);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Template Name */}
      <div className="mb-6">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full text-2xl font-bold border-b-2 border-gray-200 focus:border-orange-500 outline-none pb-2"
          placeholder="Template Name"
        />
      </div>

      {/* Section Library */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">
          Add Section
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {SECTION_TYPES.map((section) => (
            <button
              key={section.type}
              onClick={() => handleAddSection(section.type)}
              className="p-3 border-2 border-gray-200 rounded-lg hover:border-orange-500 transition-colors"
            >
              <div className="text-2xl mb-1">{section.icon}</div>
              <div className="text-xs text-gray-600">{section.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Sections List */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700">
          Template Sections ({sections.length})
        </h4>

        {sections.map((section) => (
          <div
            key={section.id}
            draggable
            onDragStart={() => handleDragStart(section.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(section.id)}
            className="p-4 border-2 border-gray-200 rounded-lg cursor-move hover:border-orange-300"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className="text-lg">
                  {SECTION_TYPES.find((s) => s.type === section.type)?.icon}
                </span>
                <input
                  type="text"
                  value={section.title}
                  onChange={(e) =>
                    handleUpdateSection(section.id, { title: e.target.value })
                  }
                  className="text-sm font-medium border-none outline-none bg-transparent"
                />
              </div>
              <button
                onClick={() => handleDeleteSection(section.id)}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                Delete
              </button>
            </div>
            <textarea
              value={section.content}
              onChange={(e) =>
                handleUpdateSection(section.id, { content: e.target.value })
              }
              placeholder="Section content..."
              className="w-full text-sm border border-gray-300 rounded p-2"
              rows={3}
            />
          </div>
        ))}

        {sections.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            No sections yet. Add sections from the library above.
          </p>
        )}
      </div>

      {/* Save Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          Save Template
        </button>
      </div>
    </div>
  );
}
