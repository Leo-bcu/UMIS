import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { snapMeasurementPoint, type MeasurementSnapResult } from '../../lib/measurementPicking';
import { useSceneStore } from '../../store/useSceneStore';

interface CanvasInteractionOptions {
  snapToNetwork?: boolean;
}

export interface CanvasInteractionPoint {
  point: THREE.Vector3;
  snap: MeasurementSnapResult;
  hit:
    | {
        kind: 'robot';
        robotId: string;
      }
    | {
        kind: 'fracture';
        fractureId: string;
        nodeId: string | null;
      }
    | {
        kind: 'coalStructure';
        structureId: string;
      }
    | null;
}

function isLowOpacitySurface(mesh: THREE.Mesh): boolean {
  if (
    mesh.userData.selectableKind === 'robot' ||
    mesh.userData.selectableKind === 'fracture' ||
    mesh.userData.selectableKind === 'coalStructure'
  ) {
    return false;
  }

  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.some((material) => (
    'transparent' in material &&
    'opacity' in material &&
    material.transparent === true &&
    typeof material.opacity === 'number' &&
    material.opacity <= 0.45
  ));
}

/**
 * 文档级射线检测 hook — 绕过 R3F mesh 事件传播 + drei Html 叠加层拦截问题
 *
 * 监听 document 的 pointer 事件（capture 阶段），检查坐标是否在 canvas 范围内，
 * 然后用 Raycaster 求交返回 3D 坐标点。
 *
 * 关键：drei 的 <Html> 组件会在 canvas 上方创建 DIV 叠加层（如预览标签、提示文字），
 * 这些 DIV 会拦截 pointer 事件导致 canvas 收不到。所以必须在 document 层监听，
 * 通过 getBoundingClientRect 判断坐标是否在 canvas 区域内。
 *
 * 过滤掉 userData.noRaycast 标记的 mesh（工具自身创建的标记/线条等），
 * 防止射线命中工具 mesh 导致正反馈循环。
 *
 * 注意：不调用 stopPropagation()，让 OrbitControls 在 bubble 阶段也能收到事件。
 * OrbitControls 的 LEFT 在工具激活时被设为 undefined，不会冲突。
 */
