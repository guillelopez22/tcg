import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NavigationComponent } from './shared/components/navigation/navigation.component';
import { CartSidebarComponent } from './features/marketplace/components/cart-sidebar/cart-sidebar.component';

@Component({
  imports: [RouterModule, NavigationComponent, CartSidebarComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'La Grieta';
}
