export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      <p>{description}</p>
    </div>
  );
}
