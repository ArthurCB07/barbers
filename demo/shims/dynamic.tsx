/** Substituto de next/dynamic fora do Next.js */
import { lazy, Suspense, type ComponentType } from "react";

export default function dynamic<P extends object>(loader: () => Promise<{ default: ComponentType<P> }>) {
  const Lazy = lazy(loader) as unknown as ComponentType<P>;
  return function Dynamic(props: P) {
    return (
      <Suspense fallback={null}>
        <Lazy {...props} />
      </Suspense>
    );
  };
}
