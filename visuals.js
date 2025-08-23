import * as THREE from 'three';

let axesGroup = null;
let gridHelper = null;

function createLabeledAxes(size = 10) {
    const group = new THREE.Group();
    const lineMat = (color) => new THREE.LineBasicMaterial({ color });
    const lineGeo = (v1, v2) => new THREE.BufferGeometry().setFromPoints([v1, v2]);

    group.add(new THREE.Line(lineGeo(new THREE.Vector3(0,0,0), new THREE.Vector3(size,0,0)), lineMat(0xff0000)));
    group.add(new THREE.Line(lineGeo(new THREE.Vector3(0,0,0), new THREE.Vector3(0,size,0)), lineMat(0x00ff00)));
    group.add(new THREE.Line(lineGeo(new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,size)), lineMat(0x0000ff)));

    function makeLabel(text, color, position) {
        const canvas = document.createElement('canvas');
        const size = 128;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        context.font = `Bold ${size * 0.5}px Arial`;
        context.fillStyle = color;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, size / 2, size / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(1.5, 1.5, 1.5);
        sprite.position.copy(position);
        return sprite;
    }

    group.add(makeLabel('X', '#ff0000', new THREE.Vector3(size + 0.7, 0, 0)));
    group.add(makeLabel('Y', '#00ff00', new THREE.Vector3(0, size + 0.7, 0)));
    group.add(makeLabel('Z', '#0000ff', new THREE.Vector3(0, 0, size + 0.7)));

    return group;
}

export function setAxesVisibility(scene, visible) {
    if (visible) {
        if (!axesGroup) {
            axesGroup = createLabeledAxes(10);
            scene.add(axesGroup);
        }
        axesGroup.visible = true;
    } else if (axesGroup) {
        axesGroup.visible = false;
    }
}

export function setGridVisibility(scene, visible) {
    if (visible) {
        if (!gridHelper) {
            gridHelper = new THREE.GridHelper(50, 50);
            scene.add(gridHelper);
        }
        gridHelper.visible = true;
    } else if (gridHelper) {
        gridHelper.visible = false;
    }
}
