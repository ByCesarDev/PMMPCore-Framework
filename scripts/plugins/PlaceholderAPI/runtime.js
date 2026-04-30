let placeholderApiRuntime = null;

function setPlaceholderApiRuntime(runtime) {
  placeholderApiRuntime = runtime ?? null;
}

function getPlaceholderApiRuntime() {
  return placeholderApiRuntime;
}

export { getPlaceholderApiRuntime, setPlaceholderApiRuntime };
