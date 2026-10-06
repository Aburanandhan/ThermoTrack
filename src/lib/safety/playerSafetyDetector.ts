import type {
  AbnormalEventType,
  PlayerSafetyAssessment,
  PoseLandmarkPoint,
  SafetyDiagnostics,
} from '../../types/safety'

interface FrameLandmarkData {
  timestamp: number
  torsoCenter: { x: number; y: number }
  shoulderCenter: { x: number; y: number }
  hipCenter: { x: number; y: number }
  bodyScale: number
  spineAngleDeg: number
  velocity: { vx: number; vy: number; speed: number }
  acceleration: { ax: number; ay: number; mag: number }
  limbDeformation: number
  visibility: number
}

interface CandidateEvent {
  timestamp: number
  eventType: AbnormalEventType
  peakScore: number
  initialY: number
}

export class PlayerSafetyDetector {
  private history: FrameLandmarkData[] = []
  private maxHistoryDurationMs = 3000 // 3.0 second rolling window
  private isCameraActive = false

  // Smoothed internal coordinates to suppress jitter
  private prevSmoothedCenter: { x: number; y: number } | null = null
  private prevSmoothedScale = 0.35
  private lastPoseSeenTimestamp = 0

  // Two-stage temporal confirmation state machine
  private candidateEvent: CandidateEvent | null = null
  private confirmedAlertTimestamp = 0
  private confirmedAlertReason: { message: string; eventType: AbnormalEventType; confidence: number } | null = null
  private alertHoldDurationMs = 3500 // Hold ATTENTION state for 3.5s minimum

  // Smoothed confidence
  private smoothedConfidence = 94

  public setCameraActive(active: boolean) {
    this.isCameraActive = active
    if (!active) {
      this.reset()
    }
  }

