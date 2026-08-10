import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.css']
})
export class ContactComponent {
  nombre = '';
  correo = '';
  asunto = '';
  mensaje = '';
  estado: 'idle' | 'sent' = 'idle';

  private readonly whatsappDestino = '50231681920';

  enviarWhatsApp(): void {
    const texto = [
      'Hola Almacen Digital, quiero contactarlos.',
      `Nombre: ${this.nombre.trim()}`,
      `Correo: ${this.correo.trim()}`,
      `Asunto: ${this.asunto.trim()}`,
      `Mensaje: ${this.mensaje.trim()}`
    ].join('\n');

    const whatsappUrl = `https://wa.me/${this.whatsappDestino}?text=${encodeURIComponent(texto)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    this.estado = 'sent';
  }

}
