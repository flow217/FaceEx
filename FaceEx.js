
import * as THREE from 'three';

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
const canvasContainer = document.querySelector('.canvas-container');
canvasContainer.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 100);
camera.position.z = 5;

const scene = new THREE.Scene();
scene.scale.x = 1;

const environment = new RoomEnvironment(renderer);
const pmremGenerator = new THREE.PMREMGenerator(renderer);

const backgroundColor = { color: '#FFFFFF' };
scene.background = backgroundColor;
scene.environment = pmremGenerator.fromScene(environment).texture;
// unused but necessary to be saved in a const
const controls = new OrbitControls(camera, renderer.domElement);

//Load Model , decompress and Textures 

async function loadModel() {
    return new Promise((resolve, reject) => {
        const ktx2Loader = new KTX2Loader()
            .setTranscoderPath('./three.js/examples/jsm/libs/basis/')
            .detectSupport(renderer);

        new GLTFLoader()
            .setKTX2Loader(ktx2Loader)
            .setMeshoptDecoder(MeshoptDecoder)
            .load('./facecap.glb', function (gltf) {
                const mesh = gltf.scene.children[0];
                scene.add(mesh);
                resolve(gltf);
            }, undefined, function (error) {
                reject(error);
            });
    });

}


await loadModel();

const head = scene.getObjectByName('mesh_2');
const clock = new THREE.Clock();
const meshName = 'mesh_2';
let animationClip;
let mixer = new THREE.AnimationMixer(head);
const gui = createGUIForModel(head);
let animation = {keyframes: []};
let actionUnits = [];
let combinedActionUnits = [];

// initialize Layout
makeResizableDivider('dividerLeft');
makeResizableDivider('dividerRight');
resizeRendererToDisplaySize();
centerScrollbars();
gui.hide();

await initialyLoadAUConfig();
createSlidersForActionUnits();
createCombinedActionUnitSliders();

// set all influences to 0 and start animation loop initially
resetFace();
animate();


document.getElementById('toggleGUIButton').addEventListener('click', toogleGUI);

document.getElementById('playAnimationButton').addEventListener('click', startAnimation);

window.addEventListener('resize', resizeRendererToDisplaySize);

document.getElementById('resetFace').addEventListener('click', resetFace);

document.getElementById('stopAnimations').addEventListener('click', stopAllAnimations);

document.getElementById('resetAUButton').addEventListener('click', resetSliders);

document.getElementById('resetAUAnimations').addEventListener('click', resetAnimation);

document.getElementById('confirmActionUnit').addEventListener('click', confirmActionUnitAddition);

document.getElementById('confirmCombinedActionUnit').addEventListener('click', confirmCombinedActionUnitAddition);

document.getElementById('saveAUConfig').addEventListener('click', saveAUConfig);

document.getElementById('saveImage').addEventListener('click', saveCroppedImage);

document.getElementById('loadAUConfig').addEventListener('click', loadAUConfig);

document.getElementById('captureButton').addEventListener('click', captureKeyframe);

document.getElementById('createAnimationButton').addEventListener('click', createAnimation);

// delete modal content after reload
document.addEventListener('DOMContentLoaded', () => {
    var modalContent = document.querySelector('.modal-content');
    if (modalContent) {
        modalContent.innerHTML = '';
    }
});

function makeResizableDivider(dividerId) {
    const divider = document.getElementById(dividerId);
    let startX, startWidth;

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
        // Update renderer and camera aspect ratio but not css
        renderer.setSize(width, height, false);
        const cameraAspect = width / height;
        if (camera) {
            camera.aspect = cameraAspect;
            camera.updateProjectionMatrix();
        }
    }
    centerScrollbars();
}

function centerScrollbars() {
    const container = document.querySelector('.canvas-container');
    const canvas = renderer.domElement;

    if (canvas && container) {
        const excessWidth = Math.max(canvas.width - container.clientWidth, 0);
        const excessHeight = Math.max(canvas.height - container.clientHeight, 0);

        container.scrollLeft = excessWidth / 2;
        container.scrollTop = excessHeight / 2;
    }
}

