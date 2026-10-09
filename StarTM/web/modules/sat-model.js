// 卫星模型：1400×1200×600 mm 箱体 + ±Y 双太阳翼 + −Z 对地发光面（方案 4.1）
// 尺寸为 third-person 场景单位（地球半径 50），与原 0.5 半径球体观感相当
import * as THREE from 'three';

export function buildSatelliteMesh(bodyMaterial) {
    const group = new THREE.Group();
    // 组合模型没有 .material，而视角/插值代码按单网格着色：把本体材质挂到组上兜住这些路径
    group.material = bodyMaterial;

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.86, 0.43), bodyMaterial);
    group.add(body);
    group.userData.body = body;

    const wingGeo = new THREE.BoxGeometry(0.05, 1.4, 0.55);
    const wingMat = new THREE.MeshPhongMaterial({ color: 0x1a3a6b, emissive: 0x061020 });
    const wingTop = new THREE.Mesh(wingGeo, wingMat);
    wingTop.position.y = 1.12;
    group.add(wingTop);
    const wingBottom = new THREE.Mesh(wingGeo, wingMat);
    wingBottom.position.y = -1.12;
    group.add(wingBottom);

    const faceMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, side: THREE.DoubleSide });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.72), faceMat);
    face.position.z = -0.22;
    face.rotation.y = Math.PI;
    group.add(face);

    return group;
}

/**
 * 文字精灵标签（星号、站名）。父级缩放会作用到标签上，按所在组的尺度给 scale。
 */
export function buildTextSprite(text, { scale = 4, color = 'rgba(196, 226, 255, 0.92)' } = {}) {
    const font = '42px "Microsoft YaHei", "Segoe UI", sans-serif';
    const measure = document.createElement('canvas').getContext('2d');
    measure.font = font;
    const W = Math.ceil(measure.measureText(text).width) + 12;

    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = 64;
    const g = cv.getContext('2d');
    g.font = font;
    g.fillStyle = color;
    g.textBaseline = 'middle';
    g.fillText(text, 6, 34);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(cv),
        transparent: true,
        depthWrite: false,
    }));
    sprite.scale.set(scale, scale * cv.height / W, 1);
    return sprite;
}

/**
 * 星号标签：挂在卫星组本地 +Y（太阳翼轴／轨道面法向）一侧，姿态变化时随轨道法向转动，不穿进本体。
 * offset 按所在视角的模型缩放给值，避免文字压在本体上。
 */
export function buildSatLabel(text, { scale = 4, offset = 2.1 } = {}) {
    const sprite = buildTextSprite(text, { scale });
    sprite.position.set(0, offset, 0);
    return sprite;
}
