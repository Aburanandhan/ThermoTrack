import { FilesetResolver, PoseLandmarker, type PoseLandmarkerResult } from '@mediapipe/tasks-vision'
import type { PoseLandmarkPoint, SafetyStatus } from '../../types/safety'

export interface SkeletonDrawOptions {
  status: SafetyStatus
  isPoseDetected: boolean
}

const POSE_CONNECTIONS: [number, number][] = [
  // Torso & Shoulders
  [11, 12], // left shoulder -> right shoulder
  [11, 23], // left shoulder -> left hip
  [12, 24], // right shoulder -> right hip
  [23, 24], // left hip -> right hip
  // Left arm
  [11, 13], // left shoulder -> left elbow
  [13, 15], // left elbow -> left wrist
  // Right arm
  [12, 14], // right shoulder -> right elbow
  [14, 16], // right elbow -> right wrist
  // Left leg
  [23, 25], // left hip -> left knee
  [25, 27], // left knee -> left ankle
  // Right leg
  [24, 26], // right hip -> right knee
  [26, 28], // right knee -> right ankle
  // Head / Neck connection
  [0, 11], // nose -> left shoulder
  [0, 12], // nose -> right shoulder
]

const KEY_LANDMARK_INDICES = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]

export class PoseEstimatorService {
  private landmarker: PoseLandmarker | null = null
  private initPromise: Promise<PoseLandmarker | null> | null = null

  public async initialize(): Promise<PoseLandmarker | null> {
    if (this.landmarker) return this.landmarker
    if (this.initPromise) return this.initPromise

    this.initPromise = (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm',
        )

        // Try GPU delegate first, fallback to CPU if WebGL is unavailable
        try {
          this.landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.45,
            minPosePresenceConfidence: 0.45,
            minTrackingConfidence: 0.45,
          })
        } catch {
          this.landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.45,
            minPosePresenceConfidence: 0.45,
            minTrackingConfidence: 0.45,
          })
        }

        return this.landmarker
      } catch (err) {
        console.error('Failed to initialize MediaPipe PoseLandmarker:', err)
        return null
      }
    })()

    return this.initPromise
  }

  public detect(
    video: HTMLVideoElement,
    timestampMs: number,
  ): PoseLandmarkPoint[] | null {
    if (!this.landmarker || video.readyState < 2) return null

    try {
      const results: PoseLandmarkerResult = this.landmarker.detectForVideo(video, timestampMs)
      if (results.landmarks && results.landmarks.length > 0 && results.landmarks[0].length > 0) {
        // Select primary tracked person (first pose)
        return results.landmarks[0].map((lm) => ({
          x: lm.x,
          y: lm.y,
          z: lm.z,
          visibility: lm.visibility,
        }))
      }
      return null
    } catch (err) {
      console.warn('Pose estimation frame detection error:', err)
      return null
    }
  }

  public drawSkeleton(
    ctx: CanvasRenderingContext2D,
    landmarks: PoseLandmarkPoint[] | null,
    width: number,
    height: number,
    options: SkeletonDrawOptions,
  ) {
    ctx.clearRect(0, 0, width, height)

    if (!landmarks || landmarks.length === 0 || !options.isPoseDetected) return

    const isSafe = options.status === 'SAFE'
    const lineColor = isSafe ? 'rgba(13, 148, 136, 0.85)' : 'rgba(239, 68, 68, 0.9)'
    const jointFill = isSafe ? '#14b8a6' : '#f87171'
    const jointStroke = '#ffffff'

    ctx.save()

    // Draw connecting lines
    ctx.lineWidth = 3
    ctx.strokeStyle = lineColor
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    for (const [startIndex, endIndex] of POSE_CONNECTIONS) {
      const p1 = landmarks[startIndex]
      const p2 = landmarks[endIndex]

      if (
        p1 &&
        p2 &&
        (p1.visibility === undefined || p1.visibility > 0.3) &&
        (p2.visibility === undefined || p2.visibility > 0.3)
      ) {
        ctx.beginPath()
        ctx.moveTo(p1.x * width, p1.y * height)
        ctx.lineTo(p2.x * width, p2.y * height)
        ctx.stroke()
      }
    }

    // Draw joint nodes
    for (const index of KEY_LANDMARK_INDICES) {
      const p = landmarks[index]
      if (p && (p.visibility === undefined || p.visibility > 0.3)) {
        const cx = p.x * width
        const cy = p.y * height
        const radius = index === 0 ? 5.5 : 4.5

        // Outer halo
        ctx.beginPath()
        ctx.arc(cx, cy, radius + 2, 0, 2 * Math.PI)
        ctx.fillStyle = isSafe ? 'rgba(13, 148, 136, 0.25)' : 'rgba(239, 68, 68, 0.3)'
        ctx.fill()

        // Inner circle
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI)
        ctx.fillStyle = jointFill
        ctx.fill()
        ctx.lineWidth = 1.5
        ctx.strokeStyle = jointStroke
        ctx.stroke()
      }
    }

    ctx.restore()
  }

  public dispose() {
    if (this.landmarker) {
      try {
        this.landmarker.close()
      } catch (err) {
        console.warn('Error closing landmarker:', err)
      }
      this.landmarker = null
    }
    this.initPromise = null
  }
}

export const poseEstimator = new PoseEstimatorService()
