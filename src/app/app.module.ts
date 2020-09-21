import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { BrowserModule } from "@angular/platform-browser";
import { NgbModule } from "@ng-bootstrap/ng-bootstrap";

import { AppComponent } from "./app.component";
import { DraggableDirective } from "./draggable.directive";

@NgModule({
  bootstrap: [AppComponent],
  declarations: [
    AppComponent,
    DraggableDirective,
  ],
  imports: [
    BrowserModule,
    FormsModule,
    NgbModule,
  ],
  providers: [],
})
export class AppModule { }
