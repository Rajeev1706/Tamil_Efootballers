// ============================================================================
// Vendored, faithfully-ported reveal animation system from the original
// standalone Tamil Efootballers Auction app. Deliberately kept as close to
// the original imperative DOM-manipulation code as possible (not rewritten
// as idiomatic React) to guarantee exact visual/timing fidelity — this is
// the same code, just fed real data (team logo URLs, card type) as
// parameters instead of reading from the original app's global in-memory
// objects (playerMeta/teamLogos/teamMeta), since those don't exist here.
// ============================================================================

const ASSET_BASE = new URL("../../images/", import.meta.url).href

export const tickSound = new Audio(`${ASSET_BASE}tick.mp3`)
export const buzzerSound = new Audio(`${ASSET_BASE}buzzer.mp3`)
tickSound.volume = 1.0
buzzerSound.volume = 0.8

export const revealState = {
  active: false, overlay: null, timeouts: [], done: null,
  pendingName: null, isThunder: false, thunderTarget: null,
  goldOverlay: null, starsState: null,
}
export const soldRevealState = { active: false, overlay: null, timeouts: [], done: null }

function registerTimeout(id) { revealState.timeouts.push(id) }
function registerSoldRevealTimeout(id) { soldRevealState.timeouts.push(id) }

export function skipRevealAnimation() {
  if (!revealState.active) return
  revealState.timeouts.forEach(clearTimeout)
  revealState.timeouts = []
  if (revealState.overlay) {
    const nameEl = revealState.overlay.querySelector(".reveal-player-name")
    if (nameEl && revealState.pendingName) {
      nameEl.textContent = revealState.pendingName
      nameEl.classList.add("visible")
    }
    if (revealState.isThunder && revealState.goldOverlay) {
      revealState.goldOverlay.style.transition = "none"
      revealState.goldOverlay.style.clipPath = "inset(0 0% 0 0)"
    }
    if (revealState.starsState) {
      revealState.starsState.cardType = revealState.thunderTarget || "gold"
    }
    revealState.overlay.remove()
  }
  document.querySelectorAll(".pre-reveal-banner").forEach(el => el.remove())
  revealState.active = false
  if (typeof revealState.done === "function") {
    const d = revealState.done
    revealState.done = null
    d()
  }
  revealState.pendingName = null
}

export function skipSoldRevealAnimation() {
  soldRevealState.timeouts.forEach(clearTimeout)
  soldRevealState.timeouts = []
  if (soldRevealState.overlay) {
    soldRevealState.overlay.querySelectorAll(".hidden").forEach(el => el.classList.remove("hidden"))
    setTimeout(() => {
      soldRevealState.overlay?.remove()
      soldRevealState.overlay = null
    }, 50)
  }
  if (typeof soldRevealState.done === "function") {
    const d = soldRevealState.done
    soldRevealState.done = null
    d()
  }
}

function generateLightningPoints(x1, y1, x2, y2) {
  const points = [{ x: x1, y: y1 }]
  const segments = 14
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  const nx = -dy / len, ny = dx / len
  for (let i = 1; i < segments; i++) {
    const t = i / segments
    const mx = x1 + dx * t
    const my = y1 + dy * t
    const roughness = 42 * Math.sin(t * Math.PI)
    const offset = (Math.random() - 0.5) * roughness * 2
    points.push({ x: mx + nx * offset, y: my + ny * offset })
  }
  points.push({ x: x2, y: y2 })
  return points
}

