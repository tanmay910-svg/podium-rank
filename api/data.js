const REPO = process.env.GITHUB_REPO || "tanmay910-svg/podium-rank";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const FILE = "public/data/podium.json";

async function githubFile() {
  const r = await fetch(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/${FILE}?t=${Date.now()}`);
  if (!r.ok) throw new Error(`GitHub read failed: ${r.status}`);
  return { raw: await r.text() };
}

export default async function handler(req, res) {
  try {
    const file = await githubFile();
    const data = JSON.parse(file.raw);
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(200).json(data);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Unable to load Podium data." });
  }
}
