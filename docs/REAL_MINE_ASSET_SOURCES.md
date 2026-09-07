# Real Mine Asset Sources

> Purpose: coal-gas and mine scenes must be driven by real mine references or licensed scan assets, not invented geometry.
>
> Code entry point: `src/components/scene/ScenarioStructureLayer.tsx`
> Asset target: `public/models/coal-mine/real-mine.glb`
> Last checked: 2026-06-19

## Decision

The current coal scene should move to a licensed GLB/OBJ scan or a topology derived from real mine survey drawings. Hand-built flat slabs, floating spheres, stacked planes, and arbitrary tunnels are not acceptable for customer or academic demos.

## Candidate Assets

| Candidate | Type | License | Download status | Fit | Notes |
|---|---|---:|---|---|---|
| [Old mine scan](https://sketchfab.com/3d-models/old-mine-scan-1cfaeb2c90d54408a661f1c0d62096d2) | Photogrammetry / scan | CC BY 4.0 | Downloadable on Sketchfab, requires authenticated download | High | Real old mine scan with coal / photogrammetry / scan tags. Best short-path replacement once downloaded legally. |
| [Coal Mine Gallery](https://sketchfab.com/3d-models/coal-mine-gallery-2cc9dfc11fe243039f9900f0c31414ae) | Coal mine gallery model | CC BY 4.0 | Downloadable on Sketchfab, requires authenticated download | Medium | Coal mine gallery from Saint-Etienne, France. Better than procedural geometry, but may be less scan-real than `Old mine scan`. |
| [Ferriere Mines - Lower Tunnels](https://sketchfab.com/3d-models/ferriere-mines-lower-tunnels-17ba7a7ddbfb4d17a86ea1b405c9f5ea) | Mine tunnel photogrammetry | CC BY 4.0 | Downloadable on Sketchfab, requires authenticated download | Medium | Real lower tunnel geometry; good tunnel realism, but not coal-specific. |
| [NASA Planetary Pits and Caves Analog Dataset - Fieg site](https://ti.arc.nasa.gov/dataset/caves/) | LiDAR mesh / point cloud dataset | Research dataset; verify redistribution before commercial use | Direct public download | Medium | Fieg was a surface coal mine in Somerset County, PA, used for early robot testing. `FiegHighwallVolume.wrl` is now used as a real layered coal highwall reference mesh. |
| [DARPA SubT Worlds](https://github.com/LTU-RAI/darpa_subt_worlds) | Underground robot simulation worlds | Open-source repo license | Cloneable, SDF/DAE assets | Reference only | Useful for underground robot topology and navigation reference. Not a direct coal mine visual replacement. |

## Integration Rule

When a licensed asset is obtained:

1. Put the browser-ready GLB at `public/models/coal-mine/real-mine.glb`.
2. Put license and attribution in `public/models/coal-mine/ATTRIBUTION.md`.
3. Keep the raw downloaded archive outside `public/` unless it is optimized for web delivery.
4. Optimize before demo if the model is larger than 30 MB.
5. Align robot positions, gas readings, tunnel labels, and hazard markers to the imported model coordinates.

## Scene Acceptance Criteria

- The mine must read as a real underground space: shaft or inclined entry, multi-level roadway, chambers, supports, goaf / void area, and hazardous narrow areas.
- The scene must not rely on same-level decorative lines to imply depth.
- Every visible route must have physical continuity: no floating branches, impossible weld-like joints, or disconnected tunnel ends unless labeled as blocked/dead-end.
- Robot markers must sit inside navigable voids or tunnels, not outside surfaces or through walls.
- Anomalies must be physically plausible: methane accumulation near roof / goaf, oxygen deficit in poor ventilation areas, water ingress at low points, roof fall near unsupported or fractured zones.
- UI labels for detected issues must be screen-space overlays tied to 3D anchors, so rotating the scene does not hide the whole finding list.

## Current Blocker

Sketchfab model metadata confirms the three primary candidates are downloadable and CC BY 4.0, but direct download requires authenticated Sketchfab access. The project must not scrape or bypass that authorization. A human or CI secret-backed asset fetch step is required before the real GLB can be committed or deployed.
