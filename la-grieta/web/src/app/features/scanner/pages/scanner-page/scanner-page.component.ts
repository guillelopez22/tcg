import { Component, OnInit, OnDestroy, ViewChild, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { ScannerService, ScanState, ScannedCard, ScanResponse } from '../../../../core/services/scanner.service';
import { CollectionsService } from '../../../../core/services/collections.service';
import { CameraComponent, CapturedImage } from '../../components/camera/camera.component';
import { ScanResultComponent } from '../../components/scan-result/scan-result.component';
import { BulkQueueComponent } from '../../components/bulk-queue/bulk-queue.component';
import { AddCardsModalComponent, AddCardsModalData } from '../../../collections/components/add-cards-modal/add-cards-modal.component';
import { Card, AddCardToCollectionDto } from '@la-grieta/shared';

@Component({
  selector: 'lg-scanner-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatDialogModule,
    CameraComponent,
    ScanResultComponent,
    BulkQueueComponent
  ],
  template: `
    <div class="scanner-page fixed inset-0 bg-black z-50 flex flex-col">
      <!-- Top Control Bar -->
      <div class="scanner-top-bar fixed top-0 left-0 right-0 z-50 bg-black/75 backdrop-blur-sm h-16 px-4 flex items-center justify-between safe-area-top">
        <!-- Close Button -->
        <button
          mat-icon-button
          class="text-white"
          (click)="closeScanner()"
          aria-label="Close scanner"
        >
          <mat-icon class="!text-2xl">close</mat-icon>
        </button>

        <!-- Title -->
        <h2 class="text-white font-semibold text-lg font-heading">
          {{ bulkMode() ? 'Bulk Scan' : 'Scan Card' }}
        </h2>

        <!-- Right Controls -->
        <div class="flex gap-1">
          <!-- Auto-Scan Toggle -->
          @if (cameraComponent?.cameraReady()) {
            <button
              mat-icon-button
              class="text-white"
              [class.text-green-400]="autoScanEnabled()"
              (click)="toggleAutoScan()"
              aria-label="Toggle auto-scan"
              [attr.aria-pressed]="autoScanEnabled()"
            >
              <mat-icon class="!text-2xl">
                {{ autoScanEnabled() ? 'motion_photos_auto' : 'motion_photos_off' }}
              </mat-icon>
            </button>
          }

          <!-- Flash Toggle -->
          @if (cameraComponent?.cameraReady()) {
            <button
              mat-icon-button
              class="text-white"
              [class.text-amber-400]="flashEnabled()"
              (click)="toggleFlash()"
              aria-label="Toggle flash"
              [attr.aria-pressed]="flashEnabled()"
            >
              <mat-icon class="!text-2xl">
                {{ flashEnabled() ? 'flash_on' : 'flash_off' }}
              </mat-icon>
            </button>
          }

          <!-- Help Button -->
          <button
            mat-icon-button
            class="text-white"
            (click)="showHelp()"
            aria-label="Scanning help"
          >
            <mat-icon class="!text-2xl">help_outline</mat-icon>
          </button>
        </div>
      </div>

      <!-- Processing Progress Bar -->
      @if (scannerService.scanState() === 'processing') {
        <mat-progress-bar
          mode="indeterminate"
          color="accent"
          class="fixed top-16 left-0 right-0 z-50"
        ></mat-progress-bar>
      }

      <!-- Camera Viewfinder -->
      <div class="flex-1 relative mt-16 mb-24">
        <lg-camera
          #cameraComponent
          [autoScanEnabled]="autoScanEnabled"
          (imageCaptured)="onImageCaptured($event)"
          (autoScanTriggered)="onAutoScanTriggered($event)"
          (cameraError)="onCameraError($event)"
          (permissionChange)="onPermissionChange($event)"
        ></lg-camera>

        <!-- Guidance Text Overlay -->
        <div class="guidance-text absolute bottom-8 left-0 right-0 text-center z-40">
          <div class="inline-block bg-black/75 backdrop-blur-sm px-6 py-3 rounded-full">
            <p class="text-white text-sm font-semibold">
              {{ guidanceText() }}
            </p>
          </div>
        </div>
      </div>

      <!-- Bottom Control Bar -->
      <div class="scanner-bottom-bar fixed bottom-0 left-0 right-0 z-50 bg-black/75 backdrop-blur-sm h-24 px-6 flex items-center justify-center safe-area-bottom">
        <div class="flex items-center gap-8">
          <!-- Gallery Button -->
          <button
            mat-mini-fab
            class="bg-white/20 hover:bg-white/30"
            (click)="openGallery()"
            aria-label="Upload from gallery"
          >
            <mat-icon class="text-white">photo_library</mat-icon>
          </button>

          <!-- Capture Button -->
          <button
            class="capture-button w-20 h-20 rounded-full border-4 border-white bg-amber-500 shadow-2xl hover:scale-105 active:scale-95 transition-transform duration-150 flex items-center justify-center disabled:opacity-50"
            [disabled]="!canCapture()"
            (click)="captureImage()"
            aria-label="Capture card photo"
          >
            <div
              class="inner-circle w-16 h-16 rounded-full bg-white"
              [class.animate-pulse]="scannerService.scanState() === 'processing'"
            ></div>
          </button>

          <!-- Flip Camera Button -->
          @if (cameraComponent?.hasMultipleCameras()) {
            <button
              mat-mini-fab
              class="bg-white/20 hover:bg-white/30"
              (click)="flipCamera()"
              aria-label="Flip camera"
            >
              <mat-icon class="text-white">flip_camera_ios</mat-icon>
            </button>
          } @else {
            <div class="w-10"></div>
          }
        </div>
      </div>

      <!-- Bulk Queue Indicator -->
      @if (bulkMode() && scannerService.queueCount() > 0) {
        <lg-bulk-queue
          #bulkQueueComponent
          [queue]="scannerService.bulkQueue()"
          (onEditItem)="editQueueItem($event)"
          (onRemoveItem)="removeFromQueue($event)"
          (onAddAll)="addAllToCollection($event)"
          (onContinueScan)="continueBulkScan()"
        ></lg-bulk-queue>
      }

      <!-- Scan Result Modal -->
      @if (showResult()) {
        <div class="result-overlay fixed inset-0 bg-black/90 z-50 flex items-end sm:items-center justify-center">
          <div class="result-card bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-6 pb-8 max-h-[90vh] overflow-y-auto">
            <lg-scan-result
              #scanResultComponent
              [result]="scannerService.currentResult()"
              [mode]="bulkMode() ? 'bulk' : 'single'"
              (onAddToCollection)="handleAddToCollection($event)"
              (onAddToQueue)="handleAddToQueue($event)"
              (onScanAnother)="scanAnother()"
              (onManualEntry)="openManualEntry()"
              (onReportWrong)="reportWrongCard()"
              (onClose)="closeResult()"
            ></lg-scan-result>
          </div>
        </div>
      }

      <!-- Bulk Mode Prompt -->
      @if (showBulkPrompt()) {
        <div class="bulk-prompt-overlay fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div class="bg-white rounded-2xl w-full max-w-md p-6 animate-scale-in">
            <div class="flex items-start gap-3 mb-4">
              <mat-icon class="text-purple-600 !text-3xl">inventory_2</mat-icon>
              <div class="flex-1">
                <h4 class="font-semibold text-gray-900 mb-1">
                  Scanning Multiple Cards?
                </h4>
                <p class="text-sm text-gray-600">
                  Enable bulk mode to scan and review multiple cards before adding them to your collection.
                </p>
              </div>
              <button mat-icon-button (click)="dismissBulkPrompt()" aria-label="Dismiss">
                <mat-icon class="text-gray-400">close</mat-icon>
              </button>
            </div>
            <div class="flex gap-3">
              <button
                mat-stroked-button
                class="flex-1"
                (click)="dismissBulkPrompt()"
              >
                Single Scan
              </button>
              <button
                mat-raised-button
                color="primary"
                class="flex-1"
                (click)="enableBulkMode()"
              >
                <mat-icon>playlist_add</mat-icon>
                Enable Bulk Mode
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Help Modal -->
      @if (showHelpModal()) {
        <div class="help-overlay fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" (click)="showHelpModal.set(false)">
          <div class="bg-white rounded-2xl w-full max-w-md p-6" (click)="$event.stopPropagation()">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-xl font-heading font-bold">Scanning Tips</h3>
              <button mat-icon-button (click)="showHelpModal.set(false)">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <div class="space-y-4">
              <div class="flex items-start gap-3">
                <mat-icon class="text-green-500">motion_photos_auto</mat-icon>
                <div>
                  <h4 class="font-semibold">Auto-Scan</h4>
                  <p class="text-sm text-gray-600">Hold your card steady and it will scan automatically. The frame turns green when ready.</p>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <mat-icon class="text-amber-500">wb_sunny</mat-icon>
                <div>
                  <h4 class="font-semibold">Good Lighting</h4>
                  <p class="text-sm text-gray-600">Use bright, even lighting. Avoid harsh shadows or glare.</p>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <mat-icon class="text-amber-500">center_focus_strong</mat-icon>
                <div>
                  <h4 class="font-semibold">Center the Card</h4>
                  <p class="text-sm text-gray-600">Fill the frame with the card, keeping it within the guide.</p>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <mat-icon class="text-amber-500">pan_tool</mat-icon>
                <div>
                  <h4 class="font-semibold">Hold Steady</h4>
                  <p class="text-sm text-gray-600">Keep your phone stable to avoid blur.</p>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <mat-icon class="text-amber-500">palette</mat-icon>
                <div>
                  <h4 class="font-semibold">Plain Background</h4>
                  <p class="text-sm text-gray-600">Use a solid, contrasting background color.</p>
                </div>
              </div>
            </div>
            <div class="mt-6">
              <button mat-raised-button color="primary" class="w-full" (click)="showHelpModal.set(false)">
                Got it!
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Hidden file input for gallery -->
      <input
        #fileInput
        type="file"
        accept="image/*"
        class="hidden"
        (change)="onFileSelected($event)"
      />

      <!-- Screen reader announcements -->
      <div aria-live="polite" aria-atomic="true" class="sr-only">
        {{ announcement() }}
      </div>
    </div>
  `,
  styles: [`
    .safe-area-top {
      padding-top: env(safe-area-inset-top, 0);
    }

    .safe-area-bottom {
      padding-bottom: env(safe-area-inset-bottom, 0);
    }

    @keyframes scale-in {
      from {
        transform: scale(0.9);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }

    .animate-scale-in {
      animation: scale-in 200ms ease-out;
    }
  `]
})
export class ScannerPageComponent implements OnInit, OnDestroy {
  @ViewChild('cameraComponent') cameraComponent!: CameraComponent;
  @ViewChild('scanResultComponent') scanResultComponent!: ScanResultComponent;
  @ViewChild('bulkQueueComponent') bulkQueueComponent!: BulkQueueComponent;
  @ViewChild('fileInput') fileInput!: { nativeElement: HTMLInputElement };

