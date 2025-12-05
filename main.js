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

// 배경 이미지 목록 (동적으로 탐색)
let backgroundImages = [];
let currentBackgroundIndex = 0;

// 배경 이미지(와인바 사진) 적용
const textureLoader = new THREE.TextureLoader();

// 배경 폴더에서 모든 PNG 파일을 동적으로 찾는 함수
async function discoverBackgroundImages() {
  const backgroundsDir = "resources/backgrounds/";
  const foundImages = [];
  
  // 파일 존재 여부 확인 함수 (Image 객체 사용)
  function checkImageExists(filePath) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = filePath;
      // 타임아웃 설정 (1.5초)
      setTimeout(() => resolve(false), 1500);
    });
  }
  
  // panorama*.png 패턴 찾기 (*는 숫자만, 자릿수는 동적)
  // panorama1.png, panorama2.png, ... panorama10.png, panorama11.png 등을 찾음
  let index = 1;
  let consecutiveFailures = 0;
  const maxConsecutiveFailures = 20; // 연속으로 20개를 찾지 못하면 중단
  
  while (index <= 10000 && consecutiveFailures < maxConsecutiveFailures) {
    const fileName = `panorama${index}.png`;
    const filePath = `${backgroundsDir}${fileName}`;
    
    const exists = await checkImageExists(filePath);
    if (exists) {
      foundImages.push(filePath);
      consecutiveFailures = 0;
    } else {
      consecutiveFailures++;
    }
    
    index++;
  }
  
  // 파일명으로 정렬 (숫자 순서)
  foundImages.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] || "0");
    const numB = parseInt(b.match(/\d+/)?.[0] || "0");
    return numA - numB;
  });
  
  backgroundImages = foundImages;
  console.log(`Found ${backgroundImages.length} PNG background images:`, backgroundImages);
  
  // 이미지를 찾았으면 첫 번째 배경 로드
  if (backgroundImages.length > 0) {
    loadBackground(0);
  } else {
    console.warn("No PNG images found in resources/backgrounds/");
  }
}

// 배경 이미지 로드 함수
function loadBackground(index) {
  if (backgroundImages.length === 0) {
    console.warn("No background images available");
    return;
  }
  
  const imagePath = backgroundImages[index];
  textureLoader.load(
    imagePath,
    (texture) => {
      // 색 공간 보정
      if (texture.colorSpace !== undefined) {
        texture.colorSpace = THREE.SRGBColorSpace;
      }
      // 360 파노라마(equirectangular)로 사용
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.background = texture;
      console.log(`Background texture loaded: ${imagePath}`);
    },
    undefined,
    (error) => {
      console.error(`Failed to load background texture: ${imagePath}`, error);
    }
  );
}

// 배경 변경 함수
function changeBackground() {
  if (backgroundImages.length === 0) {
    console.warn("No background images available");
    return;
  }
  currentBackgroundIndex = (currentBackgroundIndex + 1) % backgroundImages.length;
  loadBackground(currentBackgroundIndex);
}

// 배경 이미지 탐색 시작
discoverBackgroundImages();

