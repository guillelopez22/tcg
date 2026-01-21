import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  Output,
  EventEmitter,
  signal,
  computed,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

export interface CapturedImage {
  base64: string;
  mimeType: string;
  width: number;
  height: number;
}

@Component({
  selector: 'lg-camera',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  template: `
    <div class="camera-container relative w-full h-full bg-black overflow-hidden">
      <!-- Video Stream -->
      <video
        #videoElement
        [class.hidden]="!cameraReady()"
        class="w-full h-full object-cover"
        autoplay
        playsinline
        muted
      ></video>

      <!-- Canvas for capture (hidden) -->
      <canvas #canvasElement class="hidden"></canvas>

      <!-- Card Alignment Guide Overlay -->
      <div class="card-guide absolute inset-0 pointer-events-none flex items-center justify-center">
        <!-- Dimmed background around guide -->
        <div class="absolute inset-0 bg-black/40"></div>

        <!-- Card frame cutout - 70% width, 2:3 aspect ratio -->
        <div class="card-frame relative z-10 w-[70%] max-w-[280px] aspect-[2/3] border-4 border-white rounded-lg shadow-2xl">
          <!-- Corner brackets -->
          <div class="corner-tl absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-amber-500"></div>
          <div class="corner-tr absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-amber-500"></div>
          <div class="corner-bl absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-amber-500"></div>
          <div class="corner-br absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-amber-500"></div>

          <!-- Scanning line animation (when processing) -->
          @if (isProcessing()) {
            <div class="scan-line absolute left-0 right-0 h-1 bg-amber-500 shadow-lg shadow-amber-500/50 animate-scan-down"></div>
          }
        </div>
      </div>

      <!-- Permission Denied State -->
      @if (permissionDenied()) {
        <div class="absolute inset-0 bg-white flex flex-col items-center justify-center p-6 z-20">
          <mat-icon class="!text-8xl text-gray-300 mb-6">videocam_off</mat-icon>
          <h2 class="text-2xl font-heading font-bold text-gray-900 mb-3 text-center">
            Camera Access Required
          </h2>
          <p class="text-gray-600 text-center mb-6 max-w-md">
            La Grieta needs camera permission to scan your cards.
            Please enable camera access in your device settings.
          </p>
          <div class="space-y-3 w-full max-w-sm">
            <button
              mat-raised-button
              color="primary"
              class="w-full"
              (click)="requestPermission()"
            >
              <mat-icon>refresh</mat-icon>
              Try Again
            </button>
          </div>
        </div>
      }

      <!-- Loading State -->
      @if (!cameraReady() && !permissionDenied() && !errorMessage()) {
        <div class="absolute inset-0 flex items-center justify-center bg-gray-900 z-20">
          <div class="text-center">
            <mat-icon class="!text-6xl text-white animate-pulse mb-4">videocam</mat-icon>
            <p class="text-white">Initializing camera...</p>
          </div>
        </div>
      }

      <!-- Error State -->
      @if (errorMessage() && !permissionDenied()) {
        <div class="absolute inset-0 bg-white flex flex-col items-center justify-center p-6 z-20">
          <mat-icon class="!text-8xl text-red-300 mb-6">error_outline</mat-icon>
          <h2 class="text-xl font-heading font-bold text-gray-900 mb-3 text-center">
            Camera Error
          </h2>
          <p class="text-gray-600 text-center mb-6 max-w-md">
            {{ errorMessage() }}
          </p>
          <button
            mat-raised-button
            color="primary"
            (click)="retryCamera()"
          >
            <mat-icon>refresh</mat-icon>
            Retry
          </button>
        </div>
      }

      <!-- Flash overlay -->
      @if (showFlash()) {
        <div class="absolute inset-0 bg-white z-30 animate-flash"></div>
      }

      <!-- Screen reader announcements -->
      <div aria-live="polite" aria-atomic="true" class="sr-only">
        {{ announcement() }}
      </div>
    </div>
  `,
  styles: [`
    @keyframes scan-down {
      0% {
        top: 0;
        opacity: 1;
      }
      50% {
        opacity: 0.6;
      }
      100% {
        top: calc(100% - 4px);
        opacity: 1;
      }
    }

    .animate-scan-down {
      animation: scan-down 2s ease-in-out infinite;
    }

    @keyframes flash {
      0% {
        opacity: 0;
      }
      50% {
        opacity: 0.8;
      }
      100% {
        opacity: 0;
      }
    }

    .animate-flash {
      animation: flash 150ms ease-out forwards;
    }
  `]
})
export class CameraComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

  @Output() imageCaptured = new EventEmitter<CapturedImage>();
  @Output() cameraError = new EventEmitter<string>();
  @Output() permissionChange = new EventEmitter<boolean>();

  // State signals
  private cameraReadySignal = signal(false);
  private permissionDeniedSignal = signal(false);
  private errorMessageSignal = signal<string | null>(null);
  private flashEnabledSignal = signal(false);
  private showFlashSignal = signal(false);
  private isProcessingSignal = signal(false);
  private announcementSignal = signal('');
  private hasMultipleCamerasSignal = signal(false);
  private facingModeSignal = signal<'user' | 'environment'>('environment');

  // Public readonly signals
  readonly cameraReady = this.cameraReadySignal.asReadonly();
  readonly permissionDenied = this.permissionDeniedSignal.asReadonly();
  readonly errorMessage = this.errorMessageSignal.asReadonly();
  readonly flashEnabled = this.flashEnabledSignal.asReadonly();
  readonly showFlash = this.showFlashSignal.asReadonly();
  readonly isProcessing = this.isProcessingSignal.asReadonly();
  readonly announcement = this.announcementSignal.asReadonly();
  readonly hasMultipleCameras = this.hasMultipleCamerasSignal.asReadonly();

  private mediaStream: MediaStream | null = null;

  // Image compression settings
  private readonly MAX_IMAGE_WIDTH = 1920;
  private readonly JPEG_QUALITY = 0.8;

  ngOnInit(): void {
    this.checkCameraAvailability();
  }

  ngOnDestroy(): void {
    this.releaseCamera();
  }

  /**
   * Check available cameras and start default camera
   */
  private async checkCameraAvailability(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      this.hasMultipleCamerasSignal.set(videoDevices.length > 1);
      await this.startCamera();
    } catch {
      await this.startCamera();
    }
  }

  /**
   * Request camera permission and start stream
   */
  async requestPermission(): Promise<void> {
    this.permissionDeniedSignal.set(false);
    this.errorMessageSignal.set(null);
    await this.startCamera();
  }

  /**
   * Retry camera initialization
   */
  async retryCamera(): Promise<void> {
    this.errorMessageSignal.set(null);
    await this.startCamera();
  }

  /**
   * Start the camera stream
   */
  private async startCamera(): Promise<void> {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: this.facingModeSignal(),
          width: { ideal: 1280 },
          height: { ideal: 720 },
          aspectRatio: { ideal: 16 / 9 }
        },
        audio: false
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Wait for video element to be available
      await this.waitForVideoElement();

      if (this.videoElement?.nativeElement) {
        this.videoElement.nativeElement.srcObject = this.mediaStream;
        await this.videoElement.nativeElement.play();
        this.cameraReadySignal.set(true);
        this.permissionChange.emit(true);
        this.announce('Camera ready, center card and press capture button');
      }
    } catch (err: unknown) {
      this.handleCameraError(err);
    }
  }

  /**
   * Wait for video element to be rendered
   */
  private waitForVideoElement(): Promise<void> {
    return new Promise((resolve) => {
      const checkElement = () => {
        if (this.videoElement?.nativeElement) {
          resolve();
        } else {
          setTimeout(checkElement, 50);
        }
      };
      checkElement();
    });
  }

  /**
   * Handle camera initialization errors
   */
  private handleCameraError(err: unknown): void {
    this.cameraReadySignal.set(false);

    const error = err as Error & { name?: string };

    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      this.permissionDeniedSignal.set(true);
      this.permissionChange.emit(false);
      this.announce('Camera access denied. Please enable camera permission.');
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      this.errorMessageSignal.set('No camera found on this device.');
      this.announce('No camera found on this device.');
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      this.errorMessageSignal.set('Camera is in use by another application.');
      this.announce('Camera is in use by another application.');
    } else {
      this.errorMessageSignal.set('Unable to access camera. Please check your device settings.');
      this.announce('Unable to access camera.');
    }

    this.cameraError.emit(this.errorMessageSignal() || 'Camera error');
  }

  /**
   * Capture current frame as image with compression
   */
  async captureImage(): Promise<CapturedImage | null> {
    if (!this.cameraReady() || !this.videoElement?.nativeElement) {
      return null;
    }

    // Show flash animation
    this.showFlashSignal.set(true);
    setTimeout(() => this.showFlashSignal.set(false), 150);

    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    // Calculate dimensions with max width constraint for compression
    const { width, height } = this.calculateCompressedDimensions(
      video.videoWidth,
      video.videoHeight
    );

    // Set canvas to compressed dimensions
    canvas.width = width;
    canvas.height = height;

    // Draw current video frame to canvas (resized)
    ctx.drawImage(video, 0, 0, width, height);

    // Convert to base64 JPEG with quality compression
    const base64 = canvas.toDataURL('image/jpeg', this.JPEG_QUALITY);
    // Remove data URI prefix
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');

    const capturedImage: CapturedImage = {
      base64: base64Data,
      mimeType: 'image/jpeg',
      width: canvas.width,
      height: canvas.height
    };

    this.imageCaptured.emit(capturedImage);
    this.announce('Image captured, processing...');

    return capturedImage;
  }

  /**
   * Calculate compressed dimensions maintaining aspect ratio
   * Limits max width to MAX_IMAGE_WIDTH (1920px)
   */
  private calculateCompressedDimensions(
    originalWidth: number,
    originalHeight: number
  ): { width: number; height: number } {
    if (originalWidth <= this.MAX_IMAGE_WIDTH) {
      return { width: originalWidth, height: originalHeight };
    }

    const aspectRatio = originalHeight / originalWidth;
    return {
      width: this.MAX_IMAGE_WIDTH,
      height: Math.round(this.MAX_IMAGE_WIDTH * aspectRatio)
    };
  }

  /**
   * Set processing state (shows scan animation)
   */
  setProcessing(processing: boolean): void {
    this.isProcessingSignal.set(processing);
  }

  /**
   * Toggle flash/torch if available
   */
  async toggleFlash(): Promise<void> {
    if (!this.mediaStream) return;

    const track = this.mediaStream.getVideoTracks()[0];
    if (!track) return;

    try {
      const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };

      if (capabilities?.torch) {
        const newFlashState = !this.flashEnabledSignal();
        await track.applyConstraints({
          advanced: [{ torch: newFlashState } as MediaTrackConstraintSet & { torch?: boolean }]
        });
        this.flashEnabledSignal.set(newFlashState);
      }
    } catch {
      // Flash/torch not supported on this device
    }
  }

  /**
   * Flip between front and back camera
   */
  async flipCamera(): Promise<void> {
    this.releaseCamera();
    this.cameraReadySignal.set(false);

    this.facingModeSignal.set(
      this.facingModeSignal() === 'environment' ? 'user' : 'environment'
    );

    await this.startCamera();
  }

  /**
   * Release camera resources
   */
  releaseCamera(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.videoElement?.nativeElement) {
      this.videoElement.nativeElement.srcObject = null;
    }

    this.cameraReadySignal.set(false);
  }

  /**
   * Make screen reader announcement
   */
  private announce(message: string): void {
    this.announcementSignal.set(message);
  }

  /**
   * Keyboard shortcuts
   */
  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'f' || event.key === 'F') {
      this.toggleFlash();
    }
  }
}
