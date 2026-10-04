const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3001);
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "podium.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const MODERATOR_PASSWORD = process.env.MODERATOR_PASSWORD || "change-this-password";
const tokens = new Set();

const SCORE = {
  "1": { performancePoints: 80, participationPoints: 20, totalPoints: 100 },
  "2": { performancePoints: 68, participationPoints: 20, totalPoints: 88 },
  "3": { performancePoints: 58, participationPoints: 20, totalPoints: 78 },
  "4": { performancePoints: 50, participationPoints: 20, totalPoints: 70 },
  "5": { performancePoints: 45, participationPoints: 20, totalPoints: 65 },
  "Other": { performancePoints: 25, participationPoints: 20, totalPoints: 45 }
};

function ensureData() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ seasons: [], members: [], debates: [], results: [] }, null, 2));
  }
}
function loadData() {
  ensureData();
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { return { seasons: [], members: [], debates: [], results: [] }; }
}
function saveData(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
function activeSeason(data) { return data.seasons.find(s => s.status === "Active") || null; }

function seedDemoIfRequested() {
  const data = loadData();
  if (data.seasons.length || data.members.length || data.debates.length || data.results.length || process.env.SEED_DEMO !== "true") return;

  const season = { id: crypto.randomUUID(), name: "Term 1 • 2026–27", startDate: "2026-09-01", endDate: "2026-12-31", status: "Active", description: "PODIUM weekly debate season." };
  const memberNames = [
    ["Ananya Roy","Literature & Political Science"],
    ["Anushka Verma","Economics"],
    ["Dev Patel","Physics"],
    ["Rohan Mehta","Electrical Engineering"],
    ["Priya Nair","Design & Philosophy"],
    ["Kabir Singh","Mathematics"],
    ["Sanya Gupta","Business Administration"],
    ["Vikram Joshi","Mechanical Engineering"]
  ];
  const members = memberNames.map(([name,department]) => ({
    id: crypto.randomUUID(), name, department, bio: "Podium debater.", avatar: "", active: true, createdAt: new Date().toISOString()
  }));
  const debateSeeds = [
    ["Free Speech vs Social Harmony",1,"2026-09-07","This House would prioritize curbing disinformation over absolute freedom of speech on digital public squares."],
    ["Privacy vs Public Safety",2,"2026-09-14","This House believes state surveillance powers should be curtailed in favor of citizen digital encryption rights."],
    ["AI Regulation and Innovation",3,"2026-09-21","This House would require stronger safety standards before deployment of frontier AI systems."]
  ];
  const debates = debateSeeds.map(([name,weekNumber,date,description]) => ({
    id: crypto.randomUUID(), seasonId: season.id, name, weekNumber, date, description, status: "Completed", category: "Debate", createdAt: new Date().toISOString()
  }));
  const placements = [
    [[0,"1"],[1,"2"],[2,"3"],[3,"4"],[4,"5"],[5,"Other"],[6,"Other"]],
    [[2,"1"],[4,"2"],[1,"3"],[6,"4"],[5,"5"],[0,"Other"],[3,"Other"]],
    [[1,"1"],[3,"2"],[0,"3"],[2,"4"],[6,"5"],[4,"Other"],[7,"Other"]]
  ];
  const results = [];
  debates.forEach((debate, i) => placements[i].forEach(([mi,pos]) => results.push({
    id: crypto.randomUUID(), seasonId: season.id, debateId: debate.id, memberId: members[mi].id, position: pos, ...SCORE[pos], createdAt: new Date().toISOString()
  })));
  saveData({ seasons:[season], members, debates, results });
}

function leaderboard(data, seasonId) {
  const members = data.members.filter(m => m.active !== false);
  const map = new Map(members.map(m => [m.id, {
    memberId:m.id, name:m.name, avatar:m.avatar||"", department:m.department||"",
    totalPoints:0,wins:0,secondPlaces:0,thirdPlaces:0,performancePoints:0,participationPoints:0,debates:0
  }]));
  for (const r of data.results) {
    if (r.seasonId !== seasonId) continue;
    const row = map.get(r.memberId); if (!row) continue;
    row.totalPoints += Number(r.totalPoints)||0;
    row.performancePoints += Number(r.performancePoints)||0;
    row.participationPoints += Number(r.participationPoints)||0;
    row.debates += 1;
    if (r.position==="1") row.wins += 1;
    if (r.position==="2") row.secondPlaces += 1;
    if (r.position==="3") row.thirdPlaces += 1;
  }
  const rows = [...map.values()].sort((a,b)=>
    b.totalPoints-a.totalPoints || b.wins-a.wins || b.secondPlaces-a.secondPlaces ||
    b.thirdPlaces-a.thirdPlaces || b.performancePoints-a.performancePoints || a.name.localeCompare(b.name)
  );
  let previous = null, rank = 0;
  rows.forEach((r,i)=>{
    const key=[r.totalPoints,r.wins,r.secondPlaces,r.thirdPlaces,r.performancePoints].join("|");
    if (key!==previous) rank=i+1;
    r.rank=rank;
    r.averageScore=r.debates?Math.round(r.totalPoints/r.debates*10)/10:0;
    previous=key;
  });
  return rows;
}

function statePayload(data) {
  const season = activeSeason(data);
  const lb = season ? leaderboard(data,season.id) : [];
  const debates = data.debates.filter(d=>!season || d.seasonId===season.id).sort((a,b)=>a.weekNumber-b.weekNumber).map(d=>({
    ...d,
    participantCount:data.results.filter(r=>r.debateId===d.id).length
  }));
  const members = data.members.filter(m=>m.active!==false).map(({id,name,department,bio,avatar})=>({id,name,department,bio,avatar}));
  const hallOfFame = data.seasons.filter(s=>s.status==="Archived").sort((a,b)=>new Date(b.startDate)-new Date(a.startDate)).map(s=>({
    season:s, leaderboard:leaderboard(data,s.id).slice(0,3)
  }));
  return { season, leaderboard:lb, debates, members, hallOfFame };
}

function isAuth(req) {
  const h=req.headers.authorization||"";
  const t=h.startsWith("Bearer ")?h.slice(7):"";
  return Boolean(t && tokens.has(t));
}

function send(res,status,data,type="application/json; charset=utf-8") {
  res.writeHead(status,{"Content-Type":type,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Referrer-Policy":"no-referrer"});
  res.end(typeof data==="string"?data:JSON.stringify(data));
}
function parseBody(req) {
  return new Promise((resolve,reject)=>{
    let raw="";
    req.on("data",c=>{raw+=c;if(raw.length>200000){reject(new Error("Request too large"));req.destroy();}});
    req.on("end",()=>{try{resolve(raw?JSON.parse(raw):{})}catch{reject(new Error("Invalid JSON"))}});
    req.on("error",reject);
  });
}

async function api(req,res,url) {
  const data=loadData();

  if(req.method==="GET" && url.pathname==="/api/state") return send(res,200,statePayload(data));
  if(req.method==="GET" && url.pathname==="/api/health") return send(res,200,{ok:true,service:"PODIUM"});

  if(req.method==="POST" && url.pathname==="/api/admin/login"){
    const b=await parseBody(req);
    const a=Buffer.from(MODERATOR_PASSWORD), c=Buffer.from(String(b.password||""));
    const ok=a.length===c.length && crypto.timingSafeEqual(a,c);
    if(!ok) return send(res,401,{message:"Invalid moderator password."});
    const token=crypto.randomBytes(32).toString("hex"); tokens.add(token);
    return send(res,200,{token});
  }

  if(req.method==="POST" && url.pathname==="/api/admin/logout"){
    const t=(req.headers.authorization||"").replace(/^Bearer /,""); tokens.delete(t);
    return send(res,200,{ok:true});
  }

  if(!isAuth(req)) return send(res,401,{message:"Moderator access required."});

  if(req.method==="POST" && url.pathname==="/api/admin/members"){
    const b=await parseBody(req);
    if(!String(b.name||"").trim()) return send(res,400,{message:"Member name is required."});
    const m={id:crypto.randomUUID(),name:String(b.name).trim(),department:String(b.department||"").trim(),bio:String(b.bio||"").trim(),avatar:String(b.avatar||"").trim(),active:true,createdAt:new Date().toISOString()};
    data.members.push(m); saveData(data); return send(res,201,m);
  }

  if(req.method==="PATCH" && url.pathname.startsWith("/api/admin/members/")){
    const id=url.pathname.split("/").pop(), m=data.members.find(x=>x.id===id);
    if(!m) return send(res,404,{message:"Member not found."});
    const b=await parseBody(req);
    if(b.name!==undefined) m.name=String(b.name).trim();
    if(b.department!==undefined) m.department=String(b.department).trim();
    if(b.bio!==undefined) m.bio=String(b.bio).trim();
    if(b.avatar!==undefined) m.avatar=String(b.avatar).trim();
    saveData(data); return send(res,200,m);
  }

  if(req.method==="POST" && url.pathname==="/api/admin/debates"){
    const b=await parseBody(req), s=activeSeason(data);
    if(!s) return send(res,400,{message:"Create or activate a season first."});
    if(!String(b.name||"").trim()||!Number(b.weekNumber)||!b.date) return send(res,400,{message:"Debate name, week number and date are required."});
    const d={id:crypto.randomUUID(),seasonId:s.id,name:String(b.name).trim(),weekNumber:Number(b.weekNumber),date:String(b.date),description:String(b.description||"").trim(),status:"Open",category:"Debate",createdAt:new Date().toISOString()};
    data.debates.push(d); saveData(data); return send(res,201,d);
  }

  if(req.method==="POST" && url.pathname==="/api/admin/results"){
    const b=await parseBody(req), d=data.debates.find(x=>x.id===b.debateId);
    if(!d) return send(res,404,{message:"Debate not found."});
    const s=data.seasons.find(x=>x.id===d.seasonId);
    if(!s||s.status!=="Active") return send(res,400,{message:"Results can only be published for the active season."});
    if(!Array.isArray(b.results)||!b.results.length) return send(res,400,{message:"Add at least one result."});
    const ids=b.results.map(x=>String(x.memberId));
    if(new Set(ids).size!==ids.length) return send(res,400,{message:"Duplicate member in results."});
    const top=b.results.map(x=>String(x.position)).filter(x=>["1","2","3","4","5"].includes(x));
    if(new Set(top).size!==top.length) return send(res,400,{message:"1st–5th positions must be unique."});
    for(const item of b.results){
      const m=data.members.find(x=>x.id===String(item.memberId)&&x.active!==false);
      if(!m) return send(res,400,{message:"Every result must reference an active Podium member."});
      const pos=String(item.position);
      if(!SCORE[pos]) return send(res,400,{message:"Invalid debate position."});
      const existing=data.results.find(r=>r.debateId===d.id&&r.memberId===m.id);
      const row={id:existing?.id||crypto.randomUUID(),seasonId:s.id,debateId:d.id,memberId:m.id,position:pos,...SCORE[pos],createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
      if(existing) Object.assign(existing,row); else data.results.push(row);
    }
    d.status="Completed"; saveData(data); return send(res,201,{message:"Debate results published.",state:statePayload(data)});
  }

  if(req.method==="POST" && url.pathname==="/api/admin/seasons"){
    const b=await parseBody(req);
    if(!String(b.name||"").trim()||!b.startDate||!b.endDate) return send(res,400,{message:"Season name, start date and end date are required."});
    data.seasons.forEach(s=>{if(s.status==="Active")s.status="Archived";});
    const s={id:crypto.randomUUID(),name:String(b.name).trim(),startDate:String(b.startDate),endDate:String(b.endDate),status:"Active",description:String(b.description||"").trim()};
    data.seasons.push(s); saveData(data); return send(res,201,{season:s});
  }

  return send(res,404,{message:"API route not found."});
}

function typeFor(file){
  const e=path.extname(file).toLowerCase();
  return ({".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8"})[e]||"application/octet-stream";
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://${req.headers.host||"localhost"}`);
    if(url.pathname.startsWith("/api/")) return await api(req,res,url);
    const requested=url.pathname==="/"?"/index.html":url.pathname;
    const p=path.normalize(path.join(PUBLIC_DIR,requested));
    if(!p.startsWith(PUBLIC_DIR)) return send(res,403,"Forbidden","text/plain; charset=utf-8");
    if(!fs.existsSync(p)||fs.statSync(p).isDirectory()) return send(res,404,"Not found","text/plain; charset=utf-8");
    res.writeHead(200,{"Content-Type":typeFor(p),"Cache-Control":requested.endsWith(".html")?"no-cache":"public, max-age=3600","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY"});
    fs.createReadStream(p).pipe(res);
  }catch(e){console.error(e);send(res,500,{message:"Internal server error."});}
});

ensureData();
seedDemoIfRequested();

server.listen(PORT,()=>console.log(`[PODIUM] Running at http://localhost:${PORT}`));
