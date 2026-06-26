import type { ScenarioType, SensorReading } from '../types';

const num = (v: number, fallback = 0) => Number.isFinite(v) ? v : fallback;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, num(v)));
const nonNeg = (v: number) => Math.max(0, num(v));
const pct = (v: number) => clamp(v, 0, 100);

export function sanitizeSensorReading(reading: SensorReading, scenario: ScenarioType): SensorReading {
  const ch4Max = scenario === 'coal' ? 5 : Number.POSITIVE_INFINITY;
  const temperatureMax = scenario === 'nuclear' ? 350 : 200;
  return {
    ch4_pct: clamp(reading.ch4_pct, 0, ch4Max),
    co_ppm: nonNeg(reading.co_ppm),
    h2s_ppm: nonNeg(reading.h2s_ppm),
    temperature_c: clamp(reading.temperature_c, -50, temperatureMax),
    stress_mpa: nonNeg(reading.stress_mpa),
    stress_sigma1: nonNeg(reading.stress_sigma1),
    stress_sigma2: nonNeg(reading.stress_sigma2),
    stress_sigma3: nonNeg(reading.stress_sigma3),
    permeability_md: nonNeg(reading.permeability_md),
    water_pressure_mpa: nonNeg(reading.water_pressure_mpa),
    microseismic_count: Math.round(nonNeg(reading.microseismic_count)),
    acoustic_emission_mv: Math.round(nonNeg(reading.acoustic_emission_mv)),
    humidity_pct: pct(reading.humidity_pct),
    fracture_aperture_um: nonNeg(reading.fracture_aperture_um),
    displacement_mm: nonNeg(reading.displacement_mm),
    rock_strength_mpa: nonNeg(reading.rock_strength_mpa),
    pore_pressure_mpa: nonNeg(reading.pore_pressure_mpa),
    porosity_pct: pct(reading.porosity_pct),
    fluid_ph: clamp(reading.fluid_ph, 0, 14),
    water_saturation_pct: pct(reading.water_saturation_pct),
  };
}
