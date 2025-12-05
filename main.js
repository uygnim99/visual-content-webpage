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
  { type: "pinkhair", prompt: "a photo of sks face with pink hair" },
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

// 로딩 상태 추적
let loadingStates = {
  faces: false,
  samsung: false,
  car: false,
  nvidia: false,
  beer: false,
  chickenFries: false,
  camera: false,
};

// 로딩 상태 업데이트 함수
function updateLoadingStatus() {
  const statusMap = {
    faces: "Faces",
    samsung: "Samsung",
    car: "Car",
    nvidia: "Nvidia",
    beer: "Beer",
    chickenFries: "Food",
    camera: "Camera",
  };

  Object.keys(loadingStates).forEach((key) => {
    const statusElement = document.getElementById(`status-${key}`);
    if (statusElement) {
      if (loadingStates[key]) {
        statusElement.textContent = `${statusMap[key]}: ✓ Loaded`;
        statusElement.classList.add("loaded");
      } else {
        statusElement.textContent = `${statusMap[key]}: Loading...`;
        statusElement.classList.remove("loaded");
      }
    }
  });
}

// 로딩 화면 숨기기 함수
function hideLoadingScreen() {
  const loadingScreen = document.getElementById("loadingScreen");
  if (loadingScreen) {
    loadingScreen.classList.add("hidden");
    setTimeout(() => {
      loadingScreen.style.display = "none";
    }, 500); // transition 시간과 맞춤
  }
}

// 모든 로딩이 완료되었는지 확인
function checkAllLoaded() {
  updateLoadingStatus();
  
  const allLoaded =
    loadingStates.faces &&
    loadingStates.samsung &&
    loadingStates.car &&
    loadingStates.nvidia &&
    loadingStates.beer &&
    loadingStates.chickenFries &&
    loadingStates.camera;

  if (allLoaded) {
    setTimeout(() => {
      hideLoadingScreen();
    }, 500); // 상태 표시를 잠시 보여준 후 숨김
  }
}

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
              loadingStates.faces = true;
              loadingStates.camera = true;
              console.log("모든 얼굴 모델 로드 완료!");
              checkAllLoaded();
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

// samsung_02.obj를 lee 얼굴 머리 위에 배치
function loadSamsungObjects() {
  const leeIndex = 1; // lee는 faceBaseNames[1]
  const filePath = "resources/objects/samsung_00.obj";

  // lee 얼굴의 위치 계산
  const leeAngle = (angles[leeIndex] * Math.PI) / 180;
  const leeX = Math.sin(leeAngle) * radius;
  const leeZ = Math.cos(leeAngle) * radius;
  const normalizedLeeAngle = Math.abs(angles[leeIndex]) / 60;
  const leeY = archHeight * (1 - normalizedLeeAngle * 0.5);

  objLoader.load(
    filePath,
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

      // 오브젝트 크기 조정
      const desiredSize = 1.5;
      const scale = maxDim > 0 ? desiredSize / maxDim : 1;
      object.scale.set(scale, scale, scale);

      // 회전
      object.rotateY(-Math.PI/3);
      object.rotateZ(Math.PI/3);
      object.rotateX(-Math.PI/3);

      // lee 얼굴 머리 위에 배치
      const offsetY = 2.5; // 머리 위 높이
      object.position.set(leeX, leeY + offsetY, leeZ);

      scene.add(object);
      loadingStates.samsung = true;
      checkAllLoaded();
      console.log(`Samsung 오브젝트 로드 완료: ${filePath}`);
    },
    undefined,
    (error) => {
      console.error(`Samsung 오브젝트 로드 실패: ${filePath}`, error);
      loadingStates.samsung = true;
      checkAllLoaded();
    }
  );
}

// car_01.obj를 jeong 얼굴 머리 위에 배치
function loadCarObjects() {
  const jeongIndex = 2; // jeong은 faceBaseNames[2]
  const filePath = "resources/objects/car_01.obj";

  // jeong 얼굴의 위치 계산
  const jeongAngle = (angles[jeongIndex] * Math.PI) / 180;
  const jeongX = Math.sin(jeongAngle) * radius;
  const jeongZ = Math.cos(jeongAngle) * radius;
  const normalizedJeongAngle = Math.abs(angles[jeongIndex]) / 60;
  const jeongY = archHeight * (1 - normalizedJeongAngle * 0.5);

  objLoader.load(
    filePath,
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

      // 오브젝트 크기 조정
      const desiredSize = 1.5;
      const scale = maxDim > 0 ? desiredSize / maxDim : 1;
      object.scale.set(scale, scale, scale);

      // jeong 얼굴 머리 위에 배치
      const offsetY = 2.0; // 머리 위 높이
      const offsetZ = -0.5
      object.position.set(jeongX, jeongY + offsetY, jeongZ + offsetZ);

      scene.add(object);
      loadingStates.car = true;
      checkAllLoaded();
      console.log(`Car 오브젝트 로드 완료: ${filePath}`);
    },
    undefined,
    (error) => {
      console.error(`Car 오브젝트 로드 실패: ${filePath}`, error);
      loadingStates.car = true;
      checkAllLoaded();
    }
  );
}

