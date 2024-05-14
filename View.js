/* 
MIT License

 applies to: 
        - three.js by 2010-2024 three.js authors and Face Mesh Example by www.bannaflak.com - https://github.com/mrdoob/three.js/        
        - webpack by JS Foundation - https://github.com/webpack/
        - jema.js by 2023 Tobias Buschor - https://github.com/nuxodin/jema.js
        - JSON schema by 2022 JSON Schema Specification Authors - https://github.com/json-schema-org/
        - lil-gui by 2019 George Michael Brower - https://github.com/georgealways/lil-gui

FaceEx - A application for morphing a facemesh to express Action Units and based on them Emotions
Author: Florian Lessig 2024

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import * as THREE from 'three';
import * as Controller from './Controller.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

// Three.js preconditions
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.4;
const canvasContainer = document.querySelector('.canvasContainer');
canvasContainer.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 100);
camera.position.z = 5;

export const scene = new THREE.Scene();
scene.scale.x = 1;

const environment = new RoomEnvironment(renderer);
const pmremGenerator = new THREE.PMREMGenerator(renderer);

const backgroundColor = { color: '#FFFFFF' };
scene.background = backgroundColor;
scene.environment = pmremGenerator.fromScene(environment).texture;
//unused variable but necessary to be saved in a const
const controls = new OrbitControls(camera, renderer.domElement);

//Load Model , decompress and load Textures 
async function loadModel() {
    return new Promise((resolve, reject) => {
        const ktx2Loader = new KTX2Loader()
            .setTranscoderPath('./three.js/examples/jsm/libs/basis/')
            .detectSupport(renderer);

        new GLTFLoader()
            .setKTX2Loader(ktx2Loader)
            .setMeshoptDecoder(MeshoptDecoder)
            .load('./three.js/examples/models/gltf/facecap.glb', function (gltf) {
                const mesh = gltf.scene.children[0];
                scene.add(mesh);
                resolve(gltf);
            }, undefined, function (error) {
                reject(error);
            });
    });
}

// await the loading of the defaultConfig.json and the Face Mesh Model
await loadModel();
let succsefullyLoaded = await Controller.initialyLoadAUConfig();

const meshName = 'mesh_2';
const head = scene.getObjectByName(meshName);
const clock = new THREE.Clock();
let mixer = new THREE.AnimationMixer(scene, camera);
const gui = createGUIForModel();

Controller.setMeshProperties(head.morphTargetInfluences, head.morphTargetDictionary);

// initialize Layout
makeResizableDivider('dividerLeft');
makeResizableDivider('dividerRight');
resizeRendererToDisplaySize();
centerScrollbars();
gui.hide();

if (succsefullyLoaded) {
    createSlidersForActionUnits();
    createExpressionSliders();
}

// set all influences to 0 and start animation loop initially
resetFace();
animate();
var modal = document.getElementById("addNewWindow");

document.getElementById("closeModal").addEventListener('click', () => {
    modal.style.display = "none";
})
document.getElementById("createNewAUButton").addEventListener('click',loadModal )
document.getElementById('toggleGUIButton').addEventListener('click', toogleGUI);
window.addEventListener('resize', resizeRendererToDisplaySize);
document.getElementById('resetFaceButton').addEventListener('click', resetFace);
document.getElementById('stopAnimationsButton').addEventListener('click', stopAllAnimations);
document.getElementById('resetAUButton').addEventListener('click', resetSliders);
document.getElementById('resetAUKeyframesButton').addEventListener('click', resetAnimation);
document.getElementById('confirmActionUnitButton').addEventListener('click', confirmActionUnitAddition);
document.getElementById('confirmExpressionButton').addEventListener('click', confirmExpressionAddition);
document.getElementById('saveAUConfigButton').addEventListener('click', Controller.saveAUConfig);
document.getElementById('saveImageButton').addEventListener('click', saveCroppedImage);
document.getElementById('loadAUConfigButton').addEventListener('click', loadConfig);
document.getElementById('playAnimationButton').addEventListener('click', playAnimationClip);
document.getElementById('captureFrameButton').addEventListener('click', () => createThumbnail("captureKeyframe"));
document.getElementById('captureISIButton').addEventListener('click', () => createThumbnail("captureISI"));

async function loadConfig() {
    if (await Controller.loadAUConfig()) {
        resetSliders()
    };
}

// fill the blendshape options of the addNewWindow div
function populateBlendshapes() {
    const blendshapeSelect = document.getElementById('blendshapeSelect');
    blendshapeSelect.innerHTML = '';
    const blendshapes = Controller.getBlendshapeNames();
    blendshapes.forEach((blendshape) => {
        let option = document.createElement('option');
        option.value = option.text = blendshape;
        blendshapeSelect.add(option);
    });
}
// fill the action unit options of the addNewWindow div
function populateActionUnits() {
    const actionUnitSelect = document.getElementById('actionUnitSelect');
    actionUnitSelect.innerHTML = '';
    const actionUnits = Controller.getActionUnitNames();
    actionUnits.forEach((unit) => {
        let option = document.createElement('option');
        option.value = option.text = unit;
        actionUnitSelect.add(option);
    });
}

function confirmActionUnitAddition() {
    let name = document.getElementById('actionUnitName').value;
    let prefix = document.getElementById('actionUnitPrefix').value;
    let description = document.getElementById('actionUnitDescription').value;
    let selectedOptions = document.getElementById('blendshapeSelect').selectedOptions;
    let selectedBlendshapes = Array.from(selectedOptions).map(option => option.value);
    console.log(selectedBlendshapes)
    if (Controller.addActionUnit(prefix, name, description, selectedBlendshapes)) {
        alert("Action Unit added successfully!");
        resetSliders();
        populateActionUnits();
    } else {
        alert("Action Unit was not added!")
    }
}

function confirmExpressionAddition() {
    let name = document.getElementById('expressionName').value;
    let selectedOptions = document.getElementById('actionUnitSelect').selectedOptions;
    let selectedActionUnits = Array.from(selectedOptions).map(option => option.value);
    if (Controller.addExpression(name, selectedActionUnits)) {
        alert("Expression added successfully!")
    } else {
        alert("Expression could not be added!");
    }
}

function loadModal(){   
    modal.style.display = "block";

    var modalContent = document.querySelector('.modal-content');  
    const inputs = modalContent.getElementsByTagName('input');    
    for (const input of inputs) {        
            input.value = '';         
    }    
    populateBlendshapes();
    populateActionUnits();
}

function getCurrentInfluences() {
    return getMesh().morphTargetInfluences.slice();
}

function changeThumbnail(position) {
    const newDuration = parseInt(document.getElementById('durationInput').value, 10) || 0;
    const thumbnail = getCurrentCanvasCropped();
    const influences = getCurrentInfluences();
    Controller.changeKeyframe(position, newDuration, influences, thumbnail);
}

function updateThumbnailContainer() {
    let parentContainer = document.getElementById("thumbnailContainer");
    parentContainer.innerHTML = '';
    Controller.getKeyframes().forEach((frame) => {
        const position = frame.position;
        const duration = frame.duration;
        const thumbnail = frame.thumbnail;

        const imgElement = document.createElement('img');
        imgElement.src = thumbnail;

        // Create the thumbnail container and related elements
        const container = document.createElement('div');
        container.classList.add('thumbnail-container');
        container.dataset.position = position; // Store position for easier access in callbacks

        imgElement.classList.add('thumbnail-image');
        container.appendChild(imgElement);

        const durationLabel = document.createElement('span');
        // Special case for the first keyframe cause this should be always 0
        durationLabel.textContent = `Time to reach this expression: ${position === 0 ? 0 : duration} ms`;
        durationLabel.classList.add('duration-label');
        container.appendChild(durationLabel);

        const editButton = document.createElement('button');
        editButton.textContent = 'Edit';

        editButton.addEventListener('click', () => {
            changeThumbnail(position);
            updateThumbnailContainer();
        })
        container.appendChild(editButton);

        const removeButton = document.createElement('button');
        removeButton.textContent = 'Remove';
        removeButton.addEventListener('click', () => {
            const index = parseInt(container.dataset.position, 10);
            Controller.removeKeyframe(index);
            updateThumbnailContainer();
        });
        container.appendChild(removeButton);
        parentContainer.appendChild(container);
    })
}

function getCurrentCanvasCropped() {
    const originalCanvas = document.querySelector('canvas');
    const width = originalCanvas.width;
    const height = originalCanvas.height;

    // experience values
    const cropWidth = width * 0.23;
    const cropHeight = height * 0.5;
    const cropX = width * 0.39;
    const cropY = height * 0.22;

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropWidth;
    croppedCanvas.height = cropHeight;
    const croppedContext = croppedCanvas.getContext('2d');

    croppedContext.drawImage(originalCanvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    const dataURL = croppedCanvas.toDataURL();

    return dataURL;
}

async function createThumbnail(keyframeType) {

    let influences;
    let duration = parseInt(document.getElementById('durationInput').value, 10);
    const imgElement = document.createElement('img');

    if (keyframeType === "captureISI") {
        // For captureISI, set influences to an array of 52 ones and use a blackscreen thumbnail
        influences = new Array(52).fill(1);
        imgElement.src = "./blackscreen.png"

    } else if (keyframeType === "captureKeyframe") {
        imgElement.src = getCurrentCanvasCropped();
        influences = getCurrentInfluences();
    }

    let added = await Controller.addKeyframe(duration, influences, imgElement.src);
    if (added) {
        updateThumbnailContainer();
    } else {
        alert("Keyframe could not be saved!")
    }
}

// Control of the Mesh State, the Mesh should just be changed by this dedicated function
function changeBlendshapValue(blendshape, value) {
    let mesh = getMesh()
    let influence = mesh.morphTargetDictionary[blendshape];
    mesh.morphTargetInfluences[influence] = value;
}

function createExpressionSliders() {
    const expressionContainer = document.querySelector('.expressionSlidersContainer');
    expressionContainer.innerHTML = '';
    const expressions = Controller.getExpressions();
    if (!expressions) {
        return
    }
    expressions.forEach((expression) => {
        const expressionDiv = document.createElement('div');
        const label = document.createElement('label');
        const breaker = document.createElement('br');
        label.textContent = expression.identifier;
        expressionDiv.appendChild(label);
        expressionDiv.appendChild(breaker);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = 0;
        slider.max = 100;
        slider.value = 0;

        const valueDisplay = document.createElement('span');
        valueDisplay.textContent = `: ${slider.value}%`;
        expressionDiv.appendChild(valueDisplay);

        slider.addEventListener('input', () => {
            const value = parseInt(slider.value, 10);
            valueDisplay.textContent = `: ${value}%`;
            const normalizedValue = value / 100;
            expression.actionUnits.forEach((au) => {
                Controller.getBlendshapesForAU(au).forEach(bs => {
                    Object.keys(bs).forEach(key => {
                        changeBlendshapValue(key, normalizedValue);
                    })
                })
            })
        });
        expressionDiv.appendChild(slider);
        expressionContainer.appendChild(expressionDiv);
    });
}

function createSlidersForActionUnits() {
    const auContainer = document.querySelector('.actionUnitsSlidersContainer');
    auContainer.innerHTML = '';
    // labels from the FACS scoring
    const labels = ['0', 'A', 'B', 'C', 'D', 'E'];
    const actionUnits = Controller.getActionUnits()

    actionUnits.forEach((au) => {
        const auDiv = document.createElement('div');
        auDiv.classList.add('action-unit');

        const label = document.createElement('label');
        const breaker = document.createElement('br');
        label.textContent = au.prefix + au.number + " - " + au.description;
        label.className = 'au-label';
        auDiv.appendChild(label);
        auDiv.appendChild(breaker);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = 0;
        slider.max = 5;
        slider.value = 0;
        slider.dataset.auNumber = au.number
        slider.className = `au-slider`;

        let blendshapes = Controller.getBlendshapesForAU(au.number);

        slider.addEventListener('input', (e) => {
            const sliderValue = e.target.value - 1;
            blendshapes.forEach((bs) => {
                Object.keys(bs).forEach((key) => {
                    if (sliderValue < 0) {
                        changeBlendshapValue(key, 0)
                    } else {
                        changeBlendshapValue(key, bs[key][sliderValue])
                    }
                })
            })
            // update labels
            const valueLabel = auDiv.querySelector('span');
            if (valueLabel) {
                valueLabel.textContent = labels[sliderValue + 1];
            }
            updateAUTextField();
        });

        auDiv.appendChild(slider);

        const valueLabel = document.createElement('span');
        valueLabel.textContent = labels[0];
        auDiv.appendChild(valueLabel);

        auContainer.appendChild(auDiv);
    });
}

function resetSliders() {
    createSlidersForActionUnits();
    createExpressionSliders();
    resetFace();
    clearFACSCodeTextfield();
}

function clearFACSCodeTextfield() {
    document.getElementById('codeFACSTextfield').value = "";
}

function updateAUTextField() {
    const sliders = document.querySelectorAll('.au-slider');
    const output = [];

    sliders.forEach((slider) => {
        const value = parseInt(slider.value);
        if (value > 0) {
            const auNumber = slider.dataset.auNumber;
            const position = ['A', 'B', 'C', 'D', 'E'][value - 1];
            output.push(`${auNumber}${position}`);
        }
    });

    const outputString = output.join('+');
    document.getElementById('codeFACSTextfield').value = outputString;
}

function saveCroppedImage() {
    const originalCanvas = document.querySelector('canvas');
    if (!originalCanvas) {
        console.error('No canvas found!');
        return;
    }
    const width = originalCanvas.width;
    const height = originalCanvas.height;
    // TODO cropping should be asked before saving
    const cropWidth = width * 0.6;
    const cropHeight = height * 0.6;
    const cropX = width * 0.2;
    const cropY = height * 0.2;

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropWidth;
    croppedCanvas.height = cropHeight;
    const croppedContext = croppedCanvas.getContext('2d');

    croppedContext.drawImage(originalCanvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    const dataURL = croppedCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    const facsCode = document.getElementById('codeFACSTextfield').value;
    link.download = facsCode + '_cropped_image.png';
    link.href = dataURL;
    link.click();
}

function makeResizableDivider(dividerId) {
    const divider = document.getElementById(dividerId);
    let startX;
    let startWidth;

    function onMouseMove(e) {
        if (!startWidth) return;
        const dx = e.clientX - startX;
        const newWidth = (dividerId === 'dividerLeft' ? startWidth + dx : startWidth - dx);
        if (dividerId === 'dividerLeft') {
            divider.previousElementSibling.style.width = `${newWidth}px`;
        } else {
            divider.nextElementSibling.style.width = `${newWidth}px`;
        }
        document.body.style.cursor = 'ew-resize';
    }

    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        startWidth = undefined;
    }

    divider.addEventListener('mousedown', (e) => {
        startX = e.clientX;
        startWidth = (dividerId === 'dividerLeft' ? divider.previousElementSibling.offsetWidth : divider.nextElementSibling.offsetWidth);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

function resizeRendererToDisplaySize() {
    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;

    // Check if the renderers current size is different from the new size
    if (renderer.domElement.width !== width || renderer.domElement.height !== height) {
        // Update renderer and camera aspect ratio but not css every time
        renderer.setSize(width, height, false);
        const cameraAspect = width / height;
        if (camera) {
            camera.aspect = cameraAspect;
            camera.updateProjectionMatrix();
        }
    }
    centerScrollbars();
}

// Keep the Face Centered as the canvas expands behind the interface
function centerScrollbars() {
    const container = document.querySelector('.canvasContainer');
    const canvas = renderer.domElement;

    if (canvas && container) {
        const excessWidth = Math.max(canvas.width - container.clientWidth, 0);
        const excessHeight = Math.max(canvas.height - container.clientHeight, 0);
        container.scrollLeft = excessWidth / 2;
        container.scrollTop = excessHeight / 2;
    }
}

function stopAllAnimations() {
    if (mixer) {
        // Gets all actions from the mixer internal mixer cache,
        // there shall be just one animation
        const allActions = mixer._actions;
        allActions.forEach((action) => {
            action.stop();
        });
        mixer.uncacheRoot(scene);
    }
}

function resetFace() {
    const mesh = getMesh();
    // necessary if the last frame of a clamped animation is a blackscreen 
    scene.getObjectByName("mesh_0").visible = true;
    scene.getObjectByName("mesh_1").visible = true;
    scene.getObjectByName("mesh_2").visible = true;
    scene.getObjectByName("mesh_3").visible = true;

    mesh.morphTargetInfluences.forEach((_, index) => {
        mesh.morphTargetInfluences[index] = 0;
    });

}

function getMesh() {
    return scene.getObjectByName(meshName);
}

function isRepeatChecked() {
    return document.getElementById('repeatCheckbox').checked;
}

function isCaptureChecked() {
    return document.getElementById('captureCheckbox').checked;
}

function recordCanvas(canvas, mixer) {
    if (!canvas) {
        console.error('Canvas element is not provided or found.');
        return;
    }
    // TODO FPS should be adjustable
    let stream = canvas.captureStream(60);
    let recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    let chunks = [];

    recorder.ondataavailable = function (e) {
        if (e.data.size > 0) {
            chunks.push(e.data);
        }
    };

    // TODO adjustable output format
    recorder.onstop = function () {
        let blob = new Blob(chunks, { type: 'video/webm' });
        let url = URL.createObjectURL(blob);

        let a = document.createElement('a');
        document.body.appendChild(a);
        a.style = 'display: none';
        a.href = url;
        a.download = 'animation.webm';
        a.click();

        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    recorder.start();

    mixer.addEventListener('finished', () => {
        recorder.stop();
    });
}

function resetAnimation() {
    if (confirm("Do you really want to delete the whole Animation?")) {
        document.getElementById('thumbnailContainer').innerHTML = '';
        stopAllAnimations();

        document.querySelectorAll('.slider').forEach(slider => {
            slider.value = 0;
        });

        Controller.deleteKeyframes();
        resetFace();
    }
}

// three.js lil gui to access the blendshapes conveniently
function createGUIForModel() {
    const mesh = getMesh();
    const gui = new GUI();
    gui.close();

    // influences
    for (const [key, value] of Object.entries(mesh.morphTargetDictionary)) {
        gui.add(mesh.morphTargetInfluences, value, -2, 2, 0.01)
            .name(key.replace('blendShape1.', ''))
            .listen(mesh.morphTargetInfluences);
    }

    // toggle wireframe
    gui.add({
        toggleWireframe: function () {
            mesh.material.wireframe = !mesh.material.wireframe;
        }
    }, 'toggleWireframe').name("Toggle Wireframe");

    // change background
    gui.addColor(backgroundColor, 'color').name('Background Color').onChange((value) => {
        scene.background = new THREE.Color(value);
    });

    return gui;
}

async function playAnimationClip() {

    const animationClip = await Controller.createMorphAnimationClip();
    stopAllAnimations();
    resetSliders();
    console.log(animationClip)

    if (!mixer) {
        console.error("Mixer not defined")
    }

    const action = mixer.clipAction(animationClip);
    if (isRepeatChecked()) {
        action.setLoop(THREE.LoopRepeat);
    } else {
        action.setLoop(THREE.LoopOnce);
    }

    if (isCaptureChecked() && !isRepeatChecked()) {
        recordCanvas(renderer.domElement, mixer);
    }
    if (isClampChecked()) {
        action.clampWhenFinished = true;
    } else {
        action.clampWhenFinished = false;
    }
    action.play();
}

function isClampChecked() {
    return document.getElementById('clampAtEndCheckbox').checked;
}

function toogleGUI() {
    if (gui._hidden) {
        gui.show();
    } else {
        gui.hide();
    }
}

// Animation loop
function animate() {
    requestAnimationFrame(() => animate());
    const delta = clock.getDelta();
    if (mixer) {
        mixer.update(delta);
    }
    renderer.render(scene, camera);
}
