import type { GanttPlugin, PluginSystemLike, GanttEngineLike } from './types'

export class PluginSystem implements PluginSystemLike {
  private plugins: Map<string, GanttPlugin> = new Map()
  private engine: GanttEngineLike | null = null

  setEngine(engine: GanttEngineLike): void {
    this.engine = engine
    for (const plugin of this.plugins.values()) {
      plugin.install(engine)
    }
  }

  register(plugin: GanttPlugin): void {
    if (this.plugins.has(plugin.name)) {
      this.uninstall(plugin.name)
    }
    this.plugins.set(plugin.name, plugin)
    if (this.engine) {
      plugin.install(this.engine)
    }
  }

  uninstall(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return false
    if (plugin.uninstall) {
      plugin.uninstall()
    }
    this.plugins.delete(pluginId)
    return true
  }

  getCount(): number {
    return this.plugins.size
  }
}
