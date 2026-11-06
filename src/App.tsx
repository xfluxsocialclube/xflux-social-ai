import { useCallback, useEffect, useState } from 'react';
import { Sidebar } from './layout/Sidebar';
import { Header } from './layout/Header';
import { Overview } from './pages/Overview';
import { Library } from './pages/Library';
import { Networks } from './pages/Networks';
import { Settings } from './pages/Settings';
import { ModulePage } from './pages/ModulePage';
import { Guide } from './pages/Guide';
import { Help } from './pages/Help';
import { CaptionBank } from './pages/captions/CaptionBank';
import { Pairing } from './pages/planner/Pairing';
import { Calculator } from './pages/planner/Calculator';
import { Planner } from './pages/planner/Planner';
import { Autopilot } from './pages/planner/Autopilot';
import { Queue } from './pages/publishing/Queue';
import { publishingAlert } from './services/publishing/queue';
import { cycleAlert } from './services/planner/guide';
import { NAV_ITEMS, type PageId } from './config/nav';
import { loadSetting, saveSetting } from './services/settings';
import type { TranslationKey } from './i18n/pt';

const MODULE_DESC: Partial<Record<PageId, TranslationKey>> = {
  library: 'mod.library', schedule: 'mod.schedule', shopee: 'mod.shopee',
  reports: 'mod.reports', goodmorning: 'mod.goodmorning', help: 'mod.help',
};

export default function App() {
  const [page, setPage] = useState<PageId>('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showMascot, setShowMascotState] = useState<boolean>(() => loadSetting('showMascot', true));
  const setShowMascot = (v: boolean) => { setShowMascotState(v); saveSetting('showMascot', v); };
  const [alerts, setAlerts] = useState<PageId[]>([]);
  const refreshAlerts = useCallback(() => { Promise.all([cycleAlert(), publishingAlert()]).then(([a, p]) => setAlerts([...(a ? (['autopilot'] as PageId[]) : []), ...(p ? (['publishing'] as PageId[]) : [])])).catch(() => setAlerts([])); }, []);
  useEffect(() => { refreshAlerts(); const id = setInterval(refreshAlerts, 60000); return () => clearInterval(id); }, [refreshAlerts]);
  const navigate = (p: PageId) => { setPage(p); setMenuOpen(false); refreshAlerts(); };
  const titleKey = NAV_ITEMS.find((n) => n.id === page)!.labelKey;

  let content;
  if (page === 'overview') content = <Overview showMascot={showMascot} onHideMascot={() => setShowMascot(false)} onNavigate={navigate} />;
  else if (page === 'library') content = <Library />;
  else if (page === 'guide') content = <Guide onNavigate={navigate} />;
  else if (page === 'captions') content = <CaptionBank />;
  else if (page === 'pairing') content = <Pairing onNavigate={navigate} />;
  else if (page === 'calculator') content = <Calculator />;
  else if (page === 'schedule') content = <Planner onNavigate={navigate} />;
  else if (page === 'publishing') content = <Queue onNavigate={navigate} onChanged={refreshAlerts} />;
  else if (page === 'autopilot') content = <Autopilot onNavigate={navigate} onChanged={refreshAlerts} />;
  else if (page === 'help') content = <Help onNavigate={navigate} />;
  else if (page === 'networks') content = <Networks />;
  else if (page === 'settings') content = <Settings showMascot={showMascot} onToggleMascot={setShowMascot} />;
  else content = <ModulePage descKey={MODULE_DESC[page] ?? 'mod.help'} />;

  return (
    <div className="app">
      <Sidebar current={page} onNavigate={navigate} open={menuOpen} alerts={alerts} />
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
      <div className="main">
        <Header titleKey={titleKey} onMenu={() => setMenuOpen(true)} />
        <main className="content">{content}</main>
      </div>
    </div>
  );
}
