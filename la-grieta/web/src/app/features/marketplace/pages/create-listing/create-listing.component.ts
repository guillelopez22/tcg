import {  Component, OnInit, signal , inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatStepperModule } from '@angular/material/stepper';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { CollectionsService } from '../../../../core/services/collections.service';
import { MarketplaceService } from '../../services/marketplace.service';
import { ShopsService } from '../../services/shops.service';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { ListingType, CARD_CONDITIONS, CreateListingDto } from '@la-grieta/shared';

@Component({
  selector: 'app-create-listing',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    MatStepperModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSnackBarModule,
    MatCardModule,
    MatCheckboxModule,
    LoadingSpinnerComponent
  ],
  template: `
    <div class="container mx-auto px-4 py-6 md:px-6 md:py-8 max-w-4xl">
      <!-- Header -->
      <div class="mb-6">
        <button
          mat-stroked-button
          routerLink="/marketplace"
          class="mb-4"
        >
          <mat-icon>arrow_back</mat-icon>
          Back to Marketplace
        </button>
        <h1 class="text-3xl font-heading font-bold text-gray-900 mb-2">
          Create New Listing
        </h1>
        <p class="text-base text-gray-600">
          List your cards for sale or auction
        </p>
      </div>

      <!-- Multi-step Form -->
      <mat-stepper [linear]="true" #stepper>
        <!-- Step 1: Select Cards from Collection -->
        <mat-step [stepControl]="itemsForm">
          <ng-template matStepLabel>Select Cards</ng-template>
          <form [formGroup]="itemsForm">
            <div class="py-6">
              <h2 class="text-xl font-semibold mb-4">Choose cards from your collection</h2>

              <!-- Collection Select -->
              <mat-form-field appearance="outline" class="w-full mb-4">
                <mat-label>Collection</mat-label>
                <mat-select (selectionChange)="onCollectionSelect($event.value)">
                  <mat-option [value]="null">Select a collection</mat-option>
                  @for (collection of collectionsService.collections(); track collection.id) {
                    <mat-option [value]="collection.id">
                      {{ collection.name }} ({{ collection.itemCount }} cards)
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <!-- Selected Cards List -->
              <div formArrayName="items" class="space-y-3">
                @if (itemsFormArray.length === 0) {
                  <div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                    <mat-icon class="text-gray-400 mb-2">inventory_2</mat-icon>
                    <p class="text-gray-600">Select a collection to add cards</p>
                  </div>
                }
                @for (item of itemsFormArray.controls; track $index; let i = $index) {
                  <mat-card [formGroupName]="i">
                    <mat-card-content class="!p-4">
                      <div class="flex gap-4 items-start">
                        <div class="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                          <mat-form-field appearance="outline">
                            <mat-label>Card</mat-label>
                            <input matInput formControlName="cardId" readonly />
                          </mat-form-field>
                          <mat-form-field appearance="outline">
                            <mat-label>Condition</mat-label>
                            <mat-select formControlName="condition">
                              @for (condition of conditions; track condition) {
                                <mat-option [value]="condition">{{ condition }}</mat-option>
                              }
                            </mat-select>
                          </mat-form-field>
                          <mat-form-field appearance="outline">
                            <mat-label>Quantity</mat-label>
                            <input matInput type="number" formControlName="quantity" min="1" />
                          </mat-form-field>
                        </div>
                        <button
                          mat-icon-button
                          color="warn"
                          type="button"
                          (click)="removeItem(i)"
                        >
                          <mat-icon>delete</mat-icon>
                        </button>
                      </div>
                    </mat-card-content>
                  </mat-card>
                }
              </div>

              <div class="flex justify-end mt-6">
                <button mat-raised-button color="primary" matStepperNext [disabled]="itemsForm.invalid">
                  Next
                </button>
              </div>
            </div>
          </form>
        </mat-step>

        <!-- Step 2: Listing Details -->
        <mat-step [stepControl]="detailsForm">
          <ng-template matStepLabel>Listing Details</ng-template>
          <form [formGroup]="detailsForm">
            <div class="py-6 space-y-4">
              <h2 class="text-xl font-semibold mb-4">Add listing information</h2>

              <mat-form-field appearance="outline" class="w-full">
                <mat-label>Title</mat-label>
                <input matInput formControlName="title" placeholder="e.g., Rare Shadowblade - Mint Condition" />
              </mat-form-field>

              <mat-form-field appearance="outline" class="w-full">
                <mat-label>Description</mat-label>
                <textarea
                  matInput
                  formControlName="description"
                  rows="4"
                  placeholder="Describe the condition, rarity, or special features..."
                ></textarea>
              </mat-form-field>

              <!-- Listing Type -->
              <fieldset>
                <legend class="block text-sm font-medium text-gray-700 mb-2">Listing Type</legend>
                <mat-radio-group formControlName="type" class="flex flex-col gap-2">
                  <mat-radio-button value="FIXED_PRICE">Fixed Price</mat-radio-button>
                  <mat-radio-button value="AUCTION">Auction</mat-radio-button>
                </mat-radio-group>
              </fieldset>

              <!-- Shop Selection (Optional) -->
              @if (shopsService.hasMyShop()) {
                <mat-checkbox formControlName="useShop">
                  List under my shop: {{ shopsService.myShop()?.name }}
                </mat-checkbox>
              }

              <div class="flex gap-4 justify-end mt-6">
                <button mat-stroked-button matStepperPrevious>Back</button>
                <button mat-raised-button color="primary" matStepperNext [disabled]="detailsForm.invalid">
                  Next
                </button>
              </div>
            </div>
          </form>
        </mat-step>

        <!-- Step 3: Pricing -->
        <mat-step [stepControl]="pricingForm">
          <ng-template matStepLabel>Pricing</ng-template>
          <form [formGroup]="pricingForm">
            <div class="py-6 space-y-4">
              <h2 class="text-xl font-semibold mb-4">Set your pricing</h2>

              @if (detailsForm.get('type')?.value === 'FIXED_PRICE') {
                <mat-form-field appearance="outline" class="w-full">
                  <mat-label>Price</mat-label>
                  <input matInput type="number" formControlName="price" min="0.01" step="0.01" />
                  <span matTextPrefix>$</span>
                </mat-form-field>
              } @else {
                <mat-form-field appearance="outline" class="w-full">
                  <mat-label>Starting Bid</mat-label>
                  <input matInput type="number" formControlName="startingBid" min="0.01" step="0.01" />
                  <span matTextPrefix>$</span>
                </mat-form-field>

                <mat-form-field appearance="outline" class="w-full">
                  <mat-label>Buy Now Price (Optional)</mat-label>
                  <input matInput type="number" formControlName="buyNowPrice" min="0.01" step="0.01" />
                  <span matTextPrefix>$</span>
                </mat-form-field>

                <mat-form-field appearance="outline" class="w-full">
                  <mat-label>Auction End Date</mat-label>
                  <input matInput [matDatepicker]="picker" formControlName="endsAt" [min]="minDate" />
                  <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
                  <mat-datepicker #picker></mat-datepicker>
                </mat-form-field>
              }

              <div class="flex gap-4 justify-end mt-6">
                <button mat-stroked-button matStepperPrevious>Back</button>
                <button mat-raised-button color="primary" matStepperNext [disabled]="pricingForm.invalid">
                  Next
                </button>
              </div>
            </div>
          </form>
        </mat-step>

        <!-- Step 4: Review & Submit -->
        <mat-step>
          <ng-template matStepLabel>Review</ng-template>
          <div class="py-6">
            <h2 class="text-xl font-semibold mb-4">Review your listing</h2>

            <mat-card class="mb-4">
              <mat-card-content class="!p-6">
                <h3 class="font-semibold text-lg mb-2">{{ detailsForm.get('title')?.value }}</h3>
                <p class="text-gray-600 mb-4">{{ detailsForm.get('description')?.value || 'No description' }}</p>

                <div class="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span class="text-gray-600">Type:</span>
                    <span class="ml-2 font-medium">{{ detailsForm.get('type')?.value }}</span>
                  </div>
                  <div>
                    <span class="text-gray-600">Cards:</span>
                    <span class="ml-2 font-medium">{{ itemsFormArray.length }}</span>
                  </div>
                  @if (detailsForm.get('type')?.value === 'FIXED_PRICE') {
                    <div>
                      <span class="text-gray-600">Price:</span>
                      <span class="ml-2 font-medium">\${{ pricingForm.get('price')?.value }}</span>
                    </div>
                  } @else {
                    <div>
                      <span class="text-gray-600">Starting Bid:</span>
                      <span class="ml-2 font-medium">\${{ pricingForm.get('startingBid')?.value }}</span>
                    </div>
                  }
                </div>
              </mat-card-content>
            </mat-card>

            <div class="flex gap-4 justify-end">
              <button mat-stroked-button matStepperPrevious>Back</button>
              <button
                mat-raised-button
                color="primary"
                (click)="submitListing()"
                [disabled]="marketplaceService.loading()"
              >
                @if (marketplaceService.loading()) {
                  <mat-icon class="animate-spin">refresh</mat-icon>
                  Creating...
                } @else {
                  <mat-icon>check</mat-icon>
                  Create Listing
                }
              </button>
            </div>
          </div>
        </mat-step>
      </mat-stepper>
    </div>
  `,
  styles: []
})
export class CreateListingComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  public collectionsService = inject(CollectionsService);
  public marketplaceService = inject(MarketplaceService);
  public shopsService = inject(ShopsService);
  private snackBar = inject(MatSnackBar);
  itemsForm: FormGroup;
  detailsForm: FormGroup;
  pricingForm: FormGroup;
  minDate = new Date();
  conditions = CARD_CONDITIONS;

  constructor() {
    this.itemsForm = this.fb.group({
      items: this.fb.array([], Validators.required)
    });

    this.detailsForm = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      type: ['FIXED_PRICE', Validators.required],
      useShop: [false]
    });

    this.pricingForm = this.fb.group({
      price: [null],
      startingBid: [null],
      buyNowPrice: [null],
      endsAt: [null]
    });

    // Update validators when type changes
    this.detailsForm.get('type')?.valueChanges.subscribe(type => {
      this.updatePricingValidators(type);
    });
  }

  ngOnInit(): void {
    this.collectionsService.loadCollections().subscribe();
    this.shopsService.getMyShop().subscribe();
  }

  get itemsFormArray(): FormArray {
    return this.itemsForm.get('items') as FormArray;
  }

  onCollectionSelect(collectionId: string | null): void {
    if (!collectionId) return;

    this.collectionsService.loadCollection(collectionId).subscribe({
      next: (collection) => {
        // Clear existing items
        this.itemsFormArray.clear();

        // Add items from collection
        collection.items.forEach(item => {
          this.itemsFormArray.push(this.fb.group({
            cardId: [item.cardId, Validators.required],
            quantity: [item.quantity, [Validators.required, Validators.min(1)]],
            condition: [item.condition, Validators.required]
          }));
        });
      },
      error: () => {
        this.snackBar.open('Failed to load collection', 'Close', { duration: 3000 });
      }
    });
  }

  removeItem(index: number): void {
    this.itemsFormArray.removeAt(index);
  }

  updatePricingValidators(type: ListingType): void {
    const priceControl = this.pricingForm.get('price');
    const startingBidControl = this.pricingForm.get('startingBid');
    const endsAtControl = this.pricingForm.get('endsAt');

    if (type === 'FIXED_PRICE') {
      priceControl?.setValidators([Validators.required, Validators.min(0.01)]);
      startingBidControl?.clearValidators();
      endsAtControl?.clearValidators();
    } else {
      priceControl?.clearValidators();
      startingBidControl?.setValidators([Validators.required, Validators.min(0.01)]);
      endsAtControl?.setValidators(Validators.required);
    }

    priceControl?.updateValueAndValidity();
    startingBidControl?.updateValueAndValidity();
    endsAtControl?.updateValueAndValidity();
  }

  submitListing(): void {
    if (this.itemsForm.invalid || this.detailsForm.invalid || this.pricingForm.invalid) {
      this.snackBar.open('Please complete all required fields', 'Close', { duration: 3000 });
      return;
    }

    const dto: CreateListingDto = {
      title: this.detailsForm.value.title,
      description: this.detailsForm.value.description,
      type: this.detailsForm.value.type,
      items: this.itemsForm.value.items,
      shopId: this.detailsForm.value.useShop ? this.shopsService.myShop()?.id : undefined,
      ...this.pricingForm.value
    };

    this.marketplaceService.createListing(dto).subscribe({
      next: (listing) => {
        this.snackBar.open('Listing created successfully!', 'Close', { duration: 3000 });
        this.router.navigate(['/marketplace/listings', listing.id]);
      },
      error: () => {
        this.snackBar.open('Failed to create listing', 'Close', { duration: 3000 });
      }
    });
  }
}
