import * as THREE from "three";

/**
 * Cel shading: light falls into three flat bands instead of a gradient, and a
 * soft rim of sky light picks out every silhouette against what is behind it.
 */
let bands: THREE.DataTexture | null = null;

function gradient(): THREE.DataTexture {
  if (bands) return bands;
  const steps = [90, 170, 255];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  bands = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  bands.minFilter = THREE.NearestFilter;
  bands.magFilter = THREE.NearestFilter;
  bands.generateMipmaps = false;
  bands.needsUpdate = true;
  return bands;
}

const RIM = new THREE.Color(0xfff6dc);

export interface ToonOptions {
  emissive?: number;
  rim?: number;
  flat?: boolean;
  transparent?: boolean;
  opacity?: number;
}

export function toon(color: number, opts: ToonOptions = {}): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({
    color,
    gradientMap: gradient(),
    emissive: opts.emissive ?? 0x000000,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  });
  const rim = opts.rim ?? 0.35;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: RIM };
    shader.uniforms.rimStrength = { value: rim };
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 rimColor;\nuniform float rimStrength;")
      .replace(
        "#include <opaque_fragment>",
        `{
          float facing = max(dot(normalize(vViewPosition), normal), 0.0);
          float rim = smoothstep(0.62, 0.95, 1.0 - facing);
          outgoingLight += rimColor * rim * rimStrength;
        }
        #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => "gods-toon";
  return m;
}

/** One shared material per colour, for scenery that never flashes or fades. */
const shared = new Map<number, THREE.MeshToonMaterial>();
export function toonShared(color: number): THREE.MeshToonMaterial {
  let m = shared.get(color);
  if (!m) {
    m = toon(color);
    shared.set(color, m);
  }
  return m;
}
