export class BugPheromoneField {
  private width: number
  private height: number
  private cellSize: number
  private cols: number
  private rows: number
  private data: Float32Array

  constructor(width: number, height: number, cellSize: number) {
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)
    this.cellSize = Math.max(1, cellSize)
    this.cols = Math.max(1, Math.ceil(this.width / this.cellSize))
    this.rows = Math.max(1, Math.ceil(this.height / this.cellSize))
    this.data = new Float32Array(this.cols * this.rows)
  }

  resize(width: number, height: number): void {
    const w = Math.max(1, width)
    const h = Math.max(1, height)
    const cols = Math.max(1, Math.ceil(w / this.cellSize))
    const rows = Math.max(1, Math.ceil(h / this.cellSize))
    if (cols === this.cols && rows === this.rows) {
      this.width = w
      this.height = h
      return
    }
    this.width = w
    this.height = h
    this.cols = cols
    this.rows = rows
    this.data = new Float32Array(this.cols * this.rows)
  }

  update(dt: number, evaporationPerSec: number): void {
    if (dt <= 0) return
    const keep = Math.max(0, 1 - evaporationPerSec * dt)
    for (let i = 0; i < this.data.length; i++) {
      this.data[i] *= keep
      if (this.data[i] < 0.0001) this.data[i] = 0
    }
  }

  deposit(
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    amount: number,
    maxStrength: number,
  ): void {
    const cx = Math.floor(x / this.cellSize)
    const cy = Math.floor(y / this.cellSize)
    this.addToCell(cx, cy, amount, maxStrength)

    // Add a little forward deposition to create directional trails.
    const fx = x + dirX * this.cellSize * 0.5
    const fy = y + dirY * this.cellSize * 0.5
    const fcx = Math.floor(fx / this.cellSize)
    const fcy = Math.floor(fy / this.cellSize)
    this.addToCell(fcx, fcy, amount * 0.6, maxStrength)
  }

  sampleDirection(x: number, y: number, radius: number): { x: number; y: number; strength: number } {
    const cx = Math.floor(x / this.cellSize)
    const cy = Math.floor(y / this.cellSize)
    const cr = Math.max(1, Math.ceil(radius / this.cellSize))

    let fx = 0
    let fy = 0
    let strength = 0

    for (let gx = cx - cr; gx <= cx + cr; gx++) {
      for (let gy = cy - cr; gy <= cy + cr; gy++) {
        const idx = this.index(gx, gy)
        if (idx < 0) continue
        const s = this.data[idx]
        if (s <= 0) continue
        const centerX = (gx + 0.5) * this.cellSize
        const centerY = (gy + 0.5) * this.cellSize
        const dx = centerX - x
        const dy = centerY - y
        const dist = Math.hypot(dx, dy)
        if (dist > radius || dist <= 0.0001) continue
        const w = s / (1 + dist * 0.1)
        fx += (dx / dist) * w
        fy += (dy / dist) * w
        strength += s
      }
    }

    return { x: fx, y: fy, strength }
  }

  private addToCell(cx: number, cy: number, value: number, maxStrength: number): void {
    const idx = this.index(cx, cy)
    if (idx < 0) return
    this.data[idx] = Math.min(maxStrength, this.data[idx] + value)
  }

  private index(cx: number, cy: number): number {
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return -1
    return cy * this.cols + cx
  }
}

