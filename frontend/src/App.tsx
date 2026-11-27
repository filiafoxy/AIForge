import { AppLayout } from './components/AppLayout';
import { InsecureUrlNotice } from './components/InsecureUrlNotice';
import { MissingEnvNotice } from './components/MissingEnvNotice';
import { OfflineNotice } from './components/OfflineNotice';
import { findInsecureEnvVars, missingEnvVars } from './config/env';
import { DiagnosticsPage } from './pages/DiagnosticsPage';

// Протокол страницы за время её жизни не меняется, поэтому считаем один раз.
const insecureEnvVars = findInsecureEnvVars(window.location.protocol);

export function App() {
  return (
    <AppLayout>
      <OfflineNotice />
      <MissingEnvNotice variableNames={missingEnvVars} />
      <InsecureUrlNotice variableNames={insecureEnvVars} />
      <DiagnosticsPage />
    </AppLayout>
  );
}
