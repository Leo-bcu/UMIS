import type { Fracture, ScenarioType, SensorReading } from '../types';
import { sanitizeSensorReading } from '../lib/sensorSanitizer';

function mergeReading(reading: SensorReading, patch: Partial<SensorReading>): SensorReading {
  return { ...reading, ...patch };
}

function applyPatch(fracture: Fracture, patch: Partial<SensorReading>, nodeIndexes: number[] = [0, 1, 2]) {
  fracture.sensorReading = mergeReading(fracture.sensorReading, patch);
  const numericId = Number(fracture.id.replace(/\D/g, '').slice(-2)) || 0;
  for (const index of nodeIndexes) {
    const node = fracture.nodes[index];
    if (!node) continue;
    node.sensors = mergeReading(node.sensors, patch);
    node.robotId = node.robotId ?? `R-${String(900 + numericId * 3 + index).padStart(3, '0')}`;
  }
}

function byIndex(fractures: Fracture[], index: number): Fracture | undefined {
  return fractures[Math.min(index, fractures.length - 1)];
}

export function seedScenarioAnomalies(fractures: Fracture[], scenario: ScenarioType): Fracture[] {
  if (fractures.length === 0) return fractures;

  if (scenario === 'coal') {
    applyPatch(byIndex(fractures, 2)!, {
      ch4_pct: 3.8,
      co_ppm: 38,
      temperature_c: 42.5,
      stress_mpa: 23.5,
      microseismic_count: 18,
    });
    applyPatch(byIndex(fractures, 8)!, {
      ch4_pct: 2.2,
      co_ppm: 28,
      humidity_pct: 92,
      water_pressure_mpa: 7.2,
    }, [0, 2]);
  } else if (scenario === 'gold') {
    applyPatch(byIndex(fractures, 3)!, {
      microseismic_count: 26,
      stress_mpa: 33,
      stress_sigma1: 29,
      acoustic_emission_mv: 7200,
      displacement_mm: 9.8,
      rock_strength_mpa: 42,
    });
    applyPatch(byIndex(fractures, 11)!, {
      microseismic_count: 18,
      stress_mpa: 28,
      acoustic_emission_mv: 5400,
      displacement_mm: 6.2,
    }, [1, 2]);
  } else if (scenario === 'oil') {
    applyPatch(byIndex(fractures, 1)!, {
      pore_pressure_mpa: 34,
      permeability_md: 82,
      water_saturation_pct: 56,
      temperature_c: 86,
      stress_mpa: 41,
      fracture_aperture_um: 260,
    });
    applyPatch(byIndex(fractures, 10)!, {
      pore_pressure_mpa: 31,
      water_pressure_mpa: 24,
      fluid_ph: 5.8,
      water_saturation_pct: 49,
    }, [0, 1]);
  } else if (scenario === 'pipeline') {
    applyPatch(byIndex(fractures, 9)!, {
      ch4_pct: 28,
      h2s_ppm: 120,
      permeability_md: 0.72,
      rock_strength_mpa: 34,
      acoustic_emission_mv: 6900,
      stress_mpa: 5.6,
    });
    applyPatch(byIndex(fractures, 17)!, {
      ch4_pct: 17,
      h2s_ppm: 72,
      permeability_md: 0.54,
      rock_strength_mpa: 26,
      displacement_mm: 6.8,
      porosity_pct: 86,
    }, [0, 1]);
  } else if (scenario === 'nuclear') {
    applyPatch(byIndex(fractures, 6)!, {
      ch4_pct: 62,
      h2s_ppm: 18,
      water_pressure_mpa: 82,
      permeability_md: 0.19,
      microseismic_count: 9.8,
      pore_pressure_mpa: 14,
    });
    applyPatch(byIndex(fractures, 31)!, {
      ch4_pct: 34,
      water_pressure_mpa: 67,
      acoustic_emission_mv: 2600,
      displacement_mm: 1.8,
    }, [1, 2]);
  } else if (scenario === 'refinery') {
    applyPatch(byIndex(fractures, 4)!, {
      stress_mpa: 16.8,
      h2s_ppm: 135,
      ch4_pct: 32,
      water_saturation_pct: 980,
      rock_strength_mpa: 8.4,
      acoustic_emission_mv: 5200,
      permeability_md: 0.68,
      temperature_c: 51,
    });
    applyPatch(byIndex(fractures, 48)!, {
      stress_mpa: 17.4,
      h2s_ppm: 88,
      ch4_pct: 18,
      water_saturation_pct: 760,
      rock_strength_mpa: 6.7,
      fluid_ph: 4.9,
    }, [0, 2]);
  } else if (scenario === 'underground') {
    applyPatch(byIndex(fractures, 6)!, {
      permeability_md: 18000,
      water_pressure_mpa: 10.6,
      temperature_c: 96,
      microseismic_count: 26,
      acoustic_emission_mv: 4800,
      displacement_mm: 3.2,
    });
    applyPatch(byIndex(fractures, 13)!, {
      permeability_md: 9000,
      water_pressure_mpa: 8.8,
      temperature_c: 86,
      h2s_ppm: 14,
      fluid_ph: 5.2,
    }, [0, 1]);
  }

  return fractures.map((fracture) => ({
    ...fracture,
    sensorReading: sanitizeSensorReading(fracture.sensorReading, scenario),
    nodes: fracture.nodes.map((node) => ({
      ...node,
      sensors: sanitizeSensorReading(node.sensors, scenario),
    })),
  }));
}
