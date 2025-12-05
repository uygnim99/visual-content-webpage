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

// 얼굴 파일 베이스 이름
const faceBaseNames = ["mg", "lee", "jeong", "jenson", "dh"];

// 변형 타입과 프롬프트 매핑
const variants = [
  { type: "orig", prompt: "a photo of sks face" },
  { type: "sunglass", prompt: "a photo of sks face wearing sunglass" },
  { type: "hat", prompt: "a photo of sks face wearing hat" },
  { type: "beard", prompt: "a photo of sks face wearing beard" },
  { type: "bald", prompt: "a photo of sks face with bald" },
];

// 아치형 배치 설정
const radius = 6; // 반지름 (간격을 좁히기 위해 줄임)
const archHeight = 2; // 아치 높이 (중앙 기준)
const angles = [-60, -30, 0, 30, 60]; // 각도 (도 단위, 간격을 좁힘)

let currentVariantIndex = 0;
let totalLoadedCount = 0;
const totalFilesToLoad = faceBaseNames.length * variants.length;
// 2차원 배열: objects[faceIndex][variantIndex]
const objects = Array(faceBaseNames.length)
  .fill(null)
  .map(() => Array(variants.length).fill(null));
let isInitialLoad = true; // 초기 로드 여부 추적

// 객체를 배치하는 함수
function setupObject(object, index) {
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

  // 모델 크기 조정
  const desiredSize = 2.5;
  const scale = maxDim > 0 ? desiredSize / maxDim : 1;
  object.scale.set(scale, scale, scale);

  // 아치형 배치 계산
  const angle = (angles[index] * Math.PI) / 180; // 라디안 변환
  const x = Math.sin(angle) * radius;
  const z = Math.cos(angle) * radius;
  // Y축은 아치형으로: 중앙이 높고 양 끝이 낮게
  const normalizedAngle = Math.abs(angles[index]) / 60; // 0~1 정규화
  const y = archHeight * (1 - normalizedAngle * 0.5); // 중앙이 높고 양 끝이 낮게

  object.position.set(x, y, z);
  
  // 중앙 지점을 향하도록 회전
  const centerY = archHeight * 0.5; // 아치의 중앙 높이
  object.lookAt(0, centerY, 0);
  // 180도 회전
  object.rotateY(Math.PI);

  return object;
}

// 모든 변형의 얼굴 파일 로드
function loadAllFaces() {
  // 모든 얼굴과 변형 조합 로드
  faceBaseNames.forEach((baseName, faceIndex) => {
    variants.forEach((variant, variantIndex) => {
      const filePath = `resources/faces/${baseName}_${variant.type}.obj`;

      objLoader.load(
        filePath,
        (object) => {
          const setupObj = setupObject(object, faceIndex);
          scene.add(setupObj);
          objects[faceIndex][variantIndex] = setupObj;

          // 처음 로드되는 변형만 보이도록 설정
          if (variantIndex === currentVariantIndex) {
            setupObj.visible = true;
          } else {
            setupObj.visible = false;
          }

          totalLoadedCount++;
          console.log(`OBJ 로드 완료: ${filePath}`, {
            position: setupObj.position,
            angle: angles[faceIndex],
          });

          // 모든 파일이 로드되면 초기 로드 시에만 카메라 위치 조정
          if (totalLoadedCount === totalFilesToLoad) {
            if (isInitialLoad) {
              // 카메라를 원점에 배치
              camera.position.set(0, 0, -5);

              // 중앙에 있는 obj (angle이 0인 객체)를 향하도록 설정
              // 중앙 객체의 위치: (0, archHeight, radius)
              const centerObjY = archHeight;
              const centerObjZ = radius;
              camera.lookAt(0, centerObjY, centerObjZ);
              controls.target.set(0, centerObjY, centerObjZ);
              controls.update();
              isInitialLoad = false; // 초기 로드 완료
              console.log("모든 얼굴 모델 로드 완료!");
            }
          }
        },
        (xhr) => {
          if (xhr.total) {
            console.log(
              `${filePath} 로딩 중... ${((xhr.loaded / xhr.total) * 100).toFixed(1)}%`
            );
          } else {
            console.log(`${filePath} 로딩 중... ${xhr.loaded} bytes`);
          }
        },
        (error) => {
          console.error(`OBJ 로드 실패: ${filePath}`, error);
          totalLoadedCount++;
        }
      );
    });
  });
}

// 특정 변형만 보이도록 설정
function showVariant(variantIndex) {
  faceBaseNames.forEach((_, faceIndex) => {
    variants.forEach((_, vIndex) => {
      if (objects[faceIndex][vIndex]) {
        objects[faceIndex][vIndex].visible = vIndex === variantIndex;
      }
    });
  });
}

// 초기 로드
loadAllFaces();

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

// 버튼 클릭 이벤트
const editButton = document.querySelector(".edit-prompt");
const textBox = document.querySelector(".text-box");

editButton.addEventListener("click", () => {
  // 다음 변형으로 이동
  currentVariantIndex = (currentVariantIndex + 1) % variants.length;
  
  // 프롬프트 텍스트 업데이트
  textBox.textContent = variants[currentVariantIndex].prompt;
  
  // 해당 변형만 보이도록 show/hide 전환
  showVariant(currentVariantIndex);
});

// 초기 프롬프트 텍스트 설정
textBox.textContent = variants[currentVariantIndex].prompt;


