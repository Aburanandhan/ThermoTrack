import type {
  AbnormalEventType,
  PlayerSafetyAssessment,
  PoseLandmarkPoint,
} from '../../types/safety'

interface FrameRecord {
  timestamp: number
  torsoCenter: { x: number; y: number }
  shoulderCenter: { x: number; y: number }
  hipCenter: { x: number; y: number }
  scale: number // Body height scale
  spineAngleDeg: number // 0 = straight upright, 90 = horizontal
  velocity: { vx: number; vy: number; speed: number }
  acceleration: { ax: number; ay: number; mag: number }
  jointMotionScore: number
  visibility: number
}

export class PlayerSafetyDetector {
  private history: FrameRecord[] = []
  private maxHistoryDurationMs = 2800 // 2.8 second rolling window
  private lastAlertTimestamp = 0
  private alertHoldDurationMs = 4000 // Keep attention alert visible for 4s minimum
  private lastAlertReason: { message: string; eventType: AbnormalEventType; confidence: number } | null = null
  private smoothedConfidence = 94
  private lastPoseSeenTimestamp = 0
  private isCameraActive = false

  public setCameraActive(active: boolean) {
    this.isCameraActive = active
    if (!active) {
      this.reset()
    }
  }

  public reset() {
    this.history = []
    this.lastAlertTimestamp = 0
    this.lastAlertReason = null
    this.smoothedConfidence = 94
    this.lastPoseSeenTimestamp = 0
  }

