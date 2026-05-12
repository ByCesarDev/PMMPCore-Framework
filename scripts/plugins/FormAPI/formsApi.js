/**
 * Stable entrypoint for other PMMPCore plugins.
 * Requires FormAPI plugin enabled so {@link setFormApiService} ran during core startup.
 */
import { getFormApiService } from "./runtime.js";

export {
  isFormOk,
  normalizeFormError,
  validateModalValues,
} from "./bedrockForms.js";

/**
 * @typedef {import("./bedrockForms.js").FormResult} FormResult
 */

function notInitialized() {
  return Promise.resolve(
    /** @type {const} */ ({
      status: "invalid",
      code: "formapi_not_initialized",
      message: "FormAPI plugin is not loaded or failed to enable.",
    })
  );
}

/** @type {typeof import("./service.js").FormAPIService.prototype.showButtonMenu} */
export function showButtonMenu(player, spec) {
  const svc = getFormApiService();
  if (!svc) return notInitialized();
  return svc.showButtonMenu(player, spec);
}

/** @type {typeof import("./service.js").FormAPIService.prototype.showConfirm} */
export function showConfirm(player, spec) {
  const svc = getFormApiService();
  if (!svc) return notInitialized();
  return svc.showConfirm(player, spec);
}

/** @type {typeof import("./service.js").FormAPIService.prototype.showModal} */
export function showModal(player, spec) {
  const svc = getFormApiService();
  if (!svc) return notInitialized();
  return svc.showModal(player, spec);
}