function addNewActionUnit(name, selectedBlendshapes, strengthValues) {
    let newActionUnit = {
        name: name,
        blendshapes: selectedBlendshapes.map(bs => ({ [bs]: strengthValues }))
    };
    actionUnits.push(newActionUnit);
    resetSliders();
}

function addNewCombinedActionUnit(name, selectedActionUnits) {
    let newCombinedActionUnit = {
        name: name,
        actionUnits: selectedActionUnits
    };
    combinedActionUnits.push(newCombinedActionUnit);
    resetSliders();
}

function populateBlendshapes() {
    const blendshapeSelect = document.getElementById('blendshapeSelect');
    blendshapeSelect.innerHTML = '';
    const blendshapes = Object.keys(getMesh().morphTargetDictionary);
    blendshapes.forEach((shape) => {
        let option = document.createElement('option');
        option.value = option.text = shape;
        blendshapeSelect.add(option);
    });
}

function populateActionUnits() {
    const actionUnitSelect = document.getElementById('actionUnitSelect');
    actionUnitSelect.innerHTML = '';
    actionUnits.forEach((unit) => {
        let option = document.createElement('option');
        option.value = option.text = unit.name;
        actionUnitSelect.add(option);
    });
}

function confirmActionUnitAddition() {
    let name = document.getElementById('actionUnitName').value;
    let selectedOptions = document.getElementById('blendshapeSelect').selectedOptions;
    let selectedBlendshapes = Array.from(selectedOptions).map(option => option.value);
    let strengthValues = [0.2, 0.4, 0.6, 0.8, 1]; // Default or gather these from user later version
    addNewActionUnit(name, selectedBlendshapes, strengthValues);
    alert("Action Unit added successfully!");
    populateActionUnits(); // Update the action unit selector

}

function confirmCombinedActionUnitAddition() {
    let name = document.getElementById('combinedActionUnitName').value;
    let selectedOptions = document.getElementById('actionUnitSelect').selectedOptions;
    let selectedActionUnits = Array.from(selectedOptions).map(option => option.value);
    addNewCombinedActionUnit(name, selectedActionUnits);
    alert("Combined Action Unit added successfully!");

}

var modal = document.getElementById("myModal");
var btn = document.getElementById("createNewActionUnitButton");
var span = document.getElementsByClassName("close")[0];

btn.onclick = function () {
    modal.style.display = "block";
    populateBlendshapes();
    populateActionUnits();
};

span.onclick = function () {
    modal.style.display = "none";
};

window.onclick = function (event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
};

function captureKeyframe() {
    if (!animation) {
        animation = { keyframes: [] };
    } else if (!animation.keyframes) {
        animation.keyframes = [];
    }
    console.log("Keyframes before insertion:\n" + animation.keyframes.length);

    const mesh = getMesh();
    let duration = parseInt(document.getElementById('durationInput').value, 10) || 0;
    const morphInfluences = mesh.morphTargetInfluences.slice();

    const canvas = document.querySelector('canvas');
    const dataURL = canvas.toDataURL('image/png');

    const keyframe = {
        duration,
        frame: morphInfluences,
        thumbnail: dataURL
    };

    animation.keyframes.push(keyframe);

    const container = document.createElement('div');
    container.classList.add('thumbnail-container');

    const imgElement = document.createElement('img');
    imgElement.src = dataURL;
    imgElement.classList.add('thumbnail-image');
    imgElement.addEventListener('click', () => {
        const index = Array.from(document.getElementById('imageContainer').children).indexOf(container);
        updateMesh(index);
    });
    container.appendChild(imgElement);

    const durationLabel = document.createElement('span');
    durationLabel.textContent = `${duration} ms`;
    durationLabel.classList.add('duration-label');
    container.appendChild(durationLabel);

    const facsLabel = document.createElement('span');
    facsLabel.textContent = document.getElementById('sliderPositions').value;
    facsLabel.classList.add('facs-label');
    container.appendChild(facsLabel);

    const editButton = document.createElement('button');
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', () => {
        const index = Array.from(document.getElementById('imageContainer').children).indexOf(container);
        editKeyframe(index, durationLabel, imgElement, facsLabel);
    });
    container.appendChild(editButton);

    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', () => {
        const index = Array.from(document.getElementById('imageContainer').children).indexOf(container);
        removeKeyframe(index, container);
    });
    container.appendChild(removeButton);

    document.getElementById('imageContainer').appendChild(container);
    console.log("Keyframes after insertion:\n" + animation.keyframes.length);
}

