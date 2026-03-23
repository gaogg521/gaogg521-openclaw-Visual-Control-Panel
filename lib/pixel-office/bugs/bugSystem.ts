import { TILE_SIZE } from '../types'
import {
  BUG_ABDOMEN_LENGTH,
  BUG_ABDOMEN_WIDTH,
  BUG_BORDER_PADDING,
  BUG_DEFAULT_COUNT,
  BUG_GAIT_SWITCH_SEC,
  BUG_HEAD_SIZE,
  BUG_LEG_UPDATE_INTERVAL_SEC,
  BUG_LEG_SEGMENT_1,
  BUG_LEG_SEGMENT_2,
  BUG_MAX_COUNT,
  BUG_MAX_SPEED,
  BUG_MIN_SPEED,
  BUG_MORANDI_COLORS,
  BUG_OUT_OF_BOUNDS_MARGIN,
  BUG_PERCEPTION_RADIUS,
  BUG_SEPARATION_RADIUS,
  BUG_GRID_CELL_SIZE,
  BUG_SEPARATION_WEIGHT,
  BUG_ALIGNMENT_WEIGHT,
  BUG_COHESION_WEIGHT,
  BUG_EDGE_ATTRACTION_WEIGHT,
  BUG_PHEROMONE_CELL_SIZE,
  BUG_PHEROMONE_DEPOSIT_PER_SEC,
  BUG_PHEROMONE_EVAPORATION_PER_SEC,
  BUG_PHEROMONE_MAX_STRENGTH,
  BUG_PHEROMONE_MIN_DETECT,
  BUG_PHEROMONE_FOLLOW_WEIGHT,
  BUG_TRAIL_FOLLOW_RADIUS,
  BUG_TRAIL_FOLLOW_PROB,
  BUG_TRAIL_BREAK_PROB,
  BUG_TRAIL_STEERING_WEIGHT,
  BUG_CURSOR_REPULSION_RADIUS,
  BUG_CURSOR_REPULSION_STRENGTH,
  BUG_STEP_DISTANCE,
  BUG_STEP_DURATION_SEC,
  BUG_STEP_TRIGGER,
  BUG_THORAX_LENGTH,
  BUG_THORAX_WIDTH,
  BUG_WANDER_MAX_SEC,
  BUG_WANDER_MIN_SEC,
} from './config'
import type { BugBehaviorType, BugEntity, BugLeg } from './types'
import { BugSpatialGrid } from './spatialGrid'
import { BugPheromoneField } from './pheromoneField'

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function clamp(v: number, min: number, max: number): number {
  if (v < min) return min
  if (v > max) return max
  return v
}

function normalizeRadians(v: number): number {
  let x = v
  while (x > Math.PI) x -= Math.PI * 2
  while (x < -Math.PI) x += Math.PI * 2
  return x
}

function pickBehavior(): BugBehaviorType {
  const r = Math.random()
  if (r < 0.6) return 'social'
  if (r < 0.9) return 'edgeDweller'
  return 'loner'
}

function pickSizeScale(): number {
  const r = Math.random()
  if (r < 0.2) return 0.7
  if (r < 0.7) return 0.85
  return 1.0
}

function localToWorld(
  bugX: number,
  bugY: number,
  heading: number,
  lx: number,
  ly: number,
): { x: number; y: number } {
  const cos = Math.cos(heading)
  const sin = Math.sin(heading)
  return {
    x: bugX + lx * cos - ly * sin,
    y: bugY + lx * sin + ly * cos,
  }
}

function solveTwoBoneIK(
  ax: number,
  ay: number,
  fx: number,
  fy: number,
  l1: number,
  l2: number,
  isRightSide: boolean,
): { x: number; y: number } {
  const dx = fx - ax
  const dy = fy - ay
  let c = Math.hypot(dx, dy)
  if (c > l1 + l2) c = l1 + l2
  c = Math.max(c, 0.0001)
  const toTargetAngle = Math.atan2(dy, dx)
  let cosAngle = (l1 * l1 + c * c - l2 * l2) / (2 * l1 * c)
  cosAngle = clamp(cosAngle, -1, 1)
  const angle = Math.acos(cosAngle)
  const kneeAngle = isRightSide ? (toTargetAngle - angle) : (toTargetAngle + angle)
  return {
    x: ax + Math.cos(kneeAngle) * l1,
    y: ay + Math.sin(kneeAngle) * l1,
  }
}

const LEG_SPECS: Array<{ anchorX: number; anchorY: number; restX: number; restY: number; side: -1 | 1; group: 0 | 1 }> = [
  { anchorX: 1.1, anchorY: -0.78, restX: 4.7, restY: -5.9, side: -1, group: 0 }, // left front
  { anchorX: 0.0, anchorY: -0.78, restX: 0.0, restY: -6.9, side: -1, group: 1 }, // left mid
  { anchorX: -1.1, anchorY: -0.78, restX: -4.7, restY: -5.9, side: -1, group: 0 }, // left back
  { anchorX: 1.1, anchorY: 0.78, restX: 4.7, restY: 5.9, side: 1, group: 1 }, // right front
  { anchorX: 0.0, anchorY: 0.78, restX: 0.0, restY: 6.9, side: 1, group: 0 }, // right mid
  { anchorX: -1.1, anchorY: 0.78, restX: -4.7, restY: 5.9, side: 1, group: 1 }, // right back
]
const LOGO_CARRY_FIXED_COUNT = 8

