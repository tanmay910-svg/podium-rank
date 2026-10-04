import crypto from "crypto";

const REPO = process.env.GITHUB_REPO || "tanmay910-svg/podium-rank";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const FILE = "public/data/podium.json";
const PASSWORD = process.env.PODIUM_ADMIN_PASSWORD;
const SECRET = process.env.PODIUM_SESSION_SECRET;

function json(res, status, body) { res.status(status).setHeader("Content-Type","application/json"); return res.end(JSON.stringify(body)); }
function sign(value) { return crypto.createHmac("sha256", SECRET || "missing-secret").update(value).digest("base64url"); }
function sessionToken() {
  const exp = Date.now() + 8 * 60 * 60 * 1000;
  const value = String(exp);
  return `${value}.${sign(value)}`;
}
function validSession(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)podium_admin=([^;]+)/);
  if (!match) return false;
  const [exp, sig] = decodeURIComponent(match[1]).split(".");
  if (!exp || !sig || Number(exp) < Date.now() || !SECRET) return false;
  const expected = sign(exp);
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
function validPassword(input) {
  if (!PASSWORD || typeof input !== "string") return false;
  const a = Buffer.from(input), b = Buffer.from(PASSWORD);
  return a.length === b.length && crypto.timingSafeEqual(a,b);
}
async function github(method="GET", body) {
  const url = `https://api.github.com/repos/${REPO}/contents/${FILE}${method==="GET" ? `?ref=${BRANCH}` : ""}`;
  const r = await fetch(url, {
    method,
    headers: { Authorization:`Bearer ${process.env.GITHUB_TOKEN}`, Accept:"application/vnd.github+json", "Content-Type":"application/json", "X-GitHub-Api-Version":"2022-11-28" },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let out; try { out = JSON.parse(text); } catch { out = { message:text }; }
  if (!r.ok) throw new Error(out.message || `GitHub error ${r.status}`);
  return out;
}
async function readData() {
  const file = await github("GET");
  return { data: JSON.parse(Buffer.from(file.content.replace(/\\n/g,""), "base64").toString("utf8")), sha:file.sha };
}
async function writeData(data, sha, message) {
  const body = { message, content: Buffer.from(JSON.stringify(data,null,2)+"\\n").toString("base64"), sha, branch:BRANCH };
  return github("PUT", body);
}
function id(prefix) { return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`; }

export default async function handler(req, res) {
  try {
    if (req.method === "GET") return json(res,200,{authenticated:validSession(req)});
    const body = req.body || {};
    if (body.action === "login") {
      if (!validPassword(body.password)) return json(res,401,{error:"Invalid moderator password."});
      res.setHeader("Set-Cookie", `podium_admin=${sessionToken()}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800`);
      return json(res,200,{ok:true});
    }
    if (body.action === "logout") {
      res.setHeader("Set-Cookie","podium_admin=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
      return json(res,200,{ok:true});
    }
    if (!validSession(req)) return json(res,401,{error:"Moderator session expired."});

    const {data,sha} = await readData();
    const season = data.seasons?.find(s=>s.status==="Active") || data.seasons?.[0];
    data.members = data.members || []; data.debates = data.debates || []; data.results = data.results || [];

    if (body.action === "add_member") {
      if (!body.name?.trim()) return json(res,400,{error:"Member name is required."});
      data.members.push({id:id("member"), name:body.name.trim(), email:(body.email||"").trim(), department:(body.department||"").trim(), bio:(body.bio||"").trim(), avatar:(body.avatar||"").trim(), active:true});
      await writeData(data,sha,"admin: add Podium member");
      return json(res,200,{ok:true,data});
    }
    if (body.action === "create_debate") {
      if (!body.name?.trim()) return json(res,400,{error:"Debate title is required."});
      const weekNumber = Number(body.weekNumber) || (Math.max(0,...data.debates.filter(d=>d.seasonId===season?.id).map(d=>Number(d.weekNumber)||0))+1);
      data.debates.push({id:id("debate"), seasonId:season?.id || null, weekNumber, name:body.name.trim(), date:body.date||"", category:(body.category||"Debate").trim(), description:(body.description||"").trim(), status:body.status||"Open"});
      await writeData(data,sha,"admin: create Podium debate");
      return json(res,200,{ok:true,data});
    }
    if (body.action === "publish_results") {
      if (!body.debateId || !Array.isArray(body.memberIds) || !body.memberIds.length) return json(res,400,{error:"Choose a debate and at least one participant."});
      const debate = data.debates.find(d=>d.id===body.debateId);
      if (!debate) return json(res,404,{error:"Debate not found."});
      const members = new Map(data.members.filter(m=>m.active!==false).map(m=>[m.id,m]));
      const ids = body.memberIds.filter(x=>members.has(x));
      if (!ids.length) return json(res,400,{error:"No valid members selected."});
      data.results = data.results.filter(r=>r.debateId !== debate.id);
      ids.forEach((memberId,i)=>{
        const position = i < 5 ? String(i+1) : "Other";
        const score = ({1:[80,20],2:[68,20],3:[58,20],4:[50,20],5:[45,20],Other:[25,20]})[position];
        data.results.push({id:id("result"), debateId:debate.id, seasonId:debate.seasonId, memberId, position, performancePoints:score[0], participationPoints:score[1], totalPoints:score[0]+score[1], publishedAt:new Date().toISOString()});
      });
      debate.status="Completed";
      await writeData(data,sha,`admin: publish results for ${debate.name}`);
      return json(res,200,{ok:true,data});
    }
    if (body.action === "delete_member") {
      data.members = data.members.filter(m=>m.id!==body.memberId);
      data.results = data.results.filter(r=>r.memberId!==body.memberId);
      await writeData(data,sha,"admin: remove Podium member");
      return json(res,200,{ok:true,data});
    }
    if (body.action === "delete_debate") {
      data.debates = data.debates.filter(d=>d.id!==body.debateId);
      data.results = data.results.filter(r=>r.debateId!==body.debateId);
      await writeData(data,sha,"admin: remove Podium debate");
      return json(res,200,{ok:true,data});
    }
    return json(res,400,{error:"Unknown admin action."});
  } catch(e) {
    console.error(e);
    return json(res,500,{error:e.message || "Server error."});
  }
}