function updateMesh(keyframeIndex) {
    const keyframe = animation.keyframes[keyframeIndex];
    if (!keyframe) return;

    const mesh = getMesh();
    mesh.morphTargetInfluences = keyframe.frame.slice();
}

function editKeyframe(keyframeIndex, durationLabel, imgElement, facsLabel) {
    stopAllAnimations();
    const newDuration = parseInt(document.getElementById('durationInput').value, 10);
    const mesh = getMesh();
    const newMorphInfluences = mesh.morphTargetInfluences.slice();

    const canvas = document.querySelector('canvas');
    const newDataURL = canvas.toDataURL('image/png');

    const keyframe = animation.keyframes[keyframeIndex];
    keyframe.duration = newDuration;
    keyframe.frame = newMorphInfluences;
    keyframe.thumbnail = newDataURL;

    facsLabel.textContent = document.getElementById('sliderPositions').value;


    durationLabel.textContent = `${newDuration} ms`;
    imgElement.src = newDataURL;
}

function removeKeyframe(keyframeIndex, container) {
    stopAllAnimations();
    animation.keyframes.splice(keyframeIndex, 1);
    container.remove();
}

function createCombinedActionUnitSliders() {
    const combinedContainer = document.querySelector('.combined-sliders-container');
    combinedContainer.innerHTML = '';

    combinedActionUnits.forEach((combinedUnit) => {
        const combinedDiv = document.createElement('div');
        combinedDiv.classList.add('combined-action-unit');

        const label = document.createElement('label');
        label.textContent = combinedUnit.name;
        combinedDiv.appendChild(label);

        // TODO combinded AU should be adjustable
        // percentage scale here
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = 0;
        slider.max = 100;
        slider.value = 0;

        // slider value
        const valueDisplay = document.createElement('span');
        valueDisplay.textContent = `: ${slider.value}%`;
        combinedDiv.appendChild(valueDisplay);

        slider.addEventListener('input', () => {
            const value = parseInt(slider.value, 10);
            valueDisplay.textContent = `: ${value}%`;
            const normalizedValue = value / 100;
            // Adjust all units 
            combinedUnit.actionUnits.forEach((actionUnitName) => {
                const actionUnit = actionUnits.find(au => au.name === actionUnitName);
                if (actionUnit) {
                    actionUnit.blendshapes.forEach((blendshape) => {
                        Object.entries(blendshape).forEach(([key, values]) => {
                            const mesh = getMesh();
                            const targetIndex = mesh.morphTargetDictionary[key];
                            // linear influence for simplicity
                            mesh.morphTargetInfluences[targetIndex] = values[values.length - 1] * normalizedValue;
                        });
                    });
                }
            });
        });

        combinedDiv.appendChild(slider);
        combinedContainer.appendChild(combinedDiv);
    });
}

function resetSliders() {

    createSlidersForActionUnits();
    createCombinedActionUnitSliders();
    resetFace();
    document.getElementById('sliderPositions').value = "";
}

