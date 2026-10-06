import type {
  AbnormalEventType,
  PlayerSafetyAssessment,
  PoseLandmarkPoint,
  SafetyDiagnostics,
  SafetyEventState,
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

interface ActiveCandidate {
  id: string
  startTimestamp: number
  eventType: AbnormalEventType
  peakScore: number
  initialY: number
}

interface ConfirmedAlertRecord {
  id: string
  timestamp: number
  eventType: AbnormalEventType
  message: string
  safetyConfidence: number
}

export class PlayerSafetyDetector {
  // Configuration Constants
  public static readonly EVENT_COOLDOWN_MS = 8000 // 8 second cooldown to prevent duplicate events
  public static readonly ALERT_HOLD_DURATION_MS = 4000 // Display ATTENTION state for at least 4s
  public static readonly ROLLING_HISTORY_DURATION_MS = 3000 // 3.0 second temporal buffer
  public static readonly CANDIDATE_OBSERVE_MIN_MS = 600 // Minimum post-event observation time (0.6s)
  public static readonly CANDIDATE_OBSERVE_MAX_MS = 1800 // Maximum post-event observation window (1.8s)

  private history: FrameLandmarkData[] = []
  private isCameraActive = false

  // Smoothed internal coordinates to suppress landmark micro-jitter
  private prevSmoothedCenter: { x: number; y: number } | null = null
  private prevSmoothedScale = 0.35
  private lastPoseSeenTimestamp = 0

  // Explicit State Machine: MONITORING -> CANDIDATE -> OBSERVING -> CONFIRMED -> COOLDOWN
  private currentState: SafetyEventState = 'MONITORING'
  private activeCandidate: ActiveCandidate | null = null
  private lastConfirmedAlert: ConfirmedAlertRecord | null = null

  // Smoothed tracking confidence
  private smoothedTrackingConfidence = 94

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
    this.currentState = 'MONITORING'
    this.activeCandidate = null
    this.lastConfirmedAlert = null
    this.smoothedTrackingConfidence = 94
  }

  public processFrame(
    landmarks: PoseLandmarkPoint[] | null | undefined,
    timestamp: number = performance.now(),
  ): PlayerSafetyAssessment {
    if (!this.isCameraActive) {
      return {
        status: 'WAITING_FOR_PLAYER',
        trackingConfidence: 0,
        safetyConfidence: 0,
        confidence: 0,
        message: 'Camera is off',
        eventType: null,
        timestamp,
        isPoseDetected: false,
        trackingQuality: 0,
        isNewConfirmedEvent: false,
        diagnostics: this.createEmptyDiagnostics(timestamp),
      }
    }

    // 1. Landmark presence and visibility evaluation
    if (!landmarks || landmarks.length < 17) {
      return this.handleMissingPose(timestamp)
    }

    // Key landmarks:
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
      (p) => p && (p.visibility === undefined || p.visibility > 0.35),
    ).length

    if (validTorsoCount < 3) {
      return this.handleMissingPose(timestamp)
    }

    this.lastPoseSeenTimestamp = timestamp

    // 2. Compute Centers & Dynamic Body Scale
    const shoulderCenterRaw = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 }
    const hipCenterRaw = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 }
    const torsoCenterRaw = {
      x: (shoulderCenterRaw.x + hipCenterRaw.x) / 2,
      y: (shoulderCenterRaw.y + hipCenterRaw.y) / 2,
    }

    // Body scale: distance between shoulders and hips + shoulder width
    const torsoHeight = Math.hypot(
      shoulderCenterRaw.x - hipCenterRaw.x,
      shoulderCenterRaw.y - hipCenterRaw.y,
    )
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

    // Spine angle relative to vertical (0 = upright, 90 = horizontal)
    const dxSpine = shoulderCenterRaw.x - hipCenterRaw.x
    const dySpine = hipCenterRaw.y - shoulderCenterRaw.y
    const spineAngleRad = Math.atan2(Math.abs(dxSpine), Math.max(0.0001, dySpine))
    const spineAngleDeg = (spineAngleRad * 180) / Math.PI

    // Tracking Quality score (0-100)
    const visibilities = landmarks
      .slice(0, 29)
      .map((p) => p.visibility ?? 0.85)
    const avgVisibility = visibilities.reduce((a, b) => a + b, 0) / (visibilities.length || 1)
    const trackingQuality = Math.min(100, Math.max(25, Math.round(avgVisibility * 100)))

    // 3. Normalized Kinematics (Scale-Invariant)
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

      // Limb deformation relative to torso center (filters global camera motion)
      if (landmarks[15] && landmarks[16] && landmarks[27] && landmarks[28]) {
        const leftWristDist = Math.hypot(
          landmarks[15].x - smoothedCenter.x,
          landmarks[15].y - smoothedCenter.y,
        )
        const rightWristDist = Math.hypot(
          landmarks[16].x - smoothedCenter.x,
          landmarks[16].y - smoothedCenter.y,
        )
        const leftAnkleDist = Math.hypot(
          landmarks[27].x - smoothedCenter.x,
          landmarks[27].y - smoothedCenter.y,
        )
        const rightAnkleDist = Math.hypot(
          landmarks[28].x - smoothedCenter.x,
          landmarks[28].y - smoothedCenter.y,
        )
        limbDeformation =
          (leftWristDist + rightWristDist + leftAnkleDist + rightAnkleDist) /
          (smoothedScale * 4)
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

    // Maintain rolling temporal history
    this.history.push(currentRecord)
    const cutoffTime = timestamp - PlayerSafetyDetector.ROLLING_HISTORY_DURATION_MS
    this.history = this.history.filter((f) => f.timestamp >= cutoffTime)

    // 4. Run State Machine Evaluation
    return this.evaluateStateMachine(currentRecord, timestamp, trackingQuality)
  }

  private handleMissingPose(timestamp: number): PlayerSafetyAssessment {
    const elapsedSinceLastPose = timestamp - (this.lastPoseSeenTimestamp || timestamp)

    // Brief momentary occlusion (< 350ms): hold previous state smoothly
    if (elapsedSinceLastPose < 350 && this.history.length > 0) {
      return {
        status: 'SAFE',
        trackingConfidence: Math.round(this.smoothedTrackingConfidence * 0.85),
        safetyConfidence: 0,
        confidence: Math.round(this.smoothedTrackingConfidence * 0.85),
        message: 'Monitoring normally',
        eventType: null,
        timestamp,
        isPoseDetected: false,
        trackingQuality: 35,
        isNewConfirmedEvent: false,
        diagnostics: this.createEmptyDiagnostics(timestamp),
      }
    }

    // Clear candidate trigger on tracking loss
    if (this.currentState === 'CANDIDATE' || this.currentState === 'OBSERVING') {
      this.activeCandidate = null
      this.currentState = 'MONITORING'
    }

    // WAITING FOR PLAYER state (non-alert)
    return {
      status: 'WAITING_FOR_PLAYER',
      trackingConfidence: 0,
      safetyConfidence: 0,
      confidence: 0,
      message: 'Position the player fully inside the camera frame.',
      eventType: null,
      timestamp,
      isPoseDetected: false,
      trackingQuality: 0,
      isNewConfirmedEvent: false,
      diagnostics: this.createEmptyDiagnostics(timestamp),
    }
  }

  private evaluateStateMachine(
    current: FrameLandmarkData,
    timestamp: number,
    trackingQuality: number,
  ): PlayerSafetyAssessment {
    // Tracking confidence calculation (0-100%)
    const baseTrackingConf = Math.min(
      98,
      Math.max(85, Math.round(trackingQuality * 0.95 + 4)),
    )
    this.smoothedTrackingConfidence = Math.round(
      0.9 * this.smoothedTrackingConfidence + 0.1 * baseTrackingConf,
    )

    // Warmup period
    if (this.history.length < 6) {
      return {
        status: 'SAFE',
        trackingConfidence: this.smoothedTrackingConfidence,
        safetyConfidence: 0,
        confidence: this.smoothedTrackingConfidence,
        message: 'Monitoring normally',
        eventType: null,
        timestamp,
        isPoseDetected: true,
        trackingQuality,
        isNewConfirmedEvent: false,
        diagnostics: this.createEmptyDiagnostics(timestamp, current.bodyScale),
      }
    }

    // --- STEP 1: CALCULATE COMPONENT SCORES ---

    // A. Impact Score (0–25 pts)
    // NEVER trigger on acceleration alone!
    // Requires: high acceleration (> 20 scale/s^2) + sharp direction shift (> 40 deg) + abnormal limb deformation
    const prevFrames400 = this.history.filter((f) => f.timestamp >= timestamp - 400)
    const prevSpineAngle = prevFrames400[0]?.spineAngleDeg ?? current.spineAngleDeg
    const angleChange = Math.abs(current.spineAngleDeg - prevSpineAngle)

    let impactScore = 0
    if (current.acceleration.mag > 20 && angleChange > 35) {
      const rawImpact = (current.acceleration.mag - 20) * 1.5 + (angleChange - 35) * 0.4
      impactScore = Math.min(25, Math.max(0, rawImpact))
    }

    // B. Vertical Drop Score (0–25 pts)
    // Downward vertical drop over last 400ms - 700ms
    const recentDropFrames = this.history.filter((f) => f.timestamp >= timestamp - 650)
    const initialY = recentDropFrames[0]?.torsoCenter.y ?? current.torsoCenter.y
    const netVerticalDrop = (current.torsoCenter.y - initialY) / current.bodyScale
    let dropScore = 0
    if (netVerticalDrop > 0.40 && current.velocity.vy > 2.0) {
      dropScore = Math.min(25, Math.max(0, (netVerticalDrop - 0.40) * 45))
    }

    // C. Unusual Orientation Score (0–15 pts)
    // Near-horizontal spine angle (> 55 degrees)
    const orientationScore = Math.min(15, Math.max(0, (current.spineAngleDeg - 48) * 0.45))

    // D. Direction Discordance Score (0–10 pts)
    const directionScore = Math.min(10, Math.max(0, (angleChange - 30) * 0.35))

    // E. Post-Event Stillness / Ground Inactivity Score (0–20 pts)
    // Calculated over recent 700ms window
    const stillnessFrames = this.history.filter((f) => f.timestamp >= timestamp - 700)
    const avgRecentSpeed =
      stillnessFrames.reduce((sum, f) => sum + f.velocity.speed, 0) / (stillnessFrames.length || 1)
    const isGroundPosture = current.spineAngleDeg > 52 || current.torsoCenter.y > 0.70
    const stillnessScore =
      isGroundPosture && avgRecentSpeed < 0.18
        ? Math.min(20, Math.max(0, (0.20 - avgRecentSpeed) * 110))
        : 0

    // F. Persistent Ground State (0–15 pts)
    const groundFrames = this.history.filter(
      (f) => f.timestamp >= timestamp - 1200 && (f.spineAngleDeg > 50 || f.torsoCenter.y > 0.68),
    )
    const persistenceScore =
      groundFrames.length > 25 ? 15 : Math.round((groundFrames.length / 25) * 10)

    // Total Abnormality Score (0–100)
    const abnormalityScore = Math.min(
      100,
      Math.round(
        impactScore + dropScore + orientationScore + directionScore + stillnessScore + persistenceScore,
      ),
    )

    // Athletic Recovery Checks
    const isUpright = current.spineAngleDeg < 36 && current.torsoCenter.y < 0.65
    const isMovingNormally = avgRecentSpeed >= 0.20 && avgRecentSpeed < 5.0
    const isAthleteActiveAndRecovered = isUpright && isMovingNormally

    // --- STEP 2: COOLDOWN & STATE MACHINE TRANSITIONS ---

    let cooldownRemainingSec = 0
    if (this.lastConfirmedAlert) {
      const elapsedSinceConfirmed = timestamp - this.lastConfirmedAlert.timestamp
      if (elapsedSinceConfirmed < PlayerSafetyDetector.EVENT_COOLDOWN_MS) {
        cooldownRemainingSec = Number(
          ((PlayerSafetyDetector.EVENT_COOLDOWN_MS - elapsedSinceConfirmed) / 1000).toFixed(1),
        )
        this.currentState = 'COOLDOWN'
      } else {
        // Cooldown finished
        this.lastConfirmedAlert = null
        this.currentState = 'MONITORING'
      }
    }

    let isNewConfirmedEvent = false
    let currentEventId: string | null = null

    // If NOT in cooldown, handle MONITORING -> CANDIDATE -> OBSERVING -> CONFIRMED
    if (this.currentState !== 'COOLDOWN') {
      // 1. MONITORING -> CANDIDATE trigger
      if (this.currentState === 'MONITORING' && !this.activeCandidate) {
        // Candidate triggers ONLY on strong multi-signal event
        const isImpactCandidate = impactScore >= 16
        const isFallCandidate = dropScore >= 16 || (dropScore >= 10 && orientationScore >= 8)

        if (isImpactCandidate || isFallCandidate || abnormalityScore >= 52) {
          const detectedType: AbnormalEventType =
            isImpactCandidate ? 'possible_impact' : 'possible_fall'
          this.activeCandidate = {
            id: `cand-${Math.round(timestamp)}-${Math.random().toString(36).substring(2, 6)}`,
            startTimestamp: timestamp,
            eventType: detectedType,
            peakScore: abnormalityScore,
            initialY: current.torsoCenter.y,
          }
          this.currentState = 'OBSERVING'
        }
      }

      // 2. OBSERVING -> Evaluate candidate evidence over 0.5s – 1.8s
      if (this.activeCandidate) {
        const elapsedSinceCandidate = timestamp - this.activeCandidate.startTimestamp
        this.activeCandidate.peakScore = Math.max(this.activeCandidate.peakScore, abnormalityScore)

        if (isAthleteActiveAndRecovered && elapsedSinceCandidate >= PlayerSafetyDetector.CANDIDATE_OBSERVE_MIN_MS - 200) {
          // Normal Recovery observed! Clear candidate immediately.
          this.activeCandidate = null
          this.currentState = 'MONITORING'
        } else if (
          elapsedSinceCandidate >= PlayerSafetyDetector.CANDIDATE_OBSERVE_MIN_MS &&
          elapsedSinceCandidate <= PlayerSafetyDetector.CANDIDATE_OBSERVE_MAX_MS
        ) {
          // Check for confirmation evidence: persistent ground stillness or persistent high abnormality
          const isConfirmedByStillness = isGroundPosture && avgRecentSpeed < 0.20
          const isConfirmedBySustainedAbnormality = this.activeCandidate.peakScore >= 56 && abnormalityScore >= 45

          if (isConfirmedByStillness || isConfirmedBySustainedAbnormality) {
            // CONFIRM EVENT!
            this.currentState = 'CONFIRMED'
            isNewConfirmedEvent = true
            currentEventId = `evt-${Math.round(timestamp)}-${Math.random().toString(36).substring(2, 6)}`

            const alertMsg =
              this.activeCandidate.eventType === 'possible_impact'
                ? 'Possible impact event detected. Please check the player.'
                : 'Possible abnormal movement detected. Please check the player.'

            // Calculate Safety Event Confidence (0-100%) distinct from camera tracking confidence
            const safetyConf = Math.min(
              94,
              Math.max(65, Math.round(55 + this.activeCandidate.peakScore * 0.35 + stillnessScore * 0.5)),
            )

            this.lastConfirmedAlert = {
              id: currentEventId,
              timestamp,
              eventType: this.activeCandidate.eventType,
              message: alertMsg,
              safetyConfidence: safetyConf,
            }

            this.activeCandidate = null
            cooldownRemainingSec = Number((PlayerSafetyDetector.EVENT_COOLDOWN_MS / 1000).toFixed(1))
            this.currentState = 'COOLDOWN'
          }
        } else if (elapsedSinceCandidate > PlayerSafetyDetector.CANDIDATE_OBSERVE_MAX_MS) {
          // Window timed out without confirmed abnormality -> Clear candidate
          this.activeCandidate = null
          this.currentState = 'MONITORING'
        }
      }
    }

    // --- STEP 3: RESOLVE FINAL USER-FACING SAFETY STATUS & DIAGNOSTICS ---

    const diagnostics: SafetyDiagnostics = {
      bodyScale: Number(current.bodyScale.toFixed(2)),
      verticalVelocity: Number(current.velocity.vy.toFixed(2)),
      verticalAcceleration: Number(current.acceleration.ay.toFixed(2)),
      movementScore: Number(avgRecentSpeed.toFixed(2)),
      impactScore: Math.round(impactScore),
      verticalDropScore: Math.round(dropScore),
      postEventStillness: Math.round(stillnessScore),
      abnormalityScore,
      eventState: this.currentState,
      cooldownRemainingSec,
      trackingConfidence: this.smoothedTrackingConfidence,
      safetyEventConfidence: this.lastConfirmedAlert?.safetyConfidence ?? 0,
      rawEventCandidate: this.activeCandidate?.eventType ?? null,
    }

    // Check if active alert hold window is currently active
    if (this.lastConfirmedAlert) {
      const timeSinceAlert = timestamp - this.lastConfirmedAlert.timestamp

      // Active alert banner displays during alert hold duration (4.0s)
      if (timeSinceAlert < PlayerSafetyDetector.ALERT_HOLD_DURATION_MS) {
        // If athlete recovered upright and active after 2s, allow smooth recovery
        if (isAthleteActiveAndRecovered && timeSinceAlert > 2200) {
          return {
            status: 'SAFE',
            trackingConfidence: this.smoothedTrackingConfidence,
            safetyConfidence: this.lastConfirmedAlert.safetyConfidence,
            confidence: this.smoothedTrackingConfidence,
            message: 'Normal movement detected',
            eventType: null,
            eventId: null,
            timestamp,
            isPoseDetected: true,
            trackingQuality,
            isNewConfirmedEvent: false,
            diagnostics,
          }
        }

        return {
          status: 'ATTENTION_REQUIRED',
          trackingConfidence: this.smoothedTrackingConfidence,
          safetyConfidence: this.lastConfirmedAlert.safetyConfidence,
          confidence: this.lastConfirmedAlert.safetyConfidence,
          message: this.lastConfirmedAlert.message,
          eventType: this.lastConfirmedAlert.eventType,
          eventId: this.lastConfirmedAlert.id,
          timestamp,
          isPoseDetected: true,
          trackingQuality,
          isNewConfirmedEvent,
          diagnostics,
        }
      }
    }

    // Normal safe monitoring
    return {
      status: 'SAFE',
      trackingConfidence: this.smoothedTrackingConfidence,
      safetyConfidence: 0,
      confidence: this.smoothedTrackingConfidence,
      message: 'Normal movement detected',
      eventType: null,
      eventId: null,
      timestamp,
      isPoseDetected: true,
      trackingQuality,
      isNewConfirmedEvent: false,
      diagnostics,
    }
  }

  private createEmptyDiagnostics(timestamp = performance.now(), scale = 0.35): SafetyDiagnostics {
    let cooldownSec = 0
    if (this.lastConfirmedAlert) {
      const elapsed = timestamp - this.lastConfirmedAlert.timestamp
      if (elapsed < PlayerSafetyDetector.EVENT_COOLDOWN_MS) {
        cooldownSec = Number(
          ((PlayerSafetyDetector.EVENT_COOLDOWN_MS - elapsed) / 1000).toFixed(1),
        )
      }
    }

    return {
      bodyScale: Number(scale.toFixed(2)),
      verticalVelocity: 0,
      verticalAcceleration: 0,
      movementScore: 0,
      impactScore: 0,
      verticalDropScore: 0,
      postEventStillness: 0,
      abnormalityScore: 0,
      eventState: this.currentState,
      cooldownRemainingSec: cooldownSec,
      trackingConfidence: this.smoothedTrackingConfidence,
      safetyEventConfidence: this.lastConfirmedAlert?.safetyConfidence ?? 0,
      rawEventCandidate: this.activeCandidate?.eventType ?? null,
    }
  }
}
