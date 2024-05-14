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
import { Schema } from './jema.js/schema.js';

let blendshapes = [];
let blendshapeDictionary = [];
let animation = { keyframes: [] };
let expressions = {
    expression: []
};
let actionUnits = [];

export function setMeshProperties(morphTargetInfluences, morphTargetDictionary) {
    blendshapes = morphTargetInfluences;
    blendshapeDictionary = morphTargetDictionary;

}

export function getActionUnits() {
    return actionUnits;
}

export function getExpressions() {
    return expressions;
}

// TODO undefined if blendshape not exists
export function getBlendshapesForAU(actionUnitName) {

    let number = actionUnitName.match(/\d+/);

    blendshapes = []
    let au = actionUnits.find(actionUnits => actionUnits.number == number);

    if (au) {
        au.blendshapes.forEach((bs) => {
            if (bs) {
                blendshapes.push(bs);
            }
        })
    }
    return blendshapes;
}

export function getActionUnitNames() {
    const names = [];

    actionUnits.forEach((au) => {
        names.push(au.prefix + au.number);
    })

    return names;

}

export function addExpression(identifier, actionUnits) {
    const expression = {
        identifier,
        actionUnits
    };
    expressions.push(expression);

     //TODO validation of the expression entry
    return true;
}

export function getBlendshapeNames() {
    return Object.keys(blendshapeDictionary)
}

export function addActionUnit(prefix, number, description, blendshapes) {
    let actionUnit = {
        prefix,
        number,
        description,
    };

    let strengthValues = [0.2, 0.4, 0.6, 0.8, 1]; // Default strength values
    let blendshapesDict = {};

    // Iterate over each blendshape name and assign the strength values array
    blendshapes.forEach(blendshape => {
        blendshapesDict[blendshape] = [...strengthValues];
    });

    // Include the blendshapes dictionary in the action unit object
    actionUnit.blendshapes = [blendshapesDict];
    actionUnits.push(actionUnit);
    console.log("actionunits in controller:" + actionUnits)

    //TODO validation of the action unit entry
    
    return true;
}

// Keyframes

export async function addKeyframe(duration, influences, thumbnail) {

    const position = animation.keyframes.length;
    if (position == 0) {
        duration = 0;
    }
    const keyframe =
    {
        position,
        duration,
        influences,
        thumbnail
    }
    if (keyframeSchema.validate(keyframe)) {
        animation.keyframes.push(keyframe)
        console.log("Keyframes is valid, frames after insertion:\n" + animation.keyframes.length);
        return true;

    } else {
        const errors = keyframeSchema.errors(keyframe)
        for (const error of errors) {
            console.log(error.message)
        }
    }
    return false;

}

export function removeKeyframe(position) {
    if (position >= 0 && position < animation.keyframes.length) {
        animation.keyframes.splice(position, 1);
        // Update the position property of the remaining keyframes
        animation.keyframes.forEach((keyframe, index) => {
            keyframe.position = index;
        });
        console.log(`Keyframe at position ${position} removed successfully.`);
    } else {
        console.error("No keyframe found at the specified position.");
    }
    for (let i = 0; i < animation.keyframes.length; i++) {
        animation.keyframes[i].position = i;
    }
}

//TODO validation of resulting keyframe
export function changeKeyframe(position, newDuration = null, newInfluences = null, newThumbnail = null) {
    let keyframe = animation.keyframes[position];
    if (keyframe) {
        if (newDuration !== null) keyframe.duration = newDuration;
        if (newInfluences !== null) keyframe.influences = newInfluences;
        if (newThumbnail !== null) keyframe.thumbnail = newThumbnail;
        console.log(`Keyframe at position ${position} updated successfully.`);
    } else {
        console.error("No keyframe found at the specified position.");
    }

}

export function getKeyframes() {
    return animation.keyframes;
}

export function deleteKeyframes() {
    animation.keyframes = [];
}

// Animation Clip