function loadAndEditStrengths(blendshape, actionUnit, adjustmentDiv, auDiv) {
    adjustmentDiv.innerHTML = '';
    const strengths = getStrengths(blendshape);

    strengths.forEach((strength, index) => {
        const strengthInput = document.createElement('input');
        strengthInput.type = 'number';
        strengthInput.step = '0.05';
        // max value 1 is enough for most BS, higher values by keyboard possible
        strengthInput.min = '0';
        strengthInput.max = '1';
        strengthInput.value = strength;
        strengthInput.onchange = (e) => strengths[index] = parseFloat(e.target.value);
        adjustmentDiv.appendChild(strengthInput);
    });

    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'Confirm';
    // remove the adjustment interface on click
    confirmButton.onclick = () => {
        updateActionUnitStrengths(blendshape, actionUnit, strengths);
        refreshSliderAndMesh(actionUnit, auDiv);
        auDiv.removeChild(adjustmentDiv);
    };

    adjustmentDiv.appendChild(confirmButton);
}

function updateActionUnitStrengths(blendshape, actionUnit, newStrengths) {
    actionUnit.blendshapes.forEach((bs) => {
        if (bs.hasOwnProperty(blendshape)) {
            bs[blendshape] = newStrengths;
        }
    });
}

function refreshSliderAndMesh(actionUnit, auDiv) {
    const mesh = getMesh();
    const slider = auDiv.querySelector('input[type="range"]');
    const valueLabel = auDiv.querySelector('span');

    // Adjust for the zero-influence position
    const sliderValue = parseInt(slider.value);
    const blendshapeIndex = sliderValue - 1;

    // arrays must have equal length
    slider.max = actionUnit.blendshapes.length > 0 ? actionUnit.blendshapes[0][Object.keys(actionUnit.blendshapes[0])[0]].length : 0;

    // Update influences
    actionUnit.blendshapes.forEach((blendshape) => {
        Object.entries(blendshape).forEach(([key, values]) => {
            const targetIndex = mesh.morphTargetDictionary[key];
            mesh.morphTargetInfluences[targetIndex] = blendshapeIndex >= 0 ? values[blendshapeIndex] : 0;
        });
    });

    if (valueLabel) {
        const labels = ['0', 'A', 'B', 'C', 'D', 'E'];
        valueLabel.textContent = labels[sliderValue];
    }
}

function getBlendshapes() {
    const blendshapeSet = new Set();

    actionUnits.forEach((au) => {
        au.blendshapes.forEach((blendshape) => {
            Object.keys(blendshape).forEach((key) => {
                blendshapeSet.add(key);
            });
        });
    });

    return Array.from(blendshapeSet);
}

function getStrengths(blendshapeName) {
    for (let au of actionUnits) {
        for (let blendshape of au.blendshapes) {
            if (blendshape.hasOwnProperty(blendshapeName)) {
                return blendshape[blendshapeName];
            }
        }
    }

    console.warn(`No strengths found for blendshape: ${blendshapeName}`);
    return [];
}

function getBlendshapesForActionUnit(actionUnit) {
    const blendshapeSet = new Set();

    actionUnit.blendshapes.forEach((blendshape) => {
        Object.keys(blendshape).forEach((key) => {
            blendshapeSet.add(key);
        });
    });

    return Array.from(blendshapeSet);
}