  // State signals
  bulkMode = signal(false);
  showResult = signal(false);
  showBulkPrompt = signal(false);
  showHelpModal = signal(false);
  flashEnabled = signal(false);
  autoScanEnabled = signal(true); // Auto-scan enabled by default
  announcement = signal('');
  private bulkPromptDismissed = signal(false);
  private successCount = signal(0);
  private activeCollectionId = signal<string | null>(null);

  constructor(
    public scannerService: ScannerService,
    private collectionsService: CollectionsService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Check scanner status
    this.scannerService.getStatus().subscribe();

    // Get active collection from query params or use first collection
    this.collectionsService.loadCollections().subscribe({
      next: (collections) => {
        if (collections.length > 0) {
          this.activeCollectionId.set(collections[0].id);
        }
      }
    });
  }

  ngOnDestroy(): void {
    // Clean up camera resources
    this.cameraComponent?.releaseCamera();
  }

  /**
   * Computed guidance text based on scan state and auto-scan state
   */
  guidanceText = () => {
    const state = this.scannerService.scanState();
    switch (state) {
      case 'capturing':
        return 'Hold still...';
      case 'processing':
        return 'Analyzing card...';
      case 'success':
        return 'Card found!';
      case 'partial_match':
        return 'Multiple matches found';
      case 'no_match':
        return 'Card not recognized';
      case 'error':
        return 'Scan failed';
      default:
        // Show auto-scan aware guidance when idle
        if (this.autoScanEnabled() && this.cameraComponent?.cameraReady()) {
          const autoState = this.cameraComponent?.autoScanState();
          switch (autoState) {
            case 'detecting':
              return 'Card detected, hold steady...';
            case 'stable':
              return 'Almost ready...';
            case 'ready':
              return 'Scanning automatically...';
            case 'cooldown':
              return 'Preparing for next scan...';
            default:
              return 'Position card in frame (auto-scan on)';
          }
        }
        return 'Center card within frame';
    }
  };

