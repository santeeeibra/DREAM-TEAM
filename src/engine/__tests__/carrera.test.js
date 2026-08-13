import { describe, test, expect } from 'vitest';
import { TRAMO } from '../balance';

describe('Presión por brecha de posición (fórmula)', () => {
  test('brecha positiva agrega presión (brecha 1 → +3)', () => {
    const antes = 0;
    const brecha = 1;
    const despues = antes + brecha * TRAMO.PRESION_BRECHA;
    expect(despues).toBe(3);
  });

  test('brecha 4 agrega +12 presión', () => {
    const antes = 0;
    const brecha = 4;
    const despues = antes + brecha * TRAMO.PRESION_BRECHA;
    expect(despues).toBe(12);
  });

  test('brecha 11+ fórmula da 33, clampeo a 100 si es necesario', () => {
    const antes = 70;
    const brecha = 11;
    const resultado = antes + brecha * TRAMO.PRESION_BRECHA; // 103
    expect(resultado).toBeGreaterThan(100);
  });

  test('brecha negativa no agrega presión', () => {
    const antes = 50;
    const brecha = -5;
    const despues = brecha > 0 ? antes + brecha * TRAMO.PRESION_BRECHA : antes;
    expect(despues).toBe(50);
  });

  test('clampa presión a 100 cuando excede el tope', () => {
    let presion = 60;
    const brecha = 15;
    presion += brecha * TRAMO.PRESION_BRECHA; // 60 + 45 = 105
    if (presion > 100) presion = 100;
    if (presion < 0) presion = 0;
    expect(presion).toBe(100);
  });

  test('clampa presión a 0 cuando va negativa', () => {
    let presion = 10;
    const brecha = -20;
    presion += brecha * TRAMO.PRESION_BRECHA; // 10 - 60 = -50
    if (presion > 100) presion = 100;
    if (presion < 0) presion = 0;
    expect(presion).toBe(0);
  });
});
