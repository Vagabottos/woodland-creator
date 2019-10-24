import { Directive, ElementRef, HostListener, Input, OnInit } from "@angular/core";
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";

@Directive({
  selector: "[appDraggableWindow]",
})
export class DraggableDirective implements OnInit {

  @Input("appDraggableWindow")
  set allowDrag(value: boolean) {
    this.isDragAllowed = value;
  }

  @Input("windowHandle")
  set windowHandle(handle: HTMLElement) {
    this.handle = handle;

    if (this.isDragAllowed) {
      this.handle.className += " cursor-draggable";
    } else {
      this.handle.className = this.handle.className.replace(" cursor-draggable", "");
    }
  }

  @Input()
  public set windowLocation(data) {
    if (!data) { return; }

    const { x, y } = data;
    this.setElementCoords(y, x);
  }

  @Input()
  public windowName: string;
  private topStart = 0;
  private leftStart = 0;
  private isDragAllowed = true;
  private md = false;
  private handle: HTMLElement = null;

  private updates = new Subject();

  constructor(
    public element: ElementRef,
  ) {}

  public ngOnInit() {
    // css changes
    if (this.isDragAllowed) {
      this.handle.style.position = "relative";
      this.handle.className += " cursor-draggable";
    }

    this.updates.pipe(debounceTime(500))
      .subscribe(({ top, left }: any) => this.dispatchElementCoordinates(top, left));
  }

  @HostListener("mousedown", ["$event"])
  public onMouseDown(event: MouseEvent) {
    // prevents right click drag
    if (event.button === 2 || (this.handle !== undefined && event.target !== this.handle)) { return; }

    this.md = true;
    this.topStart = event.clientY - this.element.nativeElement.style.top.replace("px", "");
    this.leftStart = event.clientX - this.element.nativeElement.style.left.replace("px", "");
  }

  @HostListener("document:mouseup", ["$event"])
  public onMouseUp() {
    this.md = false;
  }

  @HostListener("document:mousemove", ["$event"])
  public onMouseMove(event: MouseEvent) {
    if (this.md && this.isDragAllowed) {
      event.preventDefault();
      event.stopPropagation();
      this.setElementCoords(event.clientY - this.topStart, event.clientX - this.leftStart);
    }
  }

  @HostListener("document:mouseleave", ["$event"])
  public onMouseLeave() {
    this.md = false;
  }

  @HostListener("touchstart", ["$event"])
  public onTouchStart(event) {
    this.md = true;
    this.topStart = event.changedTouches[0].clientY - this.element.nativeElement.style.top.replace("px", "");
    this.leftStart = event.changedTouches[0].clientX - this.element.nativeElement.style.left.replace("px", "");
    event.stopPropagation();
  }

  @HostListener("document:touchend", ["$event"])
  public onTouchEnd() {
    this.md = false;
  }

  @HostListener("document:touchmove", ["$event"])
  public onTouchMove(event) {
    if (this.md && this.isDragAllowed) {
      this.setElementCoords(
        event.changedTouches[0].clientY - this.topStart,
        event.changedTouches[0].clientX - this.leftStart,
      );
    }
    event.stopPropagation();
  }

  private dispatchElementCoordinates(top, left) {
    // update element position in local storage
  }

  private saveCoordinates(top, left) {
    if (!this.windowName) { return; }

    this.updates.next({ top, left });
  }

  private setElementCoords(top, left) {
    this.saveCoordinates(top, left);
    this.element.nativeElement.style.top = `${top}px`;
    this.element.nativeElement.style.left = `${left}px`;
  }

}
