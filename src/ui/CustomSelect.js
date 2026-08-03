// CustomSelect.js — dropdown personalizado (div/button/ul/li) que reemplaza
// a los <select> nativos del formulario "Creá tu DT", con el mismo look
// (fondo oscuro, borde, hover azul) pero permitiendo mostrar una imagen
// (bandera/escudo) al lado de cada opción, cosa que un <select> nativo no
// soporta bien entre navegadores.
//
// item.resolveImg puede devolver una URL de forma sync (banderas, ya
// conocemos el código ISO) o un Promise<string> (escudos, hay que
// consultar una API): en el segundo caso mostramos primero el avatar de
// iniciales y lo reemplazamos cuando resuelve, así no queda un hueco vacío
// mientras se espera la respuesta.

import { getInitialsAvatarUrl } from '../utils/badgeResolver.js';

let instanciaAbierta = null; // solo un dropdown abierto a la vez

export class CustomSelect {
  constructor(container, { placeholder, emptyMessage = 'No hay opciones disponibles', imgShape = 'badge', onChange } = {}) {
    this.container = container;
    this.placeholder = placeholder;
    this.emptyMessage = emptyMessage;
    this.onChange = onChange;
    this.value = null;
    this.resolveToken = 0;

    container.classList.add('custom-select', `custom-select--${imgShape}`);
    container.innerHTML = `
      <button type="button" class="custom-select-trigger" aria-haspopup="listbox" aria-expanded="false">
        <span class="custom-select-trigger-content"><span class="custom-select-placeholder"></span></span>
        <span class="custom-select-arrow">▾</span>
      </button>
      <ul class="custom-select-options" role="listbox" hidden></ul>
    `;

    this.trigger = container.querySelector('.custom-select-trigger');
    this.content = container.querySelector('.custom-select-trigger-content');
    this.list = container.querySelector('.custom-select-options');
    this.content.querySelector('.custom-select-placeholder').textContent = placeholder;

    this.trigger.addEventListener('click', () => this.toggle());
    document.addEventListener('click', (event) => {
      if (!container.contains(event.target)) this.close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isOpen()) this.close();
    });

    this.setDisabled(true);
  }

  isOpen() {
    return !this.list.hidden;
  }

  toggle() {
    if (this.trigger.disabled) return;
    if (this.isOpen()) this.close();
    else this.open();
  }

  open() {
    if (instanciaAbierta && instanciaAbierta !== this) instanciaAbierta.close();
    this.list.hidden = false;
    this.trigger.setAttribute('aria-expanded', 'true');
    instanciaAbierta = this;
  }

  close() {
    this.list.hidden = true;
    this.trigger.setAttribute('aria-expanded', 'false');
    if (instanciaAbierta === this) instanciaAbierta = null;
  }

  setDisabled(disabled) {
    this.trigger.disabled = disabled;
    this.container.classList.toggle('custom-select-disabled', disabled);
    if (disabled) this.close();
  }

  // items: [{ value, label, resolveImg?: () => string | Promise<string> }]
  setItems(items) {
    this.value = null;
    this.resolveToken += 1;
    const token = this.resolveToken;

    this.content.innerHTML = `<span class="custom-select-placeholder">${this.placeholder}</span>`;
    this.list.innerHTML = '';

    if (items.length === 0) {
      const vacio = document.createElement('li');
      vacio.className = 'custom-select-empty';
      vacio.textContent = this.emptyMessage;
      this.list.appendChild(vacio);
      this.setDisabled(true);
      this.onChange?.(null);
      return;
    }

    for (const item of items) {
      const li = document.createElement('li');
      li.className = 'custom-select-option';
      li.setAttribute('role', 'option');
      li.dataset.value = item.value;

      const img = this.crearImagen(item, token);
      const span = document.createElement('span');
      span.textContent = item.label;

      li.append(img, span);
      li.addEventListener('click', () => {
        this.select(item, img.src);
        this.close();
      });
      this.list.appendChild(li);
    }

    this.setDisabled(false);
  }

  crearImagen(item, token) {
    const img = document.createElement('img');
    img.alt = '';
    img.onerror = () => {
      img.onerror = null;
      img.src = getInitialsAvatarUrl(item.label);
    };

    const resuelta = item.resolveImg?.();
    if (resuelta && typeof resuelta.then === 'function') {
      img.src = getInitialsAvatarUrl(item.label); // placeholder mientras resuelve la API
      resuelta
        .then((url) => {
          if (token !== this.resolveToken || !url) return;
          img.src = url;
        })
        .catch(() => {});
    } else {
      img.src = resuelta || getInitialsAvatarUrl(item.label);
    }

    return img;
  }

  select(item, imgSrc) {
    this.value = item.value;
    this.content.innerHTML = '';

    const img = document.createElement('img');
    img.alt = '';
    img.onerror = () => {
      img.onerror = null;
      img.src = getInitialsAvatarUrl(item.label);
    };
    img.src = imgSrc || getInitialsAvatarUrl(item.label);

    const span = document.createElement('span');
    span.textContent = item.label;

    this.content.append(img, span);
    this.onChange?.(item.value);
  }

  getValue() {
    return this.value;
  }
}
