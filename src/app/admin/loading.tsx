/** Exibido imediatamente enquanto a página busca os dados */
export default function Loading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-4">
      <div className="skeleton h-10 w-56 rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-28 rounded-2xl" />
        ))}
      </div>
      <div className="skeleton h-72 rounded-2xl" />
    </div>
  );
}
