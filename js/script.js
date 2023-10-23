import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import vertexShader from './shaders/dither/vertex.glsl?raw'
import fragmentShader from './shaders/dither/fragment.glsl?raw'

const shaderSize = 720;

// create scene
const canvas = document.querySelector('canvas.webgl')
const scene = new THREE.Scene()
scene.background = new THREE.Color("rgb(0, 20, 40)");

const size = {
  width: window.innerWidth,
  height: window.innerHeight
}

// add camera
const camera = new THREE.PerspectiveCamera(45, size.width / size.height, 0.1, 100)
camera.position.x = 19
camera.position.y = 14.5
camera.position.z = 4
scene.add(camera)

// add controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.dampingFactor = 0.05

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// add renderer
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true
})
renderer.setSize(size.width, size.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

// Load textures and initialize video
Promise.all([
  loadTexture('assets/baked.jpg'),
  loadTexture('assets/dither.png'),
  initializeVideo(),
]).then(([modelTexture, ditherTexture]) => {

  // create model material
  modelTexture.flipY = -1;
  const material = new THREE.MeshBasicMaterial({ map: modelTexture });

  // create screen material
  const screenMaterial = createScreenMaterial(ditherTexture, ditherTexture.image.width, ditherTexture.image.height);

  // load model, add textures and add it to the scene
  const loader = new GLTFLoader();
  loader.load('assets/computer.glb', (gltf) => {
    gltf.scene.traverse(child => {
      if (child.name === "screen") {
        child.material = screenMaterial;
      } else {
        child.material = material;
      }
    });
    gltf.scene.position.y = -2.5;
    scene.add(gltf.scene);
  })
  // Start rendering loop and handle window resizing
  startRenderingLoop();
  handleWindowResize();
})
  .catch((error) => {
    const elementsToDelete = document.querySelectorAll('.webgl, #video, h1, .instructions');
    elementsToDelete.forEach((element) => {
      element.parentNode.removeChild(element);
    });
    // Handle the error and provide feedback to the user
    console.error('Error occurred during initialization:', error);
    const errorElement = document.createElement('div');
    errorElement.textContent = `Error occurred during initialization: ${error}`;
    errorElement.style.color = 'red';
    errorElement.style.margin = '20px';
    errorElement.style.fontFamily = 'monospace';
    document.body.appendChild(errorElement);
  });

// Load a texture using a Promise
function loadTexture(url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, (texture) => {
      resolve(texture);
    }, undefined, reject);
  });
}

// Initialize video and set its constraints
function initializeVideo() {
  return new Promise((resolve, reject) => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const constraints = { video: { width: shaderSize, height: shaderSize, facingMode: 'user' } };
      navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        video.srcObject = stream;
        video.play();
        resolve();
      }).catch(function (error) {
        console.error('Unable to access the camera/webcam.', error);
        reject(error);
      });
    } else {
      console.error('MediaDevices interface not available.');

      // Provide feedback to the user
      const errorElement = document.createElement('div');
      errorElement.textContent = 'Camera/webcam access is not available in your browser.';
      errorElement.style.color = 'red';
      errorElement.style.margin = '20px';
      errorElement.style.fontFamily = 'monospace';
      document.body.appendChild(errorElement);

      reject('MediaDevices interface not available.');
    }
  });
}


// Create the shader material
let screenMaterial;
const createScreenMaterial = (ditherTexture, ditherWidth, ditherHeight) => {
  screenMaterial = new THREE.ShaderMaterial({
    uniforms: {
      iChannel0: { value: ditherTexture },
      iChannel1: { value: new THREE.VideoTexture(video) },
      iChannel0Res: { value: new THREE.Vector2(ditherWidth, ditherHeight) },
      iResolution: { value: new THREE.Vector3(shaderSize, shaderSize, 0) },
      downScale: { value: 4.0 },
      distanceParam: { value: 0.5 },
      dither: { value: true },
      color: { value: new THREE.Vector3(0, 255, 162) },
    },
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
  });
  return screenMaterial;
}

// Start the rendering loop
const startRenderingLoop = () => {
  const draw = () => {
    controls.update();
    renderer.render(scene, camera);
    window.requestAnimationFrame(draw);
  }
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('click', onClick);

  draw();
}

// Handle window resizing
const handleWindowResize = () => {
  window.addEventListener('resize', () => {
    // Update size
    size.width = window.innerWidth;
    size.height = window.innerHeight;

    // Update camera
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();

    // Update renderer
    renderer.setSize(size.width, size.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });
}

const onPointerMove = (event) => {
  // calculate pointer position in normalized device coordinates
  // (-1 to +1) for both components
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;
}

const onClick = (event) => {
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(scene.children)

  for (let i = 0; i < intersects.length; i++) {
    if (intersects[i].object.name === "mouseLeft") {
      if (screenMaterial.uniforms.downScale.value > 1) {
        screenMaterial.uniforms.downScale.value = screenMaterial.uniforms.downScale.value - 0.5;
      }
    }
    else if (intersects[i].object.name === "mouseRight") {
      if (screenMaterial.uniforms.downScale.value < 10) {
        screenMaterial.uniforms.downScale.value = screenMaterial.uniforms.downScale.value + 0.5;
      }
    }
    else if (intersects[i].object.name === "spacebar") {
      screenMaterial.uniforms.dither.value = !screenMaterial.uniforms.dither.value;
    }
    else if (intersects[i].object.name === "knob1") {
      screenMaterial.uniforms.color.value = new THREE.Vector3(0, 255, 162);
    }
    else if (intersects[i].object.name === "knob2") {
      screenMaterial.uniforms.color.value = new THREE.Vector3(252, 219, 0);
    }
    else if (intersects[i].object.name === "knob3") {
      screenMaterial.uniforms.color.value = new THREE.Vector3(0, 89, 255);
    }
  }

}