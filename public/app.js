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
              ${nav.map(([id,icon,label]) => `<button class="${active===id?'active':''}" onclick="location.hash='#${id}'">${icon} ${label}</button>`).join("")}<button class="navlogin" onclick="location.hash='#admin'">⚙ Moderator</button>
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
    if (route === "admin") {
      document.getElementById("app").innerHTML = state.admin ? adminDashboard(data) : adminLoginPage();
      bindAdmin();
      return;
    }
    document.getElementById("app").innerHTML =
      route === "debates" ? debatesPage(data) :
      route === "members" ? membersPage(data) :
      route === "hall-of-fame" ? hallPage(data) :
      leaderboardPage(data);
  }

  async function load() {
    try {
      let response = await fetch("/api/data", { cache:"no-store" });
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


  async function adminApi(body) {
    const r = await fetch("/api/admin", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)});
    const j = await r.json().catch(()=>({}));
    if (!r.ok) throw new Error(j.error || "Request failed");
    return j;
  }
  async function adminStatus() {
    const r = await fetch("/api/admin", {cache:"no-store"});
    const j = await r.json().catch(()=>({}));
    state.admin = !!j.authenticated;
  }
  function adminLoginPage() {
    return '<main class="wrap"><div class="login-box"><div class="eyebrow">PODIUM • MODERATOR ACCESS</div><h2>Moderator Dashboard</h2><p class="sub">Manage members, schedule activities and publish results.</p><form id="admin-login" class="form"><input class="input" id="admin-password" type="password" placeholder="Moderator password" required><button class="btn gold" type="submit">Sign in</button><div id="admin-error"></div></form></div></main>';
  }
  function adminDashboard(data) {
    const season = activeSeason(data);
    const members = (data.members||[]).filter(m=>m.active!==false);
    const debates = getDebates(data, season?.id);
    const lb = calcLeaderboard(data, season?.id);
    const open = debates.filter(d=>d.status!=="Completed");
    const rows = members.map(m=>{
      const r=lb.find(x=>x.memberId===m.id);
      return '<tr><td><strong>'+esc(m.name)+'</strong><div class="muted">'+esc(m.email||"")+'</div></td><td>'+esc(m.department||"—")+'</td><td class="points">'+(r?.totalPoints||0)+'</td><td>#'+(r?.rank||"—")+'</td><td><button class="btn danger small-btn" data-del-member="'+m.id+'">Remove</button></td></tr>';
    }).join("");
    const debateRows=debates.map(d=>'<tr><td>'+d.weekNumber+'</td><td><strong>'+esc(d.name)+'</strong></td><td>'+fmtDate(d.date)+'</td><td><span class="badge '+(d.status==="Completed"?"green":"")+'">'+esc(d.status||"Open")+'</span></td><td>'+(data.results||[]).filter(r=>r.debateId===d.id).length+'</td><td><button class="btn danger small-btn" data-del-debate="'+d.id+'">Remove</button></td></tr>').join("");
    return '<main class="wrap"><section class="admin-head"><div><div class="eyebrow">⚙ MODERATOR CONTROL CENTER</div><h1 class="page-title">PODIUM ADMIN</h1><p class="sub">Add members, create activities and publish results. The public leaderboard reads the same live data.</p></div><button class="btn ghost" id="admin-logout">Log out</button></section>'+
      '<section class="stats"><div class="stat"><div class="stat-l">Members</div><div class="stat-v">'+members.length+'</div></div><div class="stat"><div class="stat-l">Activities</div><div class="stat-v">'+debates.length+'</div></div><div class="stat"><div class="stat-l">Completed</div><div class="stat-v">'+debates.filter(d=>d.status==="Completed").length+'</div></div><div class="stat"><div class="stat-l">Leader</div><div class="stat-v admin-leader">'+esc(lb[0]?.name||"—")+'</div></div></section>'+
      '<div id="admin-message"></div><section class="admin-grid">'+
      '<div class="admin-panel"><h3>➕ Add member</h3><form id="member-form" class="form"><input class="input" name="name" placeholder="Full name" required><input class="input" name="email" placeholder="Email (optional)" type="email"><input class="input" name="department" placeholder="Department / year"><textarea class="input" name="bio" rows="3" placeholder="Short bio"></textarea><input class="input" name="avatar" placeholder="Avatar URL (optional)"><button class="btn gold">Add member</button></form></div>'+
      '<div class="admin-panel"><h3>🗓 Create activity</h3><form id="debate-form" class="form"><input class="input" name="name" placeholder="Activity / debate title" required><div class="row"><input class="input grow" name="date" type="date"><input class="input grow" name="weekNumber" type="number" min="1" placeholder="Week"></div><input class="input" name="category" placeholder="Category"><textarea class="input" name="description" rows="3" placeholder="Description"></textarea><button class="btn indigo">Create activity</button></form></div>'+
      '<div class="admin-panel full"><h3>🏆 Publish results</h3><p class="muted admin-help">Select an activity and arrange names from 1st onward. Points are calculated automatically: 1st 100, 2nd 88, 3rd 78, 4th 70, 5th 65, 6th+ 45.</p><div class="row"><select class="input grow" id="result-debate">'+open.map(d=>'<option value="'+d.id+'">Week '+d.weekNumber+': '+esc(d.name)+'</option>').join("")+'</select><button class="btn ghost" id="load-result-editor">Load</button></div><div id="result-editor"></div></div>'+
      '<div class="admin-panel full"><h3>👥 Roster</h3><div class="admin-table">'+(members.length?'<table><thead><tr><th>Member</th><th>Department</th><th>Points</th><th>Rank</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>':'<div class="muted">No members yet.</div>')+'</div></div>'+
      '<div class="admin-panel full"><h3>💬 Activities</h3><div class="admin-table">'+(debates.length?'<table><thead><tr><th>Week</th><th>Activity</th><th>Date</th><th>Status</th><th>Participants</th><th></th></tr></thead><tbody>'+debateRows+'</tbody></table>':'<div class="muted">No activities yet.</div>')+'</div></div></section></main>';
  }
  function bindResultEditor() {
    const box=document.getElementById("result-editor"), sel=document.getElementById("result-debate");
    if(!box||!sel)return;
    const debate=state.data.debates.find(d=>d.id===sel.value);
    const members=(state.data.members||[]).filter(m=>m.active!==false);
    if(!debate){box.innerHTML='<div class="notice">Create an open activity first.</div>';return;}
    let html='<div class="result-editor"><div class="result-head"><span>Participant order</span><span class="muted">1st → 2nd → 3rd → …</span></div><div id="participant-list">';
    for(let i=0;i<members.length;i++){
      html+='<div class="result-line"><span class="position-chip">'+(i+1<=5?["1st","2nd","3rd","4th","5th"][i]:"6th+")+'</span><select class="input participant-select"><option value="">— Not participating —</option>'+members.map(m=>'<option value="'+m.id+'">'+esc(m.name)+'</option>').join("")+'</select></div>';
    }
    html+='</div><button class="btn gold" id="publish-results">Publish official results</button></div>';
    box.innerHTML=html;
    document.getElementById("publish-results").onclick=async()=>{
      const ids=[...box.querySelectorAll(".participant-select")].map(x=>x.value).filter(Boolean);
      const unique=[...new Set(ids)];
      if(!unique.length){alert("Select at least one participant.");return;}
      if(unique.length!==ids.length){alert("A member can only appear once.");return;}
      try{
        const out=await adminApi({action:"publish_results",debateId:debate.id,memberIds:unique});
        state.data=out.data; render();
      }catch(e){document.getElementById("admin-message").innerHTML='<div class="notice error">'+esc(e.message)+'</div>';}
    };
  }
  function bindAdmin() {
    if(!state.admin){
      const f=document.getElementById("admin-login");
      if(f)f.onsubmit=async e=>{
        e.preventDefault();
        try{await adminApi({action:"login",password:document.getElementById("admin-password").value});state.admin=true;await load();render();}
        catch(err){document.getElementById("admin-error").innerHTML='<div class="notice error">'+esc(err.message)+'</div>';}
      };
      return;
    }
    document.getElementById("admin-logout").onclick=async()=>{await adminApi({action:"logout"});state.admin=false;render();};
    document.getElementById("member-form").onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.currentTarget));try{const out=await adminApi({action:"add_member",...b});state.data=out.data;e.currentTarget.reset();render();}catch(err){document.getElementById("admin-message").innerHTML='<div class="notice error">'+esc(err.message)+'</div>';}};    
    document.getElementById("debate-form").onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.currentTarget));try{const out=await adminApi({action:"create_debate",...b});state.data=out.data;e.currentTarget.reset();render();}catch(err){document.getElementById("admin-message").innerHTML='<div class="notice error">'+esc(err.message)+'</div>';}};    
    const loadBtn=document.getElementById("load-result-editor");if(loadBtn)loadBtn.onclick=bindResultEditor;
    bindResultEditor();
    document.querySelectorAll("[data-del-member]").forEach(b=>b.onclick=async()=>{if(!confirm("Remove this member and their results?"))return;const out=await adminApi({action:"delete_member",memberId:b.dataset.delMember});state.data=out.data;render();});
    document.querySelectorAll("[data-del-debate]").forEach(b=>b.onclick=async()=>{if(!confirm("Remove this activity and its results?"))return;const out=await adminApi({action:"delete_debate",debateId:b.dataset.delDebate});state.data=out.data;render();});
  }

  window.addEventListener("hashchange", async () => {
    state.route = location.hash.replace(/^#\/?/, "") || "leaderboard";
    if (state.route === "admin") await adminStatus();
    render();
  });

  (async () => {
    await load();
    if (state.route === "admin") await adminStatus();
    render();
  })();
})();