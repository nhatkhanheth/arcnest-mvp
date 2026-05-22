export const dynamicEnvironmentId = import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID?.trim() ?? "";
export const dynamicEnabled = Boolean(dynamicEnvironmentId);
