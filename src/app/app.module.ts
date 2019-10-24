import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";

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
  ],
  providers: [],
})
export class AppModule { }
