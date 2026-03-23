import type { BugEntity } from './types'
import { BUG_BODY_DIMENSIONS } from './bugSystem'

function localToWorldForRender(
  bug: BugEntity,
  lx: number,
  ly: number,
): { x: number; y: number } {
  const h = bug.renderHeading
  const c = Math.cos(h)
  const s = Math.sin(h)
  return {
    x: bug.x + lx * c - ly * s,
    y: bug.y + lx * s + ly * c,
  }
}

export function renderBugs(
  ctx: CanvasRenderingContext2D,
  bugs: BugEntity[],
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  for (const bug of bugs) {
    drawBugLegs(ctx, bug, offsetX, offsetY, zoom)
    drawBugBody(ctx, bug, offsetX, offsetY, zoom)
  }
}

function drawBugLegs(
  ctx: CanvasRenderingContext2D,
  bug: BugEntity,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const femurW = Math.max(0.5, 0.62 * bug.size * zoom)
  const tibiaW = Math.max(0.35, 0.46 * bug.size * zoom)
  const legColor = bug.color

  for (const leg of bug.legs) {
    const anchor = localToWorldForRender(
      bug,
      leg.anchorLocalX * bug.size,
      leg.anchorLocalY * bug.size,
    )
    const aX = offsetX + anchor.x * zoom
    const aY = offsetY + anchor.y * zoom
    const kX = offsetX + leg.kneeX * zoom
    const kY = offsetY + leg.kneeY * zoom
    const fX = offsetX + leg.footX * zoom
    const fY = offsetY + leg.footY * zoom

    ctx.strokeStyle = legColor
    ctx.lineWidth = femurW
    ctx.beginPath()
    ctx.moveTo(aX, aY)
    ctx.lineTo(kX, kY)
    ctx.stroke()

    ctx.lineWidth = tibiaW
    ctx.beginPath()
    ctx.moveTo(kX, kY)
    ctx.lineTo(fX, fY)
    ctx.stroke()
  }
  ctx.restore()
}

function drawBugBody(
  ctx: CanvasRenderingContext2D,
  bug: BugEntity,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  const bx = offsetX + bug.x * zoom
  const by = offsetY + bug.y * zoom
  const scale = bug.size * zoom
  const headSize = BUG_BODY_DIMENSIONS.head * scale
  const thoraxLength = BUG_BODY_DIMENSIONS.thoraxLength * scale
  const thoraxWidth = BUG_BODY_DIMENSIONS.thoraxWidth * scale
  const abdomenLength = BUG_BODY_DIMENSIONS.abdomenLength * scale
  const abdomenWidth = BUG_BODY_DIMENSIONS.abdomenWidth * scale
  const headRadius = headSize / 2
  const thoraxHalfLength = thoraxLength / 2
  const abdomenHalfLength = abdomenLength / 2
  const overlap = 0.8
  const headOffsetX = (thoraxHalfLength + headRadius) * overlap
  const abdomenOffsetX = -(thoraxHalfLength + abdomenHalfLength) * overlap

  ctx.save()
  ctx.translate(bx, by)
  ctx.rotate(bug.renderHeading)

  ctx.fillStyle = bug.color
  ellipse(ctx, headOffsetX, 0, headSize / 2, headSize / 2)
  ellipse(ctx, 0, 0, thoraxLength / 2, thoraxWidth / 2)
  ellipse(ctx, abdomenOffsetX, 0, abdomenLength / 2, abdomenWidth / 2)

  ctx.restore()
}

function ellipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
): void {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
}
