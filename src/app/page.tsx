import Link from "next/link";

const previewMemories = [
  ["1992-2000", "Owned beige VW Golf 1"],
  ["1995-1999", "Lived in Frankfurt"],
  ["1996-1998", "Attended evening school"],
  ["1997-2001", "Worked at logistics warehouse"],
  ["1998-2002", "Owned red Opel Corsa"]
];

export default function HomePage() {
  return (
    <section className="hero">
      <div>
        <p className="eyebrow">Recallia MVP</p>
        <h1>Turn scattered life memories into a connected timeline.</h1>
        <p className="lead">
          A focused local demo: sign in, review seeded memories, add one
          uncertain memory, ask Recallia AI for placement suggestions, then
          confirm what should be persisted.
        </p>
        <div className="actions">
          <Link className="button" href="/login">
            Start demo
          </Link>
          <Link className="button secondary" href="/timeline">
            Timeline preview
          </Link>
        </div>
      </div>
      <aside className="demo-panel" aria-label="Seeded memory preview">
        <h2>Seeded timeline</h2>
        <div className="timeline-preview">
          {previewMemories.map(([date, title]) => (
            <div className="memory-preview" key={title}>
              <strong>{title}</strong>
              <span>{date}</span>
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}