function createSlidersForActionUnits() {
    const mesh = getMesh();
    const auContainer = document.querySelector('.au-sliders-container');
    auContainer.innerHTML = '';

    // labels from the FACS scoring
    const labels = ['0', 'A', 'B', 'C', 'D', 'E'];

    actionUnits.forEach((au, _) => {
        const auDiv = document.createElement('div');
        auDiv.classList.add('action-unit');

        const label = document.createElement('label');
        label.textContent = au.name;
        label.className = 'au-label';
        auDiv.appendChild(label);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = 0;
        slider.max = 5;
        slider.value = 0;
        slider.dataset.auNumber = au.name.match(/\d+/)[0];
        slider.className = `au-slider`;

        console.log(au.name);
        console.log("saved:" + slider.dataset.auNumber);

        // update the morph target influences from slider values
        slider.addEventListener('input', (e) => {
            const sliderValue = parseInt(e.target.value);
            // leftmost position is immutable 0
            const blendshapeIndex = sliderValue - 1;

            au.blendshapes.forEach((blendshape) => {
                Object.entries(blendshape).forEach(([key, values]) => {
                    const targetIndex = mesh.morphTargetDictionary[key];
                    mesh.morphTargetInfluences[targetIndex] = blendshapeIndex >= 0 ? values[blendshapeIndex] : 0;
                });
            });

            // update lavels
            const valueLabel = auDiv.querySelector('span');
            if (valueLabel) {
                valueLabel.textContent = labels[sliderValue];
            }

            updateAUTextField();
        });

        auDiv.appendChild(slider);

        const valueLabel = document.createElement('span');
        valueLabel.textContent = labels[0];
        auDiv.appendChild(valueLabel);

        const adjustButton = document.createElement('button');
        adjustButton.textContent = 'Adjust';
        adjustButton.onclick = () => createAdjustmentInterface(au, auDiv);
        auDiv.appendChild(adjustButton);

        auContainer.appendChild(auDiv);
    });
}

function updateAUTextField() {
    const sliders = document.querySelectorAll('.au-slider');
    const output = [];

    sliders.forEach((slider) => {
        console.log(slider.dataset.auNumber);
        const value = parseInt(slider.value);
        if (value > 0) {
            const auNumber = slider.dataset.auNumber;
            const position = ['A', 'B', 'C', 'D', 'E'][value - 1];
            output.push(`${auNumber}${position}`);
        }
    });

    const outputString = output.join('+');
    document.getElementById('sliderPositions').value = outputString;
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
    const facsCode = document.getElementById('sliderPositions').value;
    link.download = facsCode + '_cropped_image.png';
    link.href = dataURL;
    link.click();
}

function saveAUConfig() {
    const dataToSave = {
        action_units: actionUnits,
        combinedActionUnits: combinedActionUnits
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToSave, null, 4));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "action_units_config.json");
    // Firefox issue
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

async function initialyLoadAUConfig(path = 'default.json') {

    try {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        actionUnits = data.action_units;
        combinedActionUnits = data.combinedActionUnits;
        createSlidersForActionUnits();
        console.log(actionUnits);
    } catch (error) {
        alert('Could not load the JSON file, AU\'s have to be added manualy.');
    }
}

function createAdjustmentInterface(actionUnit, auDiv) {
    let existingDiv = document.getElementById('adjustmentDiv');

    // toggling of the adjustment interface
    if (existingDiv && auDiv.contains(existingDiv)) {
        auDiv.removeChild(existingDiv);
        return;
    }
    if (existingDiv) {
        existingDiv.parentNode.removeChild(existingDiv);
    }
    let adjustmentDiv = document.createElement('div');
    adjustmentDiv.id = 'adjustmentDiv';
    adjustmentDiv.style.display = 'block';
    auDiv.appendChild(adjustmentDiv);

    populateAdjustmentDiv(adjustmentDiv, actionUnit, auDiv);
}

function populateAdjustmentDiv(adjustmentDiv, actionUnit, auDiv) {
    adjustmentDiv.innerHTML = '';
    const blendshapeList = getBlendshapesForActionUnit(actionUnit);
    blendshapeList.forEach((blendshape) => {
        const blendshapeButton = document.createElement('button');
        blendshapeButton.textContent = blendshape;
        blendshapeButton.onclick = () => loadAndEditStrengths(blendshape, actionUnit, adjustmentDiv, auDiv);
        adjustmentDiv.appendChild(blendshapeButton);
    });
}

function createAnimation() {
    const influences = animation.keyframes.map(keyframe => keyframe.frame);
    // ignore the first value cause there is no transition
    const durations = animation.keyframes.map(keyframe => keyframe.duration).slice(1);
    animationClip = createMorphAnimationClip(influences, durations);
}


