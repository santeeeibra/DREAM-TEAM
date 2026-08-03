// errors.js — jerarquía de errores de la app. Solo definiciones en esta
// fase: todavía no se usan en el código (eso es Fase 2/3).

export class AppError extends Error {
  constructor(mensajeUsuario, { code, causa, contexto } = {}) {
    super(mensajeUsuario);
    this.name = this.constructor.name;
    this.code = code;
    this.mensajeUsuario = mensajeUsuario;
    this.causa = causa;
    this.contexto = contexto;
  }
}

export class DataError extends AppError {}

export class EngineError extends AppError {}

export class ContentError extends AppError {}