export function createMorphAnimationClip() {

    const influences = animation.keyframes.map(keyframe => keyframe.influences);
    const durations = animation.keyframes.map(keyframe => keyframe.duration);

    if (!influences || !durations || influences.length !== durations.length) {
        console.error('Invalid influences or durations array');
        return null;
    }

    function isISIFrame(influences) {
        return influences.every(val => val == 1);
    }

    let tracks = [];
    let visibilityValues = [];
    let times = [];
    let currentTime = 0;

    for (const duration of durations) {
        currentTime += duration;
        times.push(currentTime / 1000);
    }

    for (const frame of influences) {
        if (isISIFrame(frame)) {
            visibilityValues.push(false);
        } else {
            visibilityValues.push(true);
        }
    }

    let newInfluences = [];

    for (let keyframe = 0; keyframe < influences.length; keyframe++) {
        if (isISIFrame(influences[keyframe])) {
            if (keyframe == 0) {
                newInfluences.push(influences[keyframe + 1].slice());
            } else {
                newInfluences.push(influences[keyframe - 1].slice());
            }
        } else {
            newInfluences.push(influences[keyframe].slice());
        }
    }

    for (let influence = 0; influence < influences[0].length; influence++) {

        let values = [];
        for (let frame = 0; frame < influences.length; frame++) {
            values.push(newInfluences[frame][influence])
        }

        tracks.push(new THREE.NumberKeyframeTrack(`mesh_2.morphTargetInfluences[${influence}]`, times, values));

    }

    let newVisibilityValues = [true];
    newVisibilityValues.push(visibilityValues.slice(-2));

    // Create visibility tracks just if there are changes
    if (visibilityValues.some(val => val !== true)) {
        tracks.push(new THREE.BooleanKeyframeTrack('mesh_0.visible', times, visibilityValues));
        tracks.push(new THREE.BooleanKeyframeTrack('mesh_1.visible', times, visibilityValues));
        tracks.push(new THREE.BooleanKeyframeTrack('mesh_2.visible', times, visibilityValues));
        tracks.push(new THREE.BooleanKeyframeTrack('mesh_3.visible', times, visibilityValues));
    }

    return new THREE.AnimationClip('CustomAnimation', -1, tracks);
}

//Save and Load

export function saveAUConfig() {
    const dataToSave = {
        actionUnits: actionUnits,
        expressions: expressions
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

export async function initialyLoadAUConfig(path = 'defaultConfig.json') {
    try {
        const response = await fetch(path);
        if (!response.ok) {
            console.error("Configuration could not be loaded! Status: " + response.status)
        }
        const data = await response.json();
        console.log(data)
        if (configSchema.validate(data)) {
            actionUnits = data.actionUnits;
            expressions = data.expressions;
            console.log("Schema validation ok")
            return true;
        } else {
            const errors = configSchema.errors();
            for (const error of errors) {
                console.error(error);
            }
            alert("Error in Config File Structure! Make sure there is a valid defaultConfig.json config file in the root folder")
            return confirm("Schema seems to be unvalid load it anyway?");
        }

    } catch (error) {
        alert('Could not load the JSON file, AU\'s have to be added manualy.');
    }
    return false;
}

export async function loadAUConfig() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';

    fileInput.onchange = e => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = e.target.result;
                    if (!content) {
                        alert('No content to parse');
                        return false;
                    }
                    const data = JSON.parse(content);
                    console.log(data)
                    if (configSchema.validate(data) && data.actionUnits) {
                        actionUnits = data.actionUnits;
                        expressions = data.expressions;
                        return true;

                    } else {
                        alert('JSON format is incorrect');
                        const errors = configSchema.errors(data)
                        for (const error of errors) {
                            console.error(error);
                        }
                    }
                } catch (error) {
                    alert('Could not load the JSON file, AU\'s have to be added manually.');
                    console.error('Error parsing JSON:', error, 'Content:', e.target.result);
                }
            };
            reader.onerror = (e) => {
                alert('Error reading file');
                console.error('FileReader error:', e);
            };
            reader.readAsText(file);
        }
    };
    fileInput.click();
}

let keyframeSchema = new Schema({
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
        "position": {
            "type": "number",
            "minimum": 0,
            "description": "The position of the keyframe, must be a non-negative number."
        },
        "duration": {
            "type": "number",
            "minimum": 0,
            "maximum": 100000,
            "description": "The duration of the keyframe, must be a non-negative number less than 100000."
        },
        "influences": {
            "type": "array",
            "items": {
                "type": "number"
            },
            "minItems": 52,
            "maxItems": 52,
            "description": "An array containing exactly 52 numerical influence values."
        },
        "thumbnail": {
            "type": "string",
            "contentEncoding": "base64",
            "description": "A base64 encoded blob representing the thumbnail image."
        }
    },
    "required": ["position", "duration", "influences", "thumbnail"]
});



const configSchema = new Schema({
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
        "actionUnits": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "prefix": {
                        "type": "string",
                        "maxLength": 2,
                        "minLength": 0
                    },
                    "number": {
                        "type": "string",
                        "pattern": "^[0-9]{1,3}$"
                    },
                    "description": {
                        "type": "string",
                        "pattern": "^[^0-9]*$",
                        "maxLength": 40
                    },
                    "blendshapes": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": {
                                "type": "array",
                                "items": {
                                    "type": "number",
                                    "minimum": -2,
                                    "maximum": 2
                                },
                                "minItems": 5,
                                "maxItems": 5
                            }
                        },
                        "minItems": 1,
                        "maxItems": 52
                    }
                },
                "required": ["number", "blendshapes"]
            },
            "minItems": 1
        },
        "expressions": {
            "type": "array",
            "properties": {
                "identifier": {
                    "type": "string",
                    "maxLength": 40
                },
                "actionUnits": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 5
                    },
                    "minItems": 1
                }
            },
            "required": ["identifier", "actionUnits"]
        }
    },
    "required": ["actionUnits"]
}
);


