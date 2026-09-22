/**
 * The MediaPipe Face Landmarker, wrapped as a single shared instance.
 *
 * On the web there is no ARKit; this is its counterpart. The `face_landmarker`
 * bundle returns the same three things ARKit's face anchor does -- a dense 3D
 * mesh (478 points, including irises), a 4x4 head transform, and the 52
 * ARKit-named blendshape coefficients -- from an ordinary webcam, entirely
 * on-device. Nothing here uploads a frame anywhere.
 *
 * Both the wasm runtime and the .task model are served from `public/`, not a
 * CDN: it makes the first scan start faster and the app work offline.
 */

import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from '@mediapipe/tasks-vision';

let instance: FaceLandmarker | null = null;
let loading: Promise<FaceLandmarker> | null = null;

export function getLandmarker(): Promise<FaceLandmarker> {
  if (instance) return Promise.resolve(instance);
  if (loading) return loading;

  loading = (async () => {
    const fileset = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}wasm`);
    const landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: `${import.meta.env.BASE_URL}models/face_landmarker.task`,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      // The transform matrix is our cross-check on the landmark-derived pose;
      // blendshapes drive the "are your eyes open / is your mouth closed"
      // quality gate during the scan.
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
    instance = landmarker;
    return landmarker;
  })();

  return loading;
}

/** Frees the GPU-side graph. Call when leaving camera views for good. */
export function disposeLandmarker(): void {
  instance?.close();
  instance = null;
  loading = null;
}

export interface FaceSample {
  /** 478 landmarks, flat xyz, in the aspect-corrected image space below. */
  points: Float32Array;
  /** MediaPipe's own head transform, column-major, or null if it was absent. */
  matrix: Float32Array | null;
  /** Named blendshape scores, e.g. `eyeBlinkLeft`. */
  blendshapes: Map<string, number>;
  timestamp: number;
}

/**
 * Convert one MediaPipe result into the app's coordinate space.
 *
 * MediaPipe hands back x and y normalised to the image box and z on roughly
 * the same scale as x. We centre the origin, undo the box's aspect so the face
 * is not stretched, and flip y and z so the result is a right-handed space
 * with +Y up and +Z toward the camera -- three.js's convention, which saves a
 * conversion in every consumer.
 */
export function toSample(
  result: FaceLandmarkerResult,
  aspect: number,
  timestamp: number,
): FaceSample | null {
  const marks = result.faceLandmarks?.[0];
  if (!marks || marks.length < 478) return null;

  const points = new Float32Array(marks.length * 3);
  for (let i = 0; i < marks.length; i++) {
    const m = marks[i];
    points[i * 3] = (m.x - 0.5) * aspect;
    points[i * 3 + 1] = -(m.y - 0.5);
    points[i * 3 + 2] = -m.z * aspect;
  }

  const blendshapes = new Map<string, number>();
  for (const c of result.faceBlendshapes?.[0]?.categories ?? []) {
    blendshapes.set(c.categoryName, c.score);
  }

  const raw = result.facialTransformationMatrixes?.[0]?.data;
  return {
    points,
    matrix: raw ? Float32Array.from(raw) : null,
    blendshapes,
    timestamp,
  };
}
