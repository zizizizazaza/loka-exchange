import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * 3D illustration of an HGX-style 8-GPU board, built in three.js with no models or images.
 * Rotates slowly, can be dragged, stays still when reduced motion is requested.
 * Ported from the prototype's mountServers(), same three.js release (r128).
 * The default is lit for the pale panel behind it on the detail pages; `tone="dark"` lifts the metal and adds rim
 * light so the black heat sinks still read on a black background (Markets v7 hero).
 */
export function Server3D({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const W = el.clientWidth;
    const H = el.clientHeight;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dark = tone === 'dark';

    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(2, devicePixelRatio));
    r.setSize(W, H);
    r.outputEncoding = THREE.sRGBEncoding;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = dark ? 0.9 : 0.82;
    el.appendChild(r.domElement);

    const sc = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(26, W / H, 0.1, 100);
    cam.position.set(7.1, 5.9, 7.8);
    cam.lookAt(0, 0.25, 0.15);
    sc.add(new THREE.HemisphereLight(0xffffff, 0x6f6f6b, dark ? 0.3 : 0.45));
    const key = new THREE.DirectionalLight(0xffffff, 1.35);
    key.position.set(4, 9, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    key.shadow.radius = 6;
    key.shadow.bias = -0.0008;
    sc.add(key);
    const fill = new THREE.DirectionalLight(0xe9efe9, 0.55);
    fill.position.set(-6, 4, 3);
    sc.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, dark ? 1.3 : 0.8);
    rim.position.set(-3, 5, -7);
    sc.add(rim);
    if (dark) {
      const rim2 = new THREE.DirectionalLight(0xffffff, 0.7);
      rim2.position.set(7, 3, -5);
      sc.add(rim2);
    }

    const tex = (w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      draw(c.getContext('2d')!, w, h);
      const t = new THREE.CanvasTexture(c);
      t.anisotropy = 8;
      t.encoding = THREE.sRGBEncoding;
      return t;
    };
    const mat = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);
    const black = mat({ color: dark ? 0x101212 : 0x0b0c0c, metalness: 0.55, roughness: 0.4 });
    const black2 = mat({ color: dark ? 0x181a1a : 0x151616, metalness: 0.5, roughness: 0.5 });
    const fin = mat({ color: dark ? 0x1e2020 : 0x1a1b1b, metalness: 0.7, roughness: 0.32 });
    const gold = mat({ color: 0xc8a45a, metalness: 0.9, roughness: 0.3 });
    const plateT = tex(256, 384, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, '#cbbfa8');
      gr.addColorStop(0.5, '#b3a68e');
      gr.addColorStop(1, '#c4b8a0');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(60,50,35,.35)';
      g.fillRect(24, h - 70, w * 0.42, 10);
      g.fillRect(24, h - 50, w * 0.28, 7);
      g.strokeStyle = 'rgba(255,255,255,.25)';
      g.lineWidth = 3;
      g.strokeRect(6, 6, w - 12, h - 12);
    });
    const plate = mat({ map: plateT, metalness: 0.75, roughness: 0.32 });
    const ribT = tex(512, 64, (g, w, h) => {
      g.fillStyle = '#1c1d1d';
      g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 4) {
        g.fillStyle = x % 8 ? '#0e0f0f' : '#2a2c2c';
        g.fillRect(x, 0, 2, h);
      }
    });
    ribT.wrapS = ribT.wrapT = THREE.RepeatWrapping;
    ribT.repeat.set(1, 6);
    const rib = mat({ map: ribT, metalness: 0.55, roughness: 0.45 });
    const pcbT = tex(512, 512, (g, w, h) => {
      g.fillStyle = dark ? '#1a1c1c' : '#121313';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(120,120,110,.12)';
      g.lineWidth = 1;
      for (let i = 0; i < 60; i++) {
        g.beginPath();
        const y = Math.random() * h;
        g.moveTo(0, y);
        g.lineTo(w * Math.random(), y);
        g.stroke();
      }
    });
    const pcb = mat({ map: pcbT, metalness: 0.3, roughness: 0.6 });

    const grp = new THREE.Group();
    sc.add(grp);
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, cast = true) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      grp.add(mesh);
      return mesh;
    };
    // Board
    add(new THREE.BoxGeometry(4.9, 0.07, 4.1), pcb, 0, 0.035, 0);
    add(new THREE.BoxGeometry(4.9, 0.012, 0.06), gold, 0, 0.075, 2.02, false);
    // Front connectors and power modules
    for (let i = 0; i < 7; i++) {
      add(new THREE.BoxGeometry(0.42, 0.16, 0.22), black2, -1.95 + i * 0.62, 0.15, 1.88);
      add(new THREE.BoxGeometry(0.3, 0.02, 0.04), gold, -1.95 + i * 0.62, 0.235, 1.99, false);
    }
    add(new THREE.BoxGeometry(0.9, 0.28, 0.5), black2, -1.85, 0.21, 1.45);
    add(new THREE.BoxGeometry(0.9, 0.28, 0.5), black2, -0.8, 0.21, 1.45);
    for (let i = 0; i < 10; i++) add(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 12), black2, 0.2 + i * 0.2, 0.13, 1.55);
    // 8 heat sinks in two rows of 4: 18 fins, a cap and a nameplate each
    const TW = 0.98;
    const TD = 1.28;
    const TH = 1.3;
    const finG = new THREE.BoxGeometry(TW - 0.04, TH - 0.12, 0.026);
    const fins = new THREE.InstancedMesh(finG, fin, 8 * 18);
    fins.castShadow = true;
    fins.receiveShadow = true;
    let fi = 0;
    const mm = new THREE.Matrix4();
    const xs = [-1.62, -0.54, 0.54, 1.62];
    const zs = [-1.02, 0.62];
    zs.forEach((z) =>
      xs.forEach((x) => {
        for (let k = 0; k < 18; k++) {
          mm.makeTranslation(x, 0.07 + (TH - 0.12) / 2 + 0.02, z - TD / 2 + 0.08 + (k * (TD - 0.16)) / 17);
          fins.setMatrixAt(fi++, mm);
        }
        add(new THREE.BoxGeometry(TW, 0.08, TD), black, x, 0.07 + TH - 0.04, z);
        add(new THREE.BoxGeometry(TW * 0.8, 0.012, TD * 0.74), plate, x, 0.07 + TH + 0.006, z + 0.04, false);
        add(new THREE.BoxGeometry(TW, TH - 0.1, 0.05), black, x, 0.07 + (TH - 0.1) / 2, z - TD / 2 + 0.025);
        add(new THREE.BoxGeometry(TW, TH - 0.1, 0.05), black, x, 0.07 + (TH - 0.1) / 2, z + TD / 2 - 0.025);
        add(new THREE.BoxGeometry(TW * 0.9, 0.04, TD * 0.9), black2, x, 0.09, z);
      }),
    );
    grp.add(fins);
    // Switch heat-sink strip in the middle
    add(new THREE.BoxGeometry(4.3, TH - 0.08, 0.42), rib, 0, 0.07 + (TH - 0.08) / 2, -0.2);
    add(new THREE.BoxGeometry(4.3, 0.05, 0.44), black, 0, 0.07 + TH - 0.06, -0.2);
    // Ground shadow
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.22 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    sc.add(ground);
    grp.position.set(0, 0, 0);

    let ry = -0.5;
    let drag: { x: number; ry: number } | null = null;
    const vel = still ? 0 : 0.0022;
    el.onpointerdown = (e) => {
      drag = { x: e.clientX, ry };
      el.setPointerCapture(e.pointerId);
      el.classList.add('grab');
    };
    el.onpointermove = (e) => {
      if (drag) ry = drag.ry + (e.clientX - drag.x) * 0.01;
    };
    el.onpointerup = el.onpointercancel = () => {
      drag = null;
      el.classList.remove('grab');
    };

    // Follow the container's size (window resizes, layout breakpoints); skip while it is hidden.
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      r.setSize(w, h);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    });
    ro.observe(el);

    let raf = 0;
    const tick = () => {
      if (!drag) ry += vel;
      grp.rotation.y = ry;
      r.render(sc, cam);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.onpointerdown = el.onpointermove = el.onpointerup = el.onpointercancel = null;
      r.dispose();
      r.domElement.remove();
    };
  }, [tone]);

  return <div className="srv3d" data-n="1" aria-label="3D illustration of a GPU server" ref={ref}></div>;
}