// 조명 (밝게 설정)
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// 추가 조명으로 더 밝게
const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight2.position.set(-5, 5, -7);
scene.add(dirLight2);

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
          roughness: 0.4,
          metalness: 0.1,
          emissive: 0x222222, // 자체 발광으로 밝게
        });
      } else {
        // 기존 재질도 밝게 조정
        if (child.material.color) {
          child.material.color.multiplyScalar(1.5); // 색상 밝게
        }
        if (child.material.emissive) {
          child.material.emissive.setHex(0x222222); // 자체 발광 추가
        } else {
          child.material.emissive = new THREE.Color(0x222222);
        }
        child.material.needsUpdate = true;
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
              roughness: 0.4,
              metalness: 0.1,
              emissive: 0x222222, // 자체 발광으로 밝게
            });
          } else {
            // 기존 재질도 밝게 조정
            if (child.material.color) {
              child.material.color.multiplyScalar(1.5); // 색상 밝게
            }
            if (child.material.emissive) {
              child.material.emissive.setHex(0x222222); // 자체 발광 추가
            } else {
              child.material.emissive = new THREE.Color(0x222222);
            }
            child.material.needsUpdate = true;
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
              roughness: 0.4,
              metalness: 0.1,
              emissive: 0x222222, // 자체 발광으로 밝게
            });
          } else {
            // 기존 재질도 밝게 조정
            if (child.material.color) {
              child.material.color.multiplyScalar(1.5); // 색상 밝게
            }
            if (child.material.emissive) {
              child.material.emissive.setHex(0x222222); // 자체 발광 추가
            } else {
              child.material.emissive = new THREE.Color(0x222222);
            }
            child.material.needsUpdate = true;
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
              roughness: 0.4,
              metalness: 0.1,
              emissive: 0x222222, // 자체 발광으로 밝게
            });
          } else {
            // 기존 재질도 밝게 조정
            if (child.material.color) {
              child.material.color.multiplyScalar(1.5); // 색상 밝게
            }
            if (child.material.emissive) {
              child.material.emissive.setHex(0x222222); // 자체 발광 추가
            } else {
              child.material.emissive = new THREE.Color(0x222222);
            }
            child.material.needsUpdate = true;
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

// 애니메이션 상태
let isAnimating = false;
let originalCameraPosition = new THREE.Vector3();
let originalTarget = new THREE.Vector3();

// 카메라를 한바퀴 회전시키는 함수
function rotateCamera360(duration, callback) {
  const startTime = Date.now();
  const startPosition = camera.position.clone();
  const target = controls.target.clone();
  
  // 카메라와 타겟 사이의 거리 계산
  const distance = startPosition.distanceTo(target);
  
  // 초기 각도 계산 (spherical coordinates)
  const direction = new THREE.Vector3().subVectors(startPosition, target).normalize();
  let azimuth = Math.atan2(direction.x, direction.z);
  let polar = Math.acos(direction.y);
  
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // 부드러운 easing
    const eased = progress < 0.5 
      ? 2 * progress * progress 
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    
    // 360도 회전 (2π)
    const currentAzimuth = azimuth + eased * Math.PI * 2;
    
    // spherical coordinates를 cartesian으로 변환
    const x = target.x + distance * Math.sin(polar) * Math.sin(currentAzimuth);
    const y = target.y + distance * Math.cos(polar);
    const z = target.z + distance * Math.sin(polar) * Math.cos(currentAzimuth);
    
    camera.position.set(x, y, z);
    camera.lookAt(target);
    controls.target.copy(target);
    controls.update();
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      if (callback) callback();
    }
  };
  
  animate();
}

// 프롬프트 연속 변경 (원점에서)
function changePromptsSequentially(count, interval, callback) {
  let index = 0;
  
  function changeNext() {
    if (index < count) {
      clickEditPrompt();
      index++;
      if (index < count) {
        setTimeout(changeNext, interval);
      } else {
        if (callback) callback();
      }
    }
  }
  
  changeNext();
}

// 좌우 빠르게 회전 (-10도 -> 20도 -> -18도 -> 8도)
function quickLeftRightRotate(duration, callback) {
  const startTime = Date.now();
  const startPosition = camera.position.clone();
  const target = controls.target.clone();
  
  // 카메라와 타겟 사이의 거리 계산
  const distance = startPosition.distanceTo(target);
  
  // 초기 각도 계산
  const direction = new THREE.Vector3().subVectors(startPosition, target).normalize();
  let startAzimuth = Math.atan2(direction.x, direction.z);
  let startPolar = Math.acos(direction.y);
  
  // 회전 각도 시퀀스 (도 단위)
  const rotationSequence = [-10, 20, -18, 8];
  const segmentDuration = duration / rotationSequence.length;
  
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    if (progress < 1) {
      // 현재 세그먼트 계산
      const segmentIndex = Math.min(Math.floor(elapsed / segmentDuration), rotationSequence.length - 1);
      const segmentProgress = (elapsed % segmentDuration) / segmentDuration;
      
      // 현재 세그먼트의 시작과 끝 각도
      const startAngle = segmentIndex === 0 ? 0 : rotationSequence[segmentIndex - 1];
      const endAngle = rotationSequence[segmentIndex];
      
      // 부드러운 보간
      const eased = segmentProgress < 0.5 
        ? 2 * segmentProgress * segmentProgress 
        : 1 - Math.pow(-2 * segmentProgress + 2, 2) / 2;
      
      const currentAngle = startAngle + (endAngle - startAngle) * eased;
      const azimuthOffset = (currentAngle * Math.PI) / 180;
      
      // 각도 계산
      const currentAzimuth = startAzimuth + azimuthOffset;
      const currentPolar = startPolar;
      
      // spherical coordinates를 cartesian으로 변환
      const x = target.x + distance * Math.sin(currentPolar) * Math.sin(currentAzimuth);
      const y = target.y + distance * Math.cos(currentPolar);
      const z = target.z + distance * Math.sin(currentPolar) * Math.cos(currentAzimuth);
      
      camera.position.set(x, y, z);
      camera.lookAt(target);
      controls.target.copy(target);
      controls.update();
      
      requestAnimationFrame(animate);
    } else {
      // 마지막 각도로 설정
      const finalAngle = rotationSequence[rotationSequence.length - 1];
      const azimuthOffset = (finalAngle * Math.PI) / 180;
      const currentAzimuth = startAzimuth + azimuthOffset;
      
      const x = target.x + distance * Math.sin(startPolar) * Math.sin(currentAzimuth);
      const y = target.y + distance * Math.cos(startPolar);
      const z = target.z + distance * Math.sin(startPolar) * Math.cos(currentAzimuth);
      
      camera.position.set(x, y, z);
      camera.lookAt(target);
      controls.target.copy(target);
      controls.update();
      
      if (callback) callback();
    }
  };
  
  animate();
}

