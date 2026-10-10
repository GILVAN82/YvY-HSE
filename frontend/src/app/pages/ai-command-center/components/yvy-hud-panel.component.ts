import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Check, LucideAngularModule } from 'lucide-angular';
import type { IconType } from '../../../core/navigation.config';

@Component({
 selector:'app-yvy-hud-panel',standalone:true,imports:[CommonModule,LucideAngularModule],
 template:`<button type="button" class="hud" [class.active]="active" (click)="open.emit()" [attr.aria-label]="'Open ' + title + ' execution details'"><header><lucide-icon [img]="icon" [size]="17"></lucide-icon><h2>{{title}}</h2></header><div class="hud-body"><div class="hero"><lucide-icon [img]="icon" [size]="34"></lucide-icon></div><ul><li *ngFor="let item of items"><span>{{item}}</span><lucide-icon [img]="check" [size]="14"></lucide-icon></li></ul></div><footer>{{footer}}</footer></button>`,
 styleUrl:'./yvy-hud-panel.component.scss'
})
export class YvyHudPanelComponent{@Input({required:true}) title='';@Input({required:true}) icon!:IconType;@Input() items:string[]=[];@Input() footer='';@Input() active=false;@Output() open=new EventEmitter<void>();readonly check=Check;}
