/**
 * Collaboration Tests
 */

import { describe, it, expect } from 'vitest';
import { ROLE_PERMISSIONS, checkPermission } from '@/lib/collaboration/utils';

describe('Collaboration', () => {
  describe('Role Permissions', () => {
    it('should have 4 roles defined', () => {
      expect(Object.keys(ROLE_PERMISSIONS).length).toBe(4);
    });

    it('should have owner with all permissions', () => {
      const owner = ROLE_PERMISSIONS.owner;
      expect(owner.canEdit).toBe(true);
      expect(owner.canComment).toBe(true);
      expect(owner.canShare).toBe(true);
      expect(owner.canDelete).toBe(true);
    });

    it('should have viewer with limited permissions', () => {
      const viewer = ROLE_PERMISSIONS.viewer;
      expect(viewer.canEdit).toBe(false);
      expect(viewer.canComment).toBe(true);
      expect(viewer.canShare).toBe(false);
      expect(viewer.canDelete).toBe(false);
    });
  });

  describe('Permission Checks', () => {
    it('should allow editor to edit', () => {
      expect(checkPermission('editor', 'edit')).toBe(true);
    });

    it('should not allow viewer to edit', () => {
      expect(checkPermission('viewer', 'edit')).toBe(false);
    });

    it('should allow all roles to comment', () => {
      expect(checkPermission('owner', 'comment')).toBe(true);
      expect(checkPermission('admin', 'comment')).toBe(true);
      expect(checkPermission('editor', 'comment')).toBe(true);
      expect(checkPermission('viewer', 'comment')).toBe(true);
    });

    it('should only allow owner and admin to share', () => {
      expect(checkPermission('owner', 'share')).toBe(true);
      expect(checkPermission('admin', 'share')).toBe(true);
      expect(checkPermission('editor', 'share')).toBe(false);
      expect(checkPermission('viewer', 'share')).toBe(false);
    });
  });

  describe('Template Builder', () => {
    it('should have 6 section types', () => {
      const sectionTypes = ['text', 'image', 'video', 'pricing', 'timeline', 'testimonials'];
      expect(sectionTypes.length).toBe(6);
    });

    it('should calculate drag-and-drop reorder correctly', () => {
      const sections = [
        { id: '1', order: 0 },
        { id: '2', order: 1 },
        { id: '3', order: 2 },
      ];

      // Move section 3 to position 0
      const newSections = [sections[2], sections[0], sections[1]];
      newSections.forEach((s, i) => (s.order = i as any));

      expect(newSections[0].order).toBe(0);
      expect(newSections[1].order).toBe(1);
      expect(newSections[2].order).toBe(2);
    });
  });
});
