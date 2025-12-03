import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

const app = document.getElementById("app");

// 씬 생성 및 기본 배경 (로딩 전 하늘색)
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

// 배경 이미지(와인바 사진) 적용
const textureLoader = new THREE.TextureLoader();
textureLoader.load(
  "resources/Cozy_wine_bar_with_outdoor_seating_and_string_lights.png",
  (texture) => {
    // 색 공간 보정
    if (texture.colorSpace !== undefined) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    // 360 파노라마(equirectangular)로 사용
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;
    console.log("Background texture loaded");
  },
  undefined,
  (error) => {
    console.error("Failed to load background texture:", error);
  }
);

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

    // 모델이 배경 술집 안에서 너무 크게 느껴지지 않도록 약간 더 작게 조정
    const desiredSize = 3; // 숫자를 줄일수록 모델이 더 작게 보이고 공간이 넓게 느껴짐
    const scale = maxDim > 0 ? desiredSize / maxDim : 1;
    object.scale.set(scale, scale, scale);

    scene.add(object);

    // 카메라 재배치 (모델에서 조금 더 떨어진 위치)
    const distance = desiredSize * 3.5;
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


