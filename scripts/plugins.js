// PMMPCore Plugin Loader (Nativo / Desarrollo Beta)
// Agrega tus importaciones de plugins internos manualmente aquí:
// Ejemplo: import "./plugins/MyPlugin/main.js";

export const pluginList = [];

if (Array.isArray(pluginList) && pluginList.length > 0) {
  console.log(`[PMMPCore] Loaded ${pluginList.length} internal plugin(s): ${pluginList.join(", ")}`);
}