  /**
   * Check if capture is allowed
   */
  canCapture = () => {
    const state = this.scannerService.scanState();
    return this.cameraComponent?.cameraReady() &&
           state !== 'capturing' &&
           state !== 'processing';
  };

  /**
   * Capture image from camera (manual button)
   */
  async captureImage(): Promise<void> {
    if (!this.canCapture()) return;

    // Pause auto-scan during manual capture
    this.cameraComponent?.pauseAutoScan();

    this.scannerService.setCapturing();
    this.cameraComponent.setProcessing(true);

    const image = await this.cameraComponent.captureImage();
    if (image) {
      this.scanCard(image);
    } else {
      this.scannerService.resetScanState();
      this.cameraComponent.setProcessing(false);
      // Resume auto-scan if capture failed
      if (this.autoScanEnabled()) {
        this.cameraComponent?.resumeAutoScan();
      }
    }
  }

  /**
   * Handle captured image
   */
  onImageCaptured(image: CapturedImage): void {
    // Image capture handled in captureImage method
  }

  /**
   * Scan the captured image
   */
  private scanCard(image: CapturedImage): void {
    this.scannerService.scanCard(image.base64, image.mimeType).subscribe({
      next: (response) => {
        this.cameraComponent.setProcessing(false);
        this.handleScanResult(response);
      },
      error: () => {
        this.cameraComponent.setProcessing(false);
        this.snackBar.open('Scan failed. Please try again.', 'Close', { duration: 3000 });
      }
    });
  }

