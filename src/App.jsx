import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const LOTTERY_TEAMS = [
  { name: "Zain (rights from Oakley)", chances: 170 },
  { name: "Zain", chances: 140 },
  { name: "Josh", chances: 120 },
  { name: "Muazzam", chances: 90 },
  { name: "Oakley (rights from Jackson)", chances: 75 },
  { name: "Brady", chances: 35 },
  { name: "Brady (rights from Rayan)", chances: 20 },
  { name: "Rayan (rights from BJ)", chances: 15 },
  { name: "Brady (rights from Shanil)", chances: 10 },
  { name: "Brady (rights from Colin)", chances: 5 },
];

function computeLotteryOddsMatrix(chances) {
  const n = chances.length;
  const totalAll = chances.reduce((a, b) => a + b, 0);
  const size = 1 << n;

  const sumWeights = new Array(size).fill(0);
  for (let mask = 1; mask < size; mask++) {
    const lsb = mask & -mask;
    const j = Math.log2(lsb) | 0;
    sumWeights[mask] = sumWeights[mask ^ lsb] + chances[j];
  }

  const dp = new Array(size).fill(0);
  dp[0] = 1;

  const probs = Array.from({ length: n }, () => Array(n).fill(0));

  for (let mask = 0; mask < size; mask++) {
    const pos = popcount(mask);
    if (pos >= n) continue;

    const remainingTotal = totalAll - sumWeights[mask];
    if (remainingTotal <= 0) continue;

    for (let j = 0; j < n; j++) {
      if (mask & (1 << j)) continue;
      const wj = chances[j];
      if (wj <= 0) continue;

      const p = dp[mask] * (wj / remainingTotal);
      probs[pos][j] += p;
      dp[mask | (1 << j)] += p;
    }
  }

  return probs;

  function popcount(x) {
    let c = 0;
    while (x) {
      x &= x - 1;
      c++;
    }
    return c;
  }
}

function simulateLotteryOrder(chances) {
  const remaining = [...Array(chances.length).keys()];
  const order = [];

  while (remaining.length) {
    let total = 0;
    for (const idx of remaining) total += chances[idx];

    let r = Math.random() * total;
    let chosen = remaining[remaining.length - 1];

    for (const idx of remaining) {
      r -= chances[idx];
      if (r <= 0) {
        chosen = idx;
        break;
      }
    }

    order.push(chosen);
    remaining.splice(remaining.indexOf(chosen), 1);
  }

  return order;
}

const LS_KEY = "fantasy-lottery:fanspo-style:v8";

