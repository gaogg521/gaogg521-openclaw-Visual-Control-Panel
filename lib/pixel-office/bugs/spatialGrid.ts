import type { BugEntity } from './types'

export class BugSpatialGrid {
  private readonly cellSize: number
  private cells: Map<string, BugEntity[]> = new Map()

  constructor(cellSize: number) {
    this.cellSize = Math.max(1, cellSize)
  }

  clear(): void {
    this.cells.clear()
  }

  add(bug: BugEntity): void {
    const key = this.keyFor(bug.x, bug.y)
    const bucket = this.cells.get(key)
    if (bucket) {
      bucket.push(bug)
    } else {
      this.cells.set(key, [bug])
    }
  }

  query(x: number, y: number, radius: number): BugEntity[] {
    const r = Math.max(0, radius)
    const minCx = Math.floor((x - r) / this.cellSize)
    const maxCx = Math.floor((x + r) / this.cellSize)
    const minCy = Math.floor((y - r) / this.cellSize)
    const maxCy = Math.floor((y + r) / this.cellSize)
    const out: BugEntity[] = []
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const bucket = this.cells.get(`${cx},${cy}`)
        if (!bucket) continue
        for (const bug of bucket) out.push(bug)
      }
    }
    return out
  }

  private keyFor(x: number, y: number): string {
    const cx = Math.floor(x / this.cellSize)
    const cy = Math.floor(y / this.cellSize)
    return `${cx},${cy}`
  }
}

