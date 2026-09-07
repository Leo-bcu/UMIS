import type { AlertEvent } from '../data/alertDataGenerator';
import type { AIMarker, Annotation } from '../types';
import type { Finding } from './findingTypes';

const fallbackPosition: [number, number, number] = [0, 0, 0];

function centroid(points: [number, number, number][]): [number, number, number] {
  if (points.length === 0) return fallbackPosition;
  const sum = points.reduce(
    (acc, point) => [acc[0] + point[0], acc[1] + point[1], acc[2] + point[2]],
    [0, 0, 0] as [number, number, number]
  );
  return [sum[0] / points.length, sum[1] / points.length, sum[2] / points.length];
}

function annotationPosition(annotation: Annotation): [number, number, number] {
  if (annotation.points.length === 0) return fallbackPosition;
  if (annotation.type === 'distance' || annotation.type === 'profile' || annotation.type === 'area') {
    return centroid(annotation.points);
  }
  return annotation.points[0];
}

export function createFindingFromAlert(alert: AlertEvent): Finding {
  const position = alert.position ?? fallbackPosition;
  const confidence = alert.level === 'danger' ? 0.92 : 0.78;

  return {
    id: `finding-alert-${alert.id}`,
    sourceType: 'alert',
    sourceId: alert.id,
    title: alert.title,
    description: alert.description,
    level: alert.level,
    status: alert.acknowledged ? 'acknowledged' : 'new',
    position,
    truthBoundary: 'measured',
    confidence,
    createdAt: alert.timestamp,
    updatedAt: alert.timestamp,
    evidence: [
      {
        id: `evidence-${alert.id}-sensor`,
        type: 'sensor',
        label: alert.type,
        value: alert.description,
        truthBoundary: 'measured',
        timestamp: alert.timestamp,
        robotId: alert.robotId,
        confidence,
      },
    ],
  };
}

export function createFindingFromAIMarker(marker: AIMarker, timestamp = Date.now()): Finding {
  const confidence = 0.68;

  return {
    id: `finding-ai-${marker.id}`,
    sourceType: 'ai_marker',
    sourceId: marker.id,
    title: marker.label,
    description: marker.detail ?? marker.label,
    level: marker.level,
    status: 'new',
    position: marker.position,
    truthBoundary: 'ai_inferred',
    confidence,
    createdAt: timestamp,
    updatedAt: timestamp,
    evidence: [
      {
        id: `evidence-${marker.id}-ai`,
        type: 'ai_reasoning',
        label: marker.source ?? 'AI 推理',
        value: marker.detail ?? marker.label,
        truthBoundary: 'ai_inferred',
        timestamp,
        confidence,
      },
    ],
  };
}

export function createFindingFromAnnotation(annotation: Annotation, timestamp = Date.now()): Finding {
  const position = annotationPosition(annotation);
  const confidence = 0.85;

  return {
    id: `finding-annotation-${annotation.id}`,
    sourceType: 'annotation',
    sourceId: annotation.id,
    title: annotation.label ?? '人工标注',
    description: annotation.label ?? '人工标注',
    level: annotation.type === 'area' ? 'warning' : 'info',
    status: 'new',
    position,
    truthBoundary: 'human_verified',
    confidence,
    createdAt: timestamp,
    updatedAt: timestamp,
    evidence: [
      {
        id: `evidence-${annotation.id}-annotation`,
        type: 'operator_note',
        label: annotation.type,
        value: annotation.label ?? '人工标注',
        truthBoundary: 'human_verified',
        timestamp,
        confidence,
      },
    ],
  };
}
