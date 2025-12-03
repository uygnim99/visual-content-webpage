import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

const app = document.getElementById("app");

// 씬 생성 및 배경 하늘색
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

// 카메라
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(3, 3, 5);

// 렌더러
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
app.appendChild(renderer.domElement);

// 조명
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(0, 0, 0);

// OBJ 로더
const objLoader = new OBJLoader();

objLoader.load(
  "resources/dh_ddpm100.obj",
  (object) => {
    // 기본 재질 및 설정
    object.traverse((child) => {
      if (child.isMesh) {
        if (!child.material) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.6,
            metalness: 0.1,
          });
        }
      }
    });

    // 크기/위치 자동 정규화
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    object.position.x -= center.x;
    object.position.y -= center.y;
    object.position.z -= center.z;

    const box2 = new THREE.Box3().setFromObject(object);
    const size2 = new THREE.Vector3();
    box2.getSize(size2);
    const maxDim = Math.max(size2.x, size2.y, size2.z);

    const desiredSize = 5;
    const scale = maxDim > 0 ? desiredSize / maxDim : 1;
    object.scale.set(scale, scale, scale);

    scene.add(object);

    // 카메라 재배치
    const distance = desiredSize * 2.5;
    camera.position.set(distance, distance, distance);
    camera.lookAt(0, 0, 0);

    console.log("OBJ 로드 완료", { size, center, size2, maxDim, scale });
  },
  (xhr) => {
    if (xhr.total) {
      console.log(`OBJ 로딩 중... ${(xhr.loaded / xhr.total) * 100}%`);
    } else {
      console.log(`OBJ 로딩 중... ${xhr.loaded} bytes`);
    }
  },
  (error) => {
    console.error("OBJ 로드 실패:", error);
  }
);

// 리사이즈
window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});

// 렌더 루프
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();


