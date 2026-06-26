import { z } from 'zod';

export const truthBoundarySchema = z.enum(['measured', 'interpolated', 'ai_inferred', 'unknown', 'human_verified']);
export const findingLevelSchema = z.enum(['danger', 'warning', 'info']);
export const findingStatusSchema = z.enum(['new', 'acknowledged', 'assigned', 'reviewed', 'closed']);
export const findingSourceTypeSchema = z.enum(['alert', 'ai_marker', 'annotation', 'manual']);
export const evidenceTypeSchema = z.enum(['sensor', 'robot', 'pointcloud', 'ai_reasoning', 'operator_note', 'export']);

export const vec3Schema = z.tuple([z.number(), z.number(), z.number()]);

export const findingEvidenceSchema = z.object({
  id: z.string().min(1),
  type: evidenceTypeSchema,
  label: z.string().min(1),
  value: z.string().min(1),
  truthBoundary: truthBoundarySchema,
  timestamp: z.number(),
  robotId: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const findingSchema = z.object({
  id: z.string().min(1),
  sourceType: findingSourceTypeSchema,
  sourceId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  level: findingLevelSchema,
  status: findingStatusSchema,
  position: vec3Schema,
  truthBoundary: truthBoundarySchema,
  confidence: z.number().min(0).max(1),
  createdAt: z.number(),
  updatedAt: z.number(),
  assignee: z.string().optional(),
  evidence: z.array(findingEvidenceSchema),
});
