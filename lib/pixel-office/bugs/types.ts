export type BugBehaviorType = 'social' | 'loner' | 'edgeDweller'

export interface BugLeg {
  index: number
  group: 0 | 1
  sideSign: -1 | 1
  isRightSide: boolean
  anchorLocalX: number
  anchorLocalY: number
  restLocalX: number
  restLocalY: number
  footX: number
  footY: number
  kneeX: number
  kneeY: number
  stepping: boolean
  stepT: number
  stepDuration: number
  stepFromX: number
  stepFromY: number
  stepToX: number
  stepToY: number
}

export interface BugEntity {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  heading: number
  renderHeading: number
  speed: number
  size: number
  wanderTimer: number
  wanderTargetHeading: number
  behaviorType: BugBehaviorType
  color: string
  activeLegGroup: 0 | 1
  gaitTimer: number
  legUpdateTimer: number
  followingTrail: boolean
  isCarrier: boolean
  legs: BugLeg[]
}
