export type SafetyStatus = 'SAFE' | 'ATTENTION_REQUIRED' | 'WAITING_FOR_PLAYER'

export type CameraState =
  | 'OFF'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'PERMISSION_REQUIRED'
  | 'ERROR'

export type AbnormalEventType =
  | 'possible_abnormal_movement'
  | 'possible_impact'
  | 'possible_fall'
  | 'visibility_issue'

export type SafetyEventState =
  | 'MONITORING'
  | 'CANDIDATE'
  | 'OBSERVING'
  | 'CONFIRMED'
  | 'COOLDOWN'

export interface PoseLandmarkPoint {
  x: number
  y: number
  z?: number
  visibility?: number
}

export interface SafetyDiagnostics {
  bodyScale: number
  verticalVelocity: number
  verticalAcceleration: number
  movementScore: number
  impactScore: number
  verticalDropScore: number
  postEventStillness: number
  abnormalityScore: number
  eventState: SafetyEventState
  cooldownRemainingSec: number
  trackingConfidence: number
  safetyEventConfidence: number
  rawEventCandidate?: AbnormalEventType | null
}

export interface PlayerSafetyAssessment {
  status: SafetyStatus
  trackingConfidence: number // 0 to 100 percentage
  safetyConfidence: number // 0 to 100 percentage
  confidence: number // general coach display percentage
  message: string
  eventType?: AbnormalEventType | null
  eventId?: string | null
  timestamp: number
  isPoseDetected: boolean
  trackingQuality: number // 0 to 100 percentage
  isNewConfirmedEvent?: boolean // true ONLY on the exact frame an event is confirmed
  diagnostics?: SafetyDiagnostics
}

export interface SafetyDetectionEvent {
  id: string
  athleteId?: string
  athleteName?: string
  safetyStatus: SafetyStatus
  eventType: AbnormalEventType
  message: string
  trackingConfidence: number
  safetyConfidence: number
  confidence: number
  detectedAt: string
}

export interface AthleteSafetySummary {
  athleteId: string
  status: SafetyStatus
  confidence: number
  trackingConfidence?: number
  safetyConfidence?: number
  message: string
  eventType?: AbnormalEventType | null
  lastUpdate: string
  isMonitoringActive: boolean
}