  public reset() {
    this.history = []
    this.prevSmoothedCenter = null
    this.prevSmoothedScale = 0.35
    this.lastPoseSeenTimestamp = 0
    this.candidateEvent = null
    this.confirmedAlertTimestamp = 0
    this.confirmedAlertReason = null
    this.smoothedConfidence = 94
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
        diagnostics: this.createEmptyDiagnostics(),
      }
    }

    // 1. Landmark presence and visibility evaluation
    if (!landmarks || landmarks.length < 17) {
      return this.handleMissingPose(timestamp)
    }

    // MediaPipe key landmarks:
    // 0: nose, 11: left_shoulder, 12: right_shoulder, 23: left_hip, 24: right_hip
    // 13: left_elbow, 14: right_elbow, 15: left_wrist, 16: right_wrist
    // 25: left_knee, 26: right_knee, 27: left_ankle, 28: right_ankle
    const ls = landmarks[11]
    const rs = landmarks[12]
    const lh = landmarks[23]
    const rh = landmarks[24]

    // Validate key torso landmarks
    const keyTorsoPoints = [ls, rs, lh, rh]
    const validTorsoCount = keyTorsoPoints.filter(
      (p) => p && (p.visibility === undefined || p.visibility > 0.4),
    ).length

    if (validTorsoCount < 3) {
      return this.handleMissingPose(timestamp)
    }

    this.lastPoseSeenTimestamp = timestamp

    // 2. Compute Raw and Smoothed Centers & Scale
    const shoulderCenterRaw = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 }
    const hipCenterRaw = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 }
    const torsoCenterRaw = {
      x: (shoulderCenterRaw.x + hipCenterRaw.x) / 2,
      y: (shoulderCenterRaw.y + hipCenterRaw.y) / 2,
    }

    // Body scale: torso height + shoulder width
    const torsoHeight = Math.hypot(shoulderCenterRaw.x - hipCenterRaw.x, shoulderCenterRaw.y - hipCenterRaw.y)
    const shoulderWidth = Math.hypot(ls.x - rs.x, ls.y - rs.y)
    const rawScale = Math.max(0.12, torsoHeight * 1.6 + shoulderWidth * 0.5)

    // Smooth scale with EMA
    const smoothedScale = this.prevSmoothedScale
      ? 0.85 * this.prevSmoothedScale + 0.15 * rawScale
      : rawScale
    this.prevSmoothedScale = smoothedScale

    // Smooth center with EMA to eliminate MediaPipe micro-jitter
    let smoothedCenter = torsoCenterRaw
    if (this.prevSmoothedCenter) {
      // Reject impossible teleportation artifacts (> 3x scale in 1 frame)
      const rawJump = Math.hypot(
        torsoCenterRaw.x - this.prevSmoothedCenter.x,
        torsoCenterRaw.y - this.prevSmoothedCenter.y,
      )
      if (rawJump > smoothedScale * 3.0) {
        smoothedCenter = this.prevSmoothedCenter
      } else {
        smoothedCenter = {
          x: 0.75 * torsoCenterRaw.x + 0.25 * this.prevSmoothedCenter.x,
          y: 0.75 * torsoCenterRaw.y + 0.25 * this.prevSmoothedCenter.y,
        }
      }
    }
    this.prevSmoothedCenter = smoothedCenter

    // Spine angle relative to vertical (0 = straight upright, 90 = horizontal)
    const dxSpine = shoulderCenterRaw.x - hipCenterRaw.x
    const dySpine = hipCenterRaw.y - shoulderCenterRaw.y // positive if shoulders above hips
    const spineAngleRad = Math.atan2(Math.abs(dxSpine), Math.max(0.0001, dySpine))
    const spineAngleDeg = (spineAngleRad * 180) / Math.PI

    // Tracking Quality score (0-100)
    const visibilities = landmarks
      .slice(0, 29)
      .map((p) => p.visibility ?? 0.85)
    const avgVisibility = visibilities.reduce((a, b) => a + b, 0) / (visibilities.length || 1)
    const trackingQuality = Math.min(100, Math.max(25, Math.round(avgVisibility * 100)))

    // 3. Normalized Velocities and Accelerations
    let vx = 0
    let vy = 0
    let speed = 0
    let ax = 0
    let ay = 0
    let accelMag = 0
    let limbDeformation = 0

    const prevFrame = this.history[this.history.length - 1]
    if (prevFrame) {
      const dtSec = Math.max(0.015, Math.min(0.2, (timestamp - prevFrame.timestamp) / 1000))
      vx = (smoothedCenter.x - prevFrame.torsoCenter.x) / (smoothedScale * dtSec)
      vy = (smoothedCenter.y - prevFrame.torsoCenter.y) / (smoothedScale * dtSec)
      speed = Math.sqrt(vx * vx + vy * vy)

      ax = (vx - prevFrame.velocity.vx) / dtSec
      ay = (vy - prevFrame.velocity.vy) / dtSec
      accelMag = Math.sqrt(ax * ax + ay * ay)

      // Limb deformation relative to torso center (filters out global camera motion)
      if (landmarks[15] && landmarks[16] && landmarks[27] && landmarks[28]) {
        const leftWristDist = Math.hypot(landmarks[15].x - smoothedCenter.x, landmarks[15].y - smoothedCenter.y)
        const rightWristDist = Math.hypot(landmarks[16].x - smoothedCenter.x, landmarks[16].y - smoothedCenter.y)
        const leftAnkleDist = Math.hypot(landmarks[27].x - smoothedCenter.x, landmarks[27].y - smoothedCenter.y)
        const rightAnkleDist = Math.hypot(landmarks[28].x - smoothedCenter.x, landmarks[28].y - smoothedCenter.y)
        limbDeformation = (leftWristDist + rightWristDist + leftAnkleDist + rightAnkleDist) / (smoothedScale * 4)
      }
    }

    const currentRecord: FrameLandmarkData = {
      timestamp,
      torsoCenter: smoothedCenter,
      shoulderCenter: shoulderCenterRaw,
      hipCenter: hipCenterRaw,
      bodyScale: smoothedScale,
      spineAngleDeg,
      velocity: { vx, vy, speed },
      acceleration: { ax, ay, mag: accelMag },
      limbDeformation,
      visibility: avgVisibility,
    }

    // Maintain 3.0s rolling history
    this.history.push(currentRecord)
    const cutoffTime = timestamp - this.maxHistoryDurationMs
    this.history = this.history.filter((f) => f.timestamp >= cutoffTime)

    // 4. Temporal Multi-Signal Evaluation
    return this.evaluateSafetyWithTemporalConfirmation(currentRecord, timestamp, trackingQuality)
  }

  private handleMissingPose(timestamp: number): PlayerSafetyAssessment {
    const elapsedSinceLastPose = timestamp - (this.lastPoseSeenTimestamp || timestamp)

    // Brief momentary occlusion (< 350ms): hold previous safe state smoothly
    if (elapsedSinceLastPose < 350 && this.history.length > 0) {
      return {
        status: 'SAFE',
        confidence: Math.round(this.smoothedConfidence * 0.9),
        message: 'Monitoring normally',
        eventType: null,
        timestamp,
        isPoseDetected: false,
        trackingQuality: 35,
        diagnostics: this.createEmptyDiagnostics(),
      }
    }

    // Reset candidate trigger on visibility loss
    this.candidateEvent = null

    // WAITING FOR PLAYER state (non-alert)
    return {
      status: 'WAITING_FOR_PLAYER',
      confidence: 0,
      message: 'Position the player fully inside the camera frame.',
      eventType: null,
      timestamp,
      isPoseDetected: false,
      trackingQuality: 0,
      diagnostics: this.createEmptyDiagnostics(),
    }
  }

  private evaluateSafetyWithTemporalConfirmation(
    current: FrameLandmarkData,
    timestamp: number,
    trackingQuality: number,
  ): PlayerSafetyAssessment {
    // Warmup period
    if (this.history.length < 6) {
      this.smoothedConfidence = 94
      return {
        status: 'SAFE',
        confidence: 94,
        message: 'Monitoring normally',
        eventType: null,
        timestamp,
        isPoseDetected: true,
        trackingQuality,
        diagnostics: this.createEmptyDiagnostics(current.bodyScale),
      }
    }

    // --- STEP A: COMPUTE WEIGHTED ABNORMALITY SCORE (0–100) ---

    // 1. Impact-like acceleration impulse (0–25 pts)
    // Sports sprinting/jumping naturally reaches acceleration of 5–12 scale/s^2.
    // Collision/impact creates sudden jerk spike > 20 scale/s^2.
    const impactScore = Math.min(25, Math.max(0, (current.acceleration.mag - 15) * 2.2))

    // 2. Sudden downward drop (0–25 pts)
    // Downward vertical drop over last 400ms - 800ms
    const recentDropFrames = this.history.filter((f) => f.timestamp >= timestamp - 650)
    const initialY = recentDropFrames[0]?.torsoCenter.y ?? current.torsoCenter.y
    const netVerticalDrop = (current.torsoCenter.y - initialY) / current.bodyScale
    const dropScore = Math.min(25, Math.max(0, netVerticalDrop > 0.35 && current.velocity.vy > 1.8 ? netVerticalDrop * 35 : 0))

    // 3. Unusual body orientation (0–15 pts)
    // Horizontal spine angle (> 55 degrees)
    const orientationScore = Math.min(15, Math.max(0, (current.spineAngleDeg - 45) * 0.45))

    // 4. Abrupt direction discordance (0–10 pts)
    const prevFrames = this.history.filter((f) => f.timestamp >= timestamp - 400)
    const prevSpineAngle = prevFrames[0]?.spineAngleDeg ?? current.spineAngleDeg
    const angleChange = Math.abs(current.spineAngleDeg - prevSpineAngle)
    const directionScore = Math.min(10, Math.max(0, (angleChange - 30) * 0.35))

    // 5. Post-event ground stillness / inactivity (0–20 pts)
    // Check average velocity over recent 700ms when near ground level
    const stillnessFrames = this.history.filter((f) => f.timestamp >= timestamp - 700)
    const avgRecentSpeed =
      stillnessFrames.reduce((sum, f) => sum + f.velocity.speed, 0) / (stillnessFrames.length || 1)
    const isGroundLevel = current.spineAngleDeg > 50 || current.torsoCenter.y > 0.70
    const stillnessScore = isGroundLevel && avgRecentSpeed < 0.20
      ? Math.min(20, (0.22 - avgRecentSpeed) * 100)
      : 0

    // 6. Persistent abnormal posture (0–15 pts)
    const groundFrames = this.history.filter(
      (f) => f.timestamp >= timestamp - 1200 && (f.spineAngleDeg > 50 || f.torsoCenter.y > 0.68),
    )
    const persistenceScore = groundFrames.length > 25 ? 15 : (groundFrames.length / 25) * 10

    // Combined Weighted Abnormality Score
    const rawAbnormalityScore = impactScore + dropScore + orientationScore + directionScore + stillnessScore + persistenceScore
    const abnormalityScore = Math.min(100, Math.round(rawAbnormalityScore))

    // Sports Activity Normalcy Checks
    const isUpright = current.spineAngleDeg < 38 && current.torsoCenter.y < 0.65
    const isMovingNormally = avgRecentSpeed >= 0.15 && avgRecentSpeed < 5.0
    const isAthleteActiveAndRecovered = isUpright && isMovingNormally

    // --- STEP B: TWO-STAGE TEMPORAL CONFIRMATION ---

    let temporalConfirmationStatus: 'CONFIRMED' | 'OBSERVING' | 'NO' = 'NO'
    let activeCandidateEventType: AbnormalEventType | null = null

    // 1. Check for candidate trigger initiation
    if (abnormalityScore >= 48 && !this.candidateEvent) {
      const detectedType: AbnormalEventType = impactScore > 15 ? 'possible_impact' : 'possible_fall'
      this.candidateEvent = {
        timestamp,
        eventType: detectedType,
        peakScore: abnormalityScore,
        initialY: current.torsoCenter.y,
      }
    }

    // 2. Evaluate active candidate event over temporal window (0.5s - 1.5s)
    if (this.candidateEvent) {
      const elapsedSinceCandidate = timestamp - this.candidateEvent.timestamp
      activeCandidateEventType = this.candidateEvent.eventType

      if (isAthleteActiveAndRecovered && elapsedSinceCandidate >= 400) {
        // Normal athletic recovery observed -> Clear candidate immediately!
        this.candidateEvent = null
        temporalConfirmationStatus = 'NO'
      } else if (elapsedSinceCandidate >= 600 && elapsedSinceCandidate <= 2200) {
        // In observation window: check if abnormal pattern persists or ground stillness confirms it
        if (abnormalityScore >= 52 || (isGroundLevel && avgRecentSpeed < 0.25)) {
          // Confirmed Abnormal Event!
          temporalConfirmationStatus = 'CONFIRMED'
          this.confirmedAlertTimestamp = timestamp
          const alertMessage =
            this.candidateEvent.eventType === 'possible_impact'
              ? 'Possible impact event detected. Please check the player.'
              : 'Possible abnormal movement detected. Please check the player.'

          const alertConf = Math.min(96, Math.max(88, Math.round(86 + abnormalityScore * 0.1)))
          this.confirmedAlertReason = {
            message: alertMessage,
            eventType: this.candidateEvent.eventType,
            confidence: alertConf,
          }
          this.candidateEvent = null
        } else {
          temporalConfirmationStatus = 'OBSERVING'
        }
      } else if (elapsedSinceCandidate > 2200) {
        // Window expired without confirmation
        this.candidateEvent = null
        temporalConfirmationStatus = 'NO'
      } else {
        temporalConfirmationStatus = 'OBSERVING'
      }
    }

    // --- STEP C: HYSTERESIS & ALERT HOLD HANDLING ---

    const timeSinceConfirmedAlert = timestamp - this.confirmedAlertTimestamp
    const isInAlertHold = timeSinceConfirmedAlert < this.alertHoldDurationMs

    const diagnostics: SafetyDiagnostics = {
      bodyScale: Number(current.bodyScale.toFixed(2)),
      verticalVelocity: Number(current.velocity.vy.toFixed(2)),
      verticalAcceleration: Number(current.acceleration.ay.toFixed(2)),
      movementScore: Number(avgRecentSpeed.toFixed(2)),
      impactScore: Math.round(impactScore),
      postEventStillness: Math.round(stillnessScore),
      abnormalityScore,
      temporalConfirmation: isInAlertHold ? 'CONFIRMED' : temporalConfirmationStatus,
      rawEventCandidate: activeCandidateEventType,
    }

    // If alert is confirmed and currently active
    if (this.confirmedAlertReason && isInAlertHold) {
      // If player clearly recovered upright and is actively exercising for > 1.8s
      if (isAthleteActiveAndRecovered && timeSinceConfirmedAlert > 1800) {
        this.confirmedAlertTimestamp = 0
        this.confirmedAlertReason = null
        this.smoothedConfidence = 94
        return {
          status: 'SAFE',
          confidence: 94,
          message: 'Monitoring normally',
          eventType: null,
          timestamp,
          isPoseDetected: true,
          trackingQuality,
          diagnostics,
        }
      }

      this.smoothedConfidence = Math.round(
        0.85 * this.smoothedConfidence + 0.15 * this.confirmedAlertReason.confidence,
      )

      return {
        status: 'ATTENTION_REQUIRED',
        confidence: this.smoothedConfidence,
        message: this.confirmedAlertReason.message,
        eventType: this.confirmedAlertReason.eventType,
        timestamp,
        isPoseDetected: true,
        trackingQuality,
        diagnostics,
      }
    }

    // Normal athletic movement state (Running, sprinting, jumping, crouching, turning)
    const baseSafeConfidence = Math.min(98, Math.max(90, Math.round(trackingQuality * 0.95 + 4)))
    this.smoothedConfidence = Math.round(0.9 * this.smoothedConfidence + 0.1 * baseSafeConfidence)

    return {
      status: 'SAFE',
      confidence: this.smoothedConfidence,
      message: 'Monitoring normally',
      eventType: null,
      timestamp,
      isPoseDetected: true,
      trackingQuality,
      diagnostics,
    }
  }

  private createEmptyDiagnostics(scale = 0.35): SafetyDiagnostics {
    return {
      bodyScale: Number(scale.toFixed(2)),
      verticalVelocity: 0,
      verticalAcceleration: 0,
      movementScore: 0,
      impactScore: 0,
      postEventStillness: 0,
      abnormalityScore: 0,
      temporalConfirmation: 'NO',
      rawEventCandidate: null,
    }
  }
}