export function useCanvasInteraction(
  enabled: boolean,
  handlers: {
    onPointerDown?: (point: THREE.Vector3, e: PointerEvent) => void;
    onPointerMove?: (point: THREE.Vector3, e: PointerEvent) => void;
    onPointerUp?: (point: THREE.Vector3, e: PointerEvent) => void;
    onPointerDownDetail?: (detail: CanvasInteractionPoint, e: PointerEvent) => void;
    onPointerMoveDetail?: (detail: CanvasInteractionPoint, e: PointerEvent) => void;
    onPointerUpDetail?: (detail: CanvasInteractionPoint, e: PointerEvent) => void;
  },
  options: CanvasInteractionOptions = {}
) {
  const { gl, camera, scene } = useThree();
  const fractures = useSceneStore((s) => s.fractures);
  const handlersRef = useRef(handlers);
  const fracturesRef = useRef(fractures);
  const optionsRef = useRef(options);
  handlersRef.current = handlers;
  fracturesRef.current = fractures;
  optionsRef.current = options;

  useEffect(() => {
    if (!enabled) return;
    const dom = gl.domElement;

    /** 检查坐标是否在 canvas 范围内 */
    const isInCanvas = (clientX: number, clientY: number): boolean => {
      const rect = dom.getBoundingClientRect();
      return (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      );
    };

    const toRawSnap = (point: THREE.Vector3): MeasurementSnapResult => ({
      point: [point.x, point.y, point.z],
      snapped: false,
      targetType: 'raw',
      distance: 0,
    });

    const snapPoint = (
      point: THREE.Vector3,
      hit: CanvasInteractionPoint['hit'],
    ): CanvasInteractionPoint => {
      if (optionsRef.current.snapToNetwork === false) return { point, snap: toRawSnap(point), hit };
      const snap = snapMeasurementPoint(
        [point.x, point.y, point.z],
        fracturesRef.current,
        2.5
      );
      return { point: new THREE.Vector3(...snap.point), snap, hit };
    };

    const getIntersection = (clientX: number, clientY: number): CanvasInteractionPoint => {
      const rect = dom.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((clientY - rect.top) / rect.height) * 2 + 1;
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

      // 收集所有可见 mesh，排除工具自身创建的 mesh（标记为 noRaycast）
      const meshes: THREE.Mesh[] = [];
      scene.traverse((obj) => {
        if (
          obj instanceof THREE.Mesh &&
          obj.visible &&
          obj.geometry &&
          !obj.userData.noRaycast &&
          !isLowOpacitySurface(obj)
        ) {
          meshes.push(obj);
        }
      });

      const intersects = raycaster.intersectObjects(meshes, false);
      if (intersects.length > 0) {
        const hitObject = intersects[0].object;
        const hit = hitObject.userData.selectableKind === 'robot'
          ? {
              kind: 'robot' as const,
              robotId: String(hitObject.userData.robotId ?? ''),
            }
          : hitObject.userData.selectableKind === 'fracture'
          ? {
              kind: 'fracture' as const,
              fractureId: String(hitObject.userData.fractureId ?? ''),
              nodeId: hitObject.userData.nodeId ? String(hitObject.userData.nodeId) : null,
            }
          : hitObject.userData.selectableKind === 'coalStructure'
          ? {
              kind: 'coalStructure' as const,
              structureId: String(hitObject.userData.coalStructureId ?? ''),
            }
          : null;
        return snapPoint(intersects[0].point.clone(), hit);
      }

      // 回退：射线与 Y=0 水平面求交
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const hitPoint = new THREE.Vector3();
      const gotHit = raycaster.ray.intersectPlane(groundPlane, hitPoint);
      if (gotHit) return snapPoint(hitPoint, null);

      // 最终回退：射线方向上的远点
      return snapPoint(raycaster.ray.origin.clone().add(
        raycaster.ray.direction.clone().multiplyScalar(100)
      ), null);
    };

    // 监听 document（capture 阶段），检查坐标是否在 canvas 区域内
    // 这样即使 drei Html 叠加层拦截了事件，document capture 仍能收到
    const handleDown = (e: PointerEvent) => {
      if (e.button !== 0) return; // 只响应左键，右键留给 OrbitControls 旋转
      if (!isInCanvas(e.clientX, e.clientY)) return;
      const point = getIntersection(e.clientX, e.clientY);
      handlersRef.current.onPointerDown?.(point.point, e);
      handlersRef.current.onPointerDownDetail?.(point, e);
    };

    const handleMove = (e: PointerEvent) => {
      if (!handlersRef.current.onPointerMove) return;
      if (!isInCanvas(e.clientX, e.clientY)) return;
      const point = getIntersection(e.clientX, e.clientY);
      handlersRef.current.onPointerMove?.(point.point, e);
      handlersRef.current.onPointerMoveDetail?.(point, e);
    };

    const handleUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (!isInCanvas(e.clientX, e.clientY)) return;
      const point = getIntersection(e.clientX, e.clientY);
      handlersRef.current.onPointerUp?.(point.point, e);
      handlersRef.current.onPointerUpDetail?.(point, e);
    };

    document.addEventListener('pointerdown', handleDown, { capture: true });
    document.addEventListener('pointermove', handleMove, { capture: true });
    document.addEventListener('pointerup', handleUp, { capture: true });
    dom.style.cursor = 'crosshair';

    return () => {
      document.removeEventListener('pointerdown', handleDown, { capture: true });
      document.removeEventListener('pointermove', handleMove, { capture: true });
      document.removeEventListener('pointerup', handleUp, { capture: true });
      dom.style.cursor = '';
    };
  }, [enabled, gl, camera, scene]);
}