  /**
   * Handle scan result
   */
  private handleScanResult(response: ScanResponse): void {
    // Pause auto-scan while showing results
    this.cameraComponent?.pauseAutoScan();

    if (response.success && response.match) {
      this.showResult.set(true);
      this.successCount.set(this.successCount() + 1);

      // Show bulk mode prompt after first success
      if (this.successCount() === 1 && !this.bulkPromptDismissed() && !this.bulkMode()) {
        // Delay to show after result modal
        setTimeout(() => {
          if (!this.bulkMode()) {
            this.showBulkPrompt.set(true);
          }
        }, 500);
      }

      this.announce('Card found: ' + response.match.card.name);
    } else {
      this.showResult.set(true);
      this.announce('Card not recognized. Try again or add manually.');
    }
  }

  /**
   * Handle add to collection (single mode)
   */
  handleAddToCollection(data: { card: Card; quantity: number; condition: string }): void {
    if (!this.activeCollectionId()) {
      this.snackBar.open('Please select a collection first', 'Close', { duration: 3000 });
      this.scanResultComponent?.setAdding(false);
      return;
    }

    const dto: AddCardToCollectionDto = {
      cardId: data.card.id,
      quantity: data.quantity,
      condition: data.condition
    };

    this.collectionsService.addCardToCollection(this.activeCollectionId()!, dto).subscribe({
      next: () => {
        this.snackBar.open(`Added ${data.card.name} to collection`, 'Close', { duration: 3000 });
        this.scanResultComponent?.setAdding(false);
        this.closeResult();
        this.scanAnother();
      },
      error: (err) => {
        this.snackBar.open(err.error?.message || 'Failed to add card', 'Close', { duration: 3000 });
        this.scanResultComponent?.setAdding(false);
      }
    });
  }