// 아치를 따라 translate (faces obj 잘 보이게)
function translateAlongArch(duration, callback) {
  const startTime = Date.now();
  const startPosition = camera.position.clone();
  const startTarget = controls.target.clone();
  
  // 아치형 배치 설정 (main.js의 전역 변수와 동일)
  const archRadius = 6;
  const archHeight = 2;
  const archAngles = [-60, -30, 0, 30, 60];
  
  // 각 얼굴의 위치 계산
  const facePositions = archAngles.map((angle) => {
    const angleRad = (angle * Math.PI) / 180;
    const x = Math.sin(angleRad) * archRadius;
    const z = Math.cos(angleRad) * archRadius;
    const normalizedAngle = Math.abs(angle) / 60;
    const y = archHeight * (1 - normalizedAngle * 0.5);
    return new THREE.Vector3(x, y, z);
  });
  
  // 카메라가 각 얼굴을 바라보도록 위치 계산 (원점에서 얼굴 방향으로)
  const cameraPositions = facePositions.map((facePos) => {
    // 원점(0, 0, 0)에서 얼굴 방향으로 거리를 두고 배치
    const direction = new THREE.Vector3().subVectors(facePos, new THREE.Vector3(0, 0, 0)).normalize();
    const cameraDistance = 8; // 얼굴에서 떨어진 거리
    return new THREE.Vector3(
      -direction.x * cameraDistance,
      facePos.y + 1, // 얼굴보다 약간 위에서
      -direction.z * cameraDistance
    );
  });
  
  const segmentDuration = duration / cameraPositions.length;
  
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    if (progress < 1) {
      // 현재 세그먼트 계산
      const segmentIndex = Math.min(Math.floor(elapsed / segmentDuration), cameraPositions.length - 1);
      const segmentProgress = (elapsed % segmentDuration) / segmentDuration;
      
      // 현재 세그먼트의 시작과 끝 위치
      const startPos = segmentIndex === 0 ? startPosition : cameraPositions[segmentIndex - 1];
      const endPos = cameraPositions[segmentIndex];
      
      // 부드러운 보간
      const eased = segmentProgress < 0.5 
        ? 2 * segmentProgress * segmentProgress 
        : 1 - Math.pow(-2 * segmentProgress + 2, 2) / 2;
      
      const currentPos = new THREE.Vector3().lerpVectors(startPos, endPos, eased);
      
      // 타겟도 해당 얼굴 위치로 설정
      const faceIndex = segmentIndex;
      const currentTarget = facePositions[faceIndex];
      
      camera.position.copy(currentPos);
      camera.lookAt(currentTarget);
      controls.target.copy(currentTarget);
      controls.update();
      
      requestAnimationFrame(animate);
    } else {
      // 마지막 위치로 설정
      const finalPos = cameraPositions[cameraPositions.length - 1];
      const finalTarget = facePositions[facePositions.length - 1];
      
      camera.position.copy(finalPos);
      camera.lookAt(finalTarget);
      controls.target.copy(finalTarget);
      controls.update();
      
      if (callback) callback();
    }
  };
  
  animate();
}

