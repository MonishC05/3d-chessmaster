"use client";

import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";

type Props = {
  fen: string;
  orientation?: "w" | "b";
  selected?: string;
  hintMove?: { from: string; to: string };
  lastMove?: { from: string; to: string };
  onSquareClick: (square: string) => void;
};

type TileMesh = THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;

type BoardRuntime = {
  camera: THREE.PerspectiveCamera;
  hintGroup: THREE.Group;
  piecesGroup: THREE.Group;
  renderer: THREE.WebGLRenderer;
  render: () => void;
  scene: THREE.Scene;
  squaresGroup: THREE.Group;
  tiles: Map<Square, TileMesh>;
};

const files = "abcdefgh";
const pieceNames: Record<PieceSymbol, string> = {
  b: "bishop",
  k: "king",
  n: "knight",
  p: "pawn",
  q: "queen",
  r: "rook",
};

function squarePosition(square: string, orientation: "w" | "b") {
  const file = files.indexOf(square[0]);
  const rank = Number(square[1]) - 1;
  const x = file - 3.5;
  const z = 3.5 - rank;
  return orientation === "w"
    ? new THREE.Vector3(x, 0, z)
    : new THREE.Vector3(-x, 0, -z);
}

function squareRows(orientation: "w" | "b") {
  const fileOrder = orientation === "w" ? [...files] : [...files].reverse();
  const rankOrder = orientation === "w"
    ? [8, 7, 6, 5, 4, 3, 2, 1]
    : [1, 2, 3, 4, 5, 6, 7, 8];

  return rankOrder.map((rank) =>
    fileOrder.map((file) => `${file}${rank}` as Square),
  );
}

function baseSquareColor(square: Square) {
  const file = files.indexOf(square[0]);
  const rank = Number(square[1]) - 1;
  return (file + rank) % 2 === 1 ? 0xc9c3ae : 0x214d42;
}

function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  root.traverse((object) => {
    const disposable = object as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };

    if (disposable.geometry) geometries.add(disposable.geometry);
    if (disposable.material) {
      const objectMaterials = Array.isArray(disposable.material)
        ? disposable.material
        : [disposable.material];
      for (const material of objectMaterials) materials.add(material);
    }
  });

  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

function clearGroup(group: THREE.Group) {
  for (const child of [...group.children]) {
    group.remove(child);
    disposeObject(child);
  }
}

function updateTileAppearance(tile: TileMesh, color: number, focused: boolean) {
  tile.material.color.setHex(color);
  tile.material.emissive.setHex(focused ? 0x5f4700 : 0x000000);
  tile.material.emissiveIntensity = focused ? 0.38 : 0;
}

function pieceMesh(type: PieceSymbol, color: Color) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: color === "w" ? 0xe9e4d5 : 0x242b2a,
    roughness: 0.48,
    metalness: color === "w" ? 0.08 : 0.22,
  });
  const add = (geometry: THREE.BufferGeometry, y: number, scale = 1) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = y;
    mesh.scale.setScalar(scale);
    mesh.castShadow = true;
    group.add(mesh);
  };

  add(new THREE.CylinderGeometry(0.34, 0.42, 0.16, 24), 0.08);
  add(new THREE.CylinderGeometry(0.25, 0.32, 0.18, 24), 0.22);
  const heights: Record<PieceSymbol, number> = {
    b: 0.9,
    k: 1.16,
    n: 0.78,
    p: 0.55,
    q: 1.05,
    r: 0.82,
  };
  add(
    new THREE.CylinderGeometry(
      type === "p" ? 0.17 : 0.2,
      0.27,
      heights[type] * 0.62,
      24,
    ),
    0.42,
  );

  if (type === "p") add(new THREE.SphereGeometry(0.22, 24, 16), 0.78);
  if (type === "n") {
    const head = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.62, 4),
      material,
    );
    head.position.set(0.08, 0.9, -0.05);
    head.rotation.z = -0.25;
    head.rotation.y = Math.PI / 4;
    head.castShadow = true;
    group.add(head);
  }
  if (type === "b") {
    add(new THREE.SphereGeometry(0.25, 24, 16), 0.88);
    add(new THREE.ConeGeometry(0.12, 0.3, 20), 1.13);
  }
  if (type === "r") {
    add(new THREE.CylinderGeometry(0.3, 0.24, 0.3, 8), 0.86);
  }
  if (type === "q") {
    add(new THREE.SphereGeometry(0.24, 24, 16), 0.98);
    add(new THREE.ConeGeometry(0.18, 0.32, 20), 1.24);
  }
  if (type === "k") {
    add(new THREE.SphereGeometry(0.23, 24, 16), 1.02);
    const vertical = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.42, 0.1),
      material,
    );
    const horizontal = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.1, 0.1),
      material,
    );
    vertical.position.y = 1.35;
    horizontal.position.y = 1.39;
    vertical.castShadow = true;
    horizontal.castShadow = true;
    group.add(vertical, horizontal);
  }

  return group;
}

