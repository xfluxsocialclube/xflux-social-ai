import { NETWORKS } from '../services/networks';

export function NetTag({ id }: { id: string }) {
  const n = NETWORKS.find((x) => x.id === id);
  return <span className="net-tag"><i style={{ background: n?.color ?? '#8e94c4' }} />{n?.name ?? id}</span>;
}
