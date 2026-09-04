import type { ReactNode } from "react";
import {
  ErrorBoundary,
  type FallbackProps,
  getErrorMessage,
} from "react-error-boundary";

function ErrorFallback({ error }: FallbackProps) {
  const message = getErrorMessage(error) ?? "Unknown error";
  return (
    <div role="alert" style={{ padding: 16 }}>
      <h4>Something went wrong:(</h4>

      <pre>{message}</pre>

      {/*<details title="Error Stack">
        <summary>Error Stack</summary>
        <pre>{error.stack}</pre>
      </details>*/}
    </div>
  );
}

interface Props {
  children?: ReactNode;
}

export const BaseErrorBoundary = (props: Props) => {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      {props.children}
    </ErrorBoundary>
  );
};
