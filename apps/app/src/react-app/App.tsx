import { Route, Switch } from 'wouter';
import { Footer, PageHeader } from '@gordonbeeming/design-system';
import { ThemeToggle } from '@gordonbeeming/design-system/theme-toggle';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Enroll } from './pages/Enroll';
import { Dashboard } from './pages/Dashboard';
import { NoteViewer } from './pages/NoteViewer';
import { StubMarketing } from './pages/StubMarketing';
import { StubSetup } from './pages/StubSetup';

// Top-level SPA shell. PageHeader/Footer/ThemeToggle stay mounted across
// route changes so theme preference and nav state don't flicker between
// navigations. The dashboard injects its own sub-nav beneath these.
export function App() {
  return (
    <div className="ds-wrap">
      <PageHeader
        brand={
          <>
            {'// '}
            <b>stub</b>
            {' · short links & burn notes'}
          </>
        }
        meta={
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 16 }}>
            <ThemeToggle />
            <span>v0.1</span>
          </span>
        }
      />

      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/enroll" component={Enroll} />
        <Route path="/dashboard/:rest*" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/n/:id" component={NoteViewer} />
        <Route path="/stub" component={StubMarketing} />
        <Route path="/stub/setup" component={StubSetup} />
        <Route component={NotFound} />
      </Switch>

      <Footer
        left={<>{'// stub'}</>}
        right={
          <>
            ready<span style={{ color: 'var(--primary)' }}>■</span>
          </>
        }
      />
    </div>
  );
}

function NotFound() {
  return (
    <main style={{ padding: '48px 0' }}>
      <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
        {'// 404 · nothing here'}
      </p>
    </main>
  );
}
