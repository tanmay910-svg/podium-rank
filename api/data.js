const REPO = process.env.GITHUB_REPO || "tanmay910-svg/podium-rank";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const FILE = "public/data/podium.json";

async function githubFile() {
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE}?ref=${BRANCH}`, {
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }
  });
  if (!r.ok) throw new Error(`GitHub read failed: ${r.status}`);
  return r.json();
}

export default async function handler(req, res) {
  try {
    const file = await githubFile();
    const data = JSON.parse(Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8"));
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(200).json(data);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Unable to load Podium data." });
  }
}