// nvidia_00.obj를 jenson 얼굴 머리 위에 배치
function loadNvidiaObjects() {
  const jensonIndex = 3; // jenson은 faceBaseNames[3]
  const filePath = "resources/objects/nvidia_00.obj";

  // jenson 얼굴의 위치 계산
  const jensonAngle = (angles[jensonIndex] * Math.PI) / 180;
  const jensonX = Math.sin(jensonAngle) * radius;
  const jensonZ = Math.cos(jensonAngle) * radius;
  const normalizedJensonAngle = Math.abs(angles[jensonIndex]) / 60;
  const jensonY = archHeight * (1 - normalizedJensonAngle * 0.5);

  objLoader.load(
    filePath,
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

      // 오브젝트 크기 조정
      const desiredSize = 1.5;
      const scale = maxDim > 0 ? desiredSize / maxDim : 1;
      object.scale.set(scale, scale, scale);

      // jenson 얼굴 머리 위에 배치
      const offsetY = 2.0; // 머리 위 높이
      object.position.set(jensonX, jensonY + offsetY, jensonZ);

      scene.add(object);
      loadingStates.nvidia = true;
      checkAllLoaded();
      console.log(`Nvidia 오브젝트 로드 완료: ${filePath}`);
    },
    undefined,
    (error) => {
      console.error(`Nvidia 오브젝트 로드 실패: ${filePath}`, error);
      loadingStates.nvidia = true;
      checkAllLoaded();
    }
  );
}

// beer_01.obj를 5개 각 인물의 중심점에서 z축으로 -3만큼 offset하여 배치
function loadBeerObjects() {
  const filePath = "resources/objects/beer_01.obj";

  // 5명의 인물 각각에 대해 배치
  faceBaseNames.forEach((_, faceIndex) => {
    // 얼굴 위치 계산
    const faceAngle = (angles[faceIndex] * Math.PI) / 180;
    const faceX = Math.sin(faceAngle) * radius;
    const faceZ = Math.cos(faceAngle) * radius;
    const normalizedFaceAngle = Math.abs(angles[faceIndex]) / 60;
    const faceY = archHeight * (1 - normalizedFaceAngle * 0.5);

    objLoader.load(
      filePath,
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

        // 오브젝트 크기 조정
        const desiredSize = 0.8;
        const scale = maxDim > 0 ? desiredSize / maxDim : 1;
        object.scale.set(scale, scale, scale);

        // 각 얼굴의 중심점에서 z축으로 -3만큼 offset하여 배치
        const offsetZ = -1;
        const offsetY = -1
        object.position.set(faceX, faceY + offsetY, faceZ + offsetZ);

        scene.add(object);
        // 모든 beer 오브젝트가 로드되었는지 확인
        if (faceIndex === faceBaseNames.length - 1) {
          loadingStates.beer = true;
          checkAllLoaded();
        }
        console.log(`Beer 오브젝트 로드 완료: ${filePath} (faceIndex: ${faceIndex})`);
      },
      undefined,
      (error) => {
        console.error(`Beer 오브젝트 로드 실패: ${filePath}`, error);
        if (faceIndex === faceBaseNames.length - 1) {
          loadingStates.beer = true;
          checkAllLoaded();
        }
      }
    );
  });
}

// chicken, fries 오브젝트들을 카메라 앞에 원형으로 배치
function loadChickenFriesObjects() {
  const foodFiles = [
    "chicken_00.obj", "chicken_01.obj", "chicken_02.obj",
    "fries_00.obj", "fries_01.obj", "fries_02.obj",
  ];

  const totalObjects = foodFiles.length;
  const circleRadius = 3.5; // 원형 배치 반지름 (간격 넓힘)
  const baseZ = 3; // 카메라 앞쪽 z 위치 (1만큼 앞으로)
  const baseY = 0; // y축 동일하게

  foodFiles.forEach((fileName, index) => {
    const filePath = `resources/objects/${fileName}`;

    // 원형 배치 각도 계산
    const angle = (index / totalObjects) * Math.PI * 2;
    const x = Math.cos(angle) * circleRadius;
    const z = baseZ + Math.sin(angle) * circleRadius * 0.3; // 약간의 z축 변화

    objLoader.load(
      filePath,
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

        // 오브젝트 크기 조정 (1.5배)
        const desiredSize = 1.1;
        const scale = maxDim > 0 ? desiredSize / maxDim : 1;
        object.scale.set(scale, scale, scale);

        // 카메라 앞에 원형으로 배치 (2개만 y축 -0.5 낮춤)
        const yOffset = (index === 4 || index === 5) ? -0.5 : 0;
        object.position.set(x, baseY + yOffset, z);

        scene.add(object);
        // 모든 food 오브젝트가 로드되었는지 확인
        if (index === foodFiles.length - 1) {
          loadingStates.chickenFries = true;
          checkAllLoaded();
        }
        console.log(`Food 오브젝트 로드 완료: ${filePath}`, { position: { x, y: baseY, z } });
      },
      undefined,
      (error) => {
        console.error(`Food 오브젝트 로드 실패: ${filePath}`, error);
        if (index === foodFiles.length - 1) {
          loadingStates.chickenFries = true;
          checkAllLoaded();
        }
      }
    );
  });
}

// 초기 로딩 상태 표시
updateLoadingStatus();

// 초기 로드
loadAllFaces();
loadSamsungObjects();
loadCarObjects();
loadNvidiaObjects();
loadBeerObjects();
loadChickenFriesObjects();

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


