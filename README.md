# PODIUM — Think. Argue. Conquer.

A simple weekly debate ranking portal for the Podium domain.

Members open the portal to see the current season leaderboard. The moderator can add members, create weekly debates, publish results, and activate the next term.

## Scoring
- 1st: 80 performance + 20 participation = 100
- 2nd: 68 + 20 = 88
- 3rd: 58 + 20 = 78
- 4th: 50 + 20 = 70
- 5th: 45 + 20 = 65
- Other (6th+): 25 + 20 = 45
- Registration only: 0

Tie-break order:
1. Total points
2. 1st-place finishes
3. 2nd-place finishes
4. 3rd-place finishes
5. Performance points
6. Shared rank

One academic term is one PODIUM season. Old seasons are preserved.

## Run
Copy .env.example to .env, set MODERATOR_PASSWORD, then run:

npm start

Open http://localhost:3001

## Deployment
This version intentionally uses a JSON data file instead of Atlas. For production, run it on a persistent server/VM or container with the `data/` directory on persistent storage.

Docker:

docker build -t podium-rank .
docker run -d --name podium-rank -p 3001:3001 -v podium-data:/app/data --env-file .env podium-rank

Do not commit .env.