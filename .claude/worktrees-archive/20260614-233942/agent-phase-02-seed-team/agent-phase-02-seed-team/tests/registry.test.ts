import { describe, it, expect, beforeEach } from 'vitest';
import { ModuleRegistry } from '../src/registry';

describe('ModuleRegistry', () => {
  let registry: ModuleRegistry;

  beforeEach(() => {
    registry = new ModuleRegistry();
  });

  describe('register', () => {
    it('should register a module', () => {
      registry.register('auth', '1.0.0', '/auth', ['db']);
      const modules = registry.list();
      expect(modules).toHaveLength(1);
      expect(modules[0].name).toBe('auth');
    });

    it('should reject duplicate module names', () => {
      registry.register('auth', '1.0.0', '/auth', ['db']);
      expect(() => {
        registry.register('auth', '2.0.0', '/auth2', []);
      }).toThrow('Module auth already registered');
    });
  });

  describe('resolve', () => {
    it('should resolve dependencies in order', () => {
      registry.register('db', '1.0.0', '/db', []);
      registry.register('auth', '1.0.0', '/auth', ['db']);
      registry.register('api', '1.0.0', '/api', ['auth']);

      const order = registry.resolve('api');
      expect(order).toEqual(['db', 'auth', 'api']);
    });

    it('should throw for missing dependencies', () => {
      registry.register('api', '1.0.0', '/api', ['auth']);
      expect(() => {
        registry.resolve('api');
      }).toThrow('Dependency auth of api not registered');
    });

    it('should detect circular dependencies', () => {
      registry.register('a', '1.0.0', '/a', ['b']);
      registry.register('b', '1.0.0', '/b', ['a']);

      expect(() => {
        registry.resolve('a');
      }).toThrow('Circular dependency detected');
    });
  });

  describe('hasCircularDependency', () => {
    it('should return false for no cycles', () => {
      registry.register('a', '1.0.0', '/a', []);
      registry.register('b', '1.0.0', '/b', ['a']);
      expect(registry.hasCircularDependency()).toBe(false);
    });

    it('should return true for cycle', () => {
      registry.register('a', '1.0.0', '/a', ['b']);
      registry.register('b', '1.0.0', '/b', ['a']);
      expect(registry.hasCircularDependency()).toBe(true);
    });
  });
});
