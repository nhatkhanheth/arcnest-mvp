import { lazy, Suspense, type ReactNode } from "react";

const DynamicProviderImpl = lazy(() => import("./DynamicProviderImpl"));

export const dynamicEnvironmentId = import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID?.trim() ?? "";
export const dynamicEnabled = Boolean(dynamicEnvironmentId);

export function ArcNestDynamicProvider({ children }: { children: ReactNode }) {
  if (!dynamicEnabled) {
    return <>{children}</>;
  }

  return (
    <Suspense fallback={<>{children}</>}>
      <DynamicProviderImpl>{children}</DynamicProviderImpl>
    </Suspense>
  );
}