  public processFrame(
    landmarks: PoseLandmarkPoint[] | null | undefined,
    timestamp: number = performance.now(),
  ): PlayerSafetyAssessment {
    if (!this.isCameraActive) {
      return {
        status: 'WAITING_FOR_PLAYER',
        confidence: 0,
        message: 'Camera is off',
        eventType: null,
        timestamp,
        isPoseDetected: false,
        trackingQuality: 0,
      }
    }

    // 1. Check if valid landmarks exist
    if (!landmarks || landmarks.length < 17) {
      return this.handleMissingPose(timestamp)
    }

    // Extract core landmark points
    // MediaPipe Pose indices:
    // 0: nose, 11: left_shoulder, 12: right_shoulder, 23: left_hip, 24: right_hip, 25: left_knee, 26: right_knee, 27: left_ankle, 28: right_ankle
    const leftShoulder = landmarks[11]
    const rightShoulder = landmarks[12]
    const leftHip = landmarks[23]
    const rightHip = landmarks[24]
    const leftKnee = landmarks[25]
    const rightKnee = landmarks[26]
    const leftAnkle = landmarks[27]
    const rightAnkle = landmarks[28]

    // Validate key landmarks presence & visibility
    const keyPoints = [leftShoulder, rightShoulder, leftHip, rightHip]
    const validCount = keyPoints.filter((p) => p && (p.visibility === undefined || p.visibility > 0.35)).length
    if (validCount < 3) {
      return this.handleMissingPose(timestamp)
    }

    this.lastPoseSeenTimestamp = timestamp

    // Compute centers
    const shoulderCenter = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2,
    }
    const hipCenter = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2,
    }
    const torsoCenter = {
      x: (shoulderCenter.x + hipCenter.x) / 2,
      y: (shoulderCenter.y + hipCenter.y) / 2,
    }

    // Body scale: estimated vertical distance from shoulder center to ankles or hips
    let lowerBodyY = hipCenter.y
    if (leftAnkle && rightAnkle && (leftAnkle.visibility ?? 1) > 0.3 && (rightAnkle.visibility ?? 1) > 0.3) {
      lowerBodyY = (leftAnkle.y + rightAnkle.y) / 2
    } else if (leftKnee && rightKnee && (leftKnee.visibility ?? 1) > 0.3 && (rightKnee.visibility ?? 1) > 0.3) {
      lowerBodyY = (leftKnee.y + rightKnee.y) / 2
    }
    const rawScale = Math.max(0.12, Math.abs(lowerBodyY - shoulderCenter.y))

    // Spine angle relative to vertical (0 deg = standing vertical, 90 deg = horizontal flat)
    const dxSpine = shoulderCenter.x - hipCenter.x
    const dySpine = hipCenter.y - shoulderCenter.y // positive if shoulder is higher than hip in screen coords
    const spineAngleRad = Math.atan2(Math.abs(dxSpine), Math.max(0.001, dySpine))
    const spineAngleDeg = (spineAngleRad * 180) / Math.PI

    // Average visibility across all key joints
    const visibilities = landmarks
      .slice(0, 29)
      .map((p) => p.visibility ?? 0.8)
      .filter((v) => typeof v === 'number')
    const avgVisibility = visibilities.reduce((a, b) => a + b, 0) / (visibilities.length || 1)
    const trackingQuality = Math.min(100, Math.max(20, Math.round(avgVisibility * 100)))

    // Compute Velocity and Acceleration relative to scale
    let vx = 0
    let vy = 0
    let speed = 0
    let ax = 0
    let ay = 0
    let accelMag = 0
    let jointMotionScore = 0

    const prevFrame = this.history[this.history.length - 1]
    if (prevFrame) {
      const dtSec = Math.max(0.01, (timestamp - prevFrame.timestamp) / 1000)
      if (dtSec < 0.5) {
        // Normalize displacement by body scale so distance from camera doesn't distort velocity
        vx = (torsoCenter.x - prevFrame.torsoCenter.x) / (rawScale * dtSec)
        vy = (torsoCenter.y - prevFrame.torsoCenter.y) / (rawScale * dtSec)
        speed = Math.sqrt(vx * vx + vy * vy)

        ax = (vx - prevFrame.velocity.vx) / dtSec
        ay = (vy - prevFrame.velocity.vy) / dtSec
        accelMag = Math.sqrt(ax * ax + ay * ay)

        // Joint motion score: aggregate movement of arms and legs
        if (landmarks[15] && landmarks[16] && landmarks[27] && landmarks[28]) {
          const armSpeed = Math.hypot(landmarks[15].x - (leftShoulder.x), landmarks[15].y - leftShoulder.y)
          const legSpeed = Math.hypot(landmarks[27].x - (leftHip.x), landmarks[27].y - leftHip.y)
          jointMotionScore = (armSpeed + legSpeed) / rawScale
        }
      }
    }

    const currentRecord: FrameRecord = {
      timestamp,
      torsoCenter,
      shoulderCenter,
      hipCenter,
      scale: rawScale,
      spineAngleDeg,
      velocity: { vx, vy, speed },
      acceleration: { ax, ay, mag: accelMag },
      jointMotionScore,
      visibility: avgVisibility,
    }

    // Add to history and prune old records
    this.history.push(currentRecord)
    const cutoffTime = timestamp - this.maxHistoryDurationMs
    this.history = this.history.filter((f) => f.timestamp >= cutoffTime)

    // Analyze temporal signals
    const assessment = this.evaluateTemporalSafety(currentRecord, timestamp, trackingQuality)
    return assessment
  }

  private handleMissingPose(timestamp: number): PlayerSafetyAssessment {
    const elapsedSinceLastPose = timestamp - (this.lastPoseSeenTimestamp || timestamp)

    // If visibility loss is momentary (< 400ms) and we were actively tracking, hold state briefly
    if (elapsedSinceLastPose < 400 && this.history.length > 0) {
      return {
        status: 'SAFE',
        confidence: Math.round(this.smoothedConfidence * 0.9),
        message: 'Monitoring normally',
        eventType: null,
        timestamp,
        isPoseDetected: false,
        trackingQuality: 30,
      }
    }

    // When reliable athlete landmarks cannot currently be detected:
    // WAITING FOR PLAYER state (non-alert)
    return {
      status: 'WAITING_FOR_PLAYER',
      confidence: 0,
      message: 'Position the player fully inside the camera frame.',
      eventType: null,
      timestamp,
      isPoseDetected: false,
      trackingQuality: 0,
    }
  }

  private evaluateTemporalSafety(
    current: FrameRecord,
    timestamp: number,
    trackingQuality: number,
  ): PlayerSafetyAssessment {
    if (this.history.length < 5) {
      // Warmup phase with valid pose
      this.smoothedConfidence = 93
      return {
        status: 'SAFE',
        confidence: 93,
        message: 'Monitoring normally',
        eventType: null,
        timestamp,
        isPoseDetected: true,
        trackingQuality,
      }
    }

    // Check if we are currently holding an active alert window
    const isInAlertHold = timestamp - this.lastAlertTimestamp < this.alertHoldDurationMs
    const timeSinceAlert = timestamp - this.lastAlertTimestamp

    // --- TEMPORAL FEATURE EXTRACTION ---
    const windowStart = timestamp - 2000
    const recentFrames = this.history.filter((f) => f.timestamp >= windowStart)

    // 1. Max Acceleration / Jerk in recent window
    const maxAccel = Math.max(...recentFrames.map((f) => f.acceleration.mag), 0)

    // 2. Vertical Drop Rate (difference between min Y and max Y in last 0.8s)
    const dropWindowFrames = this.history.filter((f) => f.timestamp >= timestamp - 800)
    const initialY = dropWindowFrames[0]?.torsoCenter.y ?? current.torsoCenter.y
    const verticalDrop = (current.torsoCenter.y - initialY) / current.scale

    // 3. Current ground-level posture check
    // Low torso in frame or horizontal spine angle (> 55 degrees)
    const isGroundPosture = current.spineAngleDeg > 55 || current.torsoCenter.y > 0.72

    // 4. Inactivity check after high dynamic event:
    // Check average velocity over the last 600ms
    const recentStillnessFrames = this.history.filter((f) => f.timestamp >= timestamp - 600)
    const avgRecentSpeed =
      recentStillnessFrames.reduce((sum, f) => sum + f.velocity.speed, 0) /
      (recentStillnessFrames.length || 1)
    const isStationary = avgRecentSpeed < 0.25

    // 5. Recovery check:
    // If player has returned to upright posture (< 35 deg), has good height, and is moving normally
    const isUprightAndActive =
      current.spineAngleDeg < 35 &&
      current.torsoCenter.y < 0.65 &&
      avgRecentSpeed >= 0.1 &&
      avgRecentSpeed < 4.0

    // --- HEURISTIC SAFETY CLASSIFICATION ---

    // A. Possible Fall Event:
    // Sudden downward drop or high acceleration followed by ground-level posture and stillness
    const isFallPattern =
      (verticalDrop > 0.75 || maxAccel > 18) &&
      isGroundPosture &&
      isStationary

    // B. Possible Impact / Collision:
    // Severe sudden deceleration/acceleration impulse (jerk spike > 26) with abrupt orientation shift
    const orientationChange = Math.abs(current.spineAngleDeg - (recentFrames[0]?.spineAngleDeg ?? current.spineAngleDeg))
    const isImpactPattern = maxAccel > 26 && orientationChange > 35

    // C. Prolonged ground inactivity following high movement:
    const wasFastMoving = recentFrames.some((f) => f.velocity.speed > 2.5)
    const isProlongedGroundStillness = wasFastMoving && isGroundPosture && isStationary

    let detectedEvent: AbnormalEventType | null = null
    let alertMessage = ''
    let calculatedConfidence = 94

    if (isImpactPattern) {
      detectedEvent = 'possible_impact'
      alertMessage = 'Possible impact event detected. Please check the player.'
      calculatedConfidence = Math.min(96, Math.max(88, Math.round(85 + maxAccel * 0.3)))
    } else if (isFallPattern || isProlongedGroundStillness) {
      detectedEvent = 'possible_fall'
      alertMessage = 'Possible abnormal movement detected. Please check the player.'
      calculatedConfidence = Math.min(95, Math.max(89, Math.round(86 + verticalDrop * 8)))
    }

    // If an abnormal event is newly detected:
    if (detectedEvent) {
      this.lastAlertTimestamp = timestamp
      this.lastAlertReason = {
        message: alertMessage,
        eventType: detectedEvent,
        confidence: calculatedConfidence,
      }
    }

    // Determine final status
    if (detectedEvent || (isInAlertHold && this.lastAlertReason)) {
      // If player clearly recovered upright and is actively exercising, clear alert faster
      if (isUprightAndActive && timeSinceAlert > 1500) {
        this.lastAlertTimestamp = 0
        this.lastAlertReason = null
        this.smoothedConfidence = 94
        return {
          status: 'SAFE',
          confidence: 94,
          message: 'Monitoring normally',
          eventType: null,
          timestamp,
          isPoseDetected: true,
          trackingQuality,
        }
      }

      const activeAlert = this.lastAlertReason!
      this.smoothedConfidence = Math.round(0.85 * this.smoothedConfidence + 0.15 * activeAlert.confidence)

      return {
        status: 'ATTENTION_REQUIRED',
        confidence: this.smoothedConfidence,
        message: activeAlert.message,
        eventType: activeAlert.eventType,
        timestamp,
        isPoseDetected: true,
        trackingQuality,
      }
    }

    // Normal athletic movement (running, jumping, bending, crouching, sprinting)
    // High stability confidence based on tracking quality
    const baseSafeConf = Math.min(98, Math.max(90, Math.round(trackingQuality * 0.95 + 4)))
    this.smoothedConfidence = Math.round(0.9 * this.smoothedConfidence + 0.1 * baseSafeConf)

    return {
      status: 'SAFE',
      confidence: this.smoothedConfidence,
      message: 'Monitoring normally',
      eventType: null,
      timestamp,
      isPoseDetected: true,
      trackingQuality,
    }
  }
}
