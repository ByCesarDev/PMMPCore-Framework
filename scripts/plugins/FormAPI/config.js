/** @typedef {{ plugin: { enabled: boolean }; demoCommand: { enabled: boolean; permission: string }; limits: { maxButtons: number }; queue: { timeoutMs: number }; debug: boolean }} FormApiConfig */

/** @type {FormApiConfig} */
export const FORM_API_CONFIG = {
  plugin: {
    enabled: true,
  },
  demoCommand: {
    enabled: true,
    permission: "pmmpcore.formapi.demo",
  },
  limits: {
    maxButtons: 30,
  },
  queue: {
    /** Max wait per queued form; after this the promise resolves as rejected/timeout (queue advances). */
    timeoutMs: 180_000,
  },
  debug: false,
};

export const FORM_API_PLUGIN_NAME = "FormAPI";