function loadAUConfig() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';

    fileInput.onchange = e => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const content = e.target.result;
                    const data = JSON.parse(content);
                    if (data.action_units && data.combinedActionUnits) {
                        actionUnits = data.action_units;
                        combinedActionUnits = data.combinedActionUnits;
                        createSlidersForActionUnits();
                        createCombinedActionUnitSliders();
                    } else {
                        alert('JSON format is incorrect');
                    }
                } catch (error) {
                    alert('Could not load the JSON file, AU\'s have to be added manualy.')
                }
            };
            reader.readAsText(file);
        }
    };

    fileInput.click();

}

/////////////////
// lil GUI
///////////////

function createGUIForModel(model) {
    const mesh = getMesh();
    const gui = new GUI();
    gui.close();

    // influences
    for (const [key, value] of Object.entries(mesh.morphTargetDictionary)) {
        gui.add(mesh.morphTargetInfluences, value, 0, 1, 0.01)
            .name(key.replace('blendShape1.', ''))
            .listen(mesh.morphTargetInfluences);
    }

    // toggle wireframe
    gui.add({
        toggleWireframe: function () {
            model.material.wireframe = !model.material.wireframe;
        }
    }, 'toggleWireframe').name("Toggle Wireframe");

    // change background
    gui.addColor(backgroundColor, 'color').name('Background Color').onChange((value) => {
        scene.background = new THREE.Color(value);
    });

    return gui;
}


///////////////////////
// Animation loop
////////////////////

function animate() {
    requestAnimationFrame(() => animate());
    const delta = clock.getDelta();
    if (mixer) {
        mixer.update(delta);
    }
    renderer.render(scene, camera);

}

///////////////////
// Animation Clip
/////////////////

// build the clip from the global mesh name and an array of influences and timevalues
function createMorphAnimationClip(influences, durations) {

    if (!influences || !durations || influences.length !== durations.length + 1) {
        console.error('Invalid influences or durations array.');
        return null;
    }

    let tracks = [];

    for (let i = 0; i < 52; i++) { //  52 morph targets are immutable
        let times = [];
        let values = [];

        let currentTime = 0;
        times.push(currentTime);
        values.push(influences[0][i]);

        for (let j = 0; j < durations.length; j++) {
            currentTime += durations[j] / 1000;
            times.push(currentTime);
            values.push(influences[j + 1][i]);
        }

        let trackName = meshName + '.morphTargetInfluences[' + i + ']';
        //TODO check for interpolation modes lsater
        let track = new THREE.NumberKeyframeTrack(trackName, times, values, THREE.InterpolateSmooth);
        tracks.push(track);
    }

    let animationClip = new THREE.AnimationClip('morphAnimation', -1, tracks);
    return animationClip;
}

function playAnimationClip(clip) {

    if (!mixer || !(clip instanceof THREE.AnimationClip)) {
        alert('No mixer is defined or clip is not valid');
        return;
    }

    const action = mixer.clipAction(clip);
    if (isRepeatChecked()) {
        action.setLoop(THREE.LoopRepeat);
    } else {
        action.setLoop(THREE.LoopOnce);
    }

    if (isCaptureChecked() && !isRepeatChecked()) {
        recordCanvas(renderer.domElement, mixer);
    }

    action.play();

}

function toogleGUI() {
    if (gui._hidden) {
        gui.show();
    } else {
        gui.hide();
    }
}


function startAnimation() {
    if (!animationClip) {
        alert('No animation clip is defined.\nCreate an Animation first.');
        return;
    }
    stopAllAnimations();
    playAnimationClip(animationClip);
}

function resetAnimation() {
    animation = [];
    document.getElementById('imageContainer').innerHTML = '';

    stopAllAnimations();

    document.querySelectorAll('.slider').forEach(slider => {
        slider.value = 0;
    });

    resetFace();
}

function stopAllAnimations() {
    if (mixer) {
        // Gets all actions from the mixer internal mixer cache
        const allActions = mixer._actions;
        allActions.forEach((action) => {
            action.stop();
        });
    }
}

function resetFace() {

    const mesh = getMesh();

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



