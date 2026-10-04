(() => {
  const SCORE = {
    "1": { performancePoints: 80, participationPoints: 20, totalPoints: 100 },
    "2": { performancePoints: 68, participationPoints: 20, totalPoints: 88 },
    "3": { performancePoints: 58, participationPoints: 20, totalPoints: 78 },
    "4": { performancePoints: 50, participationPoints: 20, totalPoints: 70 },
    "5": { performancePoints: 45, participationPoints: 20, totalPoints: 65 },
    "Other": { performancePoints: 25, participationPoints: 20, totalPoints: 45 }
  };

  const state = {
    data: null,
    route: location.hash.replace(/^#\/?/, "") || "leaderboard"
  };

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
  const initials = (name) => String(name || "?").trim().split(/\s+/).slice(0,2).map(x => x[0]).join("").toUpperCase() || "?";
  const fmtDate = (d) => {
    if (!d) return "—";
    const x = new Date(d + (String(d).length === 10 ? "T00:00:00" : ""));
    return Number.isNaN(x.getTime()) ? d : x.toLocaleDateString("en-IN", {day:"2-digit", month:"short", year:"numeric"});
  };

  function activeSeason(data) {
    return data.season || data.seasons?.find(s => s.status === "Active") || null;
  }

  function calcLeaderboard(data, seasonId) {
    const members = (data.members || []).filter(m => m.active !== false);
    const map = new Map(members.map(m => [m.id, {
      memberId:m.id, name:m.name, avatar:m.avatar || "", department:m.department || "",
      totalPoints:0, wins:0, secondPlaces:0, thirdPlaces:0,
      performancePoints:0, participationPoints:0, debates:0
    }]));

    for (const r of (data.results || [])) {
      if (seasonId && r.seasonId !== seasonId) continue;
      const row = map.get(r.memberId);
      if (!row) continue;
      const score = SCORE[r.position] || {
        performancePoints:Number(r.performancePoints)||0,
        participationPoints:Number(r.participationPoints)||0,
        totalPoints:(Number(r.performancePoints)||0)+(Number(r.participationPoints)||0)
      };
      row.totalPoints += score.totalPoints;
      row.performancePoints += score.performancePoints;
      row.participationPoints += score.participationPoints;
      row.debates++;
      if (r.position === "1") row.wins++;
      if (r.position === "2") row.secondPlaces++;
      if (r.position === "3") row.thirdPlaces++;
    }

    const rows = [...map.values()].sort((a,b) =>
      b.totalPoints-a.totalPoints ||
      b.wins-a.wins ||
      b.secondPlaces-a.secondPlaces ||
      b.thirdPlaces-a.thirdPlaces ||
      b.performancePoints-a.performancePoints ||
      a.name.localeCompare(b.name)
    );

    let prev = null, rank = 0;
    rows.forEach((r, i) => {
      const key = [r.totalPoints,r.wins,r.secondPlaces,r.thirdPlaces,r.performancePoints].join("|");
      if (key !== prev) rank = i + 1;
      r.rank = rank;
      r.averageScore = r.debates ? Math.round(r.totalPoints / r.debates * 10) / 10 : 0;
      prev = key;
    });
    return rows;
  }

  function getDebates(data, seasonId) {
    return (data.debates || [])
      .filter(d => !seasonId || d.seasonId === seasonId)
      .sort((a,b) => (a.weekNumber || 0) - (b.weekNumber || 0));
  }

  function shell(content, active) {
    const nav = [
      ["leaderboard","🏆","Leaderboard"],
      ["debates","💬","Debates"],
      ["members","✦","Members"],
      ["hall-of-fame","🏛","Hall of Fame"]
    ];
    return `
      <div class="app">
        <header class="nav">
          <div class="nav-in">
            <div class="brand" onclick="location.hash='#leaderboard'" style="cursor:pointer">
              <div class="logo">🏆</div>
              <div><div class="brand-title">PODIUM</div><div class="brand-tag">THINK • ARGUE • CONQUER</div></div>
            </div>
            <nav class="navlinks">
              ${nav.map(([id,icon,label]) => `<button class="${active===id?'active':''}" onclick="location.hash='#${id}'">${icon} ${label}</button>`).join("")}
            </nav>
            <div class="pill">TERM 1 • 2026–27</div>
          </div>
        </header>
        ${content}
        <footer class="footer"><div class="foot-in"><div>🏆 PODIUM — Debate Rankings</div><div>Weekly competition • Official points • Transparent standings</div></div></footer>
      </div>`;
  }

  function leaderboardPage(data) {
    const season = activeSeason(data);
    const lb = calcLeaderboard(data, season?.id);
    const top = lb.slice(0,3);
    const totalParticipants = (data.members || []).filter(m => m.active !== false).length;
    const totalDebates = getDebates(data, season?.id).length;
    const completed = getDebates(data, season?.id).filter(d => d.status === "Completed").length;

    const podium = top.length ? `
      <div class="top3">
        ${[top[1],top[0],top[2]].filter(Boolean).map((r,i) => `
          <div class="top ${r.rank===1?'first':''}">
            <div class="medal">${r.rank===1?'🥇':r.rank===2?'🥈':'🥉'}</div>
            <div class="top-name">${esc(r.name)}</div>
            <div class="top-points">${r.totalPoints} pts</div>
            <div class="muted">${r.wins} win${r.wins===1?'':'s'} • ${r.debates} debate${r.debates===1?'':'s'}</div>
          </div>`).join("")}
      </div>` : `<div class="card" style="text-align:center;padding:46px"><div style="font-size:40px">🏆</div><div class="card-title">No rankings yet</div><div class="muted">Official standings will appear here after the first debate results are published.</div></div>`;

    return shell(`
      <main class="wrap">
        <section class="hero">
          <div><div class="eyebrow">🏅 OFFICIAL DEBATE STANDINGS</div><h1>DEBATE<br>LEADERBOARD</h1><div class="tagline">Compete. Create. Conquer.</div><p class="sub">The official Podium ranking for weekly debates. Points are calculated from participation and published performance results using the fixed scoring system.</p></div>
          <div class="pill">${esc(season?.name || "No active season")}</div>
        </section>
        <section class="stats">
          <div class="stat"><div class="stat-l">Debaters</div><div class="stat-v">${totalParticipants}</div></div>
          <div class="stat"><div class="stat-l">Debates</div><div class="stat-v">${totalDebates}</div></div>
          <div class="stat"><div class="stat-l">Completed</div><div class="stat-v">${completed}</div></div>
          <div class="stat"><div class="stat-l">Points / Win</div><div class="stat-v">100</div></div>
        </section>
        <section class="section"><div class="section-head"><div><div class="section-title">CURRENT PODIUM</div><div class="section-note">Top performers in the active term</div></div></div>${podium}</section>
        <section class="section"><div class="section-head"><div><div class="section-title">CURRENT DEBATE LEADERBOARD</div><div class="section-note">Tie-break order: points → wins → 2nd → 3rd → performance points</div></div></div>
          ${lb.length ? `<div class="table"><table><thead><tr><th>Rank</th><th>Debater</th><th>Debates</th><th>Wins</th><th>2nd</th><th>3rd</th><th>Points</th></tr></thead><tbody>${lb.map(r=>`<tr><td class="rank">#${r.rank}</td><td><strong>${esc(r.name)}</strong><div class="muted">${esc(r.department)}</div></td><td>${r.debates}</td><td>${r.wins}</td><td>${r.secondPlaces}</td><td>${r.thirdPlaces}</td><td class="points">${r.totalPoints}</td></tr>`).join("")}</tbody></table></div>` : "" }
        </section>
        <section class="section"><div class="admin-panel"><h3>Official scoring</h3><div class="cards">
          <div class="card"><span class="badge">1ST</span><div class="card-title">100 points</div><div class="muted">80 performance + 20 participation</div></div>
          <div class="card"><span class="badge">2ND</span><div class="card-title">88 points</div><div class="muted">68 performance + 20 participation</div></div>
          <div class="card"><span class="badge">3RD–5TH</span><div class="card-title">78 / 70 / 65</div><div class="muted">Fixed official scoring</div></div>
        </div></div></section>
      </main>`, "leaderboard");
  }

  function debatesPage(data) {
    const season = activeSeason(data);
    const debates = getDebates(data, season?.id);
    return shell(`
      <main class="wrap">
        <section class="section" style="margin-top:10px"><div class="eyebrow">💬 WEEKLY PARLIAMENTARY ARENA</div><h1 style="font-size:48px;margin:8px 0">WEEKLY DEBATES</h1><p class="sub">Every debate is a new chance to earn official Podium points.</p></section>
        <section class="section"><div class="cards">${debates.length ? debates.map(d=>`<article class="card"><span class="badge">${d.status||"Open"}</span><div class="card-title">Week ${d.weekNumber}: ${esc(d.name)}</div><div class="card-meta">${fmtDate(d.date)} • ${esc(d.category||"Debate")} • ${(data.results||[]).filter(r=>r.debateId===d.id).length} participants</div><div class="card-desc">${esc(d.description||"Official weekly Podium debate.")}</div></article>`).join("") : `<div class="card" style="grid-column:1/-1;text-align:center;padding:46px"><div style="font-size:40px">📅</div><div class="card-title">No debates scheduled yet</div><div class="muted">Weekly debate motions will appear here.</div></div>`}</div></section>
      </main>`, "debates");
  }

  function membersPage(data) {
    const season = activeSeason(data);
    const lb = calcLeaderboard(data, season?.id);
    const byId = new Map(lb.map(x=>[x.memberId,x]));
    const members = (data.members||[]).filter(m=>m.active!==false);
    return shell(`
      <main class="wrap">
        <section class="section" style="margin-top:10px"><div class="eyebrow">✦ ROSTER & COMPETITORS</div><h1 style="font-size:48px;margin:8px 0">PODIUM MEMBERS</h1><p class="sub">Meet the competitors and follow their performance throughout the term.</p></section>
        <section class="section"><div class="profiles">${members.length ? members.map(m=>{const r=byId.get(m.id)||{totalPoints:0,wins:0,debates:0,rank:"—"};return `<article class="profile"><div class="profile-head"><div class="avatar">${m.avatar?`<img src="${esc(m.avatar)}" alt="">`:initials(m.name)}</div><div><div class="profile-name">${esc(m.name)}</div><div class="profile-dept">${esc(m.department||"Podium Debater")}</div></div></div><p class="card-desc">${esc(m.bio||"Podium debater.")}</p><div class="mini-grid"><div class="mini"><b>#${r.rank}</b><span>Rank</span></div><div class="mini"><b>${r.totalPoints}</b><span>Points</span></div><div class="mini"><b>${r.wins}</b><span>Wins</span></div></div></article>`}).join("") : `<div class="card" style="grid-column:1/-1;text-align:center;padding:46px"><div style="font-size:40px">👥</div><div class="card-title">No members added yet</div><div class="muted">The Podium roster will appear here.</div></div>`}</div></section>
      </main>`, "members");
  }

  function hallPage(data) {
    const archived = (data.seasons||[]).filter(s=>s.status==="Archived").sort((a,b)=>new Date(b.startDate)-new Date(a.startDate));
    return shell(`
      <main class="wrap">
        <section class="hero"><div><div class="eyebrow">🏛 PERMANENT HISTORICAL ARCHIVES</div><h1>HALL OF FAME</h1><p class="sub">Past Podium champions and historic debate records remain preserved as the seasons continue.</p></div></section>
        <section class="section"><div class="section-title">HISTORICAL SEASONS & DEBATE CHAMPIONS</div><div class="cards" style="margin-top:16px">${archived.length ? archived.map(s=>{const rows=calcLeaderboard(data,s.id).slice(0,3);return `<article class="card"><span class="badge">${esc(s.name)}</span><div class="card-title">${fmtDate(s.startDate)} — ${fmtDate(s.endDate)}</div>${rows.map((r,i)=>`<div class="row" style="justify-content:space-between;margin-top:12px"><span>${i===0?'🥇':i===1?'🥈':'🥉'} ${esc(r.name)}</span><strong class="points">${r.totalPoints}</strong></div>`).join("")}</article>`}).join("") : `<div class="card" style="grid-column:1/-1;text-align:center;padding:46px"><div style="font-size:40px">🏛</div><div class="card-title">No archived seasons yet</div><div class="muted">Champions will be preserved here when a term is completed.</div></div>`}</div></section>
      </main>`, "hall-of-fame");
  }

  function render() {
    if (!state.data) return;
    const data = state.data;
    const route = state.route;
    document.getElementById("app").innerHTML =
      route === "debates" ? debatesPage(data) :
      route === "members" ? membersPage(data) :
      route === "hall-of-fame" ? hallPage(data) :
      leaderboardPage(data);
  }

  async function load() {
    try {
      let response = await fetch("/data/podium.json", { cache:"no-store" });
      if (!response.ok) throw new Error("Data file unavailable");
      state.data = await response.json();
      if (!state.data.seasons && state.data.season) state.data.seasons = [state.data.season];
      render();
    } catch (e) {
      document.getElementById("app").innerHTML = `
        <main class="wrap"><div class="login-box"><div class="eyebrow">PODIUM</div><h2>Portal unavailable</h2><p class="sub">The ranking data could not be loaded. Please refresh once the deployment has finished.</p><button class="btn gold" onclick="location.reload()">Refresh portal</button></div></main>`;
      console.error(e);
    }
  }

  window.addEventListener("hashchange", () => {
    state.route = location.hash.replace(/^#\/?/, "") || "leaderboard";
    render();
  });

  load();
})();