function flashAndStrike(overlay, fromX, toX, toY, onHit) {
  const flash = document.createElement("div")
  flash.style.cssText = "position:absolute;inset:0;background:rgba(255,220,80,0.55);z-index:8;pointer-events:none;"
  flash.style.opacity = "1"
  overlay.appendChild(flash)
  setTimeout(() => { flash.style.transition = "opacity 0.4s ease"; flash.style.opacity = "0" }, 80)
  setTimeout(() => { flash.remove() }, 520)

  const pts = generateLightningPoints(fromX, 0, toX, toY)
  const pathD = pts.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(" ")

  const W = window.innerWidth, H = window.innerHeight
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("width", W)
  svg.setAttribute("height", H)
  svg.style.cssText = "position:absolute;inset:0;z-index:7;pointer-events:none;overflow:visible;"

  function makePath(color, width, opacity) {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path")
    p.setAttribute("d", pathD)
    p.setAttribute("stroke", color)
    p.setAttribute("stroke-width", width)
    p.setAttribute("stroke-linecap", "round")
    p.setAttribute("stroke-linejoin", "round")
    p.setAttribute("fill", "none")
    p.setAttribute("opacity", opacity)
    return p
  }

  svg.appendChild(makePath("#ffcc00", "12", "0.4"))
  svg.appendChild(makePath("#ffe040", "6", "0.85"))
  svg.appendChild(makePath("#ffffff", "2", "1"))
  overlay.appendChild(svg)
  onHit()

  setTimeout(() => {
    const pts2 = generateLightningPoints(fromX, 0, toX, toY)
    const d2 = pts2.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(" ")
    svg.querySelectorAll("path").forEach(p => p.setAttribute("d", d2))
  }, 80)

  setTimeout(() => {
    svg.style.transition = "opacity 0.45s ease"
    svg.style.opacity = "0"
    setTimeout(() => svg.remove(), 500)
  }, 260)
}

function startStarsAnimation(canvas, starsState) {
  const ctx = canvas.getContext("2d")
  const W = canvas.width, H = canvas.height
  const stars = []
  for (let i = 0; i < 130; i++) {
    stars.push({
      x: Math.random() * W, y: Math.random() * H,
      r: 0.4 + Math.random() * 2.2, speed: 0.08 + Math.random() * 0.35,
      tw: Math.random() * Math.PI * 2, tws: 0.018 + Math.random() * 0.045,
    })
  }
  let fadeIn = 0
  function loop() {
    if (!canvas.parentElement) return
    fadeIn = Math.min(1, fadeIn + 0.018)
    ctx.clearRect(0, 0, W, H)
    for (const s of stars) {
      s.y -= s.speed
      s.tw += s.tws
      if (s.y < -4) { s.y = H + 4; s.x = Math.random() * W }
      const alpha = fadeIn * (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(s.tw)))
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fillStyle = starsState.cardType === "gold"
        ? `hsla(46, 92%, 62%, ${alpha})`
        : starsState.cardType === "purple"
          ? `hsla(270, 80%, 72%, ${alpha})`
          : `hsla(210, 18%, 84%, ${alpha})`
      ctx.fill()
    }
    requestAnimationFrame(loop)
  }
  loop()
}

/**
 * Triggers the full cinematic card reveal — flip, thunder strike (if
 * isThunder), typewriter name, background team logo — exactly matching
 * the original app's timing.
 *
 * @param {string} name - player's name
 * @param {boolean} isThunder - whether this reveal upgrades tiers mid-flip
 * @param {{from:string, to:string}|null} thunderCombo - e.g. {from:'silver',to:'gold'}
 * @param {string} actualCardType - the player's real card tier (silver/gold/purple)
 * @param {string|null} logoUrl - previous team's logo URL, shown behind the name
 * @param {() => void} done - called once the reveal fully finishes and vanishes
 */