export class BugSystem {
  private bugs: BugEntity[] = []
  private enabled = false
  private targetCount = BUG_DEFAULT_COUNT
  private nextId = 1
  private grid: BugSpatialGrid
  private pheromones: BugPheromoneField
  private cursorActive = false
  private cursorX = 0
  private cursorY = 0
  private logoCarry: {
    active: boolean
    startX: number
    startY: number
    logoX: number
    logoY: number
    logoVx: number
    logoVy: number
    logoAngle: number
    logoAngularV: number
    displayX: number
    displayY: number
    displayVx: number
    displayVy: number
    displayAngle: number
    displayAngularV: number
    targetX: number
    targetY: number
    hidden: boolean
    carrierIds: Set<number>
    desiredCount: number
    swapTimer: number
    countTimer: number
    slotSeed: number
    pauseTimer: number
    biasTimer: number
    sideBias: number
    wobblePhase: number
    regripTimer: number
    detourTimer: number
    detourAngle: number
    laggers: Map<number, number>
    regripUntil: Map<number, number>
  } = {
    active: false,
    startX: 0,
    startY: 0,
    logoX: 0,
    logoY: 0,
    logoVx: 0,
    logoVy: 0,
    logoAngle: 0,
    logoAngularV: 0,
    displayX: 0,
    displayY: 0,
    displayVx: 0,
    displayVy: 0,
    displayAngle: 0,
    displayAngularV: 0,
    targetX: 0,
    targetY: 0,
    hidden: false,
    carrierIds: new Set<number>(),
    desiredCount: 0,
    swapTimer: 0,
    countTimer: 0,
    slotSeed: 1,
    pauseTimer: 0,
    biasTimer: 0,
    sideBias: 0,
    wobblePhase: 0,
    regripTimer: 0,
    detourTimer: 0,
    detourAngle: 0,
    laggers: new Map<number, number>(),
    regripUntil: new Map<number, number>(),
  }

  constructor(worldWidth: number, worldHeight: number, initialCount = BUG_DEFAULT_COUNT) {
    this.targetCount = clamp(initialCount, 0, BUG_MAX_COUNT)
    this.grid = new BugSpatialGrid(BUG_GRID_CELL_SIZE)
    this.pheromones = new BugPheromoneField(worldWidth, worldHeight, BUG_PHEROMONE_CELL_SIZE)
    for (let i = 0; i < this.targetCount; i++) this.bugs.push(this.createBug(worldWidth, worldHeight))
  }

  getBugs(): BugEntity[] {
    return this.enabled ? this.bugs : []
  }

