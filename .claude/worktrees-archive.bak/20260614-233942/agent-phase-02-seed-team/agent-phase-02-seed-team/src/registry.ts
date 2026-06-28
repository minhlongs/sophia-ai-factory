/**
 * Module information for registered modules
 */
export interface ModuleInfo {
  name: string;
  version: string;
  path: string;
  dependencies: string[];
}

/**
 * Registry for managing modules and their dependencies
 */
export class ModuleRegistry {
  private modules: Map<string, ModuleInfo> = new Map();

  /**
   * Register a new module
   */
  register(name: string, version: string, path: string, dependencies: string[] = []): void {
    if (this.modules.has(name)) {
      throw new Error(`Module "${name}" is already registered`);
    }
    this.modules.set(name, { name, version, path, dependencies });
  }

  /**
   * Get a module by name
   */
  get(name: string): ModuleInfo | undefined {
    return this.modules.get(name);
  }

  /**
   * List all registered modules
   */
  list(): ModuleInfo[] {
    return Array.from(this.modules.values());
  }

  /**
   * Check if a module is registered
   */
  has(name: string): boolean {
    return this.modules.has(name);
  }

  /**
   * Get dependencies of a module
   */
  getDependencies(name: string): string[] {
    const module = this.modules.get(name);
    return module ? module.dependencies : [];
  }

  /**
   * Check for circular dependencies using DFS
   */
  hasCircularDependency(): boolean {
    const visited = new Set<string>();

    const dfs = (node: string, stack: Set<string>): boolean => {
      visited.add(node);
      stack.add(node);

      const module = this.modules.get(node);
      if (module) {
        for (const dep of module.dependencies) {
          if (!visited.has(dep)) {
            if (dfs(dep, stack)) {
              return true;
            }
          } else if (stack.has(dep)) {
            return true;
          }
        }
      }

      stack.delete(node);
      return false;
    };

    for (const [name] of this.modules) {
      if (!visited.has(name)) {
        const recStack = new Set<string>();
        if (dfs(name, recStack)) {
          return true;
        }
      }
    }

    return false;
  }
}
