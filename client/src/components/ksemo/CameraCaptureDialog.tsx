import React, { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Camera,
  SwitchCamera,
  RotateCcw,
  Check,
  X,
  Loader2,
  AlertCircle,
  Smartphone,
  Zap,
  ZapOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface CameraCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
}

export function CameraCaptureDialog({
  open,
  onOpenChange,
  onCapture,
}: CameraCaptureDialogProps) {
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment"
  );
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flashSupported, setFlashSupported] = useState(false);
  const [flashOn, setFlashOn] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeInputRef = useRef<HTMLInputElement>(null);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setFlashOn(false);
    setFlashSupported(false);
  };

  const startCamera = async (mode: "environment" | "user") => {
    stopStream();
    setIsLoading(true);
    setError(null);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError(
        "Camera stream is not supported in this browser. You can still use the system camera below."
      );
      setIsLoading(false);
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn("[CameraCaptureDialog] Video play error:", playErr);
        }
      }

      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          const caps = (track.getCapabilities?.() as any) || {};
          setFlashSupported(Boolean(caps.torch));
        } catch {
          setFlashSupported(false);
        }
      }
    } catch (err: any) {
      console.error("[CameraCaptureDialog] getUserMedia failed:", err);
      if (
        err?.name === "NotAllowedError" ||
        err?.name === "PermissionDeniedError"
      ) {
        setError(
          "Camera access permission was denied. Please enable camera access in your browser settings or use the system camera below."
        );
      } else {
        setError(
          "Could not open camera stream. You can capture a photo using your device camera below."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setCapturedImage(null);
      setCapturedBlob(null);
      startCamera(facingMode);
    } else {
      stopStream();
      setCapturedImage(null);
      setCapturedBlob(null);
    }
    return () => {
      stopStream();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  const toggleFacingMode = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  const toggleFlash = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextFlash = !flashOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextFlash }],
      });
      setFlashOn(nextFlash);
    } catch (err) {
      console.warn("[CameraCaptureDialog] Toggle torch failed:", err);
    }
  };

  const handleTakePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    canvas.toBlob(
      blob => {
        if (blob) {
          setCapturedBlob(blob);
          setCapturedImage(dataUrl);
          stopStream();
        }
      },
      "image/jpeg",
      0.92
    );

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(40);
      } catch {
        // ignore
      }
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setCapturedBlob(null);
    startCamera(facingMode);
  };

  const handleConfirm = () => {
    if (!capturedBlob) return;
    const timestamp = Date.now();
    const file = new File([capturedBlob], `ksemo-photo-${timestamp}.jpg`, {
      type: "image/jpeg",
    });
    onCapture(file);
    onOpenChange(false);
  };

  const handleNativeFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onCapture(file);
      onOpenChange(false);
    }
    e.target.value = "";
  };

  const triggerNativeCamera = () => {
    nativeInputRef.current?.click();
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Camera"
      onClick={e => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-2 backdrop-blur-xs sm:p-4"
    >
      <input
        ref={nativeInputRef}
        type="file"
        accept="image/*"
        capture={facingMode === "user" ? "user" : "environment"}
        className="sr-only hidden"
        onChange={handleNativeFileChange}
      />

      <div className="relative flex max-h-[96vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3">
          <div className="flex items-center gap-2">
            <Camera className="size-5 text-primary" />
            <h2 className="text-sm font-semibold tracking-tight text-white">
              {capturedImage
                ? "Photo Preview"
                : facingMode === "environment"
                  ? "Back Camera"
                  : "Front Camera"}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            {!capturedImage && flashSupported && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={toggleFlash}
                className="size-8 rounded-full text-zinc-300 hover:bg-zinc-800 hover:text-white"
                title={flashOn ? "Turn flash off" : "Turn flash on"}
              >
                {flashOn ? (
                  <Zap className="size-4 text-amber-400" />
                ) : (
                  <ZapOff className="size-4 text-zinc-400" />
                )}
              </Button>
            )}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="size-8 rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white"
              aria-label="Close camera"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Viewfinder / Preview area */}
        <div className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden bg-black">
          {isLoading && !capturedImage && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/80 text-zinc-300">
              <Loader2 className="size-8 animate-spin text-primary" />
              <span className="text-xs">Starting camera...</span>
            </div>
          )}

          {error && !capturedImage ? (
            <div className="flex flex-col items-center justify-center p-6 text-center text-zinc-300">
              <AlertCircle className="mb-2 size-10 text-amber-500" />
              <p className="mb-4 text-xs leading-relaxed text-zinc-300">
                {error}
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={triggerNativeCamera}
                className="gap-2 rounded-xl bg-zinc-800 text-xs text-white hover:bg-zinc-700"
              >
                <Smartphone className="size-4" />
                Open Device Camera
              </Button>
            </div>
          ) : capturedImage ? (
            <img
              src={capturedImage}
              alt="Captured photo preview"
              className="size-full object-cover"
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                "size-full object-cover",
                facingMode === "user" && "-scale-x-100"
              )}
            />
          )}
        </div>

        {/* Bottom controls */}
        <div className="flex items-center justify-around border-t border-zinc-800/80 bg-zinc-950 px-4 py-4">
          {capturedImage ? (
            <div className="flex w-full items-center justify-between gap-4 px-2">
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={handleRetake}
                className="flex-1 gap-2 rounded-2xl border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white"
              >
                <RotateCcw className="size-4" />
                Retake
              </Button>
              <Button
                type="button"
                size="default"
                onClick={handleConfirm}
                className="flex-1 gap-2 rounded-2xl bg-primary font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Check className="size-4" />
                Use Photo
              </Button>
            </div>
          ) : (
            <div className="flex w-full items-center justify-around">
              {/* Fallback to device camera button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={triggerNativeCamera}
                className="size-11 rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white"
                title="Use phone native camera app"
                aria-label="Use system camera"
              >
                <Smartphone className="size-5" />
              </Button>

              {/* Shutter button */}
              <button
                type="button"
                onClick={handleTakePhoto}
                disabled={isLoading || Boolean(error)}
                className="relative flex size-16 items-center justify-center rounded-full border-4 border-white p-1 transition-transform active:scale-95 disabled:opacity-40"
                aria-label="Take photo"
              >
                <span className="size-full rounded-full bg-white transition-opacity active:bg-zinc-200" />
              </button>

              {/* Switch camera (front/back) */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggleFacingMode}
                disabled={isLoading}
                className="size-11 rounded-full text-zinc-300 hover:bg-zinc-800 hover:text-white active:scale-95"
                title={
                  facingMode === "environment"
                    ? "Switch to Front camera"
                    : "Switch to Back camera"
                }
                aria-label="Switch camera front and back"
              >
                <SwitchCamera className="size-5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
