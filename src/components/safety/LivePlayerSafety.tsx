import {
  Activity,
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  Info,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  SwitchCamera,
  VideoOff,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PlayerSafetyDetector } from '../../lib/safety/playerSafetyDetector'
import { poseEstimator } from '../../lib/safety/poseEstimator'
import { cn } from '../../lib/cn'
import { useMonitoring } from '../../context/MonitoringContext'
import type {
  CameraState,
  PlayerSafetyAssessment,
  SafetyDetectionEvent,
} from '../../types/safety'
import type { Athlete } from '../../types/monitoring'

interface LivePlayerSafetyProps {
  athlete: Athlete
  className?: string
}

export function LivePlayerSafety({ athlete, className }: LivePlayerSafetyProps) {
  const { updateAthleteSafety } = useMonitoring()
  const [cameraState, setCameraState] = useState<CameraState>('OFF')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false)
  const [showDiagnostics, setShowDiagnostics] = useState(false)

  const [assessment, setAssessment] = useState<PlayerSafetyAssessment>({
    status: 'SAFE',
    confidence: 0,
    message: 'Camera is off',
    eventType: null,
    timestamp: 0,
    isPoseDetected: false,
    trackingQuality: 0,
  })

  const [eventHistory, setEventHistory] = useState<SafetyDetectionEvent[]>([])
  const [fps, setFps] = useState(0)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameIdRef = useRef<number | null>(null)
  const detectorRef = useRef<PlayerSafetyDetector>(new PlayerSafetyDetector())
  const frameCountRef = useRef<number>(0)
  const fpsTimerRef = useRef<number>(0)

  // Check if device has multiple video cameras (e.g. front and rear on mobile)
  useEffect(() => {
    if (navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const videoInputs = devices.filter((d) => d.kind === 'videoinput')
          setHasMultipleCameras(videoInputs.length > 1)
        })
        .catch(() => {
          setHasMultipleCameras(false)
        })
    }
  }, [])

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current)
      animFrameIdRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop()
      })
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    }

    detectorRef.current.setCameraActive(false)
    setCameraState('OFF')
    setErrorMessage(null)
    setFps(0)
    const stoppedAssessment: PlayerSafetyAssessment = {
      status: 'WAITING_FOR_PLAYER',
      confidence: 0,
      message: 'Camera is off',
      eventType: null,
      timestamp: 0,
      isPoseDetected: false,
      trackingQuality: 0,
    }
    setAssessment(stoppedAssessment)
    updateAthleteSafety(athlete.id, stoppedAssessment, false)
  }, [athlete.id, updateAthleteSafety])

  const lastSyncTimeRef = useRef<number>(0)
  const lastSyncStatusRef = useRef<string>('')

  // Main pose processing & animation frame loop
  const startProcessingLoop = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const detector = detectorRef.current
    detector.setCameraActive(true)

    const renderLoop = () => {
      if (video.readyState >= 2 && !video.paused && !video.ended) {
        // Adjust canvas dimensions to match video element
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
          }
        }

        const nowMs = performance.now()
        // FPS calculation
        frameCountRef.current++
        if (nowMs - fpsTimerRef.current >= 1000) {
          setFps(Math.round((frameCountRef.current * 1000) / (nowMs - fpsTimerRef.current)))
          frameCountRef.current = 0
          fpsTimerRef.current = nowMs
        }

        // Run MediaPipe Pose estimation on video frame
        const landmarks = poseEstimator.detect(video, nowMs)
        const currentAssessment = detector.processFrame(landmarks, nowMs)

        // Draw skeleton overlay
        const ctx = canvas.getContext('2d')
        if (ctx) {
          poseEstimator.drawSkeleton(ctx, landmarks, canvas.width, canvas.height, {
            status: currentAssessment.status,
            isPoseDetected: currentAssessment.isPoseDetected,
          })
        }

        setAssessment(currentAssessment)

        // Sync to shared MonitoringContext
        const statusKey = `${currentAssessment.status}-${currentAssessment.message}-${Math.round(currentAssessment.confidence)}`
        if (
          statusKey !== lastSyncStatusRef.current ||
          nowMs - lastSyncTimeRef.current >= 1000
        ) {
          lastSyncStatusRef.current = statusKey
          lastSyncTimeRef.current = nowMs
          updateAthleteSafety(athlete.id, currentAssessment, true)
        }

        // If newly detected attention required event with specific event type, log to history
        if (
          currentAssessment.status === 'ATTENTION_REQUIRED' &&
          currentAssessment.eventType &&
          currentAssessment.eventType !== 'visibility_issue'
        ) {
          const nowIso = new Date().toISOString()
          setEventHistory((prev) => {
            const lastEvt = prev[0]
            // Throttle duplicate event logging within 5s
            if (
              lastEvt &&
              lastEvt.eventType === currentAssessment.eventType &&
              Date.now() - new Date(lastEvt.detectedAt).getTime() < 5000
            ) {
              return prev
            }

            const newEvt: SafetyDetectionEvent = {
              id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              athleteId: athlete.id,
              athleteName: athlete.name,
              safetyStatus: 'ATTENTION_REQUIRED',
              eventType: currentAssessment.eventType!,
              message: currentAssessment.message,
              confidence: currentAssessment.confidence,
              detectedAt: nowIso,
            }
            return [newEvt, ...prev.slice(0, 9)]
          })
        }
      }

      animFrameIdRef.current = requestAnimationFrame(renderLoop)
    }

    animFrameIdRef.current = requestAnimationFrame(renderLoop)
  }, [athlete, updateAthleteSafety])

  // Initialize camera and start video stream
  const startCamera = useCallback(
    async (targetFacingMode: 'environment' | 'user' = facingMode) => {
      setErrorMessage(null)
      setCameraState('CONNECTING')

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera API is not supported in this browser.')
        }

        // Stop any active stream first
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
        }

        // Initialize Pose model in background
        await poseEstimator.initialize()

        // Request camera with constraints
        let stream: MediaStream
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: targetFacingMode },
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
              frameRate: { ideal: 30, max: 30 },
            },
            audio: false,
          })
        } catch (constraintErr) {
          console.warn('Falling back to default camera constraints:', constraintErr)
          // Fallback to basic video without facingMode constraint
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          })
        }

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setCameraState('CONNECTED')
          startProcessingLoop()
        }
      } catch (err: unknown) {
        console.error('Camera initialization error:', err)
        const name = (err as { name?: string })?.name
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setCameraState('PERMISSION_REQUIRED')
          setErrorMessage('Camera permission is required for player safety monitoring.')
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setCameraState('ERROR')
          setErrorMessage('No camera found on this device.')
        } else {
          setCameraState('ERROR')
          setErrorMessage(
            err instanceof Error ? err.message : 'Unable to connect to camera. Please try again.',
          )
        }
      }
    },
    [facingMode, startProcessingLoop],
  )

  // Toggle front/rear camera
  const toggleCameraFacingMode = useCallback(() => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(nextMode)
    if (cameraState === 'CONNECTED') {
      stopCamera()
      void startCamera(nextMode)
    }
  }, [facingMode, cameraState, stopCamera, startCamera])

  // Reset current alert
  const handleResetAlert = () => {
    detectorRef.current.reset()
    setAssessment((prev) => ({
      ...prev,
      status: 'SAFE',
      confidence: 94,
      message: 'Monitoring normally',
      eventType: null,
    }))
  }

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  const isCameraActive = cameraState === 'CONNECTED'
  const isWaitingForPlayer = isCameraActive && assessment.status === 'WAITING_FOR_PLAYER'
  const isAttentionRequired = isCameraActive && assessment.status === 'ATTENTION_REQUIRED'
  const isSafe = isCameraActive && assessment.status === 'SAFE' && assessment.isPoseDetected

  return (
    <section
      className={cn(
        'rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden transition-all',
        className,
      )}
    >
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              !isCameraActive
                ? 'bg-slate-200 text-slate-600'
                : isAttentionRequired
                  ? 'bg-red-100 text-red-600'
                  : isSafe
                    ? 'bg-teal/10 text-teal'
                    : 'bg-slate-200 text-slate-600',
            )}
          >
            {isCameraActive ? (
              isAttentionRequired ? (
                <ShieldAlert className="h-4 w-4" />
              ) : isSafe ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )
            ) : (
              <Camera className="h-4 w-4" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-navy">AI Player Safety Monitoring</h2>
              <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                PROTOTYPE
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Live posture & movement safety analysis for{' '}
              <span className="font-semibold text-navy">{athlete.name}</span> ({athlete.athleteId})
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          {hasMultipleCameras && isCameraActive ? (
            <button
              type="button"
              onClick={toggleCameraFacingMode}
              title="Switch Camera (Front/Rear)"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
            >
              <SwitchCamera className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden sm:inline">
                {facingMode === 'environment' ? 'Rear Cam' : 'Front Cam'}
              </span>
            </button>
          ) : null}

          {isCameraActive ? (
            <button
              type="button"
              onClick={stopCamera}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
            >
              <VideoOff className="h-3.5 w-3.5" />
              Stop Camera
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void startCamera(facingMode)}
              disabled={cameraState === 'CONNECTING'}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-dark disabled:opacity-60 transition-colors"
            >
              {cameraState === 'CONNECTING' ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Connecting…
                </>
              ) : (
                <>
                  <Camera className="h-3.5 w-3.5" />
                  Start Camera
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Content Body */}
      <div className="p-5">
        {/* Error Alert Box */}
        {errorMessage ? (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{errorMessage}</p>
              {cameraState === 'PERMISSION_REQUIRED' ? (
                <p className="mt-1 text-[11px] text-red-700">
                  Please allow camera access in your browser address bar permissions to enable live
                  pose tracking.
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-700 font-bold"
            >
              ×
            </button>
          </div>
        ) : null}

        {/* Layout Grid: Left Video / Skeleton & Right Safety Intelligence */}
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Left Column: Live Camera & Skeleton Overlay */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col">
            <div className="relative aspect-video w-full rounded-xl bg-slate-950 overflow-hidden shadow-inner border border-slate-800 flex items-center justify-center">
              {/* HTML5 Video element */}
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={cn(
                  'h-full w-full object-cover transition-opacity duration-300',
                  isCameraActive ? 'opacity-100' : 'opacity-0 absolute',
                )}
              />

              {/* Canvas Overlay for Pose Skeleton */}
              <canvas
                ref={canvasRef}
                className={cn(
                  'absolute inset-0 h-full w-full object-cover pointer-events-none transition-opacity duration-300',
                  isCameraActive ? 'opacity-100' : 'opacity-0',
                )}
              />

              {/* Camera OFF / Initializing Placeholder */}
              {!isCameraActive ? (
                <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400">
                  {cameraState === 'CONNECTING' ? (
                    <>
                      <div className="relative mb-3">
                        <RefreshCw className="h-10 w-10 animate-spin text-teal" />
                      </div>
                      <p className="text-sm font-semibold text-slate-200">
                        Initializing Camera & AI Pose Model…
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Setting up browser computer vision tracking
                      </p>
                    </>
                  ) : cameraState === 'PERMISSION_REQUIRED' ? (
                    <>
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-900/40 text-red-400 border border-red-700/50">
                        <VideoOff className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-semibold text-slate-200">Camera Permission Required</p>
                      <p className="mt-1 max-w-xs text-xs text-slate-400">
                        Camera access is needed to observe athlete body movement.
                      </p>
                      <button
                        type="button"
                        onClick={() => void startCamera(facingMode)}
                        className="mt-3.5 inline-flex items-center gap-1.5 rounded-lg bg-teal px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-dark"
                      >
                        Grant Permission
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                        <Camera className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-semibold text-slate-200">Camera is Offline</p>
                      <p className="mt-1 max-w-sm text-xs text-slate-400">
                        Click Start Camera to begin real-time AI safety and posture observation.
                      </p>
                      <button
                        type="button"
                        onClick={() => void startCamera(facingMode)}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-teal-dark transition-transform active:scale-98"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        Start Camera
                      </button>
                    </>
                  )}
                </div>
              ) : null}

              {/* Live Overlay Tags */}
              {isCameraActive ? (
                <>
                  {/* Top Left: Stream Status */}
                  <div className="absolute top-3 left-3 flex items-center gap-2 rounded-md bg-slate-900/80 px-2.5 py-1 backdrop-blur-xs border border-white/10 text-[11px] text-white">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    <span className="font-medium tracking-wide">LIVE VISION</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-300 font-mono text-[10px]">{fps} FPS</span>
                  </div>

                  {/* Top Right: Player Tag */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-md bg-slate-900/80 px-2.5 py-1 backdrop-blur-xs border border-white/10 text-[11px] text-white">
                    <Eye className="h-3.5 w-3.5 text-teal" />
                    <span className="font-semibold text-slate-200">{athlete.name}</span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      ({athlete.athleteId})
                    </span>
                  </div>

                  {/* Bottom Center: Skeleton tracking note */}
                  <div className="absolute bottom-2 inset-x-0 flex justify-center pointer-events-none">
                    <div className="rounded-full bg-slate-950/70 px-3 py-0.5 text-[10px] text-slate-300 backdrop-blur-xs border border-white/10">
                      {assessment.isPoseDetected ? (
                        <span className="text-emerald-300">
                          ● Tracking 1 Primary Athlete (Real-time skeleton active)
                        </span>
                      ) : (
                        <span className="text-slate-300 font-medium">
                          ⚪ Searching for athlete landmarks in frame
                        </span>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Privacy note under camera */}
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 px-1">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-teal" />
                Local browser inference · No raw video is saved or transmitted
              </span>
              <span className="font-mono text-[10px] text-slate-400 uppercase">
                {cameraState}
              </span>
            </div>
          </div>

          {/* Right Column: Coach-Facing Safety Result Card */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col justify-between space-y-4">
            {/* Primary Safety Result Banner */}
            <div
              className={cn(
                'rounded-xl border p-5 flex flex-col transition-all duration-300',
                !isCameraActive
                  ? 'border-slate-200 bg-slate-50/70 text-slate-600'
                  : isAttentionRequired
                    ? 'border-red-300 bg-red-50 text-red-950 shadow-sm animate-pulse-subtle'
                    : isSafe
                      ? 'border-emerald-200 bg-emerald-50/80 text-emerald-950 shadow-xs'
                      : 'border-slate-200 bg-slate-50/80 text-slate-800 shadow-xs',
              )}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Safety Assessment
              </p>

              {/* Status Badge */}
              <div className="mt-3 flex items-center gap-3">
                {isCameraActive ? (
                  isAttentionRequired ? (
                    <div className="flex items-center gap-2 rounded-lg bg-red-600 px-3.5 py-2 text-white shadow-xs">
                      <AlertTriangle className="h-4 w-4 text-white animate-bounce" />
                      <span className="text-base font-bold tracking-wide">ATTENTION REQUIRED</span>
                    </div>
                  ) : isSafe ? (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-white shadow-xs">
                      <span className="h-3 w-3 rounded-full bg-white animate-pulse" />
                      <span className="text-base font-bold tracking-wide">SAFE</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg bg-slate-200 border border-slate-300 px-3.5 py-2 text-slate-800 shadow-xs">
                      <span className="h-2.5 w-2.5 rounded-full bg-white border border-slate-400" />
                      <span className="text-sm font-bold tracking-wide">WAITING FOR PLAYER</span>
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-2 rounded-lg bg-slate-300 px-3 py-1.5 text-slate-700">
                    <VideoOff className="h-4 w-4" />
                    <span className="text-sm font-semibold">CAMERA OFF</span>
                  </div>
                )}
              </div>

              {/* Algorithmic Confidence */}
              <div className="mt-4 pt-3 border-t border-slate-200/60">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600">Detection Confidence</span>
                  <span className="font-semibold font-mono text-navy">
                    {isCameraActive && !isWaitingForPlayer ? `${assessment.confidence}%` : '--'}
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
                  <div
                    className={cn(
                      'h-full transition-all duration-300',
                      !isCameraActive || isWaitingForPlayer
                        ? 'bg-slate-300 w-0'
                        : isAttentionRequired
                          ? 'bg-red-500'
                          : 'bg-emerald-500',
                    )}
                    style={{
                      width: `${isCameraActive && !isWaitingForPlayer ? assessment.confidence : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Supporting Coach Message */}
              <div className="mt-4 rounded-lg bg-white/80 p-3 border border-slate-200/70 text-xs">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Live Status Detail
                </p>
                <p
                  className={cn(
                    'mt-1 font-medium',
                    !isCameraActive
                      ? 'text-slate-500'
                      : isAttentionRequired
                        ? 'text-red-800 font-semibold'
                        : isSafe
                          ? 'text-emerald-800'
                          : 'text-slate-600',
                  )}
                >
                  {isCameraActive ? assessment.message : 'Camera is currently stopped.'}
                </p>

                {isAttentionRequired ? (
                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-red-100">
                    <span className="text-[11px] text-red-600">Please check the player.</span>
                    <button
                      type="button"
                      onClick={handleResetAlert}
                      className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-200"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset Alert
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Vision Telemetry Overview Stats */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs">
              <h3 className="text-xs font-semibold text-navy flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-teal" />
                Vision System Status
              </h3>
              <dl className="mt-3 divide-y divide-slate-100 text-[11px]">
                <div className="flex justify-between py-1.5">
                  <dt className="text-slate-500">Pose Landmark Tracking</dt>
                  <dd
                    className={cn(
                      'font-semibold',
                      !isCameraActive
                        ? 'text-slate-400'
                        : assessment.isPoseDetected
                          ? 'text-emerald-600'
                          : 'text-amber-600',
                    )}
                  >
                    {isCameraActive
                      ? assessment.isPoseDetected
                        ? 'Active (1 Player)'
                        : 'Searching Frame'
                      : 'Inactive'}
                  </dd>
                </div>
                <div className="flex justify-between py-1.5">
                  <dt className="text-slate-500">Tracking Quality</dt>
                  <dd className="font-semibold text-navy">
                    {isCameraActive ? `${assessment.trackingQuality}%` : '--'}
                  </dd>
                </div>
                <div className="flex justify-between py-1.5">
                  <dt className="text-slate-500">Temporal Analysis</dt>
                  <dd className="font-semibold text-navy">
                    {isCameraActive ? 'Rolling 2.8s Window' : 'Standby'}
                  </dd>
                </div>
                <div className="flex justify-between py-1.5">
                  <dt className="text-slate-500">Camera Source</dt>
                  <dd className="font-semibold text-navy capitalize">
                    {facingMode} mode
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        {/* Prototype Diagnostics Debug Panel */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs">
          <button
            type="button"
            onClick={() => setShowDiagnostics((prev) => !prev)}
            className="flex w-full items-center justify-between font-semibold text-slate-700 hover:text-navy cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-teal" />
              <span>Prototype Diagnostics</span>
              <span className="rounded bg-teal/10 px-1.5 py-0.5 text-[10px] font-medium text-teal">
                CV TELEMETRY
              </span>
            </div>
            {showDiagnostics ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {showDiagnostics ? (
            <div className="mt-3 pt-3 border-t border-slate-200 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-[11px]">
              <div className="rounded-lg bg-white p-2.5 border border-slate-200 shadow-2xs">
                <span className="text-slate-500">Tracking Quality</span>
                <p className="mt-1 font-mono font-semibold text-navy">
                  {assessment.trackingQuality}%
                </p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-slate-200 shadow-2xs">
                <span className="text-slate-500">Body Scale (Torso)</span>
                <p className="mt-1 font-mono font-semibold text-navy">
                  {assessment.diagnostics?.bodyScale ?? '--'}
                </p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-slate-200 shadow-2xs">
                <span className="text-slate-500">Vertical Velocity</span>
                <p className="mt-1 font-mono font-semibold text-navy">
                  {assessment.diagnostics?.verticalVelocity ?? 0} scale/s
                </p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-slate-200 shadow-2xs">
                <span className="text-slate-500">Vertical Acceleration</span>
                <p className="mt-1 font-mono font-semibold text-navy">
                  {assessment.diagnostics?.verticalAcceleration ?? 0} scale/s²
                </p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-slate-200 shadow-2xs">
                <span className="text-slate-500">Movement Score</span>
                <p className="mt-1 font-mono font-semibold text-navy">
                  {assessment.diagnostics?.movementScore ?? 0}
                </p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-slate-200 shadow-2xs">
                <span className="text-slate-500">Impact Score</span>
                <p className="mt-1 font-mono font-semibold text-navy">
                  {assessment.diagnostics?.impactScore ?? 0} / 25
                </p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-slate-200 shadow-2xs">
                <span className="text-slate-500">Post-Event Stillness</span>
                <p className="mt-1 font-mono font-semibold text-navy">
                  {assessment.diagnostics?.postEventStillness ?? 0} / 20
                </p>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-slate-200 shadow-2xs">
                <span className="text-slate-500">Abnormality Score</span>
                <div className="mt-1 flex items-center justify-between">
                  <p
                    className={cn(
                      'font-mono font-semibold',
                      (assessment.diagnostics?.abnormalityScore ?? 0) >= 50
                        ? 'text-red-600'
                        : 'text-emerald-600',
                    )}
                  >
                    {assessment.diagnostics?.abnormalityScore ?? 0} / 100
                  </p>
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                      assessment.diagnostics?.temporalConfirmation === 'CONFIRMED'
                        ? 'bg-red-100 text-red-700'
                        : assessment.diagnostics?.temporalConfirmation === 'OBSERVING'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-50 text-emerald-700',
                    )}
                  >
                    {assessment.diagnostics?.temporalConfirmation ?? 'NO'}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Recent Abnormal Events Log for this session */}
        {eventHistory.length > 0 ? (
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-navy">
                Recent Safety Events (Session History)
              </p>
              <button
                type="button"
                onClick={() => setEventHistory([])}
                className="text-[11px] text-slate-400 hover:text-slate-600"
              >
                Clear Log
              </button>
            </div>
            <div className="mt-2 space-y-1.5 max-h-32 overflow-y-auto pr-1 text-xs">
              {eventHistory.map((evt) => (
                <div
                  key={evt.id}
                  className="flex items-center justify-between rounded bg-white px-3 py-1.5 border border-slate-200 text-xs shadow-2xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    <span className="font-medium text-slate-800">{evt.message}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-400 text-[11px] font-mono">
                    <span>Conf: {evt.confidence}%</span>
                    <span>{new Date(evt.detectedAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Medical Disclaimer Note */}
        <div className="mt-4 rounded-lg bg-slate-100/70 p-2.5 text-[11px] text-slate-500 leading-relaxed">
          <span className="font-semibold text-slate-600">Disclaimer: </span>
          Prototype AI monitoring. Results may vary with camera angle, lighting, distance and player
          visibility. This system does not provide medical diagnosis.
        </div>
      </div>
    </section>
  )
}
