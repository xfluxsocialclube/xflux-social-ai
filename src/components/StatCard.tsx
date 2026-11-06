export function StatCard({ label, value, tag }: { label: string; value: number; tag?: string }) {
  return (
    <div className="card stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {tag && <span className="tag">{tag}</span>}
    </div>
  );
}
