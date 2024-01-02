import * as THREE from 'three';
import { GUI } from 'dat.gui';
import * as TWEEN from '@tweenjs/tween.js';
import Hls from 'hls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';

var scene = new THREE.Scene();
var camera = new THREE.OrthographicCamera(window.innerWidth / - 2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / - 2, 1, 1000);
camera.position.z = 5;
camera.zoom = 120; // Adjust the zoom level
camera.updateProjectionMatrix(); // Update the camera's projection matrix
camera.layers.enableAll(); // Set the camera to see all layers

var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
// renderer.context.enable(renderer.context.DEPTH_TEST);
renderer.setSize(window.innerWidth, window.innerHeight);

renderer.setClearColor(0x181821); // Dark blue color

document.getElementById('canvas-container').appendChild(renderer.domElement);

window.addEventListener('resize', onWindowResize, false);

var percentageAboveCenter = 0.03; // 3%
var worldHeight = 100; // Define the height of your world. This could be the height of your scene, camera frustum, etc.
var targetY = worldHeight * percentageAboveCenter;

//compositing stuff
var composer = new EffectComposer(renderer);
var renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
var outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);

outlinePass.edgeColor = new THREE.Color('white');
outlinePass.edgeStrength = 3; // Adjust to your liking
composer.addPass(outlinePass);

// Get a reference to the play/pause button
var playPauseButton = document.getElementById('play-pause-button');

function onWindowResize() {
  // Update camera aspect ratio
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  // Update renderer size
  renderer.setSize(window.innerWidth, window.innerHeight);
}

var selectedPlane = null;
var hoveredPlane = null; // Variable to keep track of the plane being hovered over

// Variable to control the upper end of the speed
var speedScale = 0.007;

// Variable to control the lower end of the speed
var minSpeedScale = 0.005; // Adjust this value as needed

// Variable to control the scale of the planes
var planeScale = 1;

// Variables to control the minimum and maximum scale multipliers for the planes
var minScaleMultiplier = 0.5;
var maxScaleMultiplier = 1.5;

// Variable for the extremes
var planeDistance = 3;

// Create a new material that is green and wireframe
var wireframeMaterial = new THREE.MeshBasicMaterial({color: 0x00ff00, wireframe: true});

// Create 6 planes with unique pivot points
var pivots = [];
var planes = []; // Array to hold the planes

// Define the video data
var videosData = [
  {hls: './public/videos/loops/loop_rainy_landscape.m3u8'},
  {hls: './public/videos/loops/loop_awui_landscape.m3u8'},
  {hls: './public/videos/loops/loop_boy_portrait.m3u8'},
  // Add more videos here
];

for (let i = 0; i < 3; i++) {
  // Random scale for each plane, within the range defined by minScaleMultiplier and maxScaleMultiplier
  var randomScale = minScaleMultiplier + Math.random() * (maxScaleMultiplier - minScaleMultiplier);

  var videoData = videosData[i % videosData.length]; // Get the video data for this plane
  var video = document.createElement('video');
  video.setAttribute('playsinline', ''); // Add this line
  if (Hls.isSupported()) {
    var hls = new Hls();
    hls.loadSource(videoData.hls);
    hls.attachMedia(video);
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = videoData.hls;
  }
  video.crossOrigin = 'anonymous';
  video.loop = true;
  video.muted = true;
  video.play();

  var texture = new THREE.VideoTexture(video);
  var material = new THREE.MeshBasicMaterial({ map: texture, depthWrite: true });

  var aspectRatio = videoData.hls.includes('_portrait') ? 9 / 16 : 16 / 9;
  var geometry = new THREE.PlaneGeometry(planeScale * aspectRatio, planeScale);
  
  var plane = new THREE.Mesh(geometry, material);
  plane.position.x = (Math.random() - 0.5) * planeDistance;
  plane.position.y = (Math.random() - 0.5) * planeDistance;
  plane.position.z = (Math.random() - 0.5) * planeDistance;
  plane.originalPosition = plane.position.clone(); // Store the original position
  plane.videoSrc = videoData.hls; // Store the original video source
  plane.videoElement = video; // Store a reference to the video element
  plane.layers.set(1); // Assign all planes to a specific layer
  plane.state = 'initial'; // Add this line

  var pivot = new THREE.Object3D();
  pivot.rotationSpeed = minSpeedScale + Math.random() * (speedScale - minSpeedScale); // Random speed for each pivot, scaled by speedScale
  pivot.rotationAxis = new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize(); // Random rotation axis for each pivot
  pivot.add(plane);
  pivots.push(pivot);
  planes.push(plane); // Add the plane to the planes array
  scene.add(pivot);
}