  /**
   * Handle add to queue (bulk mode)
   */
  handleAddToQueue(data: { card: Card; quantity: number; condition: string; confidence: number }): void {
    this.scannerService.addToQueue(data.card, data.quantity, data.condition, data.confidence);
    this.snackBar.open(`Added to queue (${this.scannerService.queueCount()} cards)`, 'Close', { duration: 2000 });
    this.closeResult();
    this.scanAnother();
  }

  /**
   * Add all queued cards to collection
   */
  addAllToCollection(queue: ScannedCard[]): void {
    if (!this.activeCollectionId()) {
      this.snackBar.open('Please select a collection first', 'Close', { duration: 3000 });
      return;
    }

    this.bulkQueueComponent?.setAdding(true);

    // Add cards one by one (could be optimized with bulk API endpoint)
    let added = 0;
    const total = queue.length;

    const addNext = (index: number) => {
      if (index >= queue.length) {
        this.bulkQueueComponent?.setAdding(false);
        this.scannerService.clearQueue();
        this.snackBar.open(`Added ${added} cards to collection`, 'Close', { duration: 3000 });
        this.closeScanner();
        return;
      }

      const item = queue[index];
      const dto: AddCardToCollectionDto = {
        cardId: item.card.id,
        quantity: item.quantity,
        condition: item.condition
      };

      this.collectionsService.addCardToCollection(this.activeCollectionId()!, dto).subscribe({
        next: () => {
          added++;
          addNext(index + 1);
        },
        error: () => {
          // Continue even if one fails
          addNext(index + 1);
        }
      });
    };

    addNext(0);
  }

  /**
   * Edit queue item
   */
  editQueueItem(index: number): void {
    // Could open a modal to edit quantity/condition
    // For now, just show the bulk queue expanded
    this.bulkQueueComponent?.expand();
  }

  /**
   * Remove item from queue
   */
  removeFromQueue(index: number): void {
    this.scannerService.removeFromQueue(index);
  }

  /**
   * Continue bulk scanning
   */
  continueBulkScan(): void {
    this.bulkQueueComponent?.collapse();
    this.scanAnother();
  }

  /**
   * Scan another card
   */
  scanAnother(): void {
    this.showResult.set(false);
    this.scannerService.resetScanState();
    this.scanResultComponent?.resetState();

    // Resume auto-scan if enabled
    if (this.autoScanEnabled()) {
      this.cameraComponent?.resumeAutoScan();
    }
  }

  /**
   * Close result modal
   */
  closeResult(): void {
    this.showResult.set(false);
    this.scannerService.resetScanState();
    this.scanResultComponent?.resetState();

    // Resume auto-scan if enabled
    if (this.autoScanEnabled()) {
      this.cameraComponent?.resumeAutoScan();
    }
  }

