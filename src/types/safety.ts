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
  postEventStillness: number
  abnormalityScore: number
  temporalConfirmation: 'CONFIRMED' | 'OBSERVING' | 'NO'
  rawEventCandidate?: AbnormalEventType | null
}

export interface PlayerSafetyAssessment {
  status: SafetyStatus
  confidence: number // 0 to 100 percentage
  message: string
  eventType?: AbnormalEventType | null
  timestamp: number
  isPoseDetected: boolean
  trackingQuality: number // 0 to 100 percentage
  diagnostics?: SafetyDiagnostics
}

export interface SafetyDetectionEvent {
  id: string
  athleteId?: string
  athleteName?: string
  safetyStatus: SafetyStatus
  eventType: AbnormalEventType
  message: string
  confidence: number
  detectedAt: string
}

export interface AthleteSafetySummary {
  athleteId: string
  status: SafetyStatus
  confidence: number
  message: string
  eventType?: AbnormalEventType | null
  lastUpdate: string
  isMonitoringActive: boolean
}