// Create a raycaster and a vector to hold the mouse position
var raycaster = new THREE.Raycaster();
raycaster.layers.set(1); // Set the raycaster to intersect with layer 1 by default
var mouse = new THREE.Vector2();

// Add an event listener for when the mouse is clicked
window.addEventListener('mousedown', onMouseDown, false);

// Add an event listener for when the mouse moves
window.addEventListener('mousemove', onMouseMove, false);

function onMouseDown(event) {
  // Convert the mouse position to normalized device coordinates (-1 to +1)
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Update the picking ray with the camera and mouse position
  raycaster.setFromCamera(mouse, camera);

  // Calculate objects intersecting the picking ray, including descendants of the scene's children
  var intersects = raycaster.intersectObjects(scene.children, true);

  if (intersects.length > 0) {
    // If a plane was clicked, animate it moving towards the center
    if (selectedPlane) {
      new TWEEN.Tween(selectedPlane.position)
        .to({ x: selectedPlane.originalPosition.x, y: selectedPlane.originalPosition.y, z: selectedPlane.originalPosition.z }, 1000)
        .easing(TWEEN.Easing.Exponential.InOut)
        .start();
    }
    selectedPlane = intersects[0].object;
    
    selectedPlane.layers.set(2); // Move the selected plane to a different layer
    raycaster.layers.set(2); // Set the raycaster to intersect with layer 2
    // Debug: print the click count of the selected plane

    switch (selectedPlane.state) {
      case 'initial':
        // Load the video and pause it
        loadVideo(selectedPlane);
        selectedPlane.state = 'videoLoaded';
        break;
      case 'videoLoaded':
        // Start playing the video after the animation
        selectedPlane.videoElement.muted = false;
        selectedPlane.material.map.image.play();
        selectedPlane.state = 'videoPlaying';
        playPauseButton.style.backgroundImage = "url('/public/img/pause_button.svg')"; // Change button to pause icon
        playPauseButton.style.display = 'block'; // Show the button
        // playPauseButton.classList.remove('fade-in'); // Remove the fade-in class        
        playPauseButton.classList.add('fade-out'); // Add the fade-out class
        console.log('Class added: ', playPauseButton.classList);
        
        
        break;
      case 'videoPlaying':
        // Toggle pause/play
        if (selectedPlane.material.map.image.paused) {
          selectedPlane.material.map.image.play();
          playPauseButton.style.backgroundImage = "url('/public/img/play_button.svg')"; // Change button to pause icon
          playPauseButton.style.display = 'block'; // Show the button
          playPauseButton.classList.remove('fade-out'); // Remove the fade-out class
          console.log('Class removed: ', playPauseButton.classList);
          void playPauseButton.offsetWidth; // Trigger reflow
          playPauseButton.classList.add('fade-out'); // Add the fade-out class again
          console.log('Class added: ', playPauseButton.classList);
        } else {
          selectedPlane.material.map.image.pause();
          playPauseButton.style.backgroundImage = "url('/public/img/pause_button.svg')"; // Change button to play icon
          playPauseButton.style.display = 'block'; // Show the button
          playPauseButton.classList.remove('fade-out'); // Remove the fade-out class
          console.log('Class removed: ', playPauseButton.classList);
          void playPauseButton.offsetWidth; // Trigger reflow
          playPauseButton.classList.add('fade-out'); // Add the fade-out class again
          console.log('Class added: ', playPauseButton.classList);
        }
        break;
    }

    selectedPlane.material.depthTest = false;
    selectedPlane.material.needsUpdate = true;  // This line is needed to apply the changes to the material
    selectedPlane.renderOrder = 1; // Add this line

    // Set the renderOrder of all non-selected planes to 0
    planes.forEach(plane => {
      if (plane !== selectedPlane) {
        plane.renderOrder = 0;
      }
    });

    // Animate the clicked plane moving towards the center
    new TWEEN.Tween(selectedPlane.position)
      .to({ x: 0, y: 0, z: 0 }, 1000)
      .easing(TWEEN.Easing.Exponential.InOut)
      .onComplete(function() {
        if (selectedPlane && selectedPlane.state === 'videoLoaded') {
          playPauseButton.style.display = 'block'; // Show the button
          // playPauseButton.classList.add('fade-in'); // Add the fade-in class
        }
      })
      .start();

    // Animate the clicked plane scaling up
    new TWEEN.Tween(selectedPlane.scale)
      .to({ x: 3, y: 3, z: 3 }, 1000)
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();
  } else {
    // If the click was outside a plane, return to orbiting state
    playPauseButton.style.display = 'none'; // Hide the button when no plane is selected
    if (selectedPlane) {
      selectedPlane.material.depthTest = true;
      selectedPlane.material.needsUpdate = true;  // This line is needed to apply the changes to the material
      selectedPlane.renderOrder = 0; // Add this line
      selectedPlane.layers.set(1); // Move the plane back to layer 1 when it's deselected
      raycaster.layers.set(1); // Set the raycaster back to intersect with layer 1 when the plane is deselected
      new TWEEN.Tween(selectedPlane.position)
        .to({ x: selectedPlane.originalPosition.x, y: selectedPlane.originalPosition.y, z: selectedPlane.originalPosition.z }, 1000)
        .easing(TWEEN.Easing.Exponential.InOut)
        .start();

      // Animate the previously selected plane scaling down
      new TWEEN.Tween(selectedPlane.scale)
        .to({ x: 1, y: 1, z: 1 }, 1000)
        .easing(TWEEN.Easing.Exponential.InOut)
        .start();

      // Switch the video back to the loop if the plane leaves the selected state
      selectedPlane.state = 'initial';
      loadLoopVideo(selectedPlane); // Load the loop video back onto the plane
      selectedPlane.videoElement.play(); // Ensure the loop video is playing
    }
    selectedPlane = null; // Reset the selected plane
  }
}