export function revealForAuction(name, isThunder, thunderCombo, actualCardType, logoUrl, done) {
  revealState.active = true
  revealState.done = done
  revealState.timeouts = []
  revealState.pendingName = name
  revealState.isThunder = isThunder
  revealState.thunderTarget = thunderCombo ? thunderCombo.to : null
  revealState.goldOverlay = null
  revealState.starsState = null

  const cardType = isThunder ? thunderCombo.from : (actualCardType || "silver")

  const overlay = document.createElement("div")
  overlay.className = "reveal-overlay"
  revealState.overlay = overlay

  const starsCanvas = document.createElement("canvas")
  starsCanvas.className = "reveal-stars-canvas"
  starsCanvas.width = window.innerWidth
  starsCanvas.height = window.innerHeight
  overlay.appendChild(starsCanvas)

  const card = document.createElement("div")
  card.className = "reveal-card entering"
  card.classList.add(cardType)

  const inner = document.createElement("div")
  inner.className = "reveal-card-inner"
  const back = document.createElement("div")
  back.className = "reveal-card-face reveal-card-back"
  const front = document.createElement("div")
  front.className = "reveal-card-face reveal-card-front"

  let goldOverlay = null
  if (isThunder) {
    goldOverlay = document.createElement("div")
    goldOverlay.className = thunderCombo.to === "purple" ? "purple-reveal-overlay" : "gold-reveal-overlay"
    front.appendChild(goldOverlay)
    revealState.goldOverlay = goldOverlay
  }

  const nameEl = document.createElement("div")
  nameEl.className = "reveal-player-name"
  nameEl.textContent = ""

  const logoEl = document.createElement("img")
  if (logoUrl) {
    logoEl.src = logoUrl
    logoEl.className = "reveal-team-logo"
  }

  front.appendChild(nameEl)
  if (logoEl.src) front.appendChild(logoEl)
  inner.appendChild(back)
  inner.appendChild(front)
  card.appendChild(inner)
  overlay.appendChild(card)
  document.body.appendChild(overlay)

  void card.offsetWidth

  const flipDelay = 2600
  const charInterval = 140
  const typingDuration = name.length * charInterval
  const holdAfterName = 3000

  const rightBoltDelay = 850
  const rightGoldDelay = 1050
  const leftBoltDelay = 1900
  const leftGoldDelay = 2100
  const nameExtraDelay = isThunder ? 2700 : 600
  const nameStartDelay = flipDelay + nameExtraDelay + (logoEl.src ? 300 : 0)

  const starsState = { cardType: isThunder ? thunderCombo.from : cardType }
  revealState.starsState = starsState

  registerTimeout(setTimeout(() => {
    card.classList.add("flipped")
    startStarsAnimation(starsCanvas, starsState)
  }, flipDelay))

  if (isThunder && goldOverlay) {
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    const cardHalfW = 195

    registerTimeout(setTimeout(() => {
      flashAndStrike(overlay, cx + cardHalfW * 1.6, cx + cardHalfW * 0.55, cy - 60, () => {
        registerTimeout(setTimeout(() => {
          goldOverlay.style.clipPath = "inset(0 0 0 50%)"
        }, rightGoldDelay - rightBoltDelay))
      })
    }, flipDelay + rightBoltDelay))

    registerTimeout(setTimeout(() => {
      flashAndStrike(overlay, cx - cardHalfW * 1.6, cx - cardHalfW * 0.55, cy - 60, () => {
        registerTimeout(setTimeout(() => {
          goldOverlay.style.clipPath = "inset(0 0% 0 0)"
          starsState.cardType = thunderCombo.to
        }, leftGoldDelay - leftBoltDelay))
      })
    }, flipDelay + leftBoltDelay))
  }

  const bgLogo = document.createElement("div")
  bgLogo.className = "reveal-bg-logo"
  overlay.insertBefore(bgLogo, starsCanvas)

  if (logoEl && logoEl.src) {
    registerTimeout(setTimeout(() => {
      logoEl.classList.add("visible")
      registerTimeout(setTimeout(() => {
        bgLogo.style.backgroundImage = `url("${logoEl.src}")`
        bgLogo.classList.add("visible")
      }, 400))
    }, nameStartDelay - 200))
  }

  registerTimeout(setTimeout(() => {
    nameEl.classList.add("visible")
    name.split("").forEach((char, i) => {
      registerTimeout(setTimeout(() => { nameEl.textContent += char }, i * charInterval))
    })
  }, nameStartDelay))

  registerTimeout(setTimeout(() => {
    card.classList.add("vanish")
    registerTimeout(setTimeout(() => {
      if (revealState.overlay) { revealState.overlay.remove(); revealState.overlay = null }
      revealState.active = false
      if (typeof revealState.done === "function") {
        const d = revealState.done
        revealState.done = null
        d()
      }
      revealState.pendingName = null
    }, 900))
  }, nameStartDelay + typingDuration + holdAfterName))
}

