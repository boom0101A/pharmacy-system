import { Component, type ErrorInfo, type ReactNode } from 'react';
import styles from './ErrorBoundary.module.css';
import { Button } from './ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Nothing in this render tree caught unexpected errors before this — one
 * uncaught throw in any page unmounted the whole app to a blank white
 * screen, with no way back for a non-technical daily user short of quitting
 * and reopening. This turns that into a clear message and a one-click retry.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error caught by ErrorBoundary:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className={styles.page}>
          <div className={styles.card}>
            <h1 className={styles.title}>حدث خطأ غير متوقع</h1>
            <p className={styles.message}>
              حدث خطأ في التطبيق. البيانات المحفوظة لن تتأثر — جرّب إعادة التحميل.
            </p>
            <Button onClick={() => window.location.reload()}>إعادة التحميل</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
