export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }} />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, var(--accent2) 0%, transparent 70%)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 60%)" }} />
      </div>

      <div className="relative z-10 w-full max-w-lg text-center">
        {/* Badge */}
        <div className="animate-fade-up inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8 text-xs font-medium tracking-wide"
          style={{ background: "rgba(0,229,176,0.1)", border: "1px solid rgba(0,229,176,0.2)", color: "var(--accent)" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          AI-POWERED TRIVIA
        </div>

        {/* Logo */}
        <div className="animate-fade-up-1 mb-4">
          <h1 className="font-display text-8xl font-800 leading-none tracking-tight mb-1"
            style={{ fontWeight: 800 }}>
            <span style={{ color: "var(--accent)" }}>fan</span>
            <span style={{ color: "var(--text)" }}>atic</span>
          </h1>
          <div className="flex items-center justify-center gap-3 mt-3">
            <div className="h-px flex-1" style={{ background: "var(--border)" }} />
            <p className="text-sm tracking-widest uppercase" style={{ color: "var(--muted)" }}>
              Trivia for obsessives
            </p>
            <div className="h-px flex-1" style={{ background: "var(--border)" }} />
          </div>
        </div>

        {/* Stats row */}
        <div className="animate-fade-up-2 flex items-center justify-center gap-8 my-10">
          {[
            { value: "AI", label: "Generated" },
            { value: "5", label: "Difficulty levels" },
            { value: "Live", label: "Multiplayer" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-display text-2xl font-bold" style={{ color: "var(--accent)" }}>
                {stat.value}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="animate-fade-up-3 flex flex-col sm:flex-row gap-3 w-full">
          
            <a href="/host"
            className="btn-primary flex-1 py-4 text-base flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Host a Game
          </a>
          
            <a href="/play"
            className="flex-1 py-4 text-base font-display font-bold flex items-center justify-center gap-2 rounded-xl transition-all"
            style={{
              background: "var(--surface)",
              border: "1.5px solid var(--border)",
              color: "var(--text)",
              fontFamily: "'Syne', sans-serif",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
              (e.currentTarget as HTMLElement).style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLElement).style.color = "var(--text)";
            }}
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            Join a Game
          </a>
        </div>

        {/* Categories */}
        <div className="animate-fade-up-3 flex items-center justify-center gap-2 mt-8 flex-wrap">
          {["Anime", "TV Shows", "Any Show You Want"].map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 rounded-full text-xs"
              style={{
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                color: "var(--muted)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}