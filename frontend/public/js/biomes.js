/** Textos que cambian según el escenario (el bioma no cambia las reglas, solo cómo se habla de ellas). */
export const TERMS = {
  water: { fleet: 'flota', area: 'aguas enemigas', areaOf: 'Aguas de', miss: 'agua', sunk: 'hundido', unit: 'barco' },
  pirate: { fleet: 'flota pirata', area: 'aguas enemigas', areaOf: 'Aguas de', miss: 'agua', sunk: 'hundido', unit: 'barco' },
  land: { fleet: 'ejército', area: 'territorio enemigo', areaOf: 'Territorio de', miss: 'solo tierra', sunk: 'derrotado', unit: 'unidad' },
  jungle: { fleet: 'escuadra', area: 'la selva enemiga', areaOf: 'Selva de', miss: 'solo maleza', sunk: 'neutralizado', unit: 'unidad' },
};

export const termsFor = (biome) => TERMS[biome] ?? TERMS.water;
export const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
