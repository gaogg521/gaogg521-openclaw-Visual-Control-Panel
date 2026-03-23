export const BUG_DEFAULT_COUNT = 5
export const BUG_MAX_COUNT = 400
export const BUG_MIN_SPEED = 12
export const BUG_MAX_SPEED = 30
export const BUG_WANDER_MIN_SEC = 0.5
export const BUG_WANDER_MAX_SEC = 2.2
export const BUG_BORDER_PADDING = 8

// OpenBug-like body proportions
export const BUG_HEAD_SIZE = 3.2
export const BUG_THORAX_LENGTH = 4.0
export const BUG_THORAX_WIDTH = 2.5
export const BUG_ABDOMEN_LENGTH = 5.0
export const BUG_ABDOMEN_WIDTH = 3.5

// OpenBug-like legs
export const BUG_LEG_SEGMENT_1 = 2.65
export const BUG_LEG_SEGMENT_2 = 3.45
export const BUG_STEP_TRIGGER = 4.0
export const BUG_STEP_DISTANCE = 2.0
export const BUG_STEP_HEIGHT = 2.2
export const BUG_STEP_DURATION_SEC = 0.09
export const BUG_GAIT_SWITCH_SEC = 0.11
export const BUG_LEG_UPDATE_INTERVAL_SEC = 0.0416667
export const BUG_OUT_OF_BOUNDS_MARGIN = 64

// M2: neighborhood + boids-like steering
export const BUG_PERCEPTION_RADIUS = 40
export const BUG_SEPARATION_RADIUS = 8
export const BUG_GRID_CELL_SIZE = 50
export const BUG_SEPARATION_WEIGHT = 8.0
export const BUG_ALIGNMENT_WEIGHT = 1.2
export const BUG_COHESION_WEIGHT = 1.0
export const BUG_EDGE_ATTRACTION_WEIGHT = 2.0

// M2: lifecycle + swarm event
export const BUG_SPAWN_INTERVAL_SEC = 600 // 10 minutes
export const BUG_SWARM_MIN_COUNT = 20
export const BUG_SWARM_TRIGGER_MEAN_SEC = 480
export const BUG_SWARM_DURATION_MIN_SEC = 6
export const BUG_SWARM_DURATION_MAX_SEC = 14
export const BUG_SWARM_COOLDOWN_MIN_SEC = 300
export const BUG_SWARM_COOLDOWN_MAX_SEC = 420
export const BUG_SWARM_INITIAL_COOLDOWN_MIN_SEC = 90
export const BUG_SWARM_INITIAL_COOLDOWN_MAX_SEC = 210

// M3: pheromone + trail follow
export const BUG_PHEROMONE_CELL_SIZE = 28.0
export const BUG_PHEROMONE_DEPOSIT_PER_SEC = 6.0
export const BUG_PHEROMONE_EVAPORATION_PER_SEC = 0.25
export const BUG_PHEROMONE_MAX_STRENGTH = 12.0
export const BUG_PHEROMONE_MIN_DETECT = 0.15
export const BUG_PHEROMONE_FOLLOW_WEIGHT = 2.0
export const BUG_TRAIL_FOLLOW_RADIUS = 40.0
export const BUG_TRAIL_FOLLOW_PROB = 0.02
export const BUG_TRAIL_BREAK_PROB = 0.01
export const BUG_TRAIL_STEERING_WEIGHT = 5.0

// Cursor repulsion
export const BUG_CURSOR_REPULSION_RADIUS = 125
export const BUG_CURSOR_REPULSION_STRENGTH = 100

export const BUG_MORANDI_COLORS = [
  '#A4B7C9',
  '#8FA899',
  '#D4B2AA',
  '#DED0B6',
  '#9BA88D',
  '#C6B5A6',
  '#8DA399',
  '#B5A398',
  '#A99D98',
  '#E0CDB6',
]
