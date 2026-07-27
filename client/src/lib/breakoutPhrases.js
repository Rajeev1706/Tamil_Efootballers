// ─────────────────────────────────────────────────────────────────────────────
// Breakout Alert Phrases
// 100+ phrases across 3 tiers based on win rate jump magnitude.
// Tier 1: Solid breakout   (20–34% jump)
// Tier 2: Strong breakout  (35–49% jump)
// Tier 3: Explosive        (50%+ jump)
// ─────────────────────────────────────────────────────────────────────────────

const PHRASES = {
  solid: [
    "Taking the next step — this season feels different.",
    "The work is finally paying off.",
    "Quietly building something special.",
    "Found their stride and isn't stopping.",
    "A player who has clearly been studying the game.",
    "Last season was a warm-up. This is the real deal.",
    "The league is starting to take notice.",
    "Consistency has become their calling card.",
    "Every match, a statement. Every result, a message.",
    "Growing into one of the most reliable players in the league.",
    "The improvement isn't luck — it's earned.",
    "A slow burn turning into a steady flame.",
    "Solid, smart, and getting better every week.",
    "The numbers don't lie — this player is levelling up.",
    "Once overlooked, now impossible to ignore.",
    "Making every captain rethink their lineup.",
    "Calm under pressure, lethal in execution.",
    "The league average can't keep up with this form.",
    "Playing with a purpose that wasn't there last season.",
    "Don't call it a comeback — call it an arrival.",
    "Proving that improvement has no ceiling.",
    "The kind of player who makes opponents nervous.",
    "Form, focus, and a point to prove.",
    "Week by week, match by match — building a legacy.",
    "Something clicked. The league felt it.",
    "Quietly dangerous. Consistently excellent.",
    "The best version of this player is here — right now.",
    "A player who refused to stay average.",
    "The breakout was inevitable. The timing is perfect.",
    "Not flashy. Just effective. Consistently effective.",
    "Turning potential into performance, one match at a time.",
    "Every fixture is a chance to prove it — and they keep proving it.",
    "Captains who ignored them last season are paying for it now.",
    "A chess piece that just became a queen.",
    "The upgrade was real. The stats confirm it.",
    "No fanfare. Just results. Lots of them.",
    "The improvement curve points only upward.",
    "This player came to compete — and is winning.",
    "Better, sharper, hungrier than last season.",
    "Playing like someone who has a score to settle.",
  ],

  strong: [
    "Nobody saw this coming — the league certainly didn't.",
    "From a question mark to an exclamation point.",
    "The glow-up that changed the power dynamics of this league.",
    "Last season was a lesson. This season is the exam. They're passing.",
    "A transformation so sharp it looks surgical.",
    "Opponents used to overlook this player. Not anymore.",
    "The league's best-kept secret just went public.",
    "If this is a breakout, the rest of the league needs to prepare.",
    "Rewriting their own story — and the league is watching.",
    "This isn't just improvement. This is evolution.",
    "A player reborn. The data is undeniable.",
    "Silently studying. Loudly winning.",
    "The leap from last season to this one is extraordinary.",
    "What changed? Everything. What stayed the same? The name.",
    "Playing like someone who watched last season on tape and fixed every flaw.",
    "The version of this player that opponents feared has arrived.",
    "Forget last season. The current model is far more dangerous.",
    "A player who broke through the ceiling they set for themselves.",
    "The league just found its next serious threat.",
    "This player didn't just improve. They transformed.",
    "One of the biggest individual turnarounds the league has ever seen.",
    "Whoever trained with them this off-season did the league a disservice.",
    "The jump in form is so sharp it almost feels unfair.",
    "Last season was the chrysalis. This season is the butterfly.",
    "The most improved player in the league — and it isn't close.",
    "Some players develop. This one exploded.",
    "From background noise to headline act.",
    "You can't gameplan for a player who wasn't on the radar before.",
    "They found another gear last season — they haven't come back down.",
    "The stats from this season and last barely look like the same person.",
    "A sleeping giant that finally woke up.",
    "The league table has a new name to fear.",
    "When scouts look back at this season, they'll point to this player.",
    "The hunger, the execution, the results — all at a new level.",
    "They didn't just break out. They broke records.",
    "Once underestimated. Now unstoppable.",
    "A player who looked in the mirror mid-season and said: not good enough.",
    "The turnaround is staggering. The performances are stunning.",
    "This player came back from last season with something to prove.",
    "Every captain who underrated them is now overranking them. Rightfully so.",
  ],

  explosive: [
    "This is the kind of breakout that gets talked about for seasons.",
    "Unprecedented. Unmatched. Unleashed.",
    "The league has a new superpower and everyone is scrambling.",
    "Whatever happened in the off-season, it should be bottled and sold.",
    "A meteor hit the league table and its name is on this profile.",
    "This player didn't break out. They broke the league.",
    "Rewriting the record books with every single match.",
    "The improvement is so extreme it has to be seen to be believed.",
    "This is what a complete transformation looks like in real time.",
    "From the bottom of the tier list to the top of every captain's lineup.",
    "Statistically, historically, and visually — the biggest breakout in the league.",
    "Other players should study this. Captains should fear it.",
    "Every match is an announcement. Every result is a statement.",
    "The league will be defined by the seasons before and after this player emerged.",
    "This isn't a breakout season. It's a hostile takeover.",
    "Nobody in the league is doing what this player is doing right now.",
    "Hall of fame form from a player who wasn't on anyone's radar.",
    "A generational improvement. The numbers look like a typo. They aren't.",
    "When historians write about this league, this season gets its own chapter.",
    "This player arrived last season. This season, they took over.",
  ],
}

/**
 * Returns a breakout phrase based on the win rate jump.
 * Uses player ID as a seed so the same player always sees the same phrase
 * in a given season, but it varies across players.
 *
 * @param {number} jump     - Win rate percentage jump (e.g. 32 for +32%)
 * @param {number} playerId - Used to deterministically pick from the phrase pool
 * @returns {{ phrase: string, tier: string }}
 */
export function getBreakoutPhrase(jump, playerId = 1) {
  const pool =
    jump >= 50 ? PHRASES.explosive :
    jump >= 35 ? PHRASES.strong :
                 PHRASES.solid

  const idx = Math.abs(playerId * 7 + jump * 3) % pool.length
  const tier =
    jump >= 50 ? "explosive" :
    jump >= 35 ? "strong" :
                 "solid"

  return { phrase: pool[idx], tier }
}

export default PHRASES