export function ThreeBoard({
  fen,
  orientation = "w",
  selected,
  hintMove,
  lastMove,
  onSquareClick,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<BoardRuntime>(null);
  const clickRef = useRef(onSquareClick);
  const [keyboardSquare, setKeyboardSquare] = useState<Square>("a1");

  const rows = useMemo(() => squareRows(orientation), [orientation]);
  const orderedSquares = useMemo(() => rows.flat(), [rows]);
  const pieceLabels = useMemo(() => {
    const labels = new Map<Square, string>();
    const chess = new Chess(fen);
    for (const row of chess.board()) {
      for (const piece of row) {
        if (!piece) continue;
        labels.set(
          piece.square,
          `${piece.color === "w" ? "white" : "black"} ${pieceNames[piece.type]}`,
        );
      }
    }
    return labels;
  }, [fen]);

  useEffect(() => {
    clickRef.current = onSquareClick;
  }, [onSquareClick]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090c0b);
    scene.fog = new THREE.Fog(0x090c0b, 12, 24);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 10.5, 10.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xd8fff1, 0x121815, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(-5, 10, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    scene.add(key);
    const rim = new THREE.PointLight(0x34d399, 25, 18);
    rim.position.set(6, 5, -4);
    scene.add(rim);

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.45, 9),
      new THREE.MeshStandardMaterial({ color: 0x111816, roughness: 0.72 }),
    );
    base.position.y = -0.28;
    base.receiveShadow = true;
    scene.add(base);

    const squaresGroup = new THREE.Group();
    const piecesGroup = new THREE.Group();
    const hintGroup = new THREE.Group();
    const tiles = new Map<Square, TileMesh>();

    for (const file of files) {
      for (let rank = 1; rank <= 8; rank += 1) {
        const square = `${file}${rank}` as Square;
        const material = new THREE.MeshStandardMaterial({
          color: baseSquareColor(square),
          roughness: 0.75,
        });
        const tile = new THREE.Mesh(
          new THREE.BoxGeometry(0.98, 0.12, 0.98),
          material,
        );
        const position = squarePosition(square, "w");
        tile.position.set(position.x, -0.03, position.z);
        tile.receiveShadow = true;
        tile.userData.square = square;
        squaresGroup.add(tile);
        tiles.set(square, tile);
      }
    }
    scene.add(squaresGroup, piecesGroup, hintGroup);

    const render = () => renderer.render(scene, camera);
    const runtime: BoardRuntime = {
      camera,
      hintGroup,
      piecesGroup,
      renderer,
      render,
      scene,
      squaresGroup,
      tiles,
    };
    runtimeRef.current = runtime;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const handlePointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(
        [squaresGroup, piecesGroup],
        true,
      )[0];
      const square = hit?.object.userData.square as string | undefined;
      if (square) clickRef.current(square);
    };
    renderer.domElement.addEventListener("pointerdown", handlePointer);

    const resize = () => {
      const width = mount.clientWidth;
      if (!width) return;
      const height = Math.max(420, Math.min(width, 760));
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    return () => {
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointer);
      if (runtimeRef.current === runtime) runtimeRef.current = null;
      disposeObject(scene);
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    for (const [square, tile] of runtime.tiles) {
      const position = squarePosition(square, orientation);
      tile.position.set(position.x, -0.03, position.z);
    }
    runtime.render();
  }, [orientation]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    clearGroup(runtime.piecesGroup);

    const chess = new Chess(fen);
    for (const row of chess.board()) {
      for (const piece of row) {
        if (!piece) continue;
        const position = squarePosition(piece.square, orientation);
        const mesh = pieceMesh(piece.type, piece.color);
        mesh.position.set(position.x, 0.03, position.z);
        mesh.userData.square = piece.square;
        mesh.traverse((child) => {
          child.userData.square = piece.square;
        });
        runtime.piecesGroup.add(mesh);
      }
    }
    runtime.render();
  }, [fen, orientation]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    for (const [square, tile] of runtime.tiles) {
      const wasLastMove = lastMove?.from === square || lastMove?.to === square;
      updateTileAppearance(
        tile,
        selected === square
          ? 0xf59e0b
          : wasLastMove
            ? 0x2f755f
            : baseSquareColor(square),
        keyboardSquare === square,
      );
    }
    runtime.render();
  }, [keyboardSquare, lastMove?.from, lastMove?.to, selected]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    clearGroup(runtime.hintGroup);

    if (hintMove) {
      const start = squarePosition(hintMove.from, orientation).setY(0.32);
      const end = squarePosition(hintMove.to, orientation).setY(0.32);
      const direction = end.clone().sub(start);
      const length = direction.length();
      if (length > 0) {
        runtime.hintGroup.add(
          new THREE.ArrowHelper(
            direction.normalize(),
            start,
            length,
            0xfbbf24,
            0.38,
            0.24,
          ),
        );
      }
    }
    runtime.render();
  }, [hintMove, orientation]);

  function handleGridKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = orderedSquares.indexOf(keyboardSquare);
    if (currentIndex < 0) return;
    const row = Math.floor(currentIndex / 8);
    const column = currentIndex % 8;
    let nextIndex: number | undefined;

    if (event.key === "ArrowLeft" && column > 0) nextIndex = currentIndex - 1;
    if (event.key === "ArrowRight" && column < 7) nextIndex = currentIndex + 1;
    if (event.key === "ArrowUp" && row > 0) nextIndex = currentIndex - 8;
    if (event.key === "ArrowDown" && row < 7) nextIndex = currentIndex + 8;
    if (event.key === "Home") nextIndex = row * 8;
    if (event.key === "End") nextIndex = row * 8 + 7;
    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextSquare = orderedSquares[nextIndex];
    setKeyboardSquare(nextSquare);
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-square="${nextSquare}"]`)
      ?.focus();
  }

  const boardStatus = [
    selected ? `${selected} selected.` : undefined,
    lastMove ? `Last move from ${lastMove.from} to ${lastMove.to}.` : undefined,
    hintMove ? `Suggested move from ${hintMove.from} to ${hintMove.to}.` : undefined,
  ].filter(Boolean).join(" ");

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
      <div aria-hidden="true" ref={mountRef} />
      <div
        aria-label={`Chess board, ${orientation === "w" ? "White" : "Black"} perspective. Use arrow keys to move between squares and Enter or Space to select a square.`}
        className="pointer-events-none absolute inset-0 grid grid-rows-8"
        ref={gridRef}
        role="grid"
      >
        {rows.map((row, rowIndex) => (
          <div className="grid grid-cols-8" key={rowIndex} role="row">
            {row.map((square) => {
              const piece = pieceLabels.get(square) ?? "empty";
              const isSelected = selected === square;
              return (
                <button
                  aria-label={`${square}, ${piece}${isSelected ? ", selected" : ""}`}
                  aria-selected={isSelected}
                  className="pointer-events-none grid place-items-center border border-transparent bg-transparent text-xs font-semibold text-transparent outline-none focus-visible:border-amber-200/80 focus-visible:bg-amber-300/20 focus-visible:text-amber-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-300"
                  data-square={square}
                  key={square}
                  onClick={() => clickRef.current(square)}
                  onFocus={() => setKeyboardSquare(square)}
                  onKeyDown={handleGridKeyDown}
                  role="gridcell"
                  tabIndex={keyboardSquare === square ? 0 : -1}
                  type="button"
                >
                  {square}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p aria-live="polite" className="sr-only">
        {boardStatus}
      </p>
    </div>
  );
}