// 제자리에서 작게 두바퀴 회전 (드래그로 작은 원을 그리듯, obj 정면이 잘 보이도록)
function rotateInPlace360x2(duration, callback) {
  const startTime = Date.now();
  // 현재 카메라 위치를 정확히 캡처
  const startPosition = camera.position.clone();
  const target = controls.target.clone();
  
  // 카메라와 타겟 사이의 거리 계산
  const distance = startPosition.distanceTo(target);
  
  // 초기 각도 계산 (spherical coordinates)
  const direction = new THREE.Vector3().subVectors(startPosition, target).normalize();
  let startAzimuth = Math.atan2(direction.x, direction.z);
  let startPolar = Math.acos(direction.y);
  
  // 작은 원을 그리기 위한 반지름 (약 5도 정도의 작은 회전)
  const smallCircleRadius = 5 * Math.PI / 180; // 5도
  
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // 부드러운 easing
    const eased = progress < 0.5 
      ? 2 * progress * progress 
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    
    // 두바퀴 회전 (4π) - 작은 원을 그리며
    const circleAngle = eased * Math.PI * 4;
    
    // 작은 원의 경로 (azimuth와 polar를 작게 변화시켜 원형 경로 생성)
    // 시작 시점(progress=0)에서 오프셋이 0이 되도록 조정
    const azimuthOffset = Math.sin(circleAngle) * smallCircleRadius;
    const polarOffset = (Math.cos(circleAngle) - 1) * smallCircleRadius; // 시작 시 0이 되도록
    
    // 시작 각도에서 작은 오프셋 추가
    const currentAzimuth = startAzimuth + azimuthOffset;
    const currentPolar = Math.max(0.1, Math.min(Math.PI - 0.1, startPolar + polarOffset));
    
    // spherical coordinates를 cartesian으로 변환
    const x = target.x + distance * Math.sin(currentPolar) * Math.sin(currentAzimuth);
    const y = target.y + distance * Math.cos(currentPolar);
    const z = target.z + distance * Math.sin(currentPolar) * Math.cos(currentAzimuth);
    
    camera.position.set(x, y, z);
    camera.lookAt(target);
    controls.target.copy(target);
    controls.update();
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // 원래 위치로 복귀
      camera.position.copy(startPosition);
      camera.lookAt(target);
      controls.target.copy(target);
      controls.update();
      
      if (callback) callback();
    }
  };
  
  animate();
}

// edit prompt 버튼 클릭 함수 (프로그래밍 방식)
function clickEditPrompt() {
  currentVariantIndex = (currentVariantIndex + 1) % variants.length;
  textBox.textContent = variants[currentVariantIndex].prompt;
  showVariant(currentVariantIndex);
}

// 전체 애니메이션 시퀀스 실행
function playAnimation() {
  if (isAnimating) return;
  
  isAnimating = true;
  const playButton = document.getElementById("playButton");
  if (playButton) {
    playButton.disabled = true;
    playButton.textContent = "Playing...";
  }
  
  // 프롬프트 텍스트를 제외한 모든 UI 숨기기
  const overlay = document.querySelector(".overlay");
  const bottomPanel = document.querySelector(".bottom-panel");
  const changeBackgroundButton = document.getElementById("changeBackgroundButton");
  
  if (overlay) overlay.style.display = "none";
  if (bottomPanel) bottomPanel.style.display = "none";
  if (changeBackgroundButton) changeBackgroundButton.style.display = "none";
  if (playButton) playButton.style.display = "none";
  
  // 원래 카메라 위치와 타겟 저장
  originalCameraPosition.copy(camera.position);
  originalTarget.copy(controls.target);
  
  // OrbitControls 비활성화
  controls.enabled = false;
  
  // 1. 카메라를 한바퀴 회전 (2초)
  rotateCamera360(2000, () => {
    // 원점으로 복귀
    camera.position.copy(originalCameraPosition);
    controls.target.copy(originalTarget);
    controls.update();
    
    // 2. 10회 prompt 변경 (각 0.4초, 총 4초)
    changePromptsSequentially(10, 400, () => {
      // 카메라 위치가 원점에 있는지 확인하고 유지
      camera.position.copy(originalCameraPosition);
      controls.target.copy(originalTarget);
      controls.update();
      
      // 다음 프레임에서 회전 시작 (부드러운 전환을 위해)
      requestAnimationFrame(() => {
        // 3. 제자리에서 작게 두바퀴 회전 (4초)
        rotateInPlace360x2(4000, () => {
          // 애니메이션 완료
          isAnimating = false;
          
          // UI 다시 보이기
          if (overlay) overlay.style.display = "";
          if (bottomPanel) bottomPanel.style.display = "";
          if (changeBackgroundButton) changeBackgroundButton.style.display = "";
          if (playButton) {
            playButton.style.display = "";
            playButton.disabled = false;
            playButton.textContent = "▶ Play";
          }
          controls.enabled = true;
        });
      });
    });
  });
}

// Play 버튼 이벤트 리스너
const playButton = document.getElementById("playButton");
if (playButton) {
  playButton.addEventListener("click", playAnimation);
}

// Change Background 버튼 이벤트 리스너
const changeBackgroundButton = document.getElementById("changeBackgroundButton");
if (changeBackgroundButton) {
  changeBackgroundButton.addEventListener("click", changeBackground);
}