  isEnabled(): boolean {
    return this.enabled
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  setTargetCount(count: number, worldWidth: number, worldHeight: number): void {
    this.targetCount = clamp(Math.round(count), 0, BUG_MAX_COUNT)
    this.reconcileCount(worldWidth, worldHeight)
  }

  getTargetCount(): number {
    return this.targetCount
  }

  setCursor(x: number, y: number, active: boolean): void {
    this.cursorX = x
    this.cursorY = y
    this.cursorActive = active
  }

  startLogoCarry(startX: number, startY: number, targetX: number, targetY: number): void {
    for (const b of this.bugs) b.isCarrier = false
    this.logoCarry.active = true
    this.logoCarry.hidden = false
    this.logoCarry.startX = startX
    this.logoCarry.startY = startY
    this.logoCarry.logoX = startX
    this.logoCarry.logoY = startY
    this.logoCarry.logoVx = 0
    this.logoCarry.logoVy = 0
    this.logoCarry.logoAngle = 0
    this.logoCarry.logoAngularV = 0
    this.logoCarry.displayX = startX
    this.logoCarry.displayY = startY
    this.logoCarry.displayVx = 0
    this.logoCarry.displayVy = 0
    this.logoCarry.displayAngle = 0
    this.logoCarry.displayAngularV = 0
    this.logoCarry.targetX = targetX
    this.logoCarry.targetY = targetY
    this.logoCarry.carrierIds.clear()
    this.logoCarry.slotSeed = Math.floor(Math.random() * 1_000_000) + 1
    this.logoCarry.countTimer = randomRange(1.4, 2.6)
    this.logoCarry.swapTimer = randomRange(1.8, 2.8)
    this.logoCarry.desiredCount = LOGO_CARRY_FIXED_COUNT
    this.logoCarry.pauseTimer = randomRange(0.6, 1.8)
    this.logoCarry.biasTimer = randomRange(0.8, 1.6)
    this.logoCarry.sideBias = randomRange(-0.6, 0.6)
    this.logoCarry.wobblePhase = randomRange(0, Math.PI * 2)
    this.logoCarry.regripTimer = randomRange(0.5, 1.1)
    this.logoCarry.detourTimer = randomRange(1.3, 2.4)
    this.logoCarry.detourAngle = 0
    this.logoCarry.laggers.clear()
    this.logoCarry.regripUntil.clear()

    const need = LOGO_CARRY_FIXED_COUNT
    while (this.bugs.length < need) {
      this.bugs.push(this.createBug(Math.max(targetX, startX) + 120, Math.max(targetY, startY) + 120))
    }
    const sorted = [...this.bugs].sort((a, b) => {
      const da = Math.hypot(a.x - startX, a.y - startY)
      const db = Math.hypot(b.x - startX, b.y - startY)
      return da - db
    })
    for (let i = 0; i < need && i < sorted.length; i++) {
      const b = sorted[i]
      b.isCarrier = true
      b.followingTrail = false
      this.snapCarrierNearLogo(b)
      this.logoCarry.carrierIds.add(b.id)
    }
  }

  stopLogoCarry(): void {
    this.logoCarry.active = false
    this.logoCarry.hidden = false
    this.logoCarry.carrierIds.clear()
    this.logoCarry.laggers.clear()
    this.logoCarry.regripUntil.clear()
    this.logoCarry.logoX = this.logoCarry.startX
    this.logoCarry.logoY = this.logoCarry.startY
    this.logoCarry.logoVx = 0
    this.logoCarry.logoVy = 0
    this.logoCarry.logoAngle = 0
    this.logoCarry.logoAngularV = 0
    this.logoCarry.displayX = this.logoCarry.startX
    this.logoCarry.displayY = this.logoCarry.startY
    this.logoCarry.displayVx = 0
    this.logoCarry.displayVy = 0
    this.logoCarry.displayAngle = 0
    this.logoCarry.displayAngularV = 0
    for (const b of this.bugs) b.isCarrier = false
  }

  getLogoCarryVisual(): { active: boolean; dx: number; dy: number; angle: number; hidden: boolean } {
    if (!this.logoCarry.active) {
      return { active: false, dx: 0, dy: 0, angle: 0, hidden: false }
    }
    return {
      active: this.logoCarry.active,
      dx: this.logoCarry.displayX - this.logoCarry.startX,
      dy: this.logoCarry.displayY - this.logoCarry.startY,
      angle: this.logoCarry.displayAngle,
      hidden: this.logoCarry.hidden,
    }
  }

  update(dt: number, worldWidth: number, worldHeight: number): void {
    this.reconcileCount(worldWidth, worldHeight)
    if (!this.enabled || dt <= 0) return
    this.pheromones.resize(worldWidth, worldHeight)
    this.pheromones.update(dt, BUG_PHEROMONE_EVAPORATION_PER_SEC)
    this.updateLogoCarryCrew(dt, worldWidth, worldHeight)

    const centerX = worldWidth / 2
    const centerY = worldHeight / 2
    this.grid.clear()
    for (const bug of this.bugs) this.grid.add(bug)

    for (const bug of this.bugs) {
      bug.wanderTimer -= dt
      if (bug.wanderTimer <= 0) {
        const wanderRange = bug.behaviorType === 'loner' ? 110 : 65
        bug.wanderTargetHeading = bug.heading + randomRange(-wanderRange, wanderRange) * Math.PI / 180
        bug.wanderTimer = randomRange(BUG_WANDER_MIN_SEC, BUG_WANDER_MAX_SEC)
      }

      const neighbors = this.grid.query(bug.x, bug.y, BUG_PERCEPTION_RADIUS)
      const carryHeading = bug.isCarrier && this.logoCarry.active
        ? this.computeCarryHeading(bug)
        : null
      const boidsHeading = carryHeading ?? this.computeBoidsHeading(bug, neighbors, worldWidth, worldHeight, dt)
      const blendedTargetHeading = boidsHeading ?? bug.wanderTargetHeading
      const turnRate = bug.isCarrier ? 7.5 : (bug.behaviorType === 'loner' ? 5.0 : 3.5)
      const angleDelta = normalizeRadians(blendedTargetHeading - bug.heading)
      bug.heading += angleDelta * Math.min(1, dt * turnRate)

      if (bug.behaviorType === 'edgeDweller') {
        const nearestEdgeX = bug.x < centerX ? 0 : worldWidth
        const nearestEdgeY = bug.y < centerY ? 0 : worldHeight
        const edgeDir = Math.abs(bug.x - centerX) > Math.abs(bug.y - centerY)
          ? Math.atan2(0, nearestEdgeX - bug.x)
          : Math.atan2(nearestEdgeY - bug.y, 0)
        bug.heading += normalizeRadians(edgeDir - bug.heading) * Math.min(1, dt * 1.4)
      }

      const speed = bug.isCarrier
        ? Math.max(bug.speed, BUG_MAX_SPEED * 0.95) * this.getCarrySpeedMultiplier(bug)
        : bug.speed
      bug.vx = Math.cos(bug.heading) * speed
      bug.vy = Math.sin(bug.heading) * speed
      bug.x += bug.vx * dt
      bug.y += bug.vy * dt
      this.pheromones.deposit(
        bug.x,
        bug.y,
        Math.cos(bug.heading),
        Math.sin(bug.heading),
        BUG_PHEROMONE_DEPOSIT_PER_SEC * dt * this.getDepositScale(bug.behaviorType),
        BUG_PHEROMONE_MAX_STRENGTH,
      )

      const minX = -BUG_OUT_OF_BOUNDS_MARGIN
      const maxX = Math.max(minX, worldWidth + BUG_OUT_OF_BOUNDS_MARGIN)
      const minY = -BUG_OUT_OF_BOUNDS_MARGIN
      const maxY = Math.max(minY, worldHeight + BUG_OUT_OF_BOUNDS_MARGIN)
      if (bug.x <= minX || bug.x >= maxX) {
        bug.x = clamp(bug.x, minX, maxX)
        bug.heading = Math.PI - bug.heading + randomRange(-0.25, 0.25)
      }
      if (bug.y <= minY || bug.y >= maxY) {
        bug.y = clamp(bug.y, minY, maxY)
        bug.heading = -bug.heading + randomRange(-0.25, 0.25)
      }

      bug.renderHeading = bug.heading
      if (bug.isCarrier && this.logoCarry.active) {
        // Visual heading stays inward toward payload; movement heading keeps coordination behavior.
        bug.renderHeading = this.computeCarryFaceHeading(bug)
      }

      if (bug.speed > 0.1) {
        bug.gaitTimer += BUG_LEG_UPDATE_INTERVAL_SEC * (bug.speed / BUG_MAX_SPEED) * 8.0
        if (bug.speed < BUG_MAX_SPEED * 0.5) bug.gaitTimer += BUG_LEG_UPDATE_INTERVAL_SEC * 0.8
        if (bug.speed > BUG_MAX_SPEED * 1.2) bug.gaitTimer += BUG_LEG_UPDATE_INTERVAL_SEC * 2.0
        if (bug.gaitTimer > 1.0) {
          bug.gaitTimer = 0
          bug.activeLegGroup = bug.activeLegGroup === 0 ? 1 : 0
        }
      }

      bug.legUpdateTimer += dt
      if (bug.legUpdateTimer >= BUG_LEG_UPDATE_INTERVAL_SEC) {
        this.updateLegs(bug, BUG_LEG_UPDATE_INTERVAL_SEC)
        bug.legUpdateTimer = 0
      }
    }
    this.updateLogoCarryVisual(dt, worldWidth, worldHeight)
  }

  private updateLegs(bug: BugEntity, dt: number): void {
    const size = bug.size
    const speedDirX = Math.cos(bug.heading)
    const speedDirY = Math.sin(bug.heading)

    for (const leg of bug.legs) {
      const anchor = localToWorld(
        bug.x, bug.y, bug.heading,
        leg.anchorLocalX * size,
        leg.anchorLocalY * size,
      )
      const desired = localToWorld(
        bug.x, bug.y, bug.heading,
        leg.restLocalX * size,
        leg.restLocalY * size,
      )

      if (!leg.stepping) {
        const dx = desired.x - leg.footX
        const dy = desired.y - leg.footY
        const dist = Math.hypot(dx, dy)
        const canStep = bug.activeLegGroup === 0
          ? (leg.index === 0 || leg.index === 4 || leg.index === 2)
          : (leg.index === 1 || leg.index === 3 || leg.index === 5)
        if (dist > BUG_STEP_TRIGGER * size && canStep) {
          leg.stepping = true
          leg.stepT = 0
          leg.stepDuration = BUG_STEP_DURATION_SEC
          leg.stepFromX = leg.footX
          leg.stepFromY = leg.footY
          leg.stepToX = desired.x + speedDirX * BUG_STEP_DISTANCE * size
          leg.stepToY = desired.y + speedDirY * BUG_STEP_DISTANCE * size
        }
      }

      if (leg.stepping) {
        // Keep parity with OpenBug: stepping progress advances with a fixed ~60fps tick.
        leg.stepT = Math.min(1, leg.stepT + (1 / leg.stepDuration) * 0.016)
        leg.footX = leg.stepFromX + (leg.stepToX - leg.stepFromX) * leg.stepT
        leg.footY = leg.stepFromY + (leg.stepToY - leg.stepFromY) * leg.stepT
        if (leg.stepT >= 1) leg.stepping = false
      }

      const knee = solveTwoBoneIK(
        anchor.x, anchor.y,
        leg.footX, leg.footY,
        BUG_LEG_SEGMENT_1 * size,
        BUG_LEG_SEGMENT_2 * size,
        leg.isRightSide,
      )
      leg.kneeX = knee.x
      leg.kneeY = knee.y
    }
  }

  private reconcileCount(worldWidth: number, worldHeight: number): void {
    while (this.bugs.length < this.targetCount) this.bugs.push(this.createBug(worldWidth, worldHeight))
    while (this.bugs.length > this.targetCount) this.bugs.pop()
  }

  private computeBoidsHeading(
    bug: BugEntity,
    nearby: BugEntity[],
    worldWidth: number,
    worldHeight: number,
    dt: number,
  ): number | null {
    let sepX = 0
    let sepY = 0
    let aliX = 0
    let aliY = 0
    let cohX = 0
    let cohY = 0
    let nCount = 0
    let aCount = 0
    const perceptionSq = BUG_PERCEPTION_RADIUS * BUG_PERCEPTION_RADIUS
    const separationSq = BUG_SEPARATION_RADIUS * BUG_SEPARATION_RADIUS

    for (const other of nearby) {
      if (other.id === bug.id) continue
      const dx = bug.x - other.x
      const dy = bug.y - other.y
      const distSq = dx * dx + dy * dy
      if (distSq <= 0.0001 || distSq > perceptionSq) continue

      nCount++
      cohX += other.x
      cohY += other.y
      aliX += Math.cos(other.heading)
      aliY += Math.sin(other.heading)
      aCount++

      if (distSq < separationSq) {
        const inv = 1 / Math.sqrt(distSq)
        sepX += dx * inv
        sepY += dy * inv
      }
    }

    const wanderX = Math.cos(bug.wanderTargetHeading)
    const wanderY = Math.sin(bug.wanderTargetHeading)
    let sepW = BUG_SEPARATION_WEIGHT
    let aliW = BUG_ALIGNMENT_WEIGHT
    let cohW = BUG_COHESION_WEIGHT
    let edgeW = BUG_EDGE_ATTRACTION_WEIGHT

    // Behavior-specific weighting close to OpenBug intent.
    if (bug.behaviorType === 'social') {
      sepW *= 1.0
      aliW *= 1.6
      cohW *= 1.8
      edgeW *= 0.4
    } else if (bug.behaviorType === 'loner') {
      sepW *= 1.3
      aliW *= 0.4
      cohW *= 0.25
      edgeW *= 0.4
    } else {
      sepW *= 1.05
      aliW *= 0.7
      cohW *= 0.55
      edgeW *= 1.2
    }

    const sample = this.pheromones.sampleDirection(bug.x, bug.y, BUG_TRAIL_FOLLOW_RADIUS)
    const enterFollowP = Math.min(1, BUG_TRAIL_FOLLOW_PROB * (dt / 0.016))
    const breakFollowP = Math.min(1, BUG_TRAIL_BREAK_PROB * (dt / 0.016))
    const canFollowTrail = nCount >= 1
    if (!canFollowTrail) {
      // Prevent single-bug self-tracking loops (circling around its own pheromone).
      bug.followingTrail = false
    } else if (!bug.followingTrail && sample.strength > BUG_PHEROMONE_MIN_DETECT && Math.random() < enterFollowP) {
      bug.followingTrail = true
    } else if (bug.followingTrail && Math.random() < breakFollowP) {
      bug.followingTrail = false
    }

    let fx = wanderX
    let fy = wanderY
    fx += sepX * sepW
    fy += sepY * sepW

    if (aCount > 0) {
      fx += (aliX / aCount) * aliW
      fy += (aliY / aCount) * aliW
    }

    if (nCount > 0) {
      const cx = cohX / nCount
      const cy = cohY / nCount
      const toCx = cx - bug.x
      const toCy = cy - bug.y
      const clen = Math.hypot(toCx, toCy)
      if (clen > 0.001) {
        fx += (toCx / clen) * cohW
        fy += (toCy / clen) * cohW
      }
    }

    if (canFollowTrail && sample.strength > BUG_PHEROMONE_MIN_DETECT) {
      const plen = Math.hypot(sample.x, sample.y)
      if (plen > 0.0001) {
        const followW = bug.followingTrail ? BUG_TRAIL_STEERING_WEIGHT : BUG_PHEROMONE_FOLLOW_WEIGHT
        fx += (sample.x / plen) * followW
        fy += (sample.y / plen) * followW
      }
    }

    // Mouse repulsion: bugs near cursor scatter outward.
    if (this.cursorActive && !bug.isCarrier) {
      const dx = bug.x - this.cursorX
      const dy = bug.y - this.cursorY
      const distSq = dx * dx + dy * dy
      const radSq = BUG_CURSOR_REPULSION_RADIUS * BUG_CURSOR_REPULSION_RADIUS
      if (distSq > 0.0001 && distSq < radSq) {
        const dist = Math.sqrt(distSq)
        const nx = dx / dist
        const ny = dy / dist
        const repulse = BUG_CURSOR_REPULSION_STRENGTH * (1 - dist / BUG_CURSOR_REPULSION_RADIUS)
        fx += nx * repulse * 10.0
        fy += ny * repulse * 10.0
      }
    }

    if (bug.behaviorType === 'edgeDweller') {
      const left = bug.x
      const right = worldWidth - bug.x
      const top = bug.y
      const bottom = worldHeight - bug.y
      const minD = Math.min(left, right, top, bottom)
      if (minD > 0) {
        if (minD === left) fx -= edgeW
        else if (minD === right) fx += edgeW
        else if (minD === top) fy -= edgeW
        else fy += edgeW
      }
    }

    if (Math.abs(fx) < 0.0001 && Math.abs(fy) < 0.0001) return null
    return Math.atan2(fy, fx)
  }

  private updateLogoCarryVisual(dt: number, worldWidth: number, worldHeight: number): void {
    if (!this.logoCarry.active) return
    const toTargetX = this.logoCarry.targetX - this.logoCarry.logoX
    const toTargetY = this.logoCarry.targetY - this.logoCarry.logoY
    const toTargetLen = Math.hypot(toTargetX, toTargetY)
    const targetHeading = Math.atan2(toTargetY, toTargetX) + this.logoCarry.detourAngle
    const tnx = Math.cos(targetHeading)
    const tny = Math.sin(targetHeading)
    const pnx = -tny
    const pny = tnx
    const engageRadius = 12
    let pull = 0
    let lateral = 0
    let torque = 0
    let n = 0

    for (const b of this.bugs) {
      if (!b.isCarrier) continue
      const dx = this.logoCarry.logoX - b.x
      const dy = this.logoCarry.logoY - b.y
      const dist = Math.hypot(dx, dy)
      if (dist <= engageRadius) {
        const grip = 1 - dist / engageRadius
        const rx = b.x - this.logoCarry.logoX
        const ry = b.y - this.logoCarry.logoY
        const behindness = clamp((-(rx * tnx + ry * tny)) / (engageRadius * 1.1), -1, 1)
        const sideFactor = clamp(Math.abs(rx * pnx + ry * pny) / engageRadius, 0, 1)
        const alignForPull = clamp(0.18 + Math.max(0, behindness) * 1.05, 0.1, 1.25)
        const alignForSide = 0.15 + sideFactor * 0.65
        const alignForTorque = 0.2 + sideFactor * 0.8
        pull += alignForPull * grip
        const side = rx * pnx + ry * pny
        lateral += Math.sign(side) * alignForSide * grip
        torque += side * alignForTorque * (0.5 + Math.max(0, behindness) * 0.8) * grip * 0.12
      }
      n++
    }

    if (n > 0 && toTargetLen > 0.0001) {
      const mass = 1.5
      const damping = 0.86
      this.logoCarry.wobblePhase += dt * 7.5
      let drive = pull * 24
      if (this.logoCarry.pauseTimer > 0) drive *= 0.2
      const wobble = Math.sin(this.logoCarry.wobblePhase) * 0.55
      const latDrive = lateral * 5.5 + this.logoCarry.sideBias * 1.2 + wobble
      this.logoCarry.logoVx = this.logoCarry.logoVx * damping + (tnx * drive + pnx * latDrive) / mass
      this.logoCarry.logoVy = this.logoCarry.logoVy * damping + (tny * drive + pny * latDrive) / mass
      const angularDamping = 0.84
      const angularDrive = torque * 0.075 + wobble * 0.15
      this.logoCarry.logoAngularV = this.logoCarry.logoAngularV * angularDamping + angularDrive
      this.logoCarry.logoAngle += this.logoCarry.logoAngularV * dt
      this.logoCarry.logoAngle = clamp(this.logoCarry.logoAngle, -0.75, 0.75)
      this.logoCarry.logoX += this.logoCarry.logoVx * dt
      this.logoCarry.logoY += this.logoCarry.logoVy * dt
    } else if (n > 0) {
      this.logoCarry.logoVx *= 0.85
      this.logoCarry.logoVy *= 0.85
      this.logoCarry.logoAngularV *= 0.82
      this.logoCarry.logoAngle += this.logoCarry.logoAngularV * dt
    } else {
      this.logoCarry.logoVx = 0
      this.logoCarry.logoVy = 0
      this.logoCarry.logoAngularV = 0
    }

    // Keep visual center fully aligned with physical payload center.
    this.logoCarry.displayVx = this.logoCarry.logoVx
    this.logoCarry.displayVy = this.logoCarry.logoVy
    this.logoCarry.displayX = this.logoCarry.logoX
    this.logoCarry.displayY = this.logoCarry.logoY

    const angleLead = clamp(this.logoCarry.logoAngularV * 0.04, -0.05, 0.05)
    const visAngleTarget = this.logoCarry.logoAngle + angleLead
    const angleSpring = 70
    const angleDrag = 0.92
    this.logoCarry.displayAngularV += (visAngleTarget - this.logoCarry.displayAngle) * angleSpring * dt
    this.logoCarry.displayAngularV *= angleDrag
    this.logoCarry.displayAngle += this.logoCarry.displayAngularV * dt
    this.logoCarry.displayAngle = clamp(this.logoCarry.displayAngle, -0.95, 0.95)

    if (this.logoCarry.logoX > worldWidth + 28 || this.logoCarry.logoY > worldHeight + 28) {
      this.logoCarry.hidden = true
    }
  }

  private updateLogoCarryCrew(dt: number, worldWidth: number, worldHeight: number): void {
    if (!this.logoCarry.active) return

    this.logoCarry.countTimer -= dt
    this.logoCarry.swapTimer -= dt
    this.logoCarry.pauseTimer -= dt
    this.logoCarry.biasTimer -= dt
    this.logoCarry.regripTimer -= dt
    this.logoCarry.detourTimer -= dt

    if (this.logoCarry.detourAngle !== 0) {
      this.logoCarry.detourAngle *= Math.max(0, 1 - dt * 2.2)
      if (Math.abs(this.logoCarry.detourAngle) < 0.02) this.logoCarry.detourAngle = 0
    }

    if (this.logoCarry.pauseTimer <= 0) {
      // Ant-like re-grip: tiny pauses while carrying.
      this.logoCarry.pauseTimer = Math.random() < 0.35 ? randomRange(0.08, 0.2) : randomRange(0.55, 1.4)
    }

    if (this.logoCarry.biasTimer <= 0) {
      // Side bias drifts over time, creating imperfect trajectories.
      this.logoCarry.sideBias = randomRange(-0.8, 0.8)
      this.logoCarry.biasTimer = randomRange(0.7, 1.6)
    }

    if (this.logoCarry.detourTimer <= 0) {
      // Short detours like ants negotiating tiny obstacles.
      this.logoCarry.detourAngle = randomRange(-0.38, 0.38)
      this.logoCarry.detourTimer = randomRange(1.1, 2.1)
    }

    if (this.logoCarry.countTimer <= 0) {
      this.logoCarry.desiredCount = LOGO_CARRY_FIXED_COUNT
      this.logoCarry.countTimer = randomRange(1.2, 2.4)
      this.logoCarry.slotSeed = Math.floor(randomRange(1, 1_000_000))
    }

    const need = LOGO_CARRY_FIXED_COUNT
    while (this.bugs.length < need) this.bugs.push(this.createBug(worldWidth, worldHeight))

    const currentCarriers = this.bugs.filter((b) => b.isCarrier)
    if (currentCarriers.length > need) {
      const drop = currentCarriers
        .sort((a, b) => Math.random() - 0.5)
        .slice(0, currentCarriers.length - need)
      for (const b of drop) {
        b.isCarrier = false
        this.logoCarry.carrierIds.delete(b.id)
      }
    } else if (currentCarriers.length < need) {
      const missing = need - currentCarriers.length
      const candidates = this.bugs
        .filter((b) => !b.isCarrier)
        .sort((a, b) => {
          const da = Math.hypot(a.x - this.logoCarry.logoX, a.y - this.logoCarry.logoY)
          const db = Math.hypot(b.x - this.logoCarry.logoX, b.y - this.logoCarry.logoY)
          return da - db
        })
        .slice(0, missing)
      for (const b of candidates) {
        b.isCarrier = true
        b.followingTrail = false
        this.snapCarrierNearLogo(b)
        this.logoCarry.carrierIds.add(b.id)
      }
    }

    if (this.logoCarry.swapTimer <= 0) {
      const carriers = this.bugs.filter((b) => b.isCarrier)
      const canDrop = Math.max(1, carriers.length - LOGO_CARRY_FIXED_COUNT)
      const dropCount = Math.min(canDrop, Math.floor(randomRange(1, 3)))
      const drop = carriers.sort((a, b) => Math.random() - 0.5).slice(0, dropCount)
      for (const b of drop) {
        b.isCarrier = false
        this.logoCarry.carrierIds.delete(b.id)
      }
      const refill = this.bugs
        .filter((b) => !b.isCarrier)
        .sort((a, b) => {
          const da = Math.hypot(a.x - this.logoCarry.logoX, a.y - this.logoCarry.logoY)
          const db = Math.hypot(b.x - this.logoCarry.logoX, b.y - this.logoCarry.logoY)
          return da - db
        })
        .slice(0, dropCount)
      for (const b of refill) {
        b.isCarrier = true
        b.followingTrail = false
        this.snapCarrierNearLogo(b)
        this.logoCarry.carrierIds.add(b.id)
      }
      // One carrier may lag briefly, then catch up to reform the group.
      const stillCarriers = this.bugs.filter((b) => b.isCarrier)
      if (stillCarriers.length > 0) {
        const lagger = stillCarriers[Math.floor(Math.random() * stillCarriers.length)]
        lagger.x += randomRange(-14, 14)
        lagger.y += randomRange(-14, 14)
        this.logoCarry.laggers.set(lagger.id, randomRange(0.35, 0.9))
      }
      this.logoCarry.swapTimer = randomRange(0.7, 1.5)
    }

    if (this.logoCarry.regripTimer <= 0) {
      const carriers = this.bugs.filter((b) => b.isCarrier)
      if (carriers.length > 0) {
        const regripCount = Math.min(2, carriers.length)
        const shuffled = carriers.sort(() => Math.random() - 0.5)
        for (let i = 0; i < regripCount; i++) {
          const b = shuffled[i]
          this.logoCarry.regripUntil.set(b.id, randomRange(0.12, 0.32))
        }
      }
      this.logoCarry.regripTimer = randomRange(0.5, 1.2)
    }

    // Countdown transient states.
    for (const [id, left] of [...this.logoCarry.laggers.entries()]) {
      const next = left - dt
      if (next <= 0) this.logoCarry.laggers.delete(id)
      else this.logoCarry.laggers.set(id, next)
    }
    for (const [id, left] of [...this.logoCarry.regripUntil.entries()]) {
      const next = left - dt
      if (next <= 0) this.logoCarry.regripUntil.delete(id)
      else this.logoCarry.regripUntil.set(id, next)
    }
  }

  private computeCarryHeading(bug: BugEntity): number {
    const toTargetX = this.logoCarry.targetX - this.logoCarry.logoX
    const toTargetY = this.logoCarry.targetY - this.logoCarry.logoY
    const targetHeading = Math.atan2(toTargetY, toTargetX)
    const tnx = Math.cos(targetHeading)
    const tny = Math.sin(targetHeading)
    const pnx = -tny
    const pny = tnx

    const n = Math.max(1, this.logoCarry.carrierIds.size)
    const baseSlot = ((bug.id * 2654435761 + this.logoCarry.slotSeed) >>> 0) % n
    const slotPhase = n <= 1 ? 0 : (baseSlot / n) * Math.PI * 2
    const jitterRng = (((bug.id * 1664525 + this.logoCarry.slotSeed) >>> 0) % 1000) / 1000 - 0.5

    // True ring placement: workers distribute around the whole payload.
    const slotHeading = targetHeading + slotPhase + jitterRng * 0.22
    const ringR = 7.4 + (((bug.id * 1103515245 + this.logoCarry.slotSeed) >>> 0) % 4) * 0.75

    const slotX = this.logoCarry.logoX + Math.cos(slotHeading) * ringR
    const slotY = this.logoCarry.logoY + Math.sin(slotHeading) * ringR

    const toSlotX = slotX - bug.x
    const toSlotY = slotY - bug.y
    const distToSlot = Math.hypot(toSlotX, toSlotY)
    const lagging = (this.logoCarry.laggers.get(bug.id) ?? 0) > 0
    const pullInDist = lagging ? 2.2 : 3.2
    if (distToSlot > pullInDist) {
      const slotHeadingNow = Math.atan2(toSlotY, toSlotX)
      return slotHeadingNow
    }

    // On-ring collaboration flow: advance with payload + slight orbit + radius correction.
    const rx = bug.x - this.logoCarry.logoX
    const ry = bug.y - this.logoCarry.logoY
    const rLen = Math.hypot(rx, ry)
    const rnx = rLen > 0.001 ? rx / rLen : Math.cos(slotHeading)
    const rny = rLen > 0.001 ? ry / rLen : Math.sin(slotHeading)
    const tangentSign = (baseSlot % 2 === 0) ? 1 : -1
    const tx = -rny * tangentSign
    const ty = rnx * tangentSign
    const desiredR = ringR
    const radiusErr = desiredR - rLen
    const corrX = rnx * radiusErr * 0.9
    const corrY = rny * radiusErr * 0.9
    const moveX = tnx * 1.08 + tx * 0.42 + corrX + pnx * jitterRng * 0.08
    const moveY = tny * 1.08 + ty * 0.42 + corrY + pny * jitterRng * 0.08
    const mixX = moveX
    const mixY = moveY
    return Math.atan2(mixY, mixX)
  }

  private computeCarryFaceHeading(bug: BugEntity): number {
    const toLogoX = this.logoCarry.logoX - bug.x
    const toLogoY = this.logoCarry.logoY - bug.y
    const base = Math.atan2(toLogoY, toLogoX)
    const jitter = (((bug.id * 214013 + this.logoCarry.slotSeed) >>> 0) % 1000) / 1000 - 0.5
    return base + jitter * 0.02
  }

  private snapCarrierNearLogo(bug: BugEntity): void {
    const toTargetX = this.logoCarry.targetX - this.logoCarry.logoX
    const toTargetY = this.logoCarry.targetY - this.logoCarry.logoY
    const targetHeading = Math.atan2(toTargetY, toTargetX)
    const n = Math.max(1, this.logoCarry.desiredCount)
    const slot = ((bug.id * 2654435761 + this.logoCarry.slotSeed) >>> 0) % n
    const slotPhase = n <= 1 ? 0 : (slot / n) * Math.PI * 2
    const r = 8.2 + randomRange(-0.8, 0.8)
    const h = targetHeading + slotPhase

    bug.x = this.logoCarry.logoX + Math.cos(h) * r
    bug.y = this.logoCarry.logoY + Math.sin(h) * r
    bug.heading = targetHeading + randomRange(-0.18, 0.18)
    bug.renderHeading = this.computeCarryFaceHeading(bug)
    this.resetLegPose(bug)
  }

  private resetLegPose(bug: BugEntity): void {
    const size = bug.size
    for (const leg of bug.legs) {
      const foot = localToWorld(
        bug.x,
        bug.y,
        bug.heading,
        leg.restLocalX * size,
        leg.restLocalY * size,
      )
      leg.footX = foot.x
      leg.footY = foot.y
      leg.stepFromX = foot.x
      leg.stepFromY = foot.y
      leg.stepToX = foot.x
      leg.stepToY = foot.y
      leg.stepT = 0
      leg.stepping = false

      const anchor = localToWorld(
        bug.x,
        bug.y,
        bug.heading,
        leg.anchorLocalX * size,
        leg.anchorLocalY * size,
      )
      const knee = solveTwoBoneIK(
        anchor.x,
        anchor.y,
        leg.footX,
        leg.footY,
        BUG_LEG_SEGMENT_1 * size,
        BUG_LEG_SEGMENT_2 * size,
        leg.isRightSide,
      )
      leg.kneeX = knee.x
      leg.kneeY = knee.y
    }
  }

  private getCarrySpeedMultiplier(bug: BugEntity): number {
    const roleCode = this.getCarryRoleCode(bug.id)
    const regrip = (this.logoCarry.regripUntil.get(bug.id) ?? 0) > 0
    const lagging = (this.logoCarry.laggers.get(bug.id) ?? 0) > 0
    let scale = 1
    if (roleCode < 5) scale = 1.03
    else if (roleCode < 8) scale = 0.96
    else scale = 0.92
    if (lagging) scale *= 1.12
    if (regrip) scale *= 0.62
    return scale
  }

  private getCarryRoleCode(id: number): number {
    return ((id * 1103515245 + this.logoCarry.slotSeed) >>> 0) % 10
  }

  private getDepositScale(behavior: BugBehaviorType): number {
    if (behavior === 'loner') return 1.6
    if (behavior === 'social') return 1.0
    return 0.25
  }

  private createBug(worldWidth: number, worldHeight: number): BugEntity {
    const behaviorType = pickBehavior()
    const size = pickSizeScale()
    const speedBias = behaviorType === 'loner' ? 1.15 : behaviorType === 'social' ? 0.95 : 0.9
    const speed = randomRange(BUG_MIN_SPEED, BUG_MAX_SPEED) * speedBias
    const heading = randomRange(0, Math.PI * 2)
    const x = randomRange(BUG_BORDER_PADDING, Math.max(BUG_BORDER_PADDING + 1, worldWidth - BUG_BORDER_PADDING))
    const y = randomRange(BUG_BORDER_PADDING, Math.max(BUG_BORDER_PADDING + 1, worldHeight - BUG_BORDER_PADDING))

    const legs: BugLeg[] = LEG_SPECS.map((s, index) => {
      const foot = localToWorld(x, y, heading, s.restX * size, s.restY * size)
      return {
        index,
        group: s.group,
        sideSign: s.side,
        isRightSide: s.side === 1,
        anchorLocalX: s.anchorX,
        anchorLocalY: s.anchorY,
        restLocalX: s.restX,
        restLocalY: s.restY,
        footX: foot.x,
        footY: foot.y,
        kneeX: foot.x,
        kneeY: foot.y,
        stepping: false,
        stepT: 0,
        stepDuration: BUG_STEP_DURATION_SEC,
        stepFromX: foot.x,
        stepFromY: foot.y,
        stepToX: foot.x,
        stepToY: foot.y,
      }
    })

    // Initialize knees once.
    for (const leg of legs) {
      const a = localToWorld(x, y, heading, leg.anchorLocalX * size, leg.anchorLocalY * size)
      const k = solveTwoBoneIK(a.x, a.y, leg.footX, leg.footY, BUG_LEG_SEGMENT_1 * size, BUG_LEG_SEGMENT_2 * size, leg.isRightSide)
      leg.kneeX = k.x
      leg.kneeY = k.y
    }

    const color = BUG_MORANDI_COLORS[Math.floor(Math.random() * BUG_MORANDI_COLORS.length)]
    return {
      id: this.nextId++,
      x,
      y,
      vx: Math.cos(heading) * speed,
      vy: Math.sin(heading) * speed,
      heading,
      renderHeading: heading,
      speed,
      size,
      wanderTimer: randomRange(BUG_WANDER_MIN_SEC, BUG_WANDER_MAX_SEC),
      wanderTargetHeading: heading,
      behaviorType,
      color,
      activeLegGroup: Math.random() < 0.5 ? 0 : 1,
      gaitTimer: randomRange(0, BUG_GAIT_SWITCH_SEC),
      legUpdateTimer: 0,
      followingTrail: false,
      isCarrier: false,
      legs,
    }
  }
}

// Expose body dimensions for renderer to stay in sync with motion profile.
export const BUG_BODY_DIMENSIONS = {
  head: BUG_HEAD_SIZE,
  thoraxLength: BUG_THORAX_LENGTH,
  thoraxWidth: BUG_THORAX_WIDTH,
  abdomenLength: BUG_ABDOMEN_LENGTH,
  abdomenWidth: BUG_ABDOMEN_WIDTH,
}