/**
 * Full-screen "SOLD!" transfer summary — player name, prev-team logo,
 * arrow, new-team logo, price, each fading in in sequence, exactly
 * matching the original timing.
 */
export function showSoldFullScreen({ player, prevLogoUrl, newLogoUrl, amount, afterDone }) {
  soldRevealState.active = true
  soldRevealState.timeouts = []
  soldRevealState.done = () => { soldRevealState.active = false; afterDone?.() }

  const overlay = document.createElement("div")
  overlay.className = "reveal-overlay"
  soldRevealState.overlay = overlay

  overlay.innerHTML = `
    <div class="sold-summary">
      <div class="sold-player-name hidden">${player}</div>
      <div class="sold-transfer-row">
        ${prevLogoUrl ? `<img class="sold-logo hidden" id="prevLogo" src="${prevLogoUrl}">` : `<div class="sold-logo sold-no-team hidden" id="prevLogo"></div>`}
        <span class="sold-arrow hidden" id="soldArrow">➜</span>
        ${newLogoUrl ? `<img class="sold-logo hidden" id="newLogo" src="${newLogoUrl}">` : `<div class="sold-logo sold-no-team hidden" id="newLogo"></div>`}
      </div>
      <div class="sold-price hidden">₹${amount}</div>
    </div>
  `
  document.body.appendChild(overlay)

  registerSoldRevealTimeout(setTimeout(() => overlay.querySelector(".sold-player-name")?.classList.remove("hidden"), 400))
  registerSoldRevealTimeout(setTimeout(() => overlay.querySelector("#prevLogo")?.classList.remove("hidden"), 800))
  registerSoldRevealTimeout(setTimeout(() => overlay.querySelector("#soldArrow")?.classList.remove("hidden"), 1200))
  registerSoldRevealTimeout(setTimeout(() => overlay.querySelector("#newLogo")?.classList.remove("hidden"), 1600))
  registerSoldRevealTimeout(setTimeout(() => overlay.querySelector(".sold-price")?.classList.remove("hidden"), 2000))
  registerSoldRevealTimeout(setTimeout(() => skipSoldRevealAnimation(), 4200))
}

/** "Final 5 players" / "Last player standing" style full-screen banner. */
export function showPreRevealBanner(title, subtitle, gradient) {
  const overlay = document.createElement("div")
  overlay.className = "pre-reveal-banner"
  overlay.style.background = gradient
  overlay.innerHTML = `<div class="pre-reveal-title">${title}</div><div class="pre-reveal-sub">${subtitle}</div>`
  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add("visible"))
  setTimeout(() => {
    overlay.classList.add("fade-out")
    setTimeout(() => overlay.remove(), 600)
  }, 3000)
}

/**
 * Determines whether this reveal should be a "thunder" upgrade reveal,
 * exactly matching the original's probability rules: only gold/purple
 * cards can thunder, needs 5+ reveals into the auction, needs 5+ reveals
 * since the last thunder, capped at 4 thunder reveals total, 45% chance
 * when eligible. Mutates the passed-in counters object (thunderRevealCount,
 * lastThunderRevealIndex) exactly like the original's module-level state.
 */
export function decideThunder(cardType, revealTotalIndex, counters) {
  const canThunder = cardType === "gold" || cardType === "purple"
  const isThunder =
    canThunder &&
    counters.thunderRevealCount < 4 &&
    revealTotalIndex > 5 &&
    (revealTotalIndex - counters.lastThunderRevealIndex) > 5 &&
    Math.random() < 0.45

  if (isThunder) {
    counters.thunderRevealCount++
    counters.lastThunderRevealIndex = revealTotalIndex
  }

  let thunderCombo = null
  if (isThunder) {
    if (cardType === "gold") {
      thunderCombo = { from: "silver", to: "gold" }
    } else if (cardType === "purple") {
      thunderCombo = Math.random() < 0.5 ? { from: "silver", to: "purple" } : { from: "gold", to: "purple" }
    }
  }
  return { isThunder, thunderCombo }
}