function onMouseMove(event) {
  // Convert the mouse position to normalized device coordinates (-1 to +1)
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Update the picking ray with the camera and mouse position
  raycaster.setFromCamera(mouse, camera);

  // Calculate objects intersecting the picking ray, including descendants of the scene's children
  var intersects = raycaster.intersectObjects(scene.children, true);

  if (intersects.length > 0) {
    // If a plane was hovered over, add it to the selectedObjects array
    hoveredPlane = intersects[0].object;
    outlinePass.selectedObjects = [hoveredPlane];
  } else {
    // If the mouse moved off a plane, clear the selectedObjects array
    outlinePass.selectedObjects = [];
  }
}

function animate() {
  requestAnimationFrame(animate);

  // Rotate each pivot point around its unique rotation axis
  pivots.forEach(pivot => {
    pivot.rotateOnAxis(pivot.rotationAxis, pivot.rotationSpeed);
    if (pivot.children[0] === selectedPlane) {
      // pivot.children[0].material.color.set(0xff0000); // Change the color of the currently animated plane to red
    } else if (pivot.children[0] !== hoveredPlane) {
      // pivot.children[0].material.color.set(0x00ff00); // Change the color of the other planes back to green, unless it's the hovered plane
    }
    pivot.children[0].lookAt(camera.position); // Make the plane face the camera
    if (pivot.children[0] !== hoveredPlane) {
      pivot.children[0].material.wireframe = false; // Disable wireframe mode
    }
  });

  TWEEN.update(); // Add this line

  composer.render(scene, camera);
}
animate();
function loadVideo(plane) {
  var newVideoSrc;
  if (plane.videoSrc.includes('loop_rainy_landscape')) {
    newVideoSrc = './public/videos/full/rainy_full.m3u8';
  } else if (plane.videoSrc.includes('loop_awui_landscape')) {
    newVideoSrc = './public/videos/full/awuwi_full.m3u8';
  } else if (plane.videoSrc.includes('loop_boy')) {
    newVideoSrc = './public/videos/full/boy_full.m3u8';
  }
  loadSourceToVideo(plane, newVideoSrc);
  plane.videoElement.pause(); // Pause the full video immediately after it's loaded
}

function loadLoopVideo(plane) {
  loadSourceToVideo(plane, plane.videoSrc);
  plane.videoElement.play(); // Ensure the loop video is playing
}

function loadSourceToVideo(plane, source) {
  var video = plane.videoElement;
  if (Hls.isSupported()) {
    var hls = new Hls();
    hls.loadSource(source);
    hls.attachMedia(video);
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = source;
  }
  video.crossOrigin = 'anonymous';
  video.loop = true;
  video.muted = true;
  video.pause(); // Pause the video immediately after it's created

  var texture = new THREE.VideoTexture(video);
  plane.material.map = texture;
  plane.material.needsUpdate = true;
  
}
