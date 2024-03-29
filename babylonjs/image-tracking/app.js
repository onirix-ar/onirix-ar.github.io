// ====== Imports ======

import OnirixSDK from "https://unpkg.com/@onirix/ar-engine-sdk@1.6.5/dist/ox-sdk.esm.js";

// BabylonJS

var engine, scene, camera, background, model;

function setupRenderer(rendererCanvas) {
  // Initialize renderer with rendererCanvas provided by Onirix SDK
  engine = new BABYLON.Engine(rendererCanvas, true);

  // Create an empty scene with transparent background
  scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

  // Onirix SDK uses right handed coordinates (OpenGL)
  scene.useRightHandedSystem = true;

  // Ask Onirix SDK for camera parameters to create a 3D camera that fits with the AR projection.
  const cameraParams = OX.getCameraParameters();
  camera = new BABYLON.FreeCamera("Camera", new BABYLON.Vector3(0, 0, 0), scene);
  const projectionMatrix = BABYLON.Matrix.PerspectiveFovRH(
    cameraParams.fov * (Math.PI / 180),
    cameraParams.aspect,
    0.01,
    1000
  );
  camera.freezeProjectionMatrix(projectionMatrix);

  // Add some lights
  const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

  background = new BABYLON.Layer("back", null, scene);

  // Load a 3D frame model
  BABYLON.SceneLoader.LoadAssetContainer("frame.glb", null, scene, (assetContainer) => {
    model = assetContainer;
  });

  // Uncomment below to show debug 3D axes
  // const axis = new BABYLON.Debug.AxesViewer(scene, 0.5);
}

function updatePose(pose) {
  // When a new pose is detected, update the 3D camera.
  // Because BabylonJS uses a left-handed coordinate system a
  // pose conversion is needed.

  let modelViewMatrix = BABYLON.Matrix.FromArray(pose);
  modelViewMatrix.m[0] *= -1;
  modelViewMatrix.m[1] *= -1;
  modelViewMatrix.m[2] *= -1;
  modelViewMatrix.m[3] *= -1;
  modelViewMatrix.m[4] *= 1;
  modelViewMatrix.m[5] *= 1;
  modelViewMatrix.m[6] *= 1;
  modelViewMatrix.m[7] *= 1;
  modelViewMatrix.m[8] *= -1;
  modelViewMatrix.m[9] *= -1;
  modelViewMatrix.m[10] *= -1;
  modelViewMatrix.m[11] *= -1;
  modelViewMatrix.m[12] *= 1;
  modelViewMatrix.m[13] *= 1;
  modelViewMatrix.m[14] *= 1;
  modelViewMatrix.m[15] *= 1;

  const scale = new BABYLON.Vector3();
  const position = new BABYLON.Vector3();
  const rotationQuaternion = new BABYLON.Quaternion();
  modelViewMatrix.decompose(scale, rotationQuaternion, position);
  camera.position = position;
  camera.rotationQuaternion = rotationQuaternion;
}

function render() {
  // Just render the scene
  scene.render();
}

function onResize() {
  // When device orientation changes, it is required to update camera params.
  engine.resize();
  const cameraParams = OX.getCameraParameters();
  const projectionMatrix = BABYLON.Matrix.PerspectiveFovRH(
    cameraParams.fov * (Math.PI / 180),
    cameraParams.aspect,
    0.01,
    1000
  );
  camera.freezeProjectionMatrix(projectionMatrix);
}

// ====== Onirix SDK ======

const OX = new OnirixSDK(
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUyMDIsInByb2plY3RJZCI6MTQ0MjksInJvbGUiOjMsImlhdCI6MTYxNjc2MDI5M30.knKDX5vda6UyqB8CobqgPQ8BS7OYQo4RDfIuGm-EJGg"
);

const config = {
  mode: OnirixSDK.TrackingMode.Image,
};

OX.init(config)
  .then((rendererCanvas) => {
    // Setup BabylonJS renderer
    setupRenderer(rendererCanvas);

    // All loaded, so hide loading screen
    document.getElementById("loading-screen").style.display = "none";

    // Subscribe to events
    OX.subscribe(OnirixSDK.Events.OnDetected, function (id) {
      console.log("Detected Image: " + id);
      // Display 3D model
      model.addAllToScene();
      // It is useful to synchronize scene background with the camera feed
      background.texture = new BABYLON.VideoTexture("camera", OX.getCameraFeed(), scene, false);
    });

    OX.subscribe(OnirixSDK.Events.OnPose, function (pose) {
      updatePose(pose);
    });

    OX.subscribe(OnirixSDK.Events.OnLost, function (id) {
      console.log("Lost Image: " + id);
      // Hide 3D model
      model.removeAllFromScene();
      background.texture = false;
    });

    OX.subscribe(OnirixSDK.Events.OnResize, function () {
      onResize();
    });

    OX.subscribe(OnirixSDK.Events.OnFrame, function () {
      render();
    });

    // Start tracking
    OX.start();
    
  })
  .catch((error) => {
    // An error ocurred, chech error type and display it
    document.getElementById("loading-screen").style.display = "none";

    switch (error.name) {
      case "INTERNAL_ERROR":
        document.getElementById("error-title").innerText = "Internal Error";
        document.getElementById("error-message").innerText =
          "An unespecified error has occurred. Your device might not be compatible with this experience.";
        break;

      case "CAMERA_ERROR":
        document.getElementById("error-title").innerText = "Camera Error";
        document.getElementById("error-message").innerText =
          "Could not access to your device's camera. Please, ensure you have given required permissions from your browser settings.";
        break;

      case "SENSORS_ERROR":
        document.getElementById("error-title").innerText = "Sensors Error";
        document.getElementById("error-message").innerText =
          "Could not access to your device's motion sensors. Please, ensure you have given required permissions from your browser settings.";
        break;

      case "LICENSE_ERROR":
        document.getElementById("error-title").innerText = "License Error";
        document.getElementById("error-message").innerText = "This experience does not exist or has been unpublished.";
        break;
    }

    document.getElementById("error-screen").style.display = "flex";
  });
