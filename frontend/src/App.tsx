import { AppLayout } from './components/AppLayout';
import { MissingEnvNotice } from './components/MissingEnvNotice';
import { missingEnvVars } from './config/env';
import { DiagnosticsPage } from './pages/DiagnosticsPage';

export function App() {
  return (
    <AppLayout>
      <MissingEnvNotice variableNames={missingEnvVars} />
      <DiagnosticsPage />
    </AppLayout>
  );
}
