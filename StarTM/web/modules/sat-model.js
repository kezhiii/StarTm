// 卫星模型：1400×1200×600 mm 箱体 + ±Y 双太阳翼 + −Z 对地发光面（方案 4.1）
// 组内尺寸取 1 量级，实际显示大小由 applyScreenScale 按相机距离给（第三视角）或按视角缩放给（主星视角）
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
 * 让卫星在屏幕上保持大致恒定的大小：按相机距离换算组缩放。
 * 0.022 对应视高约 3.5%（透视 75°），远近差别不至于看不见或糊成一片。
 */
export function applyScreenScale(meshes, camera, { k = 0.022, min = 1.2, max = 18 } = {}) {
    if (!camera) return;
    for (const m of meshes || []) {
        if (!m || !m.visible) continue;
        const d = camera.position.distanceTo(m.position);
        m.scale.setScalar(Math.max(min, Math.min(max, d * k)));
    }
}

/** 选中框：单位半径环，摆放时按目标的屏幕缩放放大 */
export function buildSelectionRing() {
    return new THREE.Mesh(
        new THREE.RingGeometry(1, 1.12, 48),
        new THREE.MeshBasicMaterial({
            color: 0x7fe3d6, transparent: true, opacity: 0.95,
            side: THREE.DoubleSide, depthWrite: false,
        })
    );
}

export function placeSelectionRing(ring, mesh, camera) {
    if (!ring) return;
    const on = !!mesh && mesh.visible;
    ring.visible = on;
    if (!on) return;
    ring.position.copy(mesh.position);
    ring.quaternion.copy(camera.quaternion);
    ring.scale.setScalar(mesh.scale.x * 3.4);
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
