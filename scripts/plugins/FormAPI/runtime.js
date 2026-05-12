/** @type {import("./service.js").FormAPIService | null} */
let formApiService = null;

/** @param {import("./service.js").FormAPIService | null} svc */
export function setFormApiService(svc) {
  formApiService = svc;
}

/** @returns {import("./service.js").FormAPIService | null} */
export function getFormApiService() {
  return formApiService;
}