  /**
   * Open manual entry dialog
   */
  openManualEntry(): void {
    this.closeResult();

    if (!this.activeCollectionId()) {
      this.snackBar.open('Please select a collection first', 'Close', { duration: 3000 });
      return;
    }

    const dialogRef = this.dialog.open(AddCardsModalComponent, {
      width: '500px',
      maxWidth: '95vw',
      data: { collectionId: this.activeCollectionId() } as AddCardsModalData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.snackBar.open('Card added successfully', 'Close', { duration: 3000 });
      }
    });
  }

  /**
   * Report wrong card match
   */
  reportWrongCard(): void {
    this.snackBar.open('Thanks for the feedback! We\'ll improve our matching.', 'Close', { duration: 3000 });
    this.scanAnother();
  }

  /**
   * Enable bulk scanning mode
   */
  enableBulkMode(): void {
    this.bulkMode.set(true);
    this.showBulkPrompt.set(false);
    this.snackBar.open('Bulk mode enabled', 'Close', { duration: 2000 });
  }

  /**
   * Dismiss bulk mode prompt
   */
  dismissBulkPrompt(): void {
    this.showBulkPrompt.set(false);
    this.bulkPromptDismissed.set(true);
  }

  /**
   * Toggle auto-scan
   */
  toggleAutoScan(): void {
    const newValue = !this.autoScanEnabled();
    this.autoScanEnabled.set(newValue);

    if (newValue) {
      this.cameraComponent?.startAutoScanDetection();
      this.snackBar.open('Auto-scan enabled', 'Close', { duration: 2000 });
    } else {
      this.cameraComponent?.stopAutoScanDetection();
      this.snackBar.open('Auto-scan disabled', 'Close', { duration: 2000 });
    }
  }

  /**
   * Handle auto-scan triggered capture
   */
  onAutoScanTriggered(image: CapturedImage): void {
    // Pause auto-scan while processing
    this.cameraComponent?.pauseAutoScan();

    this.scannerService.setCapturing();
    this.cameraComponent.setProcessing(true);
    this.scanCard(image);
  }

  /**
   * Toggle flash
   */
  async toggleFlash(): Promise<void> {
    await this.cameraComponent?.toggleFlash();
    this.flashEnabled.set(!this.flashEnabled());
  }

  /**
   * Flip camera
   */
  async flipCamera(): Promise<void> {
    await this.cameraComponent?.flipCamera();
  }

  /**
   * Open gallery for file upload
   */
  openGallery(): void {
    this.fileInput?.nativeElement?.click();
  }

  /**
   * Handle file selected from gallery
   */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Read file as base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).replace(/^data:image\/\w+;base64,/, '');
      const mimeType = file.type || 'image/jpeg';

      this.scannerService.setCapturing();
      this.scannerService.scanCard(base64, mimeType).subscribe({
        next: (response) => {
          this.handleScanResult(response);
        },
        error: () => {
          this.snackBar.open('Failed to scan image', 'Close', { duration: 3000 });
        }
      });
    };
    reader.readAsDataURL(file);

    // Reset input
    input.value = '';
  }

  /**
   * Show help modal
   */
  showHelp(): void {
    this.showHelpModal.set(true);
  }

  /**
   * Handle camera error
   */
  onCameraError(error: string): void {
    this.announce(error);
  }

  /**
   * Handle permission change
   */
  onPermissionChange(granted: boolean): void {
    if (granted) {
      this.announce('Camera ready');
    } else {
      this.announce('Camera access denied');
    }
  }

  /**
   * Close scanner and return
   */
  closeScanner(): void {
    this.cameraComponent?.releaseCamera();
    this.router.navigate(['/collections']);
  }

  /**
   * Make screen reader announcement
   */
  private announce(message: string): void {
    this.announcement.set(message);
  }

  /**
   * Keyboard shortcuts
   */
  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.showResult()) {
        this.closeResult();
      } else if (this.showHelpModal()) {
        this.showHelpModal.set(false);
      } else {
        this.closeScanner();
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      if (!this.showResult() && this.canCapture()) {
        event.preventDefault();
        this.captureImage();
      }
    } else if (event.key === 'r' || event.key === 'R') {
      if (this.showResult()) {
        event.preventDefault();
        this.scanAnother();
      }
    }
  }
}