export default function App() {
  const chances = useMemo(() => LOTTERY_TEAMS.map((t) => t.chances), []);
  const oddsMatrix = useMemo(() => computeLotteryOddsMatrix(chances), [chances]);

  // Projected pick = odds-table row order
  const projectedPickByTeam = useMemo(() => LOTTERY_TEAMS.map((_, i) => i + 1), []);

  const [speedMs, setSpeedMs] = useState(1500);

  const [order, setOrder] = useState(null);
  const [revealFromBackCount, setRevealFromBackCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const timerRef = useRef(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (saved && typeof saved.speedMs === "number") setSpeedMs(saved.speedMs);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ speedMs }));
  }, [speedMs]);

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startReveal(currentOrder) {
    clearTimer();

    timerRef.current = setInterval(() => {
      setRevealFromBackCount((c) => {
        const next = c + 1;
        if (next >= currentOrder.length) {
          clearTimer();
          setIsPaused(false);
        }
        return next;
      });
    }, speedMs);

    setIsPaused(false);
  }

  function onSimLottery() {
    clearTimer();
    const newOrder = simulateLotteryOrder(chances);
    setOrder(newOrder);
    setRevealFromBackCount(0);
    startReveal(newOrder);
  }

  function onReset() {
    clearTimer();
    setOrder(null);
    setRevealFromBackCount(0);
    setIsPaused(false);
  }

  function onPauseResume() {
    if (!order) return;

    if (isPaused) {
      startReveal(order);
    } else {
      setIsPaused(true);
      clearTimer();
    }
  }

  // Revealed picks: #10 -> #1
  const revealedPicks = useMemo(() => {
    if (!order) return [];
    const k = revealFromBackCount;
    const picks = [];
    for (let i = 0; i < k; i++) {
      const pickNumber = 10 - i;
      const teamIdx = order[pickNumber - 1];
      const projected = projectedPickByTeam[teamIdx];
      const delta = projected - pickNumber;
      picks.push({ pickNumber, teamIdx, delta });
    }
    return picks;
  }, [order, revealFromBackCount, projectedPickByTeam]);

  const statusText = !order
    ? "Run a simulation"
    : isPaused
    ? "Paused"
    : revealFromBackCount < 10
    ? "Revealing picks..."
    : "Complete";

  return (
    <div className="page">
      <div className="top">
        <div className="titleBlock">
          <div className="kicker">LOTTERY</div>
          <h1 className="title">Fantasy Draft Lottery Simulator</h1>
        </div>

        <div className="controls">
          <div className="control">
            <label className="label">Speed</label>
            <select
              className="select"
              value={speedMs}
              onChange={(e) => setSpeedMs(Number(e.target.value))}
            >
              <option value={1500}>Normal</option>
              <option value={2200}>Slow</option>
            </select>
          </div>

          <button className="btn primary" onClick={onSimLottery}>
            Sim Lottery
          </button>
        </div>
      </div>

      <div className="layout">
        {/* Odds table */}
        <div className="card cardTall oddsCard">
          <div className="cardHead">
            <div className="cardTitle">Odds Table</div>
            <div className="muted">Deterministic odds • Sim changes results only</div>
          </div>

          {/* KEY CHANGE: odds body scrolls too, so both cards stay same height */}
          <div className="cardBodyGrow oddsScroll">
            <div className="tableWrap noScroll">
              <table className="tbl fit">
                <thead>
                  <tr>
                    <th className="colTeam">Team</th>
                    {LOTTERY_TEAMS.map((_, i) => (
                      <th key={i} className="colPick">
                        {i + 1}
                        {suffix(i + 1)}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {LOTTERY_TEAMS.map((team, teamIdx) => (
                    <tr key={team.name}>
                      <td className="colTeam">
                        <span className="teamPill">{team.name}</span>
                      </td>

                      {oddsMatrix.map((posArr, pos) => {
                        const pct = posArr[teamIdx] * 100;
                        const displayText = pct < 0.05 ? "" : `${pct.toFixed(1)}%`;
                        return (
                          <td key={pos} className="cell" style={heatStyleStrong(pct)}>
                            {displayText}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Result */}
        <div className="side">
          <div className="card cardTall resultCard">
            <div className="cardHead">
              <div>
                <div className="cardTitle">Result</div>
                <div className="muted">{statusText}</div>
              </div>

              <div className="resultButtons">
                <button
                  className={"toggle " + (!order ? "disabled" : "")}
                  onClick={onPauseResume}
                  disabled={!order}
                >
                  {isPaused ? "Resume" : "Pause"}
                </button>

                <button className="toggle" onClick={onReset}>
                  Reset
                </button>
              </div>
            </div>

            <div className="cardBodyGrow resultScroll">
              {!order ? (
                <div className="empty">
                  Click <b>Sim Lottery</b> to generate a randomized 1–10 order.
                </div>
              ) : (
                <ol className="resultList revealBack">
                  {revealedPicks.map(({ pickNumber, teamIdx, delta }) => {
                    const badge = formatDelta(delta);
                    const badgeClass =
                      delta > 0 ? "delta plus" : delta < 0 ? "delta minus" : "delta even";

                    return (
                      <li key={pickNumber} className="resultRow finalPickAll">
                        <span className="pickTag pickTagFinal">#{pickNumber}</span>

                        <span className="resultName">
                          {renderNameWithItalicParens(LOTTERY_TEAMS[teamIdx].name)}
                        </span>

                        <span className={badgeClass}>{badge}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function suffix(n) {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  if (n % 10 === 1) return "st";
  if (n % 10 === 2) return "nd";
  if (n % 10 === 3) return "rd";
  return "th";
}

function heatStyleStrong(pct) {
  const t = Math.max(0, Math.min(1, pct / 55));
  const alpha = 0.18 + t * 0.50;
  return { backgroundColor: `rgba(255, 214, 64, ${alpha})` };
}

function formatDelta(delta) {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `${delta}`;
  return "—";
}

function renderNameWithItalicParens(name) {
  const open = name.indexOf("(");
  const close = name.lastIndexOf(")");
  if (open === -1 || close === -1 || close < open) return name;

  const before = name.slice(0, open).trimEnd();
  const parens = name.slice(open, close + 1);
  const after = name.slice(close + 1);

  return (
    <>
      {before} <span className="parenText">{parens}</span>
      {after}
    </>
  